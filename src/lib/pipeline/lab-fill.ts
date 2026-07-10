/**
 * Layer 3 + 4 — Lab Motoru ile Otomatik Tamamlama & ETL
 *
 *  - Her test için generationStrategy'ye göre değer üretir.
 *  - Rubrikte olup statikTestler'de eksik testleri `generatedTests`'e yazar
 *    (tek seferlik; sonraki çalıştırmalarda kalıcı kalır).
 *  - Runtime'da statikTestler + generatedTests birleştirilir.
 */

import { TestSonucu, ClinicalProfile, Cinsiyet } from "../types";
import { canonicalizeTestKey } from "../cdm/vocabulary";
import { buildClinicalProfile } from "../data/lab-katalog";
import { AdminVaka } from "../admin/types";
import { MASTER_TEST_CATALOGUE } from "./master-catalogue";
import { scanCase } from "./case-scanner";
import { CaseScanResult, FillResult, Tendency } from "./types";

// ─── Tanı → anormal yön eşlemesi ───
const DISEASE_TENDENCY: Record<
  string,
  Record<string, "yuksek" | "dusuk">
> = {
  TSH: { hipotiroidi: "yuksek", hipertiroidi: "dusuk" },
  FT4: { hipertiroidi: "yuksek", hipotiroidi: "dusuk" },
  FT3: { hipertiroidi: "yuksek", hipotiroidi: "dusuk" },
  GLUKOZ: { "tip-2-diyabet": "yuksek", hipoglisemi: "dusuk", "diyabetik-noropati": "yuksek" },
  HBA1C: { "tip-2-diyabet": "yuksek", "diyabetik-noropati": "yuksek" },
  KREATININ: { kbh: "yuksek", abh: "yuksek", "ckd-ev3": "yuksek", "nefrotik-sendrom": "yuksek" },
  URE: { kbh: "yuksek", abh: "yuksek", "ckd-ev3": "yuksek" },
  BUN: { kbh: "yuksek", abh: "yuksek" },
  CRP: { "pnomoni": "yuksek", "akut-apandisit": "yuksek", "akut-kolesistit": "yuksek", iye: "yuksek" },
  WBC: { "pnomoni": "yuksek", "akut-apandisit": "yuksek", "akut-kolesistit": "yuksek" },
  AMILAZ: { "akut-pankreatit": "yuksek", "koledokolitiazis": "yuksek" },
  LIPAZ: { "akut-pankreatit": "yuksek" },
  HGB: { "demir-eksikligi-anemisi": "dusuk", "kalca-kirigi": "dusuk" },
  ALT: { "akut-kolesistit": "yuksek", hepatit: "yuksek", "akut-pankreatit": "yuksek" },
  AST: { "akut-kolesistit": "yuksek", hepatit: "yuksek" },
  TBIL: { hepatit: "yuksek", koledokolitiazis: "yuksek" },
  D_DIMER: { dvt: "yuksek", "pulmoner-emboli": "yuksek" },
  LACTATE: { sepsis: "yuksek", sok: "yuksek" },
  NA: { "tip-2-diyabet": "yuksek" },
  K: { kbh: "yuksek", abh: "yuksek" },
  CA: { "meme-ca": "yuksek", "akciger-ca": "yuksek" },
  GFR: { kbh: "dusuk", abh: "dusuk" },
  BNP: { "kalp-yetmezligi": "yuksek", stemi: "yuksek", nstemi: "yuksek" },
  TROPONIN: { stemi: "yuksek", nstemi: "yuksek", "stabil-angina": "yuksek" },
  ALBUMIN: { siroz: "dusuk", hepatit: "dusuk", nefrotik: "dusuk" },
  U_PROTEIN: { kbh: "yuksek", nefrotik: "yuksek", "preeklampsi": "yuksek" },
  PLT: { "preeklampsi": "dusuk", sepsis: "dusuk", "demir-eksikligi-anemisi": "yuksek" },
  PH: { "koah-eks": "dusuk", "pnomoni": "dusuk", astim: "dusuk" },
  PCO2: { "koah-eks": "yuksek" },
  PO2: { "pnomoni": "dusuk", "koah-eks": "dusuk", astim: "dusuk" },
};

