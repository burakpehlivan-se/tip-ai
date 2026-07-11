import { TestSonucu, ClinicalProfile } from "./types";
import { HASTALIK_TEST_MAP } from "./data/clinical-reference";
import {
  generateNormalValue,
  generateAbnormalValue,
  getReferenceEntry,
  getAllTestKeys,
} from "./lab-reference-library";
import { getActiveRules, getActiveAliases } from "./admin/rule-engine-store";

// ═══════════════════════════════════════════════════
// Layer 2: Rule Engine — disease → test tendency mapping
// ═══════════════════════════════════════════════════

type Tendency = "yuksek" | "dusuk";

interface DiseaseRule {
  disease: string;
  tendency: Tendency;
  factor: number;
}

/** Hardcoded fallback — store yoksa veya boşsa kullanılır */
const FALLBACK_RULES: Record<string, DiseaseRule[]> = {
  TROPONIN: [
    { disease: "stemi", tendency: "yuksek", factor: 20 },
    { disease: "nstemi", tendency: "yuksek", factor: 3 },
    { disease: "kalp-yetmezligi", tendency: "yuksek", factor: 2 },
  ],
  BNP: [
    { disease: "kalp-yetmezligi", tendency: "yuksek", factor: 8 },
    { disease: "stemi", tendency: "yuksek", factor: 3 },
    { disease: "nstemi", tendency: "yuksek", factor: 2 },
  ],
  GLUKOZ: [
    { disease: "tip2-dm", tendency: "yuksek", factor: 1.8 },
    { disease: "diyabetik-noropati", tendency: "yuksek", factor: 2 },
    { disease: "diyabetik-retinopati", tendency: "yuksek", factor: 1.8 },
    { disease: "hipoglisemi", tendency: "dusuk", factor: 0.6 },
    { disease: "preeklampsi", tendency: "yuksek", factor: 1.3 },
  ],
  HBA1C: [
    { disease: "tip2-dm", tendency: "yuksek", factor: 1.8 },
    { disease: "diyabetik-noropati", tendency: "yuksek", factor: 2 },
    { disease: "diyabetik-retinopati", tendency: "yuksek", factor: 1.8 },
  ],
  KREATININ: [
    { disease: "kbh", tendency: "yuksek", factor: 3 },
    { disease: "abh", tendency: "yuksek", factor: 2.5 },
    { disease: "ckd-ev3", tendency: "yuksek", factor: 2 },
  ],
  BUN: [
    { disease: "kbh", tendency: "yuksek", factor: 2.5 },
    { disease: "abh", tendency: "yuksek", factor: 2 },
  ],
  TSH: [
    { disease: "hipotiroidi", tendency: "yuksek", factor: 4 },
    { disease: "hipertiroidi", tendency: "dusuk", factor: 0.08 },
  ],
  FT4: [
    { disease: "hipertiroidi", tendency: "yuksek", factor: 2.5 },
    { disease: "hipotiroidi", tendency: "dusuk", factor: 0.35 },
  ],
  CRP: [
    { disease: "pnömoni", tendency: "yuksek", factor: 15 },
    { disease: "akut-apandisit", tendency: "yuksek", factor: 12 },
    { disease: "akut-kolesistit", tendency: "yuksek", factor: 10 },
    { disease: "akut-pankreatit", tendency: "yuksek", factor: 8 },
    { disease: "koah-eks", tendency: "yuksek", factor: 9 },
    { disease: "iye", tendency: "yuksek", factor: 6 },
  ],
  WBC: [
    { disease: "pnömoni", tendency: "yuksek", factor: 1.5 },
    { disease: "akut-apandisit", tendency: "yuksek", factor: 1.6 },
    { disease: "akut-kolesistit", tendency: "yuksek", factor: 1.5 },
    { disease: "akut-pankreatit", tendency: "yuksek", factor: 1.4 },
  ],
  AMILAZ: [
    { disease: "akut-pankreatit", tendency: "yuksek", factor: 5 },
    { disease: "koledokolitiazis", tendency: "yuksek", factor: 3 },
  ],
  LIPAZ: [
    { disease: "akut-pankreatit", tendency: "yuksek", factor: 8 },
  ],
  HGB: [
    { disease: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.55 },
    { disease: "kalca-kirigi", tendency: "dusuk", factor: 0.7 },
  ],
  ALT: [
    { disease: "akut-kolesistit", tendency: "yuksek", factor: 2.5 },
    { disease: "hepatit", tendency: "yuksek", factor: 10 },
    { disease: "koledokolitiazis", tendency: "yuksek", factor: 2 },
  ],
  AST: [
    { disease: "akut-kolesistit", tendency: "yuksek", factor: 2.5 },
    { disease: "hepatit", tendency: "yuksek", factor: 10 },
  ],
  TBIL: [
    { disease: "hepatit", tendency: "yuksek", factor: 5 },
    { disease: "koledokolitiazis", tendency: "yuksek", factor: 3 },
    { disease: "akut-kolesistit", tendency: "yuksek", factor: 2 },
  ],
  DDIMER: [
    { disease: "dvt", tendency: "yuksek", factor: 3 },
  ],
  LACTATE: [
    { disease: "sepsis", tendency: "yuksek", factor: 3 },
    { disease: "pnömoni", tendency: "yuksek", factor: 1.5 },
  ],
  PH: [
    { disease: "koah-eks", tendency: "dusuk", factor: 0.95 },
    { disease: "pnömoni", tendency: "dusuk", factor: 0.97 },
    { disease: "astim", tendency: "dusuk", factor: 0.97 },
  ],
  PCO2: [
    { disease: "koah-eks", tendency: "yuksek", factor: 1.3 },
  ],
  PO2: [
    { disease: "pnömoni", tendency: "dusuk", factor: 0.85 },
    { disease: "koah-eks", tendency: "dusuk", factor: 0.82 },
  ],
  ALBUMIN: [
    { disease: "hepatit", tendency: "dusuk", factor: 0.7 },
  ],
  U_PROTEIN: [
    { disease: "kbh", tendency: "yuksek", factor: 10 },
    { disease: "preeklampsi", tendency: "yuksek", factor: 15 },
  ],
  PLT: [
    { disease: "preeklampsi", tendency: "dusuk", factor: 0.5 },
  ],
  K: [
    { disease: "kbh", tendency: "yuksek", factor: 1.2 },
    { disease: "abh", tendency: "yuksek", factor: 1.3 },
  ],
  GFR: [
    { disease: "kbh", tendency: "dusuk", factor: 0.4 },
    { disease: "abh", tendency: "dusuk", factor: 0.5 },
  ],
  GGT: [
    { disease: "akut-kolesistit", tendency: "yuksek", factor: 3 },
    { disease: "hepatit", tendency: "yuksek", factor: 3 },
  ],
  ALP: [
    { disease: "koledokolitiazis", tendency: "yuksek", factor: 3 },
  ],
  CA: [
    { disease: "meme-ca", tendency: "yuksek", factor: 1.2 },
    { disease: "akciger-ca", tendency: "yuksek", factor: 1.2 },
  ],
  FERITIN: [
    { disease: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.3 },
  ],
  HCT: [
    { disease: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.7 },
  ],
  MCV: [
    { disease: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.8 },
  ],
  PROCT: [
    { disease: "pnömoni", tendency: "yuksek", factor: 8 },
  ],
  U_SG: [
    { disease: "iye", tendency: "yuksek", factor: 1.05 },
  ],
};

