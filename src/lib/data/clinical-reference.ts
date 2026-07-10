// Tıbbi referans aralıkları ve klinik pattern'ler
// Kaynak: MIMIC-IV, AI-READI, OMOP CDM literatür taraması
// Tüm değerler sentetik vaka üretimi için referans amaçlıdır

export interface LabReferans {
  testKey: string;
  testAdi: string;
  birim: string;
  normalAlt: number;
  normalUst: number;
  kritikAlt?: number;
  kritikUst?: number;
  kategori: string;
}

export interface VitalPattern {
  durum: string;
  sistolikAlt: number;
  sistolikUst: number;
  diyastolikAlt: number;
  diyastolikUst: number;
  nabizAlt: number;
  nabizUst: number;
  solunumAlt: number;
  solunumUst: number;
  spo2Alt: number;
  atesAlt: number;
  atesUst: number;
}

// ─── Tam Laboratuvar Referans Aralıkları (MIMIC-IV labevents bazlı) ───
export const LAB_REFERANSLAR: LabReferans[] = [
  // Hematoloji
  { testKey: "CBC", testAdi: "Hemogram", birim: "panel", normalAlt: 0, normalUst: 0, kategori: "Hematoloji" },
  { testKey: "WBC", testAdi: "Lökosit", birim: "K/uL", normalAlt: 4.0, normalUst: 11.0, kritikUst: 30, kategori: "Hematoloji" },
  { testKey: "RBC", testAdi: "Eritrosit", birim: "M/uL", normalAlt: 4.2, normalUst: 5.9, kritikAlt: 2.0, kategori: "Hematoloji" },
  { testKey: "HGB", testAdi: "Hemoglobin", birim: "g/dL", normalAlt: 12.0, normalUst: 16.0, kritikAlt: 7.0, kategori: "Hematoloji" },
  { testKey: "HCT", testAdi: "Hematokrit", birim: "%", normalAlt: 36, normalUst: 48, kritikAlt: 20, kategori: "Hematoloji" },
  { testKey: "MCV", testAdi: "MCV", birim: "fL", normalAlt: 80, normalUst: 100, kategori: "Hematoloji" },
  { testKey: "PLT", testAdi: "Trombosit", birim: "K/uL", normalAlt: 150, normalUst: 450, kritikAlt: 20, kritikUst: 1000, kategori: "Hematoloji" },
  { testKey: "NEUT", testAdi: "Nötrofil", birim: "%", normalAlt: 40, normalUst: 75, kategori: "Hematoloji" },
  { testKey: "LYMPH", testAdi: "Lenfosit", birim: "%", normalAlt: 20, normalUst: 45, kategori: "Hematoloji" },
  { testKey: "EOS", testAdi: "Eozinofil", birim: "%", normalAlt: 0, normalUst: 6, kategori: "Hematoloji" },
  // Koagülasyon
  { testKey: "PT", testAdi: "Protrombin Zamanı", birim: "sn", normalAlt: 11, normalUst: 14, kritikUst: 30, kategori: "Koagülasyon" },
  { testKey: "PTT", testAdi: "aPTT", birim: "sn", normalAlt: 25, normalUst: 38, kritikUst: 80, kategori: "Koagülasyon" },
  { testKey: "INR", testAdi: "INR", birim: "", normalAlt: 0.9, normalUst: 1.2, kritikUst: 4.0, kategori: "Koagülasyon" },
  { testKey: "FIBRINOGEN", testAdi: "Fibrinojen", birim: "mg/dL", normalAlt: 200, normalUst: 400, kritikAlt: 100, kategori: "Koagülasyon" },
  { testKey: "DDIMER", testAdi: "D-Dimer", birim: "ng/mL", normalAlt: 0, normalUst: 500, kategori: "Koagülasyon" },
  // Kardiyak
  { testKey: "TROPONIN", testAdi: "Troponin I", birim: "ng/mL", normalAlt: 0, normalUst: 0.04, kritikUst: 1.0, kategori: "Kardiyak" },
  { testKey: "CKMB", testAdi: "CK-MB", birim: "ng/mL", normalAlt: 0, normalUst: 5, kritikUst: 25, kategori: "Kardiyak" },
  { testKey: "BNP", testAdi: "BNP", birim: "pg/mL", normalAlt: 0, normalUst: 100, kritikUst: 500, kategori: "Kardiyak" },
  { testKey: "MYOGLOBIN", testAdi: "Miyoglobin", birim: "ng/mL", normalAlt: 0, normalUst: 90, kategori: "Kardiyak" },
  // Karaciğer
  { testKey: "ALT", testAdi: "ALT", birim: "U/L", normalAlt: 10, normalUst: 40, kritikUst: 1000, kategori: "Karaciğer" },
  { testKey: "AST", testAdi: "AST", birim: "U/L", normalAlt: 10, normalUst: 40, kritikUst: 1000, kategori: "Karaciğer" },
  { testKey: "ALP", testAdi: "Alkalen Fosfataz", birim: "U/L", normalAlt: 40, normalUst: 130, kategori: "Karaciğer" },
  { testKey: "GGT", testAdi: "GGT", birim: "U/L", normalAlt: 5, normalUst: 40, kategori: "Karaciğer" },
  { testKey: "TBIL", testAdi: "Total Bilirubin", birim: "mg/dL", normalAlt: 0.3, normalUst: 1.2, kritikUst: 15, kategori: "Karaciğer" },
  { testKey: "DBIL", testAdi: "Direkt Bilirubin", birim: "mg/dL", normalAlt: 0, normalUst: 0.3, kategori: "Karaciğer" },
  { testKey: "ALBUMIN", testAdi: "Albumin", birim: "g/dL", normalAlt: 3.5, normalUst: 5.0, kritikAlt: 2.0, kategori: "Karaciğer" },
  // Böbrek
  { testKey: "KREATININ", testAdi: "Kreatinin", birim: "mg/dL", normalAlt: 0.7, normalUst: 1.3, kritikUst: 7.0, kategori: "Böbrek" },
  { testKey: "BUN", testAdi: "BUN", birim: "mg/dL", normalAlt: 7, normalUst: 20, kritikUst: 80, kategori: "Böbrek" },
  { testKey: "GFR", testAdi: "eGFR", birim: "mL/dk", normalAlt: 90, normalUst: 120, kritikAlt: 15, kategori: "Böbrek" },
  { testKey: "URIC_ACID", testAdi: "Ürik Asit", birim: "mg/dL", normalAlt: 3.5, normalUst: 7.2, kategori: "Böbrek" },
  // Elektrolitler
  { testKey: "NA", testAdi: "Sodyum", birim: "mmol/L", normalAlt: 135, normalUst: 145, kritikAlt: 120, kritikUst: 160, kategori: "Elektrolit" },
  { testKey: "K", testAdi: "Potasyum", birim: "mmol/L", normalAlt: 3.5, normalUst: 5.1, kritikAlt: 2.5, kritikUst: 6.5, kategori: "Elektrolit" },
  { testKey: "CL", testAdi: "Klor", birim: "mmol/L", normalAlt: 98, normalUst: 107, kategori: "Elektrolit" },
  { testKey: "CA", testAdi: "Kalsiyum", birim: "mg/dL", normalAlt: 8.5, normalUst: 10.5, kritikAlt: 6.5, kritikUst: 13, kategori: "Elektrolit" },
  { testKey: "MG", testAdi: "Magnezyum", birim: "mg/dL", normalAlt: 1.7, normalUst: 2.2, kritikAlt: 1.0, kategori: "Elektrolit" },
  { testKey: "PHOS", testAdi: "Fosfor", birim: "mg/dL", normalAlt: 2.5, normalUst: 4.5, kategori: "Elektrolit" },
  // Metabolik
  { testKey: "GLUKOZ", testAdi: "Glukoz", birim: "mg/dL", normalAlt: 70, normalUst: 100, kritikAlt: 40, kritikUst: 400, kategori: "Metabolik" },
  { testKey: "HBA1C", testAdi: "HbA1c", birim: "%", normalAlt: 4.0, normalUst: 5.7, kritikUst: 14, kategori: "Metabolik" },
  { testKey: "LACTATE", testAdi: "Laktat", birim: "mmol/L", normalAlt: 0.5, normalUst: 2.2, kritikUst: 4.0, kategori: "Metabolik" },
  { testKey: "AMMONIA", testAdi: "Amonyak", birim: "mcg/dL", normalAlt: 15, normalUst: 45, kritikUst: 100, kategori: "Metabolik" },
  // Lipid
  { testKey: "CHOL", testAdi: "Total Kolesterol", birim: "mg/dL", normalAlt: 0, normalUst: 200, kategori: "Lipid" },
  { testKey: "LDL", testAdi: "LDL", birim: "mg/dL", normalAlt: 0, normalUst: 130, kategori: "Lipid" },
  { testKey: "HDL", testAdi: "HDL", birim: "mg/dL", normalAlt: 40, normalUst: 60, kategori: "Lipid" },
  { testKey: "TRIG", testAdi: "Trigliserit", birim: "mg/dL", normalAlt: 0, normalUst: 150, kategori: "Lipid" },
  // Enflamasyon
  { testKey: "CRP", testAdi: "CRP", birim: "mg/L", normalAlt: 0, normalUst: 5, kritikUst: 200, kategori: "Enflamasyon" },
  { testKey: "ESR", testAdi: "Sedimentasyon", birim: "mm/saat", normalAlt: 0, normalUst: 20, kategori: "Enflamasyon" },
  { testKey: "PROCT", testAdi: "Prokalsitonin", birim: "ng/mL", normalAlt: 0, normalUst: 0.5, kritikUst: 10, kategori: "Enflamasyon" },
  { testKey: "FERITIN", testAdi: "Ferritin", birim: "ng/mL", normalAlt: 15, normalUst: 150, kategori: "Hematoloji" },
  // Pankreas
  { testKey: "AMILAZ", testAdi: "Amilaz", birim: "U/L", normalAlt: 30, normalUst: 110, kritikUst: 500, kategori: "Pankreas" },
  { testKey: "LIPAZ", testAdi: "Lipaz", birim: "U/L", normalAlt: 10, normalUst: 60, kritikUst: 300, kategori: "Pankreas" },
  // Tiroid
  { testKey: "TSH", testAdi: "TSH", birim: "mIU/L", normalAlt: 0.4, normalUst: 4.0, kritikUst: 30, kategori: "Tiroid" },
  { testKey: "FT4", testAdi: "Serbest T4", birim: "ng/dL", normalAlt: 0.8, normalUst: 1.8, kategori: "Tiroid" },
  { testKey: "FT3", testAdi: "Serbest T3", birim: "pg/mL", normalAlt: 2.3, normalUst: 4.2, kategori: "Tiroid" },
  // Arteriyel Kan Gazı
  { testKey: "PH", testAdi: "pH (ABG)", birim: "", normalAlt: 7.35, normalUst: 7.45, kritikAlt: 7.20, kritikUst: 7.60, kategori: "ABG" },
  { testKey: "PCO2", testAdi: "pCO2", birim: "mmHg", normalAlt: 35, normalUst: 45, kritikAlt: 25, kritikUst: 65, kategori: "ABG" },
  { testKey: "PO2", testAdi: "pO2", birim: "mmHg", normalAlt: 80, normalUst: 100, kritikAlt: 55, kategori: "ABG" },
  { testKey: "HCO3", testAdi: "HCO3", birim: "mmol/L", normalAlt: 22, normalUst: 26, kritikAlt: 15, kritikUst: 35, kategori: "ABG" },
  // İdrar
  { testKey: "U_PH", testAdi: "İdrar pH", birim: "", normalAlt: 5.0, normalUst: 8.0, kategori: "İdrar" },
  { testKey: "U_SG", testAdi: "İdrar Dansite", birim: "", normalAlt: 1.005, normalUst: 1.030, kategori: "İdrar" },
  { testKey: "U_PROTEIN", testAdi: "İdrar Protein", birim: "mg/dL", normalAlt: 0, normalUst: 15, kategori: "İdrar" },
  { testKey: "U_GLUKOZ", testAdi: "İdrar Glukoz", birim: "mg/dL", normalAlt: 0, normalUst: 15, kategori: "İdrar" },
];

