/**
 * Synthea → TIP-AI sözlük eşlemeleri
 * - SNOMED-CT → hastalikKey / poliklinik (Türkçe adlar)
 * - LOINC → kanonik testKey (granüler: NA, K, HGB, …)
 */

import { canonicalizeTestKey, testAdiForKey } from "../../cdm/vocabulary";
import {
  ageToRange,
  genderToCinsiyet,
  labDisplayName,
  mapLoincOrLabelToTestKey,
} from "../mimic/mappings";
import { SyntheaDiseaseMapping } from "./types";

export const SYNTHEA_DISEASE_MAPPINGS: SyntheaDiseaseMapping[] = [
  // ── Kardiyoloji ──
  {
    hastalikKey: "stemi",
    hastalikAdi: "ST Elevasyonlu Miyokart Enfarktüsü",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    snomedCodes: ["401303003"],
    kabulEdilenTani: ["STEMI", "ST Elevasyonlu Miyokart Enfarktüsü", "Akut Miyokart Enfarktüsü"],
    priority: 1,
  },
  {
    hastalikKey: "nstemi",
    hastalikAdi: "Non-ST Elevasyonlu Miyokart Enfarktüsü",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    snomedCodes: ["401314000", "22298006"],
    kabulEdilenTani: ["NSTEMI", "Non-ST Elevasyonlu Miyokart Enfarktüsü", "Akut Miyokart Enfarktüsü"],
    priority: 2,
  },
  {
    hastalikKey: "kalp-yetmezligi",
    hastalikAdi: "Kalp Yetmezliği",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    snomedCodes: ["88805009"],
    kabulEdilenTani: ["Kalp Yetmezliği", "Konjestif Kalp Yetmezliği"],
    priority: 5,
  },
  {
    hastalikKey: "atriyal-fibrilasyon",
    hastalikAdi: "Atriyal Fibrilasyon",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    snomedCodes: ["49436004"],
    kabulEdilenTani: ["Atriyal Fibrilasyon", "AF"],
    priority: 6,
  },
  {
    hastalikKey: "iskemik-kalp-hastaligi",
    hastalikAdi: "İskemik Kalp Hastalığı",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    snomedCodes: ["414545008"],
    kabulEdilenTani: ["İskemik Kalp Hastalığı", "Koroner Arter Hastalığı"],
    priority: 7,
  },
  {
    hastalikKey: "hipertansiyon",
    hastalikAdi: "Esansiyel Hipertansiyon",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    snomedCodes: ["59621000"],
    kabulEdilenTani: ["Esansiyel Hipertansiyon", "Hipertansiyon"],
    priority: 8,
  },
  // ── Endokrin ──
  {
    hastalikKey: "tip-2-diyabet",
    hastalikAdi: "Tip 2 Diyabet",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrin",
    poliklinikIcon: "🩺",
    snomedCodes: [
      "44054006",
      "127013003",
      "368581000119106",
      "1551000119108",
      "90781000119102",
      "157141000119108",
    ],
    kabulEdilenTani: ["Tip 2 Diyabet", "Tip 2 Diabetes Mellitus", "T2DM"],
    priority: 10,
  },
  {
    hastalikKey: "prediyabet",
    hastalikAdi: "Prediyabet",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrin",
    poliklinikIcon: "🩺",
    snomedCodes: ["714628002"],
    kabulEdilenTani: ["Prediyabet"],
    priority: 11,
  },
  {
    hastalikKey: "metabolik-sendrom",
    hastalikAdi: "Metabolik Sendrom",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrin",
    poliklinikIcon: "🩺",
    snomedCodes: ["237602007"],
    kabulEdilenTani: ["Metabolik Sendrom"],
    priority: 12,
  },
  {
    hastalikKey: "hiperlipidemi",
    hastalikAdi: "Hiperlipidemi",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrin",
    poliklinikIcon: "🩺",
    snomedCodes: ["55822004", "302870006"],
    kabulEdilenTani: ["Hiperlipidemi", "Hipertrigliseridemi", "Dislipidemi"],
    priority: 13,
  },
  {
    hastalikKey: "obezite",
    hastalikAdi: "Obezite",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrin",
    poliklinikIcon: "🩺",
    snomedCodes: ["162864005", "408512008"],
    kabulEdilenTani: ["Obezite"],
    priority: 14,
  },
  // ── Nefroloji ──
  {
    hastalikKey: "kbh",
    hastalikAdi: "Kronik Böbrek Hastalığı",
    poliklinikKey: "nefroloji",
    poliklinikAd: "Nefroloji",
    poliklinikIcon: "🫘",
    snomedCodes: ["431855005", "431856006", "433144002", "431857002", "46177005"],
    kabulEdilenTani: ["Kronik Böbrek Hastalığı", "KBH", "Son Dönem Böbrek Yetmezliği"],
    priority: 20,
  },
  {
    hastalikKey: "iye",
    hastalikAdi: "İdrar Yolu Enfeksiyonu",
    poliklinikKey: "enfeksiyon",
    poliklinikAd: "Enfeksiyon",
    poliklinikIcon: "🦠",
    snomedCodes: ["307426000", "197927001"],
    kabulEdilenTani: ["İdrar Yolu Enfeksiyonu", "İYE", "Sistit"],
    priority: 25,
  },
  // ── Solunum ──
  {
    hastalikKey: "pnomoni",
    hastalikAdi: "Pnömoni",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["233604007"],
    kabulEdilenTani: ["Pnömoni", "Toplum Kaynaklı Pnömoni"],
    priority: 15,
  },
  {
    hastalikKey: "koah",
    hastalikAdi: "KOAH",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["185086009", "87433001"],
    kabulEdilenTani: ["KOAH", "Kronik Obstrüktif Akciğer Hastalığı", "Amfizem"],
    priority: 16,
  },
  {
    hastalikKey: "astim",
    hastalikAdi: "Astım",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["195967001", "233678006"],
    kabulEdilenTani: ["Astım"],
    priority: 17,
  },
  {
    hastalikKey: "akut-bronsit",
    hastalikAdi: "Akut Bronşit",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["10509002"],
    kabulEdilenTani: ["Akut Bronşit"],
    priority: 18,
  },
  {
    hastalikKey: "akut-solunum-yetmezligi",
    hastalikAdi: "Akut Solunum Yetmezliği",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["65710008"],
    kabulEdilenTani: ["Akut Solunum Yetmezliği"],
    priority: 19,
  },
  // ── Enfeksiyon ──
  {
    hastalikKey: "sepsis",
    hastalikAdi: "Sepsis",
    poliklinikKey: "enfeksiyon",
    poliklinikAd: "Enfeksiyon",
    poliklinikIcon: "🦠",
    snomedCodes: ["91302008", "770349000"],
    kabulEdilenTani: ["Sepsis"],
    priority: 30,
  },
  {
    hastalikKey: "pulmoner-emboli",
    hastalikAdi: "Pulmoner Emboli",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["706870000"],
    kabulEdilenTani: ["Pulmoner Emboli", "PE"],
    priority: 31,
  },
  // ── Hematoloji ──
  {
    hastalikKey: "anemi",
    hastalikAdi: "Anemi",
    poliklinikKey: "hematoloji",
    poliklinikAd: "Hematoloji",
    poliklinikIcon: "🩸",
    snomedCodes: ["271737000"],
    kabulEdilenTani: ["Anemi"],
    priority: 35,
  },
  // ── Onkoloji ──
  {
    hastalikKey: "meme-ca",
    hastalikAdi: "Meme Kanseri",
    poliklinikKey: "onkoloji",
    poliklinikAd: "Onkoloji",
    poliklinikIcon: "🎗️",
    snomedCodes: ["254837009"],
    kabulEdilenTani: ["Meme Kanseri"],
    priority: 40,
  },
  {
    hastalikKey: "kolon-ca",
    hastalikAdi: "Kolon Kanseri",
    poliklinikKey: "onkoloji",
    poliklinikAd: "Onkoloji",
    poliklinikIcon: "🎗️",
    snomedCodes: ["109838007"],
    kabulEdilenTani: ["Kolon Kanseri"],
    priority: 41,
  },
  {
    hastalikKey: "losemi",
    hastalikAdi: "Lösemi",
    poliklinikKey: "onkoloji",
    poliklinikAd: "Onkoloji",
    poliklinikIcon: "🎗️",
    snomedCodes: ["93143009"],
    kabulEdilenTani: ["Lösemi"],
    priority: 42,
  },
  // ── Genel Cerrahi ──
  {
    hastalikKey: "akut-kolesistit",
    hastalikAdi: "Akut Kolesistit",
    poliklinikKey: "cerrahi",
    poliklinikAd: "Genel Cerrahi",
    poliklinikIcon: "🔪",
    snomedCodes: ["65275009"],
    kabulEdilenTani: ["Akut Kolesistit"],
    priority: 45,
  },
  {
    hastalikKey: "kolelitiazis",
    hastalikAdi: "Kolelitiazis",
    poliklinikKey: "cerrahi",
    poliklinikAd: "Genel Cerrahi",
    poliklinikIcon: "🔪",
    snomedCodes: ["235919008"],
    kabulEdilenTani: ["Kolelitiazis", "Safra Kesesi Taşı"],
    priority: 46,
  },
  {
    hastalikKey: "kolon-polip",
    hastalikAdi: "Kolon Polipi",
    poliklinikKey: "cerrahi",
    poliklinikAd: "Genel Cerrahi",
    poliklinikIcon: "🔪",
    snomedCodes: ["68496003", "713197008"],
    kabulEdilenTani: ["Kolon Polipi"],
    priority: 47,
  },
  // ── Nöroloji ──
  {
    hastalikKey: "epilepsi",
    hastalikAdi: "Epilepsi",
    poliklinikKey: "noroloji",
    poliklinikAd: "Nöroloji",
    poliklinikIcon: "🧠",
    snomedCodes: ["128613002", "84757009"],
    kabulEdilenTani: ["Epilepsi", "Nöbet Bozukluğu"],
    priority: 50,
  },
  {
    hastalikKey: "migren",
    hastalikAdi: "Kronik Migren",
    poliklinikKey: "noroloji",
    poliklinikAd: "Nöroloji",
    poliklinikIcon: "🧠",
    snomedCodes: ["124171000119105"],
    kabulEdilenTani: ["Kronik Migren", "Migren"],
    priority: 51,
  },
  {
    hastalikKey: "alzheimer",
    hastalikAdi: "Alzheimer Hastalığı",
    poliklinikKey: "noroloji",
    poliklinikAd: "Nöroloji",
    poliklinikIcon: "🧠",
    snomedCodes: ["26929004", "230265002"],
    kabulEdilenTani: ["Alzheimer Hastalığı"],
    priority: 52,
  },
  // ── Ortopedi ──
  {
    hastalikKey: "diz-osteoartrit",
    hastalikAdi: "Diz Osteoartriti",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["239873007"],
    kabulEdilenTani: ["Diz Osteoartriti"],
    priority: 60,
  },
  {
    hastalikKey: "kalca-osteoartrit",
    hastalikAdi: "Kalça Osteoartriti",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["239872002", "201834006"],
    kabulEdilenTani: ["Kalça Osteoartriti", "Osteoartrit"],
    priority: 61,
  },
  {
    hastalikKey: "osteoporoz",
    hastalikAdi: "Osteoporoz",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["64859006"],
    kabulEdilenTani: ["Osteoporoz"],
    priority: 62,
  },
  {
    hastalikKey: "gut",
    hastalikAdi: "Gut",
    poliklinikKey: "romatoloji",
    poliklinikAd: "Romatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["90560007"],
    kabulEdilenTani: ["Gut"],
    priority: 63,
  },
  {
    hastalikKey: "fibromiyalji",
    hastalikAdi: "Fibromiyalji",
    poliklinikKey: "romatoloji",
    poliklinikAd: "Romatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["203082005"],
    kabulEdilenTani: ["Fibromiyalji"],
    priority: 64,
  },
  {
    hastalikKey: "kirik",
    hastalikAdi: "Kemik Kırığı",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["125605004", "65966004", "58150001", "263102004", "16114001", "359817006"],
    kabulEdilenTani: ["Kemik Kırığı", "Kırık"],
    priority: 65,
  },
  {
    hastalikKey: "burkulma",
    hastalikAdi: "Burkulma",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["384709000", "44465007", "70704007"],
    kabulEdilenTani: ["Burkulma"],
    priority: 66,
  },
  {
    hastalikKey: "bel-agrisi",
    hastalikAdi: "Kronik Bel Ağrısı",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["278860009"],
    kabulEdilenTani: ["Kronik Bel Ağrısı", "Bel Ağrısı"],
    priority: 67,
  },
  {
    hastalikKey: "boyun-agrisi",
    hastalikAdi: "Kronik Boyun Ağrısı",
    poliklinikKey: "ortopedi",
    poliklinikAd: "Ortopedi ve Travmatoloji",
    poliklinikIcon: "🦴",
    snomedCodes: ["1121000119107"],
    kabulEdilenTani: ["Kronik Boyun Ağrısı"],
    priority: 68,
  },
  // ── Kadın Doğum ──
  {
    hastalikKey: "preeklampsi",
    hastalikAdi: "Preeklampsi",
    poliklinikKey: "kadin-dogum",
    poliklinikAd: "Kadın Hastalıkları ve Doğum",
    poliklinikIcon: "🤰",
    snomedCodes: ["398254007"],
    kabulEdilenTani: ["Preeklampsi"],
    priority: 70,
  },
  {
    hastalikKey: "eklampsi",
    hastalikAdi: "Eklampsi",
    poliklinikKey: "kadin-dogum",
    poliklinikAd: "Kadın Hastalıkları ve Doğum",
    poliklinikIcon: "🤰",
    snomedCodes: ["198992004"],
    kabulEdilenTani: ["Eklampsi"],
    priority: 71,
  },
  {
    hastalikKey: "gebelik",
    hastalikAdi: "Normal Gebelik",
    poliklinikKey: "kadin-dogum",
    poliklinikAd: "Kadın Hastalıkları ve Doğum",
    poliklinikIcon: "🤰",
    snomedCodes: ["72892002"],
    kabulEdilenTani: ["Normal Gebelik", "Gebelik"],
    priority: 72,
  },
  // ── Dermatoloji ──
  {
    hastalikKey: "atopik-dermatit",
    hastalikAdi: "Atopik Dermatit",
    poliklinikKey: "dermatoloji",
    poliklinikAd: "Dermatoloji",
    poliklinikIcon: "🩹",
    snomedCodes: ["24079001"],
    kabulEdilenTani: ["Atopik Dermatit", "Egzama"],
    priority: 75,
  },
  {
    hastalikKey: "kontakt-dermatit",
    hastalikAdi: "Kontakt Dermatit",
    poliklinikKey: "dermatoloji",
    poliklinikAd: "Dermatoloji",
    poliklinikIcon: "🩹",
    snomedCodes: ["40275004"],
    kabulEdilenTani: ["Kontakt Dermatit"],
    priority: 76,
  },
  // ── KBB ──
  {
    hastalikKey: "sinuzit",
    hastalikAdi: "Sinüzit",
    poliklinikKey: "kbb",
    poliklinikAd: "KBB",
    poliklinikIcon: "👂",
    snomedCodes: ["444814009", "75498004", "36971009", "40055000"],
    kabulEdilenTani: ["Sinüzit"],
    priority: 80,
  },
  {
    hastalikKey: "farenjit",
    hastalikAdi: "Farenjit",
    poliklinikKey: "kbb",
    poliklinikAd: "KBB",
    poliklinikIcon: "👂",
    snomedCodes: ["195662009", "43878008"],
    kabulEdilenTani: ["Farenjit", "Streptokok Boğaz Enfeksiyonu"],
    priority: 81,
  },
  {
    hastalikKey: "otitis-media",
    hastalikAdi: "Orta Kulak İltihabı",
    poliklinikKey: "kbb",
    poliklinikAd: "KBB",
    poliklinikIcon: "👂",
    snomedCodes: ["65363002"],
    kabulEdilenTani: ["Orta Kulak İltihabı", "Otitis Media"],
    priority: 82,
  },
  {
    hastalikKey: "alerjik-rinit",
    hastalikAdi: "Alerjik Rinit",
    poliklinikKey: "kbb",
    poliklinikAd: "KBB",
    poliklinikIcon: "👂",
    snomedCodes: ["232353008", "367498001", "446096008"],
    kabulEdilenTani: ["Alerjik Rinit"],
    priority: 83,
  },
  // ── Uyku ──
  {
    hastalikKey: "uyku-apnesi",
    hastalikAdi: "Obstrüktif Uyku Apnesi",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    snomedCodes: ["78275009", "73430006"],
    kabulEdilenTani: ["Obstrüktif Uyku Apnesi", "Uyku Apnesi"],
    priority: 85,
  },
];

