/**
 * Serbest metin → chip eşleştirici (AI fallback).
 *
 * Yerel sözlük (normalizeSoru) bulamadığında Gemini en yakın chip'i seçer.
 * Düşük güven veya "OZEL" durumunda null döner.
 */

import { CHIP_HAVUZU } from "@/lib/data/case-generator";
import { geminiChat, geminiYapilandirilmisMi, jsonCikar } from "./gemini";

export interface EslesmeSonucu {
  chipKey: string | null;
  guvenSkor: number;
}

export async function serbestMetinEslestir(metin: string): Promise<EslesmeSonucu> {
  if (!geminiYapilandirilmisMi()) return { chipKey: null, guvenSkor: 0 };

  const chipListesi = CHIP_HAVUZU.map((c) => `${c.aksiyon}: "${c.etiket}"`).join("\n");

  const prompt = `Aşağıda bir tıp öğrencisinin hastaya sorduğu serbest metin soru var.
Bu sorunun aşağıdaki hazır sorulardan hangisine karşılık geldiğini bul.

Öğrencinin sorusu: "${metin}"

Hazır sorular:
${chipListesi}

SADECE şu JSON formatında cevap ver:
{
  "chipKey": "EN_UYGUN_CHIP_KEY",
  "guvenSkor": 0.0
}

Hiçbir soru uymuyorsa:
{
  "chipKey": "OZEL",
  "guvenSkor": 0.0
}`;

  try {
    const yanit = await geminiChat({
      messages: [
        { role: "system", content: "Soru eşleştirme sistemisin. Sadece JSON döndür." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    const sonuc = jsonCikar(yanit.content) as { chipKey?: unknown; guvenSkor?: unknown } | null;
    if (!sonuc) return { chipKey: null, guvenSkor: 0 };

    const chipKey = typeof sonuc.chipKey === "string" ? sonuc.chipKey : "OZEL";
    const guvenSkor = typeof sonuc.guvenSkor === "number" ? sonuc.guvenSkor : 0;
    const gecerli = CHIP_HAVUZU.some((c) => c.aksiyon === chipKey);

    if (!gecerli || chipKey === "OZEL" || guvenSkor < 0.5) {
      return { chipKey: null, guvenSkor: 0 };
    }
    return { chipKey, guvenSkor };
  } catch {
    return { chipKey: null, guvenSkor: 0 };
  }
}