// ─── Vital Pattern'leri (MIMIC-IV vitalsign bazlı) ───
export const VITAL_PATTERNLER: Record<string, VitalPattern> = {
  normal: { durum: "Normal", sistolikAlt: 100, sistolikUst: 130, diyastolikAlt: 60, diyastolikUst: 85, nabizAlt: 60, nabizUst: 90, solunumAlt: 12, solunumUst: 20, spo2Alt: 95, atesAlt: 36.0, atesUst: 37.2 },
  hipertansif: { durum: "Hipertansif", sistolikAlt: 140, sistolikUst: 180, diyastolikAlt: 85, diyastolikUst: 110, nabizAlt: 65, nabizUst: 95, solunumAlt: 14, solunumUst: 22, spo2Alt: 93, atesAlt: 36.0, atesUst: 37.5 },
  hipotansif: { durum: "Hipotansif", sistolikAlt: 75, sistolikUst: 95, diyastolikAlt: 40, diyastolikUst: 60, nabizAlt: 90, nabizUst: 120, solunumAlt: 16, solunumUst: 26, spo2Alt: 92, atesAlt: 36.0, atesUst: 37.5 },
  tasikardik: { durum: "Taşikardik", sistolikAlt: 95, sistolikUst: 130, diyastolikAlt: 55, diyastolikUst: 80, nabizAlt: 100, nabizUst: 140, solunumAlt: 18, solunumUst: 30, spo2Alt: 90, atesAlt: 37.0, atesUst: 39.0 },
  hipoksik: { durum: "Hipoksik", sistolikAlt: 90, sistolikUst: 140, diyastolikAlt: 50, diyastolikUst: 85, nabizAlt: 95, nabizUst: 130, solunumAlt: 22, solunumUst: 35, spo2Alt: 82, atesAlt: 36.5, atesUst: 39.0 },
  septik: { durum: "Septik", sistolikAlt: 70, sistolikUst: 100, diyastolikAlt: 35, diyastolikUst: 60, nabizAlt: 100, nabizUst: 145, solunumAlt: 24, solunumUst: 40, spo2Alt: 85, atesAlt: 38.0, atesUst: 41.0 },
};