/** SNOMED kodu → eşleme (ilk eşleşen kazanır; priority sıralı) */
const SNOMED_INDEX: Map<string, SyntheaDiseaseMapping> = new Map();
/** Eşlenmiş (klinik olarak anlamlı) SNOMED kodları seti. */
export const SNOMED_MAPPED_CODES: Set<string> = new Set();
/** SNOMED kodu → Türkçe tanı adı (conditions listesi için). */
export const SNOMED_TO_TURKISH: Map<string, string> = new Map();
for (const m of SYNTHEA_DISEASE_MAPPINGS) {
  for (const code of m.snomedCodes) {
    SNOMED_MAPPED_CODES.add(code);
    if (!SNOMED_TO_TURKISH.has(code)) SNOMED_TO_TURKISH.set(code, m.hastalikAdi);
    if (!SNOMED_INDEX.has(code)) SNOMED_INDEX.set(code, m);
  }
}

export function isMappedSnomed(code: string): boolean {
  return SNOMED_MAPPED_CODES.has(String(code).trim());
}

/** SNOMED koduna karşılık gelen Türkçe tanı adı; yoksa undefined. */
export function turkishNameForSnomed(code: string): string | undefined {
  return SNOMED_TO_TURKISH.get(String(code).trim());
}

export function resolveDiseaseFromSnomed(codes: string[]): SyntheaDiseaseMapping | null {
  let best: SyntheaDiseaseMapping | null = null;
  for (const raw of codes) {
    const code = String(raw).trim();
    if (!code) continue;
    const mapping = SNOMED_INDEX.get(code);
    if (mapping && (!best || mapping.priority < best.priority)) best = mapping;
  }
  return best;
}

