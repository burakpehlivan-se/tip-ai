/**
 * Vakaya özel soru chip'i üretici.
 *
 * Global CHIP_HAVUZU her vakaya kopyalanırsa öğrenci, cevabı olmayan onlarca
 * genel soru görür (uyumsuzluk kaynağı #1). Bu modül chip'leri vakanın
 * *kendi* yanıt anahtarlarından türetir:
 *
 *  1. Yanıtı olan TR kodlu aksiyonlar → CHIP_HAVUZU'ndaki chip
 *  2. Synthea/AI uzun kodları (CHIEF_COMPLAINT…) → Türkçe etiketli sentetik chip
 *  3. Rubriğin beklediği ama yanıtı olmayan TR aksiyonlar → varsayılan negatif
 *     cevapla desteklenmek üzere dahil edilir
 *
 * VITAL_* anahtarları anamnez sorusu değildir; hasta kartı/özette gösterilir.
 */
import { ChipKategorisi, SoruChipi } from "../types";
import { CHIP_HAVUZU } from "./chip-havuzu";
import { kanonikHastaAksiyonu } from "./answer-action-aliases";

/** Synthea/EN aksiyon kodu → öğrenciye sorulacak Türkçe soru. */
export const EN_AKSIYON_CHIPLERI: Record<string, { etiket: string; kategori: ChipKategorisi }> = {
  CHIEF_COMPLAINT: { etiket: "Şikayetinizi biraz açar mısınız?", kategori: "anamnez-sistemik" },
  HISTORY_OF_PRESENT: {
    etiket: "Şikayetler nasıl başladı, nasıl seyrediyor?",
    kategori: "anamnez-sistemik",
  },
  PAST_MEDICAL: { etiket: "Geçmişte başka hastalığınız var mı?", kategori: "anamnez-oyku" },
  MEDICATIONS: { etiket: "Düzenli kullandığınız ilaç var mı?", kategori: "soygecmis" },
  FAMILY_HISTORY: { etiket: "Ailenizde benzer hastalık var mı?", kategori: "soygecmis" },
  SOCIAL_HISTORY: { etiket: "Sigara veya alkol kullanıyor musunuz?", kategori: "soygecmis" },
};

function vitalAnahtariMi(key: string): boolean {
  return key === "OZEL" || key.startsWith("VITAL_");
}

/**
 * Ham yanıt anahtarlarından (+ opsiyonel rubrik aksiyonlarından) oynanabilir
 * chip listesi üretir. Sıra: havuzdaki orijinal sıra korunur, sentetik EN
 * chipler sona eklenir. Aynı aksiyon tek kez gelir.
 */
export function vakaChipleriniUret(
  rawYanitlar: Record<string, string> | undefined,
  ekstraAksiyonlar: string[] = []
): SoruChipi[] {
  const havuz = new Map(CHIP_HAVUZU.map((c) => [c.aksiyon, c]));
  const rawKeys = new Set(
    Object.keys(rawYanitlar || {})
      .filter((key) => !vitalAnahtariMi(key))
      .map(kanonikHastaAksiyonu)
  );
  const canonicalExtras = ekstraAksiyonlar.map(kanonikHastaAksiyonu);

  const secilen: SoruChipi[] = [];
  const eklendi = new Set<string>();

  // 1) Havuzdan: yanlı olanlar önce, sonra rubriğin beklediği ekstra aksiyonlar
  for (const chip of CHIP_HAVUZU) {
    if (!rawKeys.has(chip.aksiyon) && !canonicalExtras.includes(chip.aksiyon)) continue;
    secilen.push(chip);
    eklendi.add(chip.aksiyon);
  }

  // 2) Eşleşmeyen ham anahtarlar → sentetik Türkçe chip (bilinen EN kodlar)
  for (const key of Object.keys(rawYanitlar || {})) {
    if (eklendi.has(key) || vitalAnahtariMi(key)) continue;
    const tanim = EN_AKSIYON_CHIPLERI[key];
    if (!tanim) continue;
    secilen.push({ etiket: tanim.etiket, aksiyon: key, kategori: tanim.kategori });
    eklendi.add(key);
  }

  // Güvenlik: hiçbir chip seçilemediyse temel soruları göster (boş ekranı önler)
  if (secilen.length === 0) {
    const fallbackKeys = ["SIKAYET", "SIKAYET_SURE", "ALERJI", "ILAC", "SIGARA", "DIYABET"];
    for (const key of fallbackKeys) {
      const chip = havuz.get(key);
      if (chip && !eklendi.has(key)) {
        secilen.push(chip);
        eklendi.add(key);
      }
    }
  }

  return secilen;
}