// ─── Hastalık → Test Mapping (hangi testler hangi hastalıkta tipik olarak istenir) ───
export const HASTALIK_TEST_MAP: Record<string, string[]> = {
  stemi: ["CBC","WBC","HGB","PLT","TROPONIN","CKMB","BNP","KREATININ","BUN","NA","K","GLUKOZ","PT","PTT","CHOL","LDL","HDL","TRIG"],
  nstemi: ["CBC","HGB","PLT","TROPONIN","CKMB","BNP","KREATININ","BUN","NA","K","GLUKOZ","HBA1C","CHOL","LDL","HDL"],
  "kalp-yetmezligi": ["CBC","HGB","BNP","TROPONIN","KREATININ","BUN","NA","K","ALT","AST","TBIL","ALBUMIN","GLUKOZ","LACTATE"],
  "tip2-dm": ["CBC","GLUKOZ","HBA1C","KREATININ","BUN","NA","K","ALT","AST","CHOL","LDL","HDL","TRIG","U_PROTEIN"],
  hipotiroidi: ["TSH","FT4","FT3","CBC","HGB","CHOL","LDL","HDL","KREATININ","GLUKOZ","CA"],
  hipertiroidi: ["TSH","FT4","FT3","CBC","WBC","ALT","AST","CA","GLUKOZ"],
  pnömoni: ["CBC","WBC","NEUT","HGB","CRP","PROCT","NA","K","KREATININ","BUN","GLUKOZ","LACTATE","PH","PCO2","PO2","HCO3"],
  "koah-eks": ["CBC","HGB","WBC","CRP","PH","PCO2","PO2","HCO3","NA","K","GLUKOZ","BNP"],
  kbh: ["CBC","HGB","PLT","KREATININ","BUN","GFR","NA","K","CL","CA","PHOS","MG","ALBUMIN","TBIL","PH","PCO2","HCO3","U_PROTEIN","U_SG","FERITIN"],
  abh: ["CBC","HGB","PLT","KREATININ","BUN","NA","K","CL","CA","PHOS","MG","PH","PCO2","HCO3","U_SG","U_PROTEIN","LACTATE"],
  "meme-ca": ["CBC","HGB","PLT","KREATININ","BUN","ALT","AST","ALP","CA","GLUKOZ"],
  "akciger-ca": ["CBC","HGB","WBC","KREATININ","BUN","ALT","AST","ALP","TBIL","CA","GLUKOZ","ALBUMIN"],
  "akut-apandisit": ["CBC","WBC","NEUT","HGB","CRP","KREATININ","BUN","NA","K","GLUKOZ"],
  "akut-kolesistit": ["CBC","WBC","NEUT","HGB","CRP","ALT","AST","ALP","TBIL","DBIL","GGT","AMILAZ","LIPAZ","KREATININ"],
  "akut-pankreatit": ["CBC","WBC","HGB","CRP","AMILAZ","LIPAZ","ALT","AST","ALP","TBIL","GGT","CA","GLUKOZ","KREATININ","BUN","LACTATE"],
  "koledokolitiazis": ["CBC","WBC","ALT","AST","ALP","GGT","TBIL","DBIL","AMILAZ","LIPAZ","KREATININ","PT","INR"],
  "demir-eksikligi-anemisi": ["CBC","HGB","HCT","MCV","RBC","PLT","FERITIN","U_PROTEIN"],
  iye: ["U_PH","U_SG","U_PROTEIN","U_GLUKOZ","CBC","WBC","CRP","KREATININ"],
  "aort-anevrizmasi": ["CBC","HGB","PLT","KREATININ","BUN","NA","K","PT","PTT","INR","GLUKOZ","CHOL","LDL","HDL"],
  "periferik-arter": ["CBC","HGB","PLT","KREATININ","BUN","GLUKOZ","HBA1C","CHOL","LDL","HDL","TRIG","PT","PTT"],
  "diyabetik-noropati": ["GLUKOZ","HBA1C","CBC","KREATININ","BUN","TSH","FT4","CHOL","LDL","HDL","TRIG"],
  "diyabetik-retinopati": ["GLUKOZ","HBA1C","CBC","KREATININ","BUN","CHOL","LDL","HDL","TRIG"],
  astim: ["CBC","WBC","EOS","CRP","PH","PCO2","PO2","HCO3","NA","K","GLUKOZ"],
  "ckd-ev3": ["CBC","HGB","PLT","KREATININ","BUN","GFR","NA","K","CL","CA","PHOS","MG","ALBUMIN","TBIL","PH","PCO2","HCO3","U_PROTEIN","U_SG","FERITIN","GLUKOZ","HBA1C"],
  dcis: ["CBC","HGB","KREATININ","BUN","ALT","AST","ALP","CA","GLUKOZ"],
  "akut-bronsit": ["CBC","WBC","NEUT","CRP","KREATININ","GLUKOZ"],
  "stabil-angina": ["CBC","HGB","CHOL","LDL","HDL","TRIG","GLUKOZ","KREATININ","TROPONIN","CKMB"],
  kardiyomiyopati: ["CBC","HGB","BNP","TROPONIN","KREATININ","BUN","NA","K","ALT","AST","TBIL","ALBUMIN","GLUKOZ","LACTATE","TSH","FT4"],
  "akut-glokom": ["GOZ_BASINCI","GLUKOZ","CBC"],
  konjonktivit: ["CBC","WBC"],
  "akut-tonsillit": ["CBC","WBC","NEUT","CRP"],
  "otitis-media": ["CBC","WBC","CRP"],
  bph: ["CBC","KREATININ","BUN","NA","K","GLUKOZ"],
  urolitiazis: ["CBC","KREATININ","BUN","NA","K","CA","PHOS","URIC_ACID","U_PH","U_SG"],
  "kalca-kirigi": ["CBC","HGB","PLT","KREATININ","BUN","NA","K","GLUKOZ","PT","PTT","INR"],
  "diz-osteoartrit": ["CBC","KREATININ","GLUKOZ"],
  preeklampsi: ["CBC","HGB","PLT","KREATININ","BUN","ALT","AST","TBIL","ALBUMIN","U_PROTEIN","PT","PTT","FIBRINOGEN","GLUKOZ"],
  "ektopik-gebelik": ["CBC","HGB","PLT"],
  "subdural-hematom": ["CBC","HGB","PLT","PT","PTT","INR","KREATININ","BUN","NA","K","GLUKOZ"],
  "lomber-disk-hernisi": ["CBC","KREATININ"],
  varis: ["CBC","KREATININ","GLUKOZ"],
  dvt: ["CBC","HGB","PLT","DDIMER","PT","PTT","INR","FIBRINOGEN","KREATININ"],
  pnomotoraks: ["CBC","PH","PCO2","PO2","HCO3","KREATININ"],
  "plevral-efuzyon": ["CBC","WBC","CRP","ALT","AST","ALP","TBIL","ALBUMIN","KREATININ","GLUKOZ"],
  yanik: ["CBC","HGB","KREATININ","BUN","NA","K","GLUKOZ","ALBUMIN","LACTATE"],
  "el-tendon-yaralanmasi": ["CBC"],
  invajinasyon: ["CBC","WBC","KREATININ","BUN","NA","K","GLUKOZ","LACTATE"],
  "pilor-stenozu": ["CBC","NA","K","CL","PH","PCO2","HCO3","KREATININ","GLUKOZ"],
};