/** Synthea FHIR'daki her condition kodu için denetlenmiş Türkçe vaka başlığı. */
export const SYNTHEA_CONDITION_TURKISH_NAMES: Record<string, string> = {
  "10509002": "Akut bronşit",
  "109838007": "Kolonun örtüşen bölgelerinin kötü huylu tümörü",
  "110030002": "Beyin sarsıntısı",
  "124171000119105": "Aurasız, tedaviye dirençli kronik migren",
  "127013003": "Diyabete bağlı böbrek hastalığı",
  "1501000119109": "Tip 2 diyabete bağlı proliferatif diyabetik retinopati",
  "1551000119108": "Tip 2 diyabete bağlı nonproliferatif diyabetik retinopati",
  "157141000119108": "Tip 2 diyabete bağlı proteinüri",
  "15724005": "Omurilik hasarı olmadan omurga kırığı",
  "15777000": "Prediyabet",
  "16114001": "Ayak bileği kırığı",
  "161622006": "Alt ekstremite amputasyonu öyküsü",
  "162573006": "Akciğer kanseri şüphesi",
  "1734006": "Omurilik hasarı ile omurga kırığı",
  "185086009": "Kronik obstrüktif bronşit",
  "19169002": "Birinci trimester düşük",
  "192127007": "Çocukluk çağı dikkat eksikliği bozukluğu",
  "195662009": "Akut viral farenjit",
  "195967001": "Astım",
  "196416002": "Gömülü azı dişleri",
  "197927001": "Tekrarlayan idrar yolu enfeksiyonu",
  "198992004": "Doğum öncesi eklampsi",
  "200936003": "Lupus eritematozus",
  "201834006": "Elin lokalize primer osteoartriti",
  "230265002": "Erken başlangıçlı ailesel Alzheimer hastalığı",
  "230690007": "İnme",
  "232353008": "Mevsimsel değişkenlik gösteren yıl boyu alerjik rinit",
  "233604007": "Pnömoni",
  "233678006": "Çocukluk çağı astımı",
  "236077008": "Uzamış ishal",
  "239720000": "Diz menisküs yırtığı",
  "239872002": "Kalça osteoartriti",
  "239873007": "Diz osteoartriti",
  "24079001": "Atopik dermatit",
  "241929008": "Akut alerjik reaksiyon",
  "254632001": "Küçük hücreli akciğer kanseri",
  "254637007": "Küçük hücreli dışı akciğer kanseri",
  "262574004": "Ateşli silah yaralanması",
  "263102004": "El bileği kırıklı çıkığı",
  "267253006": "Kromozom anomalili fetüs",
  "26929004": "Alzheimer hastalığı",
  "275272006": "Travmatik beyin hasarı",
  "283371005": "Ön kol laserasyonu",
  "283385000": "Uyluk laserasyonu",
  "284549007": "El laserasyonu",
  "284551006": "Ayak laserasyonu",
  "287182007": "Boğulma yoluyla intihar girişimi",
  "301011002": "Escherichia coli idrar yolu enfeksiyonu",
  "307731004": "Omuz rotator manşet tendon yaralanması",
  "30832001": "Patellar tendon rüptürü",
  "33737001": "Kaburga kırığı",
  "359817006": "Kapalı kalça kırığı",
  "35999006": "Boş gebelik",
  "363406005": "Kolonun kötü huylu tümörü",
  "367498001": "Mevsimsel alerjik rinit",
  "368581000119106": "Tip 2 diyabete bağlı nöropati",
  "36971009": "Sinüzit",
  "370247008": "Yüz laserasyonu",
  "37849005": "Konjenital uterus anomalisi",
  "38341003": "Hipertansiyon",
  "38822007": "Sistit",
  "398254007": "Preeklampsi",
  "39848009": "Boyun kamçı yaralanması",
  "40055000": "Kronik sinüzit",
  "40275004": "Kontakt dermatit",
  "403190006": "Birinci derece yanık",
  "403191005": "İkinci derece yanık",
  "403192003": "Üçüncü derece yanık",
  "410429000": "Kardiyak arrest",
  "422034002": "Tip 2 diyabetle ilişkili diyabetik retinopati",
  "422968005": "Evre 3 küçük hücreli dışı akciğer kanseri",
  "423121009": "Evre 4 küçük hücreli dışı akciğer kanseri",
  "424132000": "Evre 1 küçük hücreli dışı akciğer kanseri",
  "425048006": "Evre 2 küçük hücreli dışı akciğer kanseri",
  "428251008": "Apandektomi öyküsü",
  "429007001": "Kardiyak arrest öyküsü",
  "429280009": "Ayak amputasyonu öyküsü",
  "43878008": "Streptokok farenjiti",
  "44054006": "Diyabet",
  "444448004": "Diz iç yan bağ yaralanması",
  "444470001": "Ön çapraz bağ yaralanması",
  "44465007": "Ayak bileği burkulması",
  "444814009": "Viral sinüzit",
  "446096008": "Yıl boyu alerjik rinit",
  "45816000": "Piyelonefrit",
  "46177005": "Son dönem böbrek hastalığı",
  "47693006": "Apandiks rüptürü",
  "55680006": "İlaç aşırı dozu",
  "58150001": "Klavikula kırığı",
  "6072007": "Makat kanaması",
  "609496007": "Gebelikte gelişen komplikasyon",
  "60951000119105": "Tip 2 diyabete bağlı körlük",
  "62106007": "Bilinç kaybı olmaksızın beyin sarsıntısı",
  "62564004": "Bilinç kaybı ile beyin sarsıntısı",
  "65363002": "Orta kulak iltihabı",
  "65966004": "Ön kol kırığı",
  "6738008": "Kadın infertilitesi",
  "67811000119102": "Evre 1 küçük hücreli akciğer kanseri",
  "67821000119109": "Evre 2 küçük hücreli akciğer kanseri",
  "67831000119107": "Evre 3 küçük hücreli akciğer kanseri",
  "67841000119103": "Evre 4 küçük hücreli akciğer kanseri",
  "68496003": "Kolon polipi",
  "698754002": "Omurilik lezyonuna bağlı kronik paralizi",
  "69896004": "Romatoid artrit",
  "70704007": "El bileği burkulması",
  "713197008": "Tekrarlayan rektal polip",
  "72892002": "Normal gebelik",
  "74400008": "Apandisit",
  "75498004": "Akut bakteriyel sinüzit",
  "79586000": "Tübal gebelik",
  "82423001": "Kronik ağrı",
  "85116003": "İkinci trimester düşük",
  "86849004": "İntihar amaçlı kasıtlı zehirlenme",
  "87433001": "Pulmoner amfizem",
  "90560007": "Gut",
  "90781000119102": "Tip 2 diyabete bağlı mikroalbüminüri",
  "93761005": "Primer kolon kanseri",
  "94260004": "Kolonun sekonder kötü huylu tümörü",
  "95417003": "Primer fibromiyalji sendromu",
  "97331000119101": "Tip 2 diyabete bağlı maküler ödem ve retinopati",
};

