/**
 * Synthea vaka zenginleştirme — Gemini ile OSCE sunum + hasta yanıtları.
 *
 * Objektif Synthea verisinden (tanı, lab, vital, ilaç) Türkçe ana şikayet,
 * HPI özet maddeleri ve beklenen sorulara hasta yanıtları üretir.
 *
 * GEMINI_API_KEY tanımlı değilse vaka değişmeden döner (basarili: false).
 */

import { CdmLabResult, TipAiCdmDocument } from "../../cdm/types";
import { geminiChat, geminiYapilandirilmisMi, jsonCikar } from "../../ai/gemini";

export interface SyntheaEnrichResult {
  basarili: boolean;
  vaka: TipAiCdmDocument;
  rapor: { uyarilar: string[] };
  debug: { profil: string; prompt: string; hamYanit: string };
}

function bosDegil(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function labSatiri(testKey: string, lab: CdmLabResult): string {
  const sonuc = lab.sonuc as Record<string, unknown> | string;
  const deger = typeof sonuc === "object" && sonuc ? String(sonuc.deger ?? "") : String(sonuc);
  const flag =
    lab.flag === "high" ? " (yüksek)" : lab.flag === "low" ? " (düşük)" : "";
  return `- ${lab.testAdi || testKey}: ${deger}${lab.birim ? ` ${lab.birim}` : ""}${flag}`;
}

/** CDM belge → AI için Türkçe metin profil. */
export function syntheaProfilOlustur(vaka: TipAiCdmDocument): string {
  const satirlar: string[] = [];
  const ya = vaka.patient.yasAraligi;

  satirlar.push(`Hastalık: ${vaka.meta.hastalikAdi}`);
  satirlar.push(`Yaş aralığı: ${ya?.[0] ?? "?"} - ${ya?.[1] ?? "?"}`);
  satirlar.push(
    `Cinsiyet: ${vaka.patient.cinsiyetTercih === "E" ? "Erkek" : vaka.patient.cinsiyetTercih === "K" ? "Kadın" : "Belirtilmemiş"}`
  );

  const tanilar = (vaka.conditions || []).map((c) => `${c.ad}${c.primary ? " (birincil)" : ""}`).filter(Boolean);
  if (tanilar.length) satirlar.push(`Tanılar: ${tanilar.join(", ")}`);

  const profil = vaka.patient.profil;
  if (profil?.sigara) satirlar.push(`Sigara: ${profil.sigara}`);
  if (profil?.bmi != null) satirlar.push(`VKİ: ${profil.bmi}`);
  if (profil?.komorbiditeler?.length) {
    satirlar.push(`Komorbiditeler: ${profil.komorbiditeler.join(", ")}`);
  }

  const vitals = vaka.vitals;
  if (vitals) {
    const vs: string[] = [];
    if (vitals.tansiyon) vs.push(`TA ${vitals.tansiyon}`);
    if (vitals.nabiz != null) vs.push(`Nabız ${vitals.nabiz}`);
    if (vitals.ates != null) vs.push(`Ateş ${vitals.ates}`);
    if (vitals.spo2 != null) vs.push(`SpO2 %${vitals.spo2}`);
    if (vitals.solunum != null) vs.push(`Solunum ${vitals.solunum}`);
    if (vs.length) satirlar.push(`Vitaller: ${vs.join(", ")}`);
  }

  const labs = Object.entries(vaka.labs?.statikTestler || {}) as [string, CdmLabResult][];
  const onemliLabs = labs
    .filter(([, l]) => l.flag === "high" || l.flag === "low" || l.flag === "abnormal")
    .map(([k, l]) => labSatiri(k, l));
  if (onemliLabs.length) {
    satirlar.push("Önemli laboratuvar sonuçları:");
    satirlar.push(...onemliLabs.slice(0, 12));
  }

  const ilaclar = (vaka.management?.tedavi?.ilaclar || []).map((i) => i.ad).filter(Boolean);
  if (ilaclar.length) satirlar.push(`İlaçlar: ${ilaclar.slice(0, 8).join(", ")}`);

  const sorular = vaka.rubric?.beklenenSorular || [];
  if (sorular.length) {
    satirlar.push("Beklenen sorular:");
    for (const s of sorular) {
      satirlar.push(`- ${s.key}: ${s.etiket}${s.aciklama ? ` (${s.aciklama})` : ""}`);
    }
  }

  return satirlar.join("\n");
}

function promptOlustur(profil: string, vaka: TipAiCdmDocument): string {
  const sorular = vaka.rubric?.beklenenSorular || [];
  const anahtarlar = sorular.map((s) => s.key);

  return `Sen bir tıp eğitimi simülasyon sistemi için klinik vaka içeriği üreten bir uzmansın.
Sana sentetik hasta kaydından türetilmiş objektif bir hasta profili veriyorum.
OSCE sunumunu ve hastanın cevaplarını Türkçe yaz.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HASTA PROFİLİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profil}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GÖREV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. "anaSikayet": hastanın söyleyeceği tek cümlelik ana şikayet.
2. "ozetBilgiler": 3-4 kısa HPI maddesi (başlangıç, ciddiyet, artıran/azaltan faktörler, ilgili öykü). Her madde en fazla ~12 kelime.
3. "hastaYanitlari": aşağıdaki HER beklenen soru anahtarı için hastanın doğal cevabı (1-2 cümle, halk dili, tıbbi terim yok).

KURALLAR:
- Hasta gibi konuş; tıbbi terim değil, halk dili kullan.
- Objektif profille tutarlı kal (pozitif bulgular pozitif, negatifler negatif).
- Cevaplar Türkçe olmalı.
- Vital değerleri uydurma; yalnızca listelenen anahtarlara cevap ver.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT (yalnızca JSON, açıklama yok)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "anaSikayet": "…",
  "ozetBilgiler": ["…", "…", "…"],
  "hastaYanitlari": {
    "${anahtarlar[0] || "KEY1"}": "…",
    ${anahtarlar.slice(1).map((k) => `"${k}": "…"`).join(",\n    ")}
  }
}

Yalnızca JSON döndür.`;
}

function gecerliSayidaOzet(items: unknown): boolean {
  return Array.isArray(items) && items.length >= 3 && items.length <= 5 &&
    items.every((i) => typeof i === "string" && i.trim().length > 0);
}

/**
 * Bir Synthea CDM taslağını Gemini ile zenginleştirir (presentation + hastaYanitlari).
 * Başarısız/anahtarsız durumda vaka değişmeden döner.
 */
export async function enrichSyntheaCase(vaka: TipAiCdmDocument): Promise<SyntheaEnrichResult> {
  const profil = syntheaProfilOlustur(vaka);

  if (!geminiYapilandirilmisMi()) {
    return {
      basarili: false,
      vaka,
      rapor: { uyarilar: ["GEMINI_API_KEY tanımlı değil."] },
      debug: { profil, prompt: "", hamYanit: "" },
    };
  }

  const prompt = promptOlustur(profil, vaka);
  try {
    const yanit = await geminiChat({
      messages: [
        { role: "system", content: "Sen yalnızca JSON üreten bir tıp eğitimi vaka sistemisin." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });

    let hamYanit = yanit.content;
    let parsed = jsonCikar(hamYanit) as
      | { anaSikayet?: unknown; ozetBilgiler?: unknown; hastaYanitlari?: unknown }
      | null;

    // JSON çıkmadıysa (tipik neden: "length" ile kesilmiş yanıt) bir kez daha
    // dene — daha yüksek token limiti ile. Tek tur; maliyeti sınırlı tutar.
    if (!parsed) {
      const ikinci = await geminiChat({
        messages: [
          { role: "system", content: "Sen yalnızca JSON üreten bir tıp eğitimi vaka sistemisin." },
          { role: "user", content: prompt + "\n\nÖNEMLİ: Yanıtı TEK geçerli JSON bloğu olarak ver, kısaltma." },
        ],
        temperature: 0.4,
        maxTokens: 8000,
      });
      const hamIkinci = ikinci.content;
      if (hamIkinci) {
        hamYanit = hamIkinci;
        parsed = jsonCikar(hamIkinci) as typeof parsed;
      }
    }

    const sonuc: TipAiCdmDocument = structuredClone(vaka);
    const uyarilar: string[] = [];

    if (parsed) {
      const anaSikayet = bosDegil(parsed.anaSikayet);
      if (anaSikayet) {
        sonuc.presentation.anaSikayet = anaSikayet;
      } else {
        uyarilar.push("anaSikayet üretilemedi.");
      }

      if (gecerliSayidaOzet(parsed.ozetBilgiler)) {
        sonuc.presentation.ozetBilgiler = (parsed.ozetBilgiler as string[]).slice(0, 4);
      } else {
        uyarilar.push("ozetBilgiler geçersiz (3-4 madde bekleniyor).");
      }

      const yanitlar = parsed.hastaYanitlari;
      if (yanitlar && typeof yanitlar === "object") {
        const kayit = yanitlar as Record<string, unknown>;
        const eksikAnahtarlar: string[] = [];
        for (const s of vaka.rubric?.beklenenSorular || []) {
          const deger = kayit[s.key];
          if (typeof deger === "string" && deger.trim()) {
            sonuc.hastaYanitlari[s.key] = deger.trim();
          } else {
            // Sessiz atlama yerine uyarı: aksi halde placeholder cevap
            // "başarılı" enrichment altında gizli kalıyordu.
            eksikAnahtarlar.push(s.key);
          }
        }
        if (eksikAnahtarlar.length) {
          uyarilar.push(`hastaYanitlari eksik anahtarlar: ${eksikAnahtarlar.join(", ")}`);
        }
      } else {
        uyarilar.push("hastaYanitlari alanı AI yanıtında bulunamadı.");
      }

      // Vitaller her zaman objektif değerle korunur (AI ezemez).
      if (sonuc.vitals) {
        if (sonuc.vitals.tansiyon) sonuc.hastaYanitlari.VITAL_TANSIYON = sonuc.vitals.tansiyon;
        if (sonuc.vitals.nabiz != null) sonuc.hastaYanitlari.VITAL_NABIZ = String(sonuc.vitals.nabiz);
        if (sonuc.vitals.ates != null) sonuc.hastaYanitlari.VITAL_ATES = String(sonuc.vitals.ates);
        if (sonuc.vitals.spo2 != null) sonuc.hastaYanitlari.VITAL_SPO2 = String(sonuc.vitals.spo2);
      }
    } else {
      uyarilar.push("AI yanıtından JSON çıkarılamadı.");
    }

    return {
      basarili: uyarilar.length === 0,
      vaka: sonuc,
      rapor: { uyarilar },
      debug: { profil, prompt, hamYanit },
    };
  } catch (hata) {
    return {
      basarili: false,
      vaka,
      rapor: { uyarilar: [hata instanceof Error ? hata.message : String(hata)] },
      debug: { profil, prompt, hamYanit: "" },
    };
  }
}
