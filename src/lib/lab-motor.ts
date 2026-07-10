import { TestSonucu, ClinicalProfile } from "./types";
import { LAB_REFERANSLAR, HASTALIK_TEST_MAP, gercekciTestDegeri } from "./data/clinical-reference";

// ─── Master Lab Catalogue (genişletilmiş) ───
interface LabDef {
  code: string;
  name: string;
  unit: string;
  refLow: number;
  refHigh: number;
  profileAdjust?: (profile: ClinicalProfile) => "normal" | "yuksek" | "dusuk";
}

const LAB_CATALOGUE: Record<string, LabDef> = {};
for (const r of LAB_REFERANSLAR) {
  LAB_CATALOGUE[r.testKey] = {
    code: r.testKey,
    name: r.testAdi,
    unit: r.birim,
    refLow: r.normalAlt,
    refHigh: r.normalUst,
  };
}

// ─── Profile Adjustment Rules ───
function sampleFromRange(low: number, high: number, tendency: "normal" | "yuksek" | "dusuk"): number {
  const mid = (low + high) / 2;
  const range = high - low;
  
  if (tendency === "normal") {
    // Normal: range'in ortasında, hafif varyans
    return Math.round((mid + (Math.random() - 0.5) * range * 0.4) * 100) / 100;
  } else if (tendency === "yuksek") {
    // Yüksek: üst sınıra yakın
    return Math.round((high + range * (Math.random() * 0.3)) * 100) / 100;
  } else {
    // Düşük: alt sınıra yakın
    return Math.round((low - range * (Math.random() * 0.3)) * 100) / 100;
  }
}

function profileTendency(testCode: string, profile: ClinicalProfile): "normal" | "yuksek" | "dusuk" {
  const dx = profile.diagnoses[0] || "";
  const cm = profile.comorbidities.join(",");

  // Hastalığa özel pattern'ler
  const patterns: Record<string, Record<string, "yuksek" | "dusuk">> = {
    GLUKOZ: { "tip2-dm": "yuksek", diyabet: "yuksek", hipoglisemi: "dusuk" },
    HBA1C: { "tip2-dm": "yuksek", diyabet: "yuksek" },
    TROPONIN: { stemi: "yuksek", nstemi: "yuksek", "kalp-yetmezligi": "yuksek" },
    BNP: { "kalp-yetmezligi": "yuksek", stemi: "yuksek" },
    KREATININ: { kbh: "yuksek", abh: "yuksek", "ckd-ev3": "yuksek" },
    BUN: { kbh: "yuksek", abh: "yuksek" },
    TSH: { hipotiroidi: "yuksek", hipertiroidi: "dusuk" },
    FT4: { hipotiroidi: "dusuk", hipertiroidi: "yuksek" },
    CRP: { pnömoni: "yuksek", "akut-apandisit": "yuksek", enfeksiyon: "yuksek" },
    WBC: { pnömoni: "yuksek", "akut-apandisit": "yuksek", enfeksiyon: "yuksek" },
    AMILAZ: { "akut-pankreatit": "yuksek", pankreatit: "yuksek" },
    LIPAZ: { "akut-pankreatit": "yuksek", pankreatit: "yuksek" },
    HGB: { anemi: "dusuk", "demir-eksikligi-anemisi": "dusuk" },
    ALT: { hepatit: "yuksek", "akut-kolesistit": "yuksek" },
    AST: { hepatit: "yuksek", "akut-kolesistit": "yuksek" },
    TBIL: { hepatit: "yuksek", "koledokolitiazis": "yuksek" },
    DDIMER: { dvt: "yuksek", "pulmoner-emboli": "yuksek" },
    LACTATE: { sepsis: "yuksek", sok: "yuksek" },
    NA: { diyabet: "yuksek", "tip2-dm": "yuksek" },
    PH: { "koah-eks": "dusuk", pnömoni: "dusuk", astim: "dusuk" },
    PCO2: { "koah-eks": "yuksek" },
    PO2: { pnömoni: "dusuk", "koah-eks": "dusuk", astim: "dusuk" },
    ALBUMIN: { siroz: "dusuk", hepatit: "dusuk", nefrotik: "dusuk" },
    U_PROTEIN: { kbh: "yuksek", nefrotik: "yuksek", preeklampsi: "yuksek" },
    PLT: { preeklampsi: "dusuk", sepsis: "dusuk", "demir-eksikligi-anemisi": "yuksek" },
    K: { kbh: "yuksek", abh: "yuksek" },
    CA: { "meme-ca": "yuksek", "akciger-ca": "yuksek" },
    GFR: { kbh: "dusuk", abh: "dusuk" },
  };

  const diseasePatterns = patterns[testCode] || {};
  
  // Önce tanıya bak
  if (dx && diseasePatterns[dx]) return diseasePatterns[dx];
  
  // Sonra komorbiditelere
  for (const d of Object.keys(diseasePatterns)) {
    if (cm.includes(d)) return diseasePatterns[d];
  }

  return "normal";
}