const DOWN_DISEASES = new Set([
  "hipoglisemi",
  "hipotiroidi",
  "demir-eksikligi-anemisi",
  "kalca-kirigi",
  "kbh",
  "abh",
  "ckd-ev3",
  "siroz",
  "nefrotik",
  "preeklampsi",
  "sepsis",
  "koah-eks",
  "pnomoni",
  "astim",
]);

function pickTendency(
  testKey: string,
  def: { pathologyDiagnoses?: string[] },
  profile: ClinicalProfile
): Tendency | null {
  const table = DISEASE_TENDENCY[testKey];
  const dx = profile.hastalikKey || profile.diagnoses[0] || "";
  const cm = [
    ...(profile.comorbidities || []),
    ...profile.diagnoses,
  ].join(",");

  if (table) {
    if (dx && table[dx]) return table[dx];
    for (const d of Object.keys(table)) {
      if (cm.includes(d)) return table[d];
    }
  }

  // Def patoloji listesine gore varsayılan yön
  if (def.pathologyDiagnoses?.includes(dx)) {
    return DOWN_DISEASES.has(dx) ? "dusuk" : "yuksek";
  }
  return null;
}

function refRangeForSex(
  def: { refRangeMale: [number, number] | null; refRangeFemale: [number, number] | null },
  sex: Cinsiyet
): [number, number] | null {
  const rr = sex === "K" ? def.refRangeFemale : def.refRangeMale;
  return rr ?? def.refRangeMale ?? def.refRangeFemale ?? null;
}

function sampleNumeric(low: number, high: number, tendency: Tendency): number {
  const mid = (low + high) / 2;
  const range = high - low || 1;
  let v: number;
  if (tendency === "normal") {
    v = mid + (Math.random() - 0.5) * range * 0.4;
  } else if (tendency === "yuksek") {
    v = high + range * (Math.random() * 0.25 - 0.05);
  } else {
    v = low - range * (Math.random() * 0.25 - 0.05);
  }
  return Math.round(v * 100) / 100;
}

function statusText(t: Tendency): string {
  return t === "normal" ? "normal sınırlarda" : t === "yuksek" ? "yüksek" : "düşük";
}

// ─── Panel normal değerleri ───
const PANEL_NORMALS: Record<
  string,
  Record<string, { v: number | string; u?: string }>
> = {
  CBC: {
    hemoglobin: { v: 14, u: "g/dL" },
    lokosit: { v: 7, u: "K/uL" },
    trombosit: { v: 250, u: "K/uL" },
    hematokrit: { v: 42, u: "%" },
    mcv: { v: 90, u: "fL" },
  },
  ELEKTROLIT: {
    sodyum: { v: 140, u: "mmol/L" },
    potasyum: { v: 4.2, u: "mmol/L" },
    klor: { v: 103, u: "mmol/L" },
  },
  KOLESTEROL: {
    totalKolesterol: { v: 185, u: "mg/dL" },
    ldl: { v: 110, u: "mg/dL" },
    hdl: { v: 52, u: "mg/dL" },
    trigliserit: { v: 130, u: "mg/dL" },
  },
  IDRAR: {
    dansite: { v: 1020, u: "" },
    pH: { v: 6, u: "" },
    protein: { v: "negatif", u: "" },
    glukoz: { v: "negatif", u: "" },
  },
  ABG: {
    pH: { v: 7.4, u: "" },
    pCO2: { v: 40, u: "mmHg" },
    pO2: { v: 92, u: "mmHg" },
    HCO3: { v: 24, u: "mmol/L" },
  },
  DEMIR: {
    serumDemir: { v: 90, u: "mcg/dL" },
    tdbk: { v: 300, u: "mcg/dL" },
    transferrinSaturasyonu: { v: 30, u: "%" },
  },
  KARACIGER_ENZIM: {
    alt: { v: 28, u: "U/L" },
    ast: { v: 30, u: "U/L" },
    alp: { v: 85, u: "U/L" },
    ggt: { v: 35, u: "U/L" },
    tBil: { v: 0.8, u: "mg/dL" },
  },
  PT: {
    PT: { v: 12, u: "sn" },
    INR: { v: 1.0, u: "" },
  },
};

