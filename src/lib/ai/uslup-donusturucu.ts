/**
 * Hasta tipi üslup dönüştürücü — klinik gerçeği değiştirmeden yalnızca
 * konuşma TARZINI hasta tipine göre değiştirir.
 *
 * - Klinik gerçek cevap (`hastaYanitlari` → `hastaDilineCevir`) sabittir.
 * - Dönüşüm (vaka, tip, soru) üçlüsüne göre tembelce üretilir ve `cevap_cache`
 *   tablosunda saklanır; sonraki istekler milisaniyede cache'ten döner.
 * - Nötr tip ("sakin") ve yapılandırılmamış AI ortamında taban cevap döner.
 * - Hata durumunda güvenli düşüş: taban cevap.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { cevapCache } from "@/lib/auth/schema";
import type { HastaTipi } from "@/lib/admin/types";
import { geminiChat, geminiYapilandirilmisMi } from "./gemini";
import { hastaDilineCevir } from "./hasta-dili";

/** Üslup dönüşümü gerektirmeyen nötr hasta tipi kimliği. */
export const NOTR_HASTA_TIPI = "sakin";

export interface UslupBaglam {
  yas?: string;
  cinsiyet?: string;
  anaSikayet?: string;
}

export interface UslupDonusturArgs {
  /** Kararlı vaka şablonu kimliği (AdminVaka.id). */
  vakaId: string;
  tip: HastaTipi | null | undefined;
  /** Soru chip aksiyon anahtarı (örn. VITAL_TANSIYON). */
  actionKey: string;
  /** Taban (klinik, günlük dile çevrilmiş) cevap. */
  baseCevap: string;
  baglam?: UslupBaglam;
}

function tipKisilikMetni(tip: HastaTipi): string {
  const satirlar: string[] = [];
  if (tip.konusmaKurallari) {
    satirlar.push("Konuşma kuralları:");
    satirlar.push(tip.konusmaKurallari);
  }
  if (tip.konusmaOrnekleri) {
    satirlar.push("Örnek cevaplar:");
    satirlar.push(`- Pozitif: "${tip.konusmaOrnekleri.pozitif}"`);
    satirlar.push(`- Negatif: "${tip.konusmaOrnekleri.negatif}"`);
    satirlar.push(`- Belirsiz: "${tip.konusmaOrnekleri.belirsiz}"`);
  }
  return satirlar.join("\n");
}

async function aiIleDonustur(tip: HastaTipi, baseCevap: string, baglam?: UslupBaglam): Promise<string> {
  const baglamSatirlari = [
    baglam?.yas ? `- Yaş: ${baglam.yas}` : null,
    baglam?.cinsiyet ? `- Cinsiyet: ${baglam.cinsiyet}` : null,
    baglam?.anaSikayet ? `- Şikayet: ${baglam.anaSikayet}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Sen bir hasta simülasyonunda hastanın konuşma TARZINI belirleyen bir dönüştürücüsün.

HASTA TİPİ: ${tip.ad}
${tipKisilikMetni(tip)}

MUTLAK KURALLAR:
1. Klinik bilgiyi KESİNLİKLE değiştirme (değerler, sayılar, süreler, ilaç adları, semptomlar aynı kalmalı).
2. Yalnızca söyleme TARZINI değiştir; yeni klinik bilgi ekleme.
3. Hasta bilmediği bir şeyi biliyormuş gibi söylemesin.
4. Tıbbi terimleri gündelik Türkçeyle söyle.
5. Cevap uzunluğu kişiliğe uygun olsun (ketum = kısa, konuşkan/endişeli = uzun).
6. En fazla üç cümle yaz; kişilik ne kadar konuşkan olursa olsun bu sınırı aşma.
7. Aynı duygu veya endişe kalıbını her cevapta tekrar etme; her cevap sorulan soruya odaklansın.
${baglamSatirlari ? `\nHASTA BAĞLAMI:\n${baglamSatirlari}` : ""}

Aşağıdaki klinik cevabı yukarıdaki hasta kişiliğine göre yalnızca üslup olarak dönüştür. Yalnızca hasta cevabını yaz; tırnak, etiket veya açıklama ekleme.

ORİJİNAL KLİNİK CEVAP:
"${baseCevap}"`;

  const yanit = await geminiChat({
    messages: [
      { role: "system", content: "Sen bir hasta simülasyonunda yalnızca konuşma üslubunu dönüştüren bir sistemsin." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    // Konuşkan/endişeli kişilikler uzun cevap üretir; düşük limit cümle ortasından
    // kesmeye yol açıyordu. "length" finish_reason'ında kesik yanıt kabul edilmez.
    maxTokens: 2000,
  });

  const donusmus = (yanit.content || "").trim();
  if (!donusmus) return baseCevap;
  if (yanit.finishReason === "length") {
    // Kesik cevap: cache'e yazılmaz, eksiksiz klinik taban cevap döner.
    return baseCevap;
  }
  return hastaDilineCevir(donusmus);
}

/** Klinik cevabı hasta tipine göre dönüştürür (tembel + önbellekli). */
export async function uslupDonustur(args: UslupDonusturArgs): Promise<string> {
  const { vakaId, tip, actionKey, baseCevap } = args;
  if (!tip || tip.id === NOTR_HASTA_TIPI || !geminiYapilandirilmisMi()) {
    return baseCevap;
  }

  const db = getDb();
  const [satir] = await db
    .select()
    .from(cevapCache)
    .where(and(eq(cevapCache.vakaId, vakaId), eq(cevapCache.hastaTipiId, tip.id), eq(cevapCache.actionKey, actionKey)))
    .limit(1);

  // Taban cevap değiştiyse önbellek geçersizdir; yeniden dönüştürülür.
  if (satir && satir.orijinalCevap === baseCevap) return satir.donusturulmusCevap;

  let donusmus: string;
  try {
    donusmus = await aiIleDonustur(tip, baseCevap, args.baglam);
  } catch {
    // Geçici AI hatası: önbelleğe yazma; taban cevabı döndür ki sonraki istek yeniden denesin.
    return baseCevap;
  }

  await db
    .insert(cevapCache)
    .values({ vakaId, hastaTipiId: tip.id, actionKey, orijinalCevap: baseCevap, donusturulmusCevap: donusmus })
    .onConflictDoUpdate({
      target: [cevapCache.vakaId, cevapCache.hastaTipiId, cevapCache.actionKey],
      set: { orijinalCevap: baseCevap, donusturulmusCevap: donusmus },
    });

  return donusmus;
}
