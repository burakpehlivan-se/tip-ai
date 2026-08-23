import { birlesikSoruSynonymleri, birlesikTestSynonymleri } from "../data/synonyms";

/** Ek serbest metin → aksiyon (uzun eşleşmeler öncelikli) */
const EK_SORU_ALIAS: [string, string][] = [
  ["ağrın 10 üzerinden kaç", "AGRI_SKALA"],
  ["agrin 10 uzerinden kac", "AGRI_SKALA"],
  ["10 üzerinden kaç", "AGRI_SKALA"],
  ["10 uzerinden kac", "AGRI_SKALA"],
  ["ağrı skalası", "AGRI_SKALA"],
  ["agri skalasi", "AGRI_SKALA"],
  ["ağrı kaç puan", "AGRI_SKALA"],
  ["agri kac puan", "AGRI_SKALA"],
  ["kaç puan ağrı", "AGRI_SKALA"],
  ["kac puan agri", "AGRI_SKALA"],
  ["ağrı puanı", "AGRI_SKALA"],
  ["agri puani", "AGRI_SKALA"],
  ["vas skoru", "AGRI_SKALA"],
  ["ağrı şiddeti", "AGRI_SIDDAT"],
  ["agri siddeti", "AGRI_SIDDAT"],
  ["şiddeti nasıl", "AGRI_SIDDAT"],
  ["siddeti nasil", "AGRI_SIDDAT"],
  ["ağrın var mı", "AGRI_SIDDAT"],
  ["agrin var mi", "AGRI_SIDDAT"],
  ["ağrı var mı", "AGRI_SIDDAT"],
  ["agri var mi", "AGRI_SIDDAT"],
  ["göğüs ağrısı var mı", "GOGUS_AGRISI"],
  ["gogus agrisi var mi", "GOGUS_AGRISI"],
  ["göğüs ağrısı", "GOGUS_AGRISI"],
  ["gogus agrisi", "GOGUS_AGRISI"],
  ["göğüste ağrı", "GOGUS_AGRISI"],
  ["goguste agri", "GOGUS_AGRISI"],
  ["ağrı nerede", "AGRI_YER"],
  ["agri nerede", "AGRI_YER"],
  ["ağrı yeri", "AGRI_YER"],
  ["ne zamandır ağrı", "AGRI_SURE"],
  ["ne zamandir agri", "AGRI_SURE"],
  ["ağrı ne zaman", "AGRI_SURE"],
  ["yayılıyor mu", "AGRI_YAYILIM"],
  ["yayiliyor mu", "AGRI_YAYILIM"],
  ["eforla mı", "AGRI_EFOR"],
  ["eforla mi", "AGRI_EFOR"],
  ["eforla geliyor", "AGRI_EFOR"],
  ["nefes darlığı", "NEFES_DARLIGI"],
  ["nefes darligi", "NEFES_DARLIGI"],
  ["ateşin var mı", "ATES_SORGU"],
  ["atesin var mi", "ATES_SORGU"],
  ["şikayetiniz nedir", "SIKAYET"],
  ["sikayetiniz nedir", "SIKAYET"],
  ["şikayetinizi anlatır mısınız", "SIKAYET"],
  ["sikayetinizi anlatir misiniz", "SIKAYET"],
  ["şikayetler nasıl başladı", "SIKAYET_SURE"],
  ["sikayetler nasil basladi", "SIKAYET_SURE"],
  ["şikayet ne zaman başladı", "SIKAYET_SURE"],
  ["sikayet ne zaman basladi", "SIKAYET_SURE"],
  ["düzenli ilaç kullanıyor musunuz", "ILAC"],
  ["duzenli ilac kullaniyor musunuz", "ILAC"],
  ["geçmişte başka hastalığınız var mı", "PAST_MEDICAL"],
  ["gecmiste baska hastaliginiz var mi", "PAST_MEDICAL"],
  ["sigara veya alkol kullanıyor musunuz", "SOCIAL_HISTORY"],
  ["sigara veya alkol kullaniyor musunuz", "SOCIAL_HISTORY"],
  ["tansiyonun kaç", "VITAL_TANSIYON"],
  ["tansiyonun kac", "VITAL_TANSIYON"],
  ["nabzın kaç", "VITAL_NABIZ"],
  ["nabzin kac", "VITAL_NABIZ"],
];

function normalizeAscii(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function normalizeSoru(metin: string): string {
  return normalizeSorular(metin)[0] || "OZEL";
}

/**
 * Serbest metindeki birden fazla klinik alanı bulur.
 *
 * `normalizeSoru` eski tek-aksiyon API'sini korur; hasta motoru ise aynı turda
 * sorulmuş başlangıç + yayılım gibi alanları kaybetmemek için bu fonksiyonu
 * kullanır. Eşleşmeler metindeki konumlarına göre sıralanır.
 */
export function normalizeSorular(metin: string): string[] {
  const lower = metin.toLowerCase().trim();
  const ascii = normalizeAscii(metin);
  const matches: Array<{ action: string; index: number }> = [];
  const addMatch = (action: string, index: number) => {
    if (index >= 0 && !matches.some((item) => item.action === action)) {
      matches.push({ action, index });
    }
  };

  if (birlesikSoruSynonymleri[lower]) addMatch(birlesikSoruSynonymleri[lower], 0);
  if (birlesikSoruSynonymleri[ascii]) addMatch(birlesikSoruSynonymleri[ascii], 0);

  // Uzun alias'lar aynı metinde daha güvenilir olduğundan önce eklenir.
  const ekSorted = [...EK_SORU_ALIAS].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, action] of ekSorted) {
    const index = lower.indexOf(alias);
    const asciiIndex = ascii.indexOf(normalizeAscii(alias));
    addMatch(action, index >= 0 ? index : asciiIndex);
  }

  // Kısa alias'lar (örn. "göz") yanlış eşleşmeye yatkındır.
  const entries = Object.entries(birlesikSoruSynonymleri) as [string, string][];
  entries.sort((a, b) => b[0].length - a[0].length);
  for (const [alias, action] of entries) {
    if (alias.length < 3) continue;
    const index = lower.indexOf(alias);
    const asciiIndex = ascii.indexOf(normalizeAscii(alias));
    addMatch(action, index >= 0 ? index : asciiIndex);
  }

  return matches.sort((a, b) => a.index - b.index).map((item) => item.action);
}

export function normalizeTest(metin: string): string | null {
  const lower = metin.toLowerCase().trim();
  const ascii = normalizeAscii(metin);

  if (birlesikTestSynonymleri[lower]) return birlesikTestSynonymleri[lower];
  if (birlesikTestSynonymleri[ascii]) return birlesikTestSynonymleri[ascii];

  const entries = Object.entries(birlesikTestSynonymleri) as [string, string][];
  entries.sort((a, b) => b[0].length - a[0].length);
  for (const [alias, testKey] of entries) {
    if (alias.length < 2) continue;
    if (lower.includes(alias) || ascii.includes(normalizeAscii(alias))) {
      return testKey;
    }
  }

  return null;
}