function panelTweaks(
  key: string,
  profile: ClinicalProfile
): Record<string, { v: number | string; u?: string }> {
  const dx = profile.hastalikKey || profile.diagnoses[0] || "";
    const cm = [...(profile.comorbidities || []), ...profile.diagnoses].join(",");
  const t: Record<string, { v: number | string; u?: string }> = {};
  if (key === "CBC") {
    if (/anemi|anemia/i.test(dx) || cm.includes("demir-eksikligi-anemisi")) {
      t.hemoglobin = { v: 8.5, u: "g/dL" };
    }
  }
  if (key === "ELEKTROLIT") {
    if (cm.includes("kbh") || cm.includes("abh") || cm.includes("ckd-ev3")) {
      t.potasyum = { v: 5.6, u: "mmol/L" };
    }
  }
  if (key === "ABG") {
    if (cm.includes("koah-eks")) {
      t.pH = { v: 7.32, u: "" };
      t.pCO2 = { v: 55, u: "mmHg" };
    }
  }
  return t;
}

function generatePanelResult(
  key: string,
  def: { name: string; unit: string },
  profile: ClinicalProfile
): TestSonucu {
  const base = PANEL_NORMALS[key] || {};
  const tweaks = panelTweaks(key, profile);
  const sonuc: Record<string, string> = {};
  let abnormal = false;
  for (const [comp, meta] of Object.entries(base)) {
    const tv = tweaks[comp];
    const v = tv ? tv.v : meta.v;
    if (tv) abnormal = true;
    sonuc[comp] = `${v}${meta.u ? " " + meta.u : ""}`;
  }
  return {
    testKey: key,
    testAdi: def.name,
    tip: "json",
    sonuc,
    referans: "TIP-AI Lab Motoru",
    yorum: abnormal
      ? `${def.name} klinik profile uygun hafif anormal bileşenler içeriyor.`
      : `${def.name} normal sınırlarda.`,
    source: "synthetic",
  };
}

function generateNumericResult(
  key: string,
  def: (typeof MASTER_TEST_CATALOGUE)[string],
  profile: ClinicalProfile,
  tendency: Tendency
): TestSonucu {
  const rr = refRangeForSex(def, profile.sex);
  if (!rr || rr[0] == null || rr[1] == null) {
    // Referans yoksa anlamlı bir sayı üret (0 yerine 1 tabanlı)
    const value = tendency === "yuksek" ? 1.5 : tendency === "dusuk" ? 0.5 : 1.0;
    return {
      testKey: key,
      testAdi: def.name,
      tip: "numeric",
      sonuc: { deger: value, birim: def.unit, referansAralik: "—" },
      referans: "TIP-AI Lab Motoru",
      yorum: `${def.name} ${statusText(tendency)} (referans aralığı tanımsız).`,
      source: "synthetic",
    };
  }
  const value = sampleNumeric(rr[0], rr[1], tendency);
  const refStr = `${rr[0]}-${rr[1]} ${def.unit}`.trim();
  return {
    testKey: key,
    testAdi: def.name,
    tip: "numeric",
    sonuc: {
      deger: value,
      birim: def.unit,
      referansAralik: refStr,
    },
    referans: "TIP-AI Lab Motoru",
    yorum: `${def.name} ${statusText(tendency)} (${refStr}).`,
    source: "synthetic",
  };
}

/**
 * Tek test için lab motoru sonucu üret.
 * never_generate testlerde null döner (statik gerekli).
 */