/**
 * Bir Synthea tanı kaydını kod-bazlı vaka üretimi için çözer.
 *
 * Normal üretim, ilişkili SNOMED alt türlerini tek öğretim başlığında toplar.
 * Bu işlev ise veri kataloğu için her kaynak kodu ayrı bir vaka kimliğine
 * dönüştürür. Eşlemesi olmayan kodlar da kaybolmaz; genel dahiliye altında
 * kaynak tanı olarak görünür. Bu yalnızca eğitim verisi sınıflandırmasıdır;
 * klinik karar ya da yeni bir tanı üretmez.
 */
export function resolveDiseaseFromCondition(condition: {
  code: string;
  description?: string | null;
}): SyntheaDiseaseMapping | null {
  const code = String(condition.code || "").trim();
  if (!code) return null;

  const mapped = SNOMED_INDEX.get(code);
  const sourceName = SYNTHEA_CONDITION_TURKISH_NAMES[code]
    || String(condition.description || "").trim().replace(/\s*\([^)]*\)\s*$/u, "");
  const hastalikAdi = sourceName || mapped?.hastalikAdi || `Synthea tanı kodu ${code}`;

  return {
    // Kod eklemek, aynı hastalığın alt türlerinin de ayrı kaynak-vaka olarak
    // izlenmesini sağlar; tüm distinct `synthea_conditions.code` değerleri
    // katalogda temsil edilir.
    hastalikKey: `synthea-tani-${code}`,
    hastalikAdi,
    poliklinikKey: mapped?.poliklinikKey || "dahiliye",
    poliklinikAd: mapped?.poliklinikAd || "Dahiliye",
    poliklinikIcon: mapped?.poliklinikIcon || "🩺",
    snomedCodes: [code],
    kabulEdilenTani: [...new Set([hastalikAdi, mapped?.hastalikAdi].filter(Boolean))] as string[],
    priority: mapped?.priority || 999,
  };
}