// ─── Gerçekçi test değeri üretme yardımcısı ───
export function gercekciTestDegeri(
  testKey: string,
  hastalik: string,
  cinsiyet: "E" | "K"
): { normal: boolean; deger: number } {
  const ref = LAB_REFERANSLAR.find((r) => r.testKey === testKey);
  if (!ref) return { normal: true, deger: 0 };

  // Hastalığa özel anormal pattern'ler
  const abnormalPatterns: Record<string, Record<string, { dir: "up" | "down"; factor: number }>> = {
    TROPONIN: { stemi: { dir: "up", factor: 20 }, nstemi: { dir: "up", factor: 2.5 }, "kalp-yetmezligi": { dir: "up", factor: 1.5 } },
    BNP: { "kalp-yetmezligi": { dir: "up", factor: 8 }, stemi: { dir: "up", factor: 3 }, nstemi: { dir: "up", factor: 2 } },
    GLUKOZ: { "tip2-dm": { dir: "up", factor: 1.8 }, preeklampsi: { dir: "up", factor: 1.3 } },
    HBA1C: { "tip2-dm": { dir: "up", factor: 1.8 }, "diyabetik-noropati": { dir: "up", factor: 2 } },
    KREATININ: { kbh: { dir: "up", factor: 2.5 }, abh: { dir: "up", factor: 2 } },
    TSH: { hipotiroidi: { dir: "up", factor: 4 }, hipertiroidi: { dir: "down", factor: 0.1 } },
    FT4: { hipertiroidi: { dir: "up", factor: 2.5 }, hipotiroidi: { dir: "down", factor: 0.4 } },
    CRP: { pnömoni: { dir: "up", factor: 15 }, "akut-apandisit": { dir: "up", factor: 12 }, "akut-kolesistit": { dir: "up", factor: 10 } },
    WBC: { pnömoni: { dir: "up", factor: 1.5 }, "akut-apandisit": { dir: "up", factor: 1.6 }, "akut-kolesistit": { dir: "up", factor: 1.5 } },
    AMILAZ: { "akut-pankreatit": { dir: "up", factor: 5 }, "koledokolitiazis": { dir: "up", factor: 3 } },
    LIPAZ: { "akut-pankreatit": { dir: "up", factor: 8 } },
    HGB: { "demir-eksikligi-anemisi": { dir: "down", factor: 0.55 }, "kalca-kirigi": { dir: "down", factor: 0.7 } },
    ALT: { "akut-kolesistit": { dir: "up", factor: 2 }, hepatit: { dir: "up", factor: 10 } },
    AST: { "akut-kolesistit": { dir: "up", factor: 2 }, hepatit: { dir: "up", factor: 8 } },
  };

  const pattern = abnormalPatterns[testKey]?.[hastalik];

  if (pattern) {
    const base = pattern.dir === "up" ? ref.normalUst : ref.normalAlt;
    const value = Math.round(base * pattern.factor * (0.85 + Math.random() * 0.3) * 100) / 100;
    return { normal: false, deger: value };
  }

  // Normal değer üret
  const range = ref.normalUst - ref.normalAlt;
  const value = Math.round((ref.normalAlt + Math.random() * range) * 100) / 100;
  return { normal: true, deger: value };
}
