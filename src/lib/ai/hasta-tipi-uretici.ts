/**
 * Hasta tipi örnek cevap üretici — HastaTipi profilinden birkaç standart
 * soruya verilecek örnek hasta cevaplarını üretir (AI penceresi).
 */

import { HastaTipi } from "@/lib/admin/types";
import { geminiChat, geminiYapilandirilmisMi, jsonCikar } from "./gemini";
import { KISILIK_TIPLERI, KisilikTipiKey } from "./kisilik-tipleri";
import { hastaDilineCevir } from "./hasta-dili";

/** Hasta tipi AI penceresi için sabit standart soru listesi. */
export const ORNEK_SORULAR: Array<{ key: string; soru: string }> = [
  { key: "ILAC_OYKUSU", soru: "Kullandığınız ilaçlar neler?" },
  { key: "ALERJI", soru: "Bilinen alerjiniz var mı?" },
  { key: "SIGARA", soru: "Sigara / alkol kullanıyor musunuz?" },
  { key: "AILE_OYKUSU", soru: "Ailenizde önemli bir hastalık var mı?" },
  { key: "GENEL_DURUM", soru: "Kendinizi genel olarak nasıl hissediyorsunuz?" },
];

export interface HastaTipiUretimSonucu {
  basarili: boolean;
  cevaplar: Record<string, string>;
  rapor: { toplamSoru: number; cevaplananSoru: number; uyarilar: string[] };
  debug: { profil: string; prompt: string; hamYanit: string };
}

function profilOlustur(tip: HastaTipi): string {
  const satirlar: string[] = [];
  satirlar.push(`Hasta tipi: ${tip.ad}`);
  satirlar.push(`Yaş aralığı: ${tip.yasAraligi?.[0] ?? "?"} - ${tip.yasAraligi?.[1] ?? "?"}`);
  const cinsiyet =
    tip.cinsiyetTercih === "E" ? "Erkek" : tip.cinsiyetTercih === "K" ? "Kadın" : "Belirtilmemiş";
  satirlar.push(`Cinsiyet: ${cinsiyet}`);
  if (tip.komorbiditeler?.length) {
    satirlar.push(`Komorbiditeler / hastalık öyküsü: ${tip.komorbiditeler.join(", ")}`);
  }
  if (tip.aciklama) satirlar.push(`Ek açıklama / örnekler: ${tip.aciklama}`);
  return satirlar.join("\n");
}

function promptOlustur(profil: string, kisilikKey?: KisilikTipiKey): string {
  const kisilik = kisilikKey ? KISILIK_TIPLERI[kisilikKey] : undefined;
  let p = `Sen bir tıp eğitimi simülasyon sistemi için hasta cevapları üreten bir uzmansın.
Bir "hasta tipi" profili veriyorum. Bu tip için birkaç standart soruya örnek hasta cevapları yaz.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HASTA TİPİ PROFİLİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profil}
`;

  if (kisilik) {
    p += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KİŞİLİK TİPİ: ${kisilik.ad}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${kisilik.aciklama}

Konuşma kuralları:
${kisilik.konusmaKurallari}

Örnek cevaplar:
- Pozitif: "${kisilik.ornekCevaplar.pozitif}"
- Negatif: "${kisilik.ornekCevaplar.negatif}"
- Belirsiz: "${kisilik.ornekCevaplar.belirsiz}"
`;
  } else {
    p += `
KİŞİLİK TİPİ: Doğal, sakin ve işbirlikçi bir hasta. Kısa, net cevaplar verir.
`;
  }

  p += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CEVAP KURALLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. HASTA GİBİ KONUŞ: Yalnızca gündelik Türkçe kullan. Tanı, test, işlem, kod, kısaltma veya yüksek tıbbi terim kullanma; tıbbi adı bilmediğini, doktorun günlük dille anlattığını söyle.
2. TUTARLI OL: Komorbiditelere ve yaş/cinsiyete uygun cevap ver.
3. Her cevap 1-3 cümle olsun.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aşağıdaki her soru için cevabı JSON formatında döndür. Anahtarları (key) AYNI yaz.

{
  "cevaplar": {
    "ILAC_OYKUSU": "Hasta cevabı",
    "ALERJI": "Hasta cevabı",
    ...
  }
}

SADECE JSON döndür, başka açıklama yazma. Hiçbir soruyu atlama.

SORULAR:
${ORNEK_SORULAR.map((s) => `- ${s.key}: "${s.soru}"`).join("\n")}`;

  return p;
}

/** Hasta tipinden örnek hasta cevaplarını üretir. */
export async function hastaTipiOrnekCevaplariniUret(tip: HastaTipi): Promise<HastaTipiUretimSonucu> {
  const profil = profilOlustur(tip);

  if (!geminiYapilandirilmisMi()) {
    return {
      basarili: false,
      cevaplar: {},
      rapor: {
        toplamSoru: ORNEK_SORULAR.length,
        cevaplananSoru: 0,
        uyarilar: ["GEMINI_API_KEY tanımlı değil."],
      },
      debug: { profil, prompt: "", hamYanit: "" },
    };
  }

  const prompt = promptOlustur(profil, tip.kisilikTipi);
  try {
    const yanit = await geminiChat({
      messages: [
        { role: "system", content: "Sen JSON formatında hasta cevapları üreten bir sistemsin." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });

    const hamYanit = yanit.content;
    const parsed = jsonCikar(hamYanit) as { cevaplar?: Record<string, unknown> } | null;
    const kaynak = parsed && typeof parsed.cevaplar === "object" ? parsed.cevaplar : (parsed as Record<string, unknown> | null);

    const cevaplar: Record<string, string> = {};
    if (kaynak) {
      for (const [k, v] of Object.entries(kaynak)) {
        if (typeof v === "string" && v.trim()) cevaplar[k] = hastaDilineCevir(v);
      }
    }

    const uyarilar: string[] = [];
    for (const s of ORNEK_SORULAR) {
      if (!cevaplar[s.key]) uyarilar.push(`${s.key}: cevap üretilemedi.`);
    }

    return {
      basarili: Object.keys(cevaplar).length > 0,
      cevaplar,
      rapor: {
        toplamSoru: ORNEK_SORULAR.length,
        cevaplananSoru: ORNEK_SORULAR.filter((s) => cevaplar[s.key]).length,
        uyarilar,
      },
      debug: { profil, prompt, hamYanit },
    };
  } catch (hata) {
    return {
      basarili: false,
      cevaplar: {},
      rapor: {
        toplamSoru: ORNEK_SORULAR.length,
        cevaplananSoru: 0,
        uyarilar: [hata instanceof Error ? hata.message : String(hata)],
      },
      debug: { profil, prompt, hamYanit: "" },
    };
  }
}