/**
 * Synthea LOINC → granüler kanonik testKey.
 * MIMIC'in panel-bazlı eşlemesinin (ELEKTROLIT, KOLESTEROL, CBC, IDRAR) üstüne,
 * Synthea'nın bireysel analit LOINC'lerini granüler anahtarlara çözer.
 */
export const SYNTHEA_LOINC_TO_TESTKEY: Record<string, string> = {
  // Metabolik panel (granüler)
  "2339-0": "GLUKOZ",
  "2345-7": "GLUKOZ",
  "38483-4": "KREATININ",
  "2160-0": "KREATININ",
  "2947-0": "NA",
  "2951-2": "NA",
  "6298-4": "K",
  "2823-3": "K",
  "2069-3": "CL",
  "2075-0": "CL",
  "49765-1": "CA",
  "17861-6": "CA",
  "20565-8": "HCO3",
  "2028-9": "HCO3",
  "6299-2": "URE",
  "3094-0": "URE",
  "33914-3": "GFR",
  "19123-9": "MG",
  "21377-7": "MG",
  "2777-1": "PHOS",
  // Lipid panel
  "2093-3": "CHOL",
  "2571-8": "TRIG",
  "18262-6": "LDL",
  "2085-9": "HDL",
  // CBC / hemogram bileşenleri
  "718-7": "HGB",
  "6690-2": "WBC",
  "26464-8": "WBC",
  "789-8": "RBC",
  "26453-1": "RBC",
  "777-3": "PLT",
  "26515-7": "PLT",
  "4544-3": "HCT",
  "20570-8": "HCT",
  "787-2": "MCV",
  "30428-7": "MCV",
  "788-0": "RBC",
  "785-6": "MCH",
  "786-4": "MCHC",
  // Karaciğer
  "1920-8": "AST",
  "1742-6": "ALT",
  "6768-6": "ALP",
  "1975-2": "TBIL",
  "42719-5": "TBIL",
  "1751-7": "ALBUMIN",
  "2885-2": "ALBUMIN",
  // Kardiyak
  "89579-7": "TROPONIN",
  "33762-6": "BNP",
  "71425-3": "BNP",
  "1988-5": "CRP",
  "33959-8": "PROCT",
  "2157-6": "KREATININ_KINAZ",
  "10230-1": "EKG",
  // Tiroid
  "3016-3": "TSH",
  // Koagülasyon
  "5902-2": "PT",
  "3173-2": "PTT",
  "6301-6": "INR",
  "48065-7": "DDIMER",
  // Demir
  "2276-4": "FERITIN",
  "2498-4": "DEMIR",
  // ABG
  "2744-1": "PH",
  "2746-6": "PH",
  "2019-8": "PCO2",
  "2021-4": "PCO2",
  "2703-7": "PO2",
  "2705-2": "PO2",
  "1960-4": "HCO3",
  "14627-4": "HCO3",
  // İdrar (granüler)
  "5804-0": "U_PROTEIN",
  "20454-5": "U_PROTEIN",
  "5792-7": "U_GLUKOZ",
  "25428-4": "U_GLUKOZ",
  "5803-2": "U_PH",
  "5811-5": "U_SG",
  "14959-1": "U_PROTEIN",
  // Diğer
  "4548-4": "HBA1C",
};

