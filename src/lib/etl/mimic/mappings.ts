/**
 * MIMIC/OMOP → TIP-AI sözlük eşlemeleri
 * - ICD-10 → hastalikKey / poliklinik
 * - LOINC / label keywords → kanonik testKey
 */

import { DiseaseMapping } from "./types";
import { canonicalizeTestKey, testAdiForKey } from "../../cdm/vocabulary";

export const DISEASE_MAPPINGS: DiseaseMapping[] = [
  {
    hastalikKey: "stemi",
    hastalikAdi: "ST Elevasyonlu MI",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    icd10Prefixes: ["I21.0", "I21.1", "I21.2", "I21.3"],
    kabulEdilenTani: ["STEMI", "ST Elevasyonlu MI", "Akut MI", "Akut Koroner Sendrom"],
    priority: 1,
  },
  {
    hastalikKey: "nstemi",
    hastalikAdi: "Non-ST Elevasyonlu MI",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    icd10Prefixes: ["I21.4", "I22"],
    kabulEdilenTani: ["NSTEMI", "Non-ST Elevasyonlu MI", "Akut Koroner Sendrom"],
    priority: 2,
  },
  {
    hastalikKey: "kalp-yetmezligi",
    hastalikAdi: "Kalp Yetmezliği",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    icd10Prefixes: ["I50"],
    kabulEdilenTani: ["Kalp Yetmezliği", "Konjestif Kalp Yetmezliği", "KY"],
    priority: 5,
  },
  {
    hastalikKey: "atriyal-fibrilasyon",
    hastalikAdi: "Atriyal Fibrilasyon",
    poliklinikKey: "kardiyoloji",
    poliklinikAd: "Kardiyoloji",
    poliklinikIcon: "❤️",
    icd10Prefixes: ["I48"],
    kabulEdilenTani: ["Atriyal Fibrilasyon", "AF"],
    priority: 6,
  },
  {
    hastalikKey: "tip-2-diyabet",
    hastalikAdi: "Tip 2 Diyabet",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrinoloji",
    poliklinikIcon: "🩺",
    icd10Prefixes: ["E11"],
    kabulEdilenTani: ["Tip 2 Diyabet", "Tip 2 Diabetes Mellitus", "T2DM", "DM"],
    priority: 10,
  },
  {
    hastalikKey: "hipotiroidi",
    hastalikAdi: "Hipotiroidi",
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrinoloji",
    poliklinikIcon: "🩺",
    icd10Prefixes: ["E03", "E89.0"],
    kabulEdilenTani: ["Hipotiroidi", "Primer Hipotiroidi"],
    priority: 11,
  },
  {
    hastalikKey: "pnomoni",
    hastalikAdi: "Pnömoni",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    icd10Prefixes: ["J18", "J15", "J13", "J14"],
    kabulEdilenTani: ["Pnömoni", "Toplum Kazanılmış Pnömoni", "TKP"],
    priority: 15,
  },
  {
    hastalikKey: "koah",
    hastalikAdi: "KOAH",
    poliklinikKey: "solunum",
    poliklinikAd: "Göğüs Hastalıkları",
    poliklinikIcon: "🫁",
    icd10Prefixes: ["J44"],
    kabulEdilenTani: ["KOAH", "KOAH Akut Ekspazerbasyonu"],
    priority: 16,
  },
  {
    hastalikKey: "kbh",
    hastalikAdi: "Kronik Böbrek Hastalığı",
    poliklinikKey: "nefroloji",
    poliklinikAd: "Nefroloji",
    poliklinikIcon: "🫘",
    icd10Prefixes: ["N18"],
    kabulEdilenTani: ["Kronik Böbrek Hastalığı", "KBH", "CKD", "KBH Evre 3"],
    priority: 20,
  },
  {
    hastalikKey: "abh",
    hastalikAdi: "Akut Böbrek Hasarı",
    poliklinikKey: "nefroloji",
    poliklinikAd: "Nefroloji",
    poliklinikIcon: "🫘",
    icd10Prefixes: ["N17"],
    kabulEdilenTani: ["Akut Böbrek Hasarı", "ABH", "AKI"],
    priority: 21,
  },
  {
    hastalikKey: "iye",
    hastalikAdi: "İdrar Yolu Enfeksiyonu",
    poliklinikKey: "enfeksiyon",
    poliklinikAd: "Enfeksiyon Hastalıkları",
    poliklinikIcon: "🦠",
    icd10Prefixes: ["N39.0", "N30", "N10"],
    kabulEdilenTani: ["İYE", "İdrar Yolu Enfeksiyonu", "Sistit", "Piyelonefrit"],
    priority: 25,
  },
  {
    hastalikKey: "demir-eksikligi-anemisi",
    hastalikAdi: "Demir Eksikliği Anemisi",
    poliklinikKey: "hematoloji",
    poliklinikAd: "Hematoloji",
    poliklinikIcon: "🩸",
    icd10Prefixes: ["D50"],
    kabulEdilenTani: ["Demir Eksikliği Anemisi", "IDA", "Anemi"],
    priority: 30,
  },
];

