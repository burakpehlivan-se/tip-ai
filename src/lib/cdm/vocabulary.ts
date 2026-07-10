/**
 * TIP-AI CDM v1 sözlükleri — tek isim / tek kod.
 * Lab anahtarları birlesikTestKatalogu ile hizalıdır.
 */

import { birlesikTestKatalogu } from "../data";

/** Eski / alternatif lab kodlarını kanonik testKey’e çevir */
export const TEST_KEY_ALIASES: Record<string, string> = {
  IDRAR_TETKIK: "IDRAR",
  IDRAR_TAHLIL: "IDRAR",
  URINALYSIS: "IDRAR",
  UA: "IDRAR",
  GLU_FAST: "GLUKOZ",
  GLUCOSE: "GLUKOZ",
  FBS: "GLUKOZ",
  AKS: "GLUKOZ",
  CREATININE: "KREATININ",
  CRE: "KREATININ",
  BUN: "URE",
  UREA: "URE",
  NA_K: "ELEKTROLIT",
  ELECTROLYTES: "ELEKTROLIT",
  LIPID: "KOLESTEROL",
  LIPID_PANEL: "KOLESTEROL",
  HEMOGLOBIN_A1C: "HBA1C",
  A1C: "HBA1C",
  TROP: "TROPONIN",
  HS_TROPONIN: "TROPONIN",
  CXR: "AKCIGER_GRAFISI",
  CHEST_XRAY: "AKCIGER_GRAFISI",
  CT_ABDOMEN: "BT_ABDOMEN",
  CT_HEAD: "BT_KRANIYAL",
  CT_CHEST: "BT_TORAKS",
  BETA_HCG: "BHCG",
  CK: "KREATININ_KINAZ",
  LFT: "KARACIGER_ENZIM",
  LFTS: "KARACIGER_ENZIM",
  BT_ANJIYO: "BT_TORAKS", // yoksa en yakın genel; uyarı validate’te
};

