import { birlesikSoruSynonymleri, birlesikTestSynonymleri } from "../data";

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
  const lower = metin.toLowerCase().trim();
  const ascii = normalizeAscii(metin);

  // 1) Tam eşleşme
  if (birlesikSoruSynonymleri[lower]) return birlesikSoruSynonymleri[lower];
  if (birlesikSoruSynonymleri[ascii]) return birlesikSoruSynonymleri[ascii];

  // 2) Ek alias — uzun olan önce
  const ekSorted = [...EK_SORU_ALIAS].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, action] of ekSorted) {
    if (lower.includes(alias) || ascii.includes(normalizeAscii(alias))) {
      return action;
    }
  }

  // 3) Sözlük alias — uzun olan önce (kısa "göz" gibi yanlış eşleşmeyi azaltır)
  const entries = Object.entries(birlesikSoruSynonymleri) as [string, string][];
  entries.sort((a, b) => b[0].length - a[0].length);
  for (const [alias, action] of entries) {
    if (alias.length < 3) continue; // çok kısa alias'lar atla
    if (lower.includes(alias) || ascii.includes(normalizeAscii(alias))) {
      return action;
    }
  }

  return "OZEL";
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