// ─── Ana Motor Fonksiyonu ───
export function getLabResult(
  testKey: string,
  profile: ClinicalProfile,
  statikTestler?: Record<string, TestSonucu>
): TestSonucu | null {
  // Katman 1: Statik test varsa direkt dön
  if (statikTestler?.[testKey]) {
    return statikTestler[testKey];
  }

  // Katman 2: Lab motoru ile üret
  const def = LAB_CATALOGUE[testKey];
  if (!def) return null;

  // Panel/rapor tipi testler — text sonuç döner
  if (def.unit === "panel" || def.unit === "rapor") {
    const panelDescriptions: Record<string, string> = {
      ABG: "pH:7.38, pCO2:42, pO2:88, HCO3:24 — normal kan gazı",
      ELEKTROLIT: "Na:140, K:4.2, Cl:103, Ca:9.5, Mg:2.0 — normal",
      IDRAR: "Dansite:1020, pH:6.0, protein:negatif, glukoz:negatif — normal",
      KOLESTEROL: "Total:195, LDL:120, HDL:50, TG:140 mg/dL — normal",
      EKG: "Sinüs ritmi, HR:78, normal aks, ST/T normal",
      AKCIGER_GRAFISI: "PA Akciğer: normal, infiltrasyon yok",
      MAMOGRAFI: "Bilateral mamografi: normal, BIRADS 1",
      MEME_USG: "Meme USG: normal, kitle yok",
      BT_TORAKS: "Toraks BT: normal, mediasten normal",
      BIYOPSI: "Biyopsi: yetersiz materyal",
      BT_ABDOMEN: "BT Abdomen: normal, organomegali yok",
      BT_KRANIYAL: "BT Kraniyal: normal, kanama yok",
      USG_ABDOMEN: "USG Abdomen: normal, safra kesesi normal",
      PELVIK_USG: "Pelvik USG: normal, uterus ve overler normal",
      KARACIGER_ENZIM: "ALT:28, AST:32, ALP:85, GGT:35, TBil:0.8 — normal",
    };
    const desc = panelDescriptions[testKey] || `${def.name} — normal bulgular`;
    return {
      testKey, testAdi: def.name, tip: "text" as const,
      sonuc: desc,
      referans: "TIP-AI Lab Motoru",
      yorum: `${def.name} normal sınırlarda.`,
    };
  }

  const tendency = profileTendency(testKey, profile);
  const value = sampleFromRange(def.refLow, def.refHigh, tendency);

  const refStr = `${def.refLow}-${def.refHigh} ${def.unit}`;
  const statusText = tendency === "normal" ? "normal sınırlarda" : tendency === "yuksek" ? "yüksek" : "düşük";

  return {
    testKey,
    testAdi: def.name,
    tip: "numeric",
    sonuc: {
      deger: value,
      birim: def.unit,
      referansAralik: refStr,
    },
    referans: "TIP-AI Lab Motoru",
    yorum: `${def.name} ${statusText} (${refStr}).`,
  };
}

// Tüm hastalık testlerini tek seferde üret
export function generateFullPanel(
  diagnosis: string,
  profile: ClinicalProfile,
  existingTests?: Record<string, TestSonucu>
): Record<string, TestSonucu> {
  const panel: Record<string, TestSonucu> = { ...existingTests };
  const relevantTests = HASTALIK_TEST_MAP[diagnosis] || [];

  for (const testKey of relevantTests) {
    if (panel[testKey]) continue;
    const result = getLabResult(testKey, profile);
    if (result) panel[testKey] = result;
  }

  return panel;
}