/** label keyword (lowercase) → testKey (Synthea'ya özel ek eşleşmeler) */
export const SYNTHEA_LAB_LABEL_KEYWORDS: { match: RegExp; testKey: string }[] = [
  { match: /left ventricular ejection|ejection fraction/i, testKey: "EKG" },
];

export function mapSyntheaLoincToTestKey(opts: {
  loinc?: string | null;
  description?: string | null;
}): string | null {
  const loinc = opts.loinc?.trim();
  if (loinc && SYNTHEA_LOINC_TO_TESTKEY[loinc]) {
    return canonicalizeTestKey(SYNTHEA_LOINC_TO_TESTKEY[loinc]);
  }
  // Ortak LOINC + label-keyword eşlemesine düş (MIMIC eşlemelerini paylaşır)
  return mapLoincOrLabelToTestKey({ loinc, label: opts.description });
}

export function syntheaLabDisplayName(testKey: string, fallback?: string): string {
  return labDisplayName(testKey, fallback);
}

/** Synthea sigara durumu (SNOMED tabanlı metin) → Türkçe. */
export const SMOKING_STATUS_TR: Record<string, string> = {
  "Never smoked tobacco (finding)": "Sigara içmiyor",
  "Ex-smoker (finding)": "Eski sigara içicisi",
  "Smokes tobacco daily (finding)": "Her gün sigara içiyor",
  "Current every day smoker": "Her gün sigara içiyor",
  "Current some day smoker": "Ara sıra sigara içiyor",
  "Former smoker": "Eski sigara içicisi",
  "Heavy tobacco smoker": "Ağır sigara içicisi",
  "Light tobacco smoker": "Hafif sigara içicisi",
  "Smoker, current status unknown": "Sigara içiyor",
};

export function localizeSmokingStatus(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return SMOKING_STATUS_TR[trimmed] || trimmed;
}

export { genderToCinsiyet, ageToRange };

export function computeAgeYearsFromBirthdate(
  birthdate: Date | null | undefined,
  deathdate?: Date | null | undefined
): number {
  if (!birthdate) return 55;
  const end = deathdate ?? new Date();
  const start = new Date(birthdate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 55;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age > 0 && age < 120 ? age : 55;
}

export function testAdiOrFallback(testKey: string, fallback?: string): string {
  return testAdiForKey(testKey) || fallback || testKey;
}