/** LOINC → kanonik testKey */
export const LOINC_TO_TESTKEY: Record<string, string> = {
  "2345-7": "GLUKOZ",
  "2339-0": "GLUKOZ",
  "1558-6": "GLUKOZ",
  "4548-4": "HBA1C",
  "2160-0": "KREATININ",
  "38483-4": "KREATININ",
  "3094-0": "URE",
  "2951-2": "ELEKTROLIT", // sodium - panel key
  "2823-3": "ELEKTROLIT", // potassium
  "1920-8": "AST",
  "1742-6": "ALT",
  "3016-3": "TSH",
  "3024-7": "T4",
  "1988-5": "CRP",
  "10839-9": "TROPONIN",
  "89579-7": "TROPONIN",
  "30934-4": "BNP",
  "2093-3": "KOLESTEROL",
  "2085-9": "KOLESTEROL", // HDL
  "2089-1": "KOLESTEROL", // LDL
  "718-7": "CBC", // hemoglobin
  "6690-2": "CBC", // WBC
  "777-3": "CBC", // platelets
  "2276-4": "FERITIN",
  "2498-4": "DEMIR",
  "48065-7": "D_DIMER",
  "5902-2": "PT",
  "3173-2": "PTT",
  "5792-7": "IDRAR", // glucose urine
  "20454-5": "IDRAR", // protein urine
};

/** label keyword (lowercase) → testKey */
export const LAB_LABEL_KEYWORDS: { match: RegExp; testKey: string }[] = [
  { match: /troponin/i, testKey: "TROPONIN" },
  { match: /\bbnp\b|nt-?probnp/i, testKey: "BNP" },
  { match: /glucose|glukoz|kan şekeri|blood sugar/i, testKey: "GLUKOZ" },
  { match: /hba1c|a1c|hemoglobin a1c/i, testKey: "HBA1C" },
  { match: /creatinine|kreatinin/i, testKey: "KREATININ" },
  { match: /\bbun\b|urea|üre/i, testKey: "URE" },
  { match: /sodium|potassium|sodyum|potasyum|electrolyte/i, testKey: "ELEKTROLIT" },
  { match: /\bast\b|sgot|aspartate/i, testKey: "AST" },
  { match: /\balt\b|sgpt|alanine amino/i, testKey: "ALT" },
  { match: /\btsh\b/i, testKey: "TSH" },
  { match: /free t4|serbest t4|\bt4\b/i, testKey: "T4" },
  { match: /\bcrp\b|c-reactive/i, testKey: "CRP" },
  { match: /cholesterol|lipid|ldl|hdl|triglyc/i, testKey: "KOLESTEROL" },
  { match: /hemoglobin(?!\s*a1c)|wbc|platelet|hematocrit|cbc|hemogram/i, testKey: "CBC" },
  { match: /ferritin|ferritin/i, testKey: "FERITIN" },
  { match: /iron|demir|tibc|tdbk/i, testKey: "DEMIR" },
  { match: /d-?dimer/i, testKey: "D_DIMER" },
  { match: /\bpt\b|inr|prothrombin/i, testKey: "PT" },
  { match: /aptt|ptt/i, testKey: "PTT" },
  { match: /urine|idrar|urinalysis/i, testKey: "IDRAR" },
  { match: /ph arterial|pco2|po2|blood gas|abg/i, testKey: "ABG" },
];

export function mapLoincOrLabelToTestKey(opts: {
  loinc?: string | null;
  label?: string | null;
  itemid?: string | null;
}): string | null {
  if (opts.loinc) {
    const k = LOINC_TO_TESTKEY[opts.loinc.trim()];
    if (k) return canonicalizeTestKey(k);
  }
  const label = opts.label || "";
  for (const row of LAB_LABEL_KEYWORDS) {
    if (row.match.test(label)) return canonicalizeTestKey(row.testKey);
  }
  return null;
}

export function resolveDiseaseFromIcd(
  codes: string[]
): DiseaseMapping | null {
  const upper = codes.map((c) => c.toUpperCase().replace(/\s/g, ""));
  let best: DiseaseMapping | null = null;
  for (const m of DISEASE_MAPPINGS) {
    for (const prefix of m.icd10Prefixes) {
      const p = prefix.toUpperCase();
      if (upper.some((c) => c.startsWith(p) || c.replace(".", "").startsWith(p.replace(".", "")))) {
        if (!best || m.priority < best.priority) best = m;
      }
    }
  }
  return best;
}

export function genderToCinsiyet(g: "M" | "F"): "E" | "K" {
  return g === "M" ? "E" : "K";
}

export function ageToRange(age: number, window = 5): [number, number] {
  const min = Math.max(1, age - window);
  const max = Math.min(100, age + window);
  return [min, max];
}

export function computeAgeYears(opts: {
  anchorAge?: number;
  dob?: string;
  admittime?: string;
}): number {
  if (opts.anchorAge != null && opts.anchorAge > 0) {
    return Math.round(opts.anchorAge);
  }
  if (opts.dob && opts.admittime) {
    const dob = new Date(opts.dob);
    const adm = new Date(opts.admittime);
    if (!Number.isNaN(dob.getTime()) && !Number.isNaN(adm.getTime())) {
      let age = adm.getFullYear() - dob.getFullYear();
      const m = adm.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && adm.getDate() < dob.getDate())) age--;
      if (age > 0 && age < 120) return age;
    }
  }
  return 55;
}

export function labDisplayName(testKey: string, fallback?: string): string {
  return testAdiForKey(testKey) || fallback || testKey;
}