export function generateLabResult(
  testKey: string,
  profile: ClinicalProfile
): TestSonucu | null {
  const key = canonicalizeTestKey(testKey);
  const def = MASTER_TEST_CATALOGUE[key];
  if (!def) return null;
  if (def.generationStrategy === "never_generate") return null;

  let tendency: Tendency;
  if (def.generationStrategy === "always_normal") tendency = "normal";
  else if (def.generationStrategy === "mildly_abnormal")
    tendency = pickTendency(key, def, profile) ?? "yuksek";
  else tendency = pickTendency(key, def, profile) ?? "normal";

  if (def.resultKind === "panel") {
    return generatePanelResult(key, def, profile);
  }
  return generateNumericResult(key, def, profile, tendency);
}

export function generationStrategyFor(testKey: string): string | undefined {
  const key = canonicalizeTestKey(testKey);
  return MASTER_TEST_CATALOGUE[key]?.generationStrategy;
}

/** Vakadan klinik profil üret */
export function profileFromVaka(vaka: AdminVaka): ClinicalProfile {
  const yasAraligi = vaka.yasAraligi || [30, 70];
  const yas = Math.round((yasAraligi[0] + yasAraligi[1]) / 2);
  const cinsiyet: Cinsiyet =
    vaka.cinsiyetTercih === "E"
      ? "E"
      : vaka.cinsiyetTercih === "K"
        ? "K"
        : "E";
  const taniListesi = [
    ...(vaka.rubric?.kabulEdilenTani || []),
    ...(vaka.conditions || []).map((c) => c.ad),
  ];
  return buildClinicalProfile({
    yas,
    cinsiyet,
    hastalikKey: vaka.hastalikKey,
    taniListesi,
    poliklinikKey: vaka.poliklinikKey,
    comorbidities: vaka.patientProfil?.komorbiditeler,
  });
}

/**
 * Bir vaka için eksik testleri tarar ve motorla doldurup
 * `generatedTests`'e yazar. Statik olanlar korunur.
 */
export function fillCaseGeneratedTests(vaka: AdminVaka): {
  vaka: AdminVaka;
  scan: CaseScanResult;
  fill: FillResult;
} {
  const scan = scanCase(vaka);
  const generated: Record<string, TestSonucu> = { ...(vaka.generatedTests || {}) };
  const profile = profileFromVaka(vaka);

  const filled: string[] = [];
  const skippedStaticRequired: string[] = [];
  const skippedInvalid: string[] = [];

  for (const key of scan.needsGenerated) {
    if (generated[key]) {
      filled.push(key);
      continue;
    }
    const res = generateLabResult(key, profile);
    if (res) {
      generated[key] = res;
      filled.push(key);
    }
  }
  for (const key of scan.staticRequired) skippedStaticRequired.push(key);
  for (const key of scan.invalidKeys) skippedInvalid.push(key);

  const updated: AdminVaka = { ...vaka, generatedTests: generated };
  return {
    vaka: updated,
    scan,
    fill: {
      vakaId: vaka.id,
      filled,
      skippedStaticRequired,
      skippedInvalid,
    },
  };
}

/** Tüm vakaları doldur (ETL) */
export function fillAllCases(cases: AdminVaka[]): {
  cases: AdminVaka[];
  totalFilled: number;
  totalStaticRequired: number;
  totalInvalid: number;
  fills: FillResult[];
} {
  const out: AdminVaka[] = [];
  const fills: FillResult[] = [];
  let totalFilled = 0;
  let totalStaticRequired = 0;
  let totalInvalid = 0;

  for (const c of cases) {
    const { vaka, fill } = fillCaseGeneratedTests(c);
    out.push(vaka);
    fills.push(fill);
    totalFilled += fill.filled.length;
    totalStaticRequired += fill.skippedStaticRequired.length;
    totalInvalid += fill.skippedInvalid.length;
  }
  return { cases: out, totalFilled, totalStaticRequired, totalInvalid, fills };
}

/** Runtime: statik + üretilmiş testleri birleştir */
export function mergeTestsForPlay(vaka: AdminVaka): Record<string, TestSonucu> {
  return { ...(vaka.statikTestler || {}), ...(vaka.generatedTests || {}) };
}