function getMergedRules(): Record<string, DiseaseRule[]> {
  try {
    const active = getActiveRules();
    if (!active || active.length === 0) return FALLBACK_RULES;

    const merged: Record<string, DiseaseRule[]> = {};
    for (const r of active) {
      if (!merged[r.testKey]) merged[r.testKey] = [];
      merged[r.testKey].push({
        disease: r.diseaseKey,
        tendency: r.tendency as Tendency,
        factor: r.factor,
      });
    }
    return merged;
  } catch {
    return FALLBACK_RULES;
  }
}

function getDiseaseAliases(): Record<string, string> {
  try {
    return getActiveAliases();
  } catch {
    return {};
  }
}

// ═══════════════════════════════
// Disease prevalence adjustments
// ═══════════════════════════════

function matchDisease(profile: ClinicalProfile): string | undefined {
  const { diagnoses, comorbidities, hastalikKey } = profile;
  const rules = getMergedRules();
  const aliasMap = getDiseaseAliases();

  // Collect all disease keys that have rules
  const diseasesWithRules = new Set<string>();
  for (const [, diseaseRules] of Object.entries(rules)) {
    for (const r of diseaseRules) {
      diseasesWithRules.add(r.disease);
    }
  }
  const diseaseKeysArr = Array.from(diseasesWithRules);

  // Check hastalikKey first (most specific)
  if (hastalikKey) {
    const canon = aliasMap[hastalikKey] || hastalikKey;
    if (diseasesWithRules.has(canon)) return canon;
  }

  // Check diagnoses
  for (const dx of diagnoses) {
    const canon = aliasMap[dx] || dx;
    if (diseasesWithRules.has(canon)) return canon;
    for (const key of diseaseKeysArr) {
      if (dx.toLowerCase().includes(key) || key.includes(dx.toLowerCase())) return key;
    }
  }

  // Check comorbidities
  for (const cm of comorbidities) {
    const canon = aliasMap[cm] || cm;
    if (diseasesWithRules.has(canon)) return canon;
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════
// Main Motor
// ═══════════════════════════════════════════════════════

export function getLabResult(
  testKey: string,
  profile: ClinicalProfile,
  statikTestler?: Record<string, TestSonucu>
): TestSonucu | null {
  // ── Layer 1: Case-specific static override ──
  if (statikTestler?.[testKey]) {
    return statikTestler[testKey];
  }

  // ── Layer 2: Rule engine — disease → abnormal value ──
  const disease = matchDisease(profile);
  const rules = getMergedRules();
  const testRules = rules[testKey];

  if (disease && testRules) {
    const matchedRule = testRules.find((r) => r.disease === disease)
      || testRules[0]; // fallback to the first matching rule

    const entry = getReferenceEntry(testKey);
    if (entry && entry.tip === "numeric") {
      const result = generateAbnormalValue(
        testKey,
        profile.sex,
        matchedRule?.tendency || "yuksek",
        matchedRule?.factor
      );
      if (result) return result;
    }
  }

  // ── Layer 3: Global reference library — normal value ──
  const normalResult = generateNormalValue(testKey, profile.sex);
  if (normalResult) return normalResult;

  // ── Layer 4: Unknown test — log + null ──
  console.warn(
    `[getLabResult] Unknown test key: "${testKey}". Consider adding it to lab-reference-library.json.`,
    { testKey, profile: profile.hastalikKey }
  );
  return null;
}

// ═══════════════════════════════════════════════════════
// Full panel generator
// ═══════════════════════════════════════════════════════

export function generateFullPanel(
  diagnosis: string,
  profile: ClinicalProfile,
  existingTests?: Record<string, TestSonucu>
): Record<string, TestSonucu> {
  const panel: Record<string, TestSonucu> = { ...existingTests };
  const canonDiagnosis = (getDiseaseAliases() || {})[diagnosis] || diagnosis;
  const relevantTests = HASTALIK_TEST_MAP[canonDiagnosis] || HASTALIK_TEST_MAP[diagnosis] || [];

  for (const testKey of relevantTests) {
    if (panel[testKey]) continue;
    const result = getLabResult(testKey, profile);
    if (result) panel[testKey] = result;
  }

  return panel;
}

// ═══════════════════════════════════════════════════════
// Utility: list all known test keys
// ═══════════════════════════════════════════════════════

export function getKnownTestKeys(): string[] {
  return getAllTestKeys();
}

export function isTestKnown(testKey: string): boolean {
  return !!getReferenceEntry(testKey);
}