export function canonicalizeTestKey(key: string): string {
  const k = String(key || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return TEST_KEY_ALIASES[k] || k;
}

export function knownTestKeys(): Set<string> {
  return new Set(birlesikTestKatalogu.map((t) => t.key));
}

export function testAdiForKey(key: string): string | undefined {
  const canon = canonicalizeTestKey(key);
  return birlesikTestKatalogu.find((t) => t.key === canon)?.ad;
}

/** Yerel condition kodları (OMOP condition_concept_id yerine) */
export const CONDITION_VOCAB: Record<
  string,
  { ad: string; synonyms?: string[]; system?: "local" | "icd10" }
> = {
  T2DM: { ad: "Tip 2 Diabetes Mellitus", synonyms: ["tip 2 diyabet", "dm2"], system: "local" },
  HTN: { ad: "Esansiyel Hipertansiyon", synonyms: ["hipertansiyon", "ht"], system: "local" },
  CKD_G3: { ad: "Kronik Böbrek Hastalığı Evre 3", synonyms: ["kbh evre 3", "ckd 3"], system: "local" },
  CKD_G4: { ad: "Kronik Böbrek Hastalığı Evre 4", synonyms: ["kbh evre 4"], system: "local" },
  CKD: { ad: "Kronik Böbrek Hastalığı", synonyms: ["kbh", "ckd"], system: "local" },
  AKI: { ad: "Akut Böbrek Hasarı", synonyms: ["abh", "aki"], system: "local" },
  STEMI: { ad: "STEMI", synonyms: ["st elevasyonlu mi"], system: "local" },
  NSTEMI: { ad: "NSTEMI", synonyms: ["st elevasyonsuz mi"], system: "local" },
  ACS: { ad: "Akut Koroner Sendrom", synonyms: ["acs"], system: "local" },
  HF: { ad: "Kalp Yetmezliği", synonyms: ["ky", "kalp yetmezliği"], system: "local" },
  AF: { ad: "Atriyal Fibrilasyon", synonyms: ["af", "atriyal fibrilasyon"], system: "local" },
  HYPOTHYROID: { ad: "Hipotiroidi", synonyms: ["hipotiroidi"], system: "local" },
  HYPERTHYROID: { ad: "Hipertiroidi", synonyms: ["hipertiroidi"], system: "local" },
  PNEUMONIA: { ad: "Pnömoni", synonyms: ["pnömoni", "pnomoni"], system: "local" },
  COPD: { ad: "KOAH", synonyms: ["koah"], system: "local" },
  ASTHMA: { ad: "Astım", synonyms: ["astim", "astım"], system: "local" },
  UTI: { ad: "İdrar Yolu Enfeksiyonu", synonyms: ["iye", "uti"], system: "local" },
  IDA: { ad: "Demir Eksikliği Anemisi", synonyms: ["demir eksikliği"], system: "local" },
  NEPHROTIC: { ad: "Nefrotik Sendrom", synonyms: ["nefrotik"], system: "local" },
};

/** Standart vital alanları */
export const VITAL_FIELDS = ["tansiyon", "nabiz", "ates", "spo2", "solunum"] as const;
export type VitalField = (typeof VITAL_FIELDS)[number];

/** OSCE tarzı zorunlu başlıklar (yazar checklist) */
export const OSCE_SECTION_CHECKLIST = [
  { id: "presentation.anaSikayet", label: "Ana şikayet (chief complaint)" },
  { id: "presentation.ozetBilgiler", label: "HPI / özet bilgiler" },
  { id: "patient.yasAraligi", label: "Demografi (yaş aralığı)" },
  { id: "conditions", label: "Tanı(lar) — conditions" },
  { id: "rubric.beklenenSorular", label: "Beklenen anamnez soruları" },
  { id: "rubric.beklenenTestler", label: "Beklenen tetkikler" },
  { id: "rubric.redFlagler", label: "Red flags" },
  { id: "rubric.kabulEdilenTani", label: "Kabul edilen tanılar" },
  { id: "labs.statikTestler", label: "Lab / measurement sonuçları" },
  { id: "vitals", label: "Vitaller" },
  { id: "hastaYanitlari", label: "Simüle hasta yanıtları" },
  { id: "management.idealYol", label: "İdeal klinik yol (A&P)" },
  { id: "management.egitimNotu", label: "Eğitim notu" },
  { id: "management.tedavi", label: "Tedavi / ilaç / prosedür" },
] as const;

/** Soru key önerileri (OSCE blokları) */
export const STANDARD_QUESTION_KEYS = {
  VITAL_TANSIYON: { kategori: "Vital", etiket: "Kan basıncı" },
  VITAL_NABIZ: { kategori: "Vital", etiket: "Nabız" },
  VITAL_ATES: { kategori: "Vital", etiket: "Ateş" },
  VITAL_SPO2: { kategori: "Vital", etiket: "SpO2" },
  ILAC_OYKUSU: { kategori: "Ilac", etiket: "İlaç kullanımı" },
  AILE_OYKUSU: { kategori: "Aile", etiket: "Aile öyküsü" },
  SIGARA: { kategori: "Sosyal", etiket: "Sigara" },
} as const;

export const CDM_SPEC_SUMMARY = {
  name: "TIP-AI CDM v1",
  version: "tip-ai-cdm-v1",
  inspiredBy: ["OMOP CDM (person, condition, measurement, procedure, drug)", "OSCE / Virtual Patient case structure"],
  principles: [
    "Tanı, test ve ilaçlar sabit kodlarla yazılır",
    "Lab anahtarları birleşik test kataloğuna (canonical testKey) uyar",
    "Her vaka aynı OSCE başlıklarını doldurur",
    "Serbest metin (şikayet, eğitim notu) yapısal alanların üzerine gelir",
  ],
} as const;
