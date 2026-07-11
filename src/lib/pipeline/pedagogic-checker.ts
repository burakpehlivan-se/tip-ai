import { AdminVaka } from "../admin/types";
import { TestSonucu } from "../types";

export type Severity = "critical" | "warning" | "info";

export interface PedagogicFinding {
  code: string;
  severity: Severity;
  field: string;
  message: string;
  evidence: string;
  suggestion: string;
}

export interface PedagogicReport {
  vakaId: string;
  hastalikAdi: string;
  poliklinikKey: string;
  durum: string;
  uzmanOnayi: boolean;
  findings: PedagogicFinding[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    needsReview: boolean;
  };
}

// ═══════════════════════════════════════════════════
// Keyword → expected test value patterns
// ═══════════════════════════════════════════════════

interface KeywordRule {
  keywords: string[];
  testKey: string;
  check: "low" | "high" | "present_in_text";
  description: string;
  severity: Severity;
  requiredFields?: string[]; // for text tests, expected substrings in sonuc
}

const EGTIM_NOTU_RULES: KeywordRule[] = [
  {
    keywords: ["hipokalemi", "hipokalemik", "düşük potasyum", "potasyum düşük"],
    testKey: "K",
    check: "low",
    description: "Hipokalemiden bahsediliyor ama potasyum normal/düşük değil",
    severity: "critical",
  },
  {
    keywords: ["hiperkalemi"],
    testKey: "K",
    check: "high",
    description: "Hiperkalemiden bahsediliyor ama potasyum normal/yüksek değil",
    severity: "critical",
  },
  {
    keywords: ["hiponatremi", "düşük sodyum", "sodyum düşük"],
    testKey: "NA",
    check: "low",
    description: "Hiponatremiden bahsediliyor ama sodyum normal/düşük değil",
    severity: "warning",
  },
  {
    keywords: ["hipoglisemi", "hipoglisemik", "kan şekeri düşük", "düşük glukoz"],
    testKey: "GLUKOZ",
    check: "low",
    description: "Hipoglisemiden bahsediliyor ama glukoz normal/düşük değil",
    severity: "critical",
  },
  {
    keywords: ["hiperglisemi", "yüksek glukoz", "yüksek kan şekeri"],
    testKey: "GLUKOZ",
    check: "high",
    description: "Hiperglisemiden bahsediliyor ama glukoz normal/yüksek değil",
    severity: "warning",
  },
  {
    keywords: ["diyabetik", "diyabet", "dm ", "tip 2 dm", "tip2"],
    testKey: "HBA1C",
    check: "high",
    description: "Diyabetten bahsediliyor ama HbA1c normal",
    severity: "warning",
  },
  {
    keywords: ["st elevasyon", "stemi", "mi ", "miyokard", "akut koroner"],
    testKey: "TROPONIN",
    check: "high",
    description: "MI/STEMI'den bahsediliyor ama troponin normal",
    severity: "critical",
  },
  {
    keywords: ["st elevasyon", "stemi", "mi ", "miyokard"],
    testKey: "EKG",
    check: "present_in_text",
    description: "STEMI'den bahsediliyor, EKG raporunda ST elevasyon geçmeli",
    severity: "critical",
    requiredFields: ["st elevasyon", "st yükselmesi"],
  },
  {
    keywords: ["nstemi", "non-st", "unstabil angina", "unstable angina"],
    testKey: "TROPONIN",
    check: "high",
    description: "NSTEMI'den bahsediliyor ama troponin normal",
    severity: "critical",
  },
  {
    keywords: ["anemi", "anemik", "demir eksikliği"],
    testKey: "HGB",
    check: "low",
    description: "Anemiden bahsediliyor ama hemoglobin normal/düşük değil",
    severity: "warning",
  },
  {
    keywords: ["lökositoz", "enfeksiyon", "pnömoni", "sepsis"],
    testKey: "WBC",
    check: "high",
    description: "Enfeksiyon/lökositozdan bahsediliyor ama WBC normal",
    severity: "warning",
  },
  {
    keywords: ["lökositoz", "enfeksiyon", "pnömoni", "sepsis"],
    testKey: "CRP",
    check: "high",
    description: "Enfeksiyondan bahsediliyor ama CRP normal",
    severity: "warning",
  },
  {
    keywords: ["alkaloz", "metabolik alkaloz"],
    testKey: "PH",
    check: "high",
    description: "Alkalozdan bahsediliyor ama pH normal/yüksek değil",
    severity: "warning",
  },
  {
    keywords: ["asidoz", "metabolik asidoz"],
    testKey: "PH",
    check: "low",
    description: "Asidozdan bahsediliyor ama pH normal/düşük değil",
    severity: "warning",
  },
  {
    keywords: ["böbrek yetmezliği", "kbh", "kronik böbrek", "abh", "akut böbrek"],
    testKey: "KREATININ",
    check: "high",
    description: "Böbrek yetmezliğinden bahsediliyor ama kreatinin normal",
    severity: "warning",
  },
  {
    keywords: ["pankreatit", "akut pankreatit"],
    testKey: "AMILAZ",
    check: "high",
    description: "Pankreatitten bahsediliyor ama amilaz normal",
    severity: "critical",
  },
  {
    keywords: ["pankreatit", "akut pankreatit"],
    testKey: "LIPAZ",
    check: "high",
    description: "Pankreatitten bahsediliyor ama lipaz normal",
    severity: "critical",
  },
  {
    keywords: ["kolesistit"],
    testKey: "ALT",
    check: "high",
    description: "Kolesistitten bahsediliyor ama ALT normal",
    severity: "warning",
  },
  {
    keywords: ["hipoksi", "hipoksik", "solunum yetmezliği"],
    testKey: "PO2",
    check: "low",
    description: "Hipoksiden bahsediliyor ama pO2 normal/düşük değil",
    severity: "critical",
  },
  {
    keywords: ["sepsis", "septik"],
    testKey: "LACTATE",
    check: "high",
    description: "Sepsisten bahsediliyor ama laktat normal",
    severity: "critical",
  },
  {
    keywords: ["hipertansiyon", "hipertansif", "ht ", "yüksek tansiyon"],
    testKey: "", // special — check vitals
    check: "high",
    description: "Hipertansiyondan bahsediliyor, vitals.tansiyon kontrol edilmeli",
    severity: "info",
  },
  {
    keywords: ["koah"],
    testKey: "PCO2",
    check: "high",
    description: "KOAH'tan bahsediliyor, pCO2 retansiyonu beklenir",
    severity: "warning",
  },
  {
    keywords: ["proteinüri", "protein kaçağı"],
    testKey: "U_PROTEIN",
    check: "high",
    description: "Proteinüriden bahsediliyor ama idrar proteini normal",
    severity: "warning",
  },
];

// ═══════════════════════════════════════════════════
// Red flag keywords that should appear in rubric
// ═══════════════════════════════════════════════════

interface RedFlagKeywordRule {
  keywords: string[];
  suggestedRedFlag: string;
  severity: Severity;
}

const RED_FLAG_RULES: RedFlagKeywordRule[] = [
  {
    keywords: ["aort diseksiyon", "aortik", "yırtılma"],
    suggestedRedFlag: "AORT_DISEKSIYON",
    severity: "critical",
  },
  {
    keywords: ["sepsis", "septik şok"],
    suggestedRedFlag: "SEPSIS",
    severity: "critical",
  },
  {
    keywords: ["eklampsi", "konvülziyon", "nöbet"],
    suggestedRedFlag: "KONVULZIYON",
    severity: "critical",
  },
  {
    keywords: ["perforasyon", "akut batın"],
    suggestedRedFlag: "AKUT_BATIN",
    severity: "critical",
  },
  {
    keywords: ["anafilaksi", "alerjik reaksiyon"],
    suggestedRedFlag: "ANAFILAKSI",
    severity: "critical",
  },
  {
    keywords: ["tamponad", "kalp tamponadı"],
    suggestedRedFlag: "KARDIYAK_TAMPONAD",
    severity: "critical",
  },
  {
    keywords: ["tromboliz", "trombolitik"],
    suggestedRedFlag: "KANAMA_RISKI",
    severity: "warning",
  },
  {
    keywords: ["herniasyon", "herniye"],
    suggestedRedFlag: "HERNIASYON",
    severity: "critical",
  },
];

// ═══════════════════════════════════════════════════
// Patient response → test value cross-check
// ═══════════════════════════════════════════════════

interface PatientResponseRule {
  questionKey: string;
  positivePatterns: string[];
  relatedTest: string;
  check: "positive_implies_abnormal";
  description: string;
  severity: Severity;
}

const PATIENT_RESPONSE_RULES: PatientResponseRule[] = [
  {
    questionKey: "ATES_SORGU",
    positivePatterns: ["var", "ateşim", "ateşli", "yüksek", "38", "39", "40", "37.5"],
    relatedTest: "VITAL_ATES",
    check: "positive_implies_abnormal",
    description: "Hasta ateşi olduğunu söylüyor ama vital.ates normal",
    severity: "warning",
  },
  {
    questionKey: "BAS_AGRISI",
    positivePatterns: ["var", "ağrıyor", "şiddetli", "başım ağrıyor", "ağrı var"],
    relatedTest: "",
    check: "positive_implies_abnormal",
    description: "Hasta baş ağrısı olduğunu söylüyor — red flag değerlendirmesi önerilir",
    severity: "info",
  },
  {
    questionKey: "KONFUZYON",
    positivePatterns: ["var", "sersem", "karışık", "bilinç", "konfüze", "bulanık"],
    relatedTest: "",
    check: "positive_implies_abnormal",
    description: "Hasta konfüzyon bildiriyor — GKS/nörolojik değerlendirme notu önerilir",
    severity: "warning",
  },
  {
    questionKey: "OKSURUK",
    positivePatterns: ["var", "öksürüyor", "balgamlı", "kuru", "öksürük"],
    relatedTest: "AKCIGER_GRAFISI",
    check: "positive_implies_abnormal",
    description: "Hasta öksürük bildiriyor — akciğer grafisi değerlendirilmeli",
    severity: "info",
  },
];

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function getNumericValue(result: TestSonucu): number | undefined {
  if (!result?.sonuc) return undefined;
  if (typeof result.sonuc === "object" && "deger" in result.sonuc) {
    const v = Number((result.sonuc as Record<string, unknown>).deger);
    return Number.isFinite(v) ? v : undefined;
  }
  if (typeof result.sonuc === "number") return result.sonuc;
  return undefined;
}

function getTextValue(result: TestSonucu): string {
  if (!result?.sonuc) return "";
  if (typeof result.sonuc === "string") return result.sonuc.toLowerCase();
  if (typeof result.sonuc === "object") {
    return JSON.stringify(result.sonuc).toLowerCase();
  }
  return String(result.sonuc).toLowerCase();
}

function getVitalTansiyonSistolik(vaka: AdminVaka): number | undefined {
  const t = vaka.vitals?.tansiyon;
  if (!t) return undefined;
  const m = String(t).match(/(\d{2,3})\s*\/\s*\d{2,3}/);
  return m ? Number(m[1]) : undefined;
}

function textContainsAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

function textContainsWithoutNegation(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  const negationPatterns = [
    /\byok\b/, /\byoktur\b/, /\bolmadığı\b/, /\bizlenmedi\b/,
    /\bsaptanmadı\b/, /\bgörülmedi\b/, /\bdeğil\b/, /\bnegatif\b/,
    /\bnormal\b/,
  ];

  for (const pattern of patterns) {
    const idx = lower.indexOf(pattern.toLowerCase());
    if (idx === -1) continue;

    // Check if any negation word appears within 5 words after the match
    const after = lower.slice(idx + pattern.length, idx + pattern.length + 80);
    const hasNegation = negationPatterns.some((re) => re.test(after));

    if (!hasNegation) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════
// Check functions
// ═══════════════════════════════════════════════════

function checkEgitimNotuTestConsistency(
  vaka: AdminVaka
): PedagogicFinding[] {
  const findings: PedagogicFinding[] = [];
  const egitimNotu = (vaka.egitimNotu || "").toLowerCase();
  if (!egitimNotu) return findings;

  const allTests: Record<string, TestSonucu> = {
    ...(vaka.statikTestler || {}),
    ...(vaka.generatedTests || {}),
    ...(vaka.testOverrides || {}),
  };

  for (const rule of EGTIM_NOTU_RULES) {
    const matched = rule.keywords.some((kw) => egitimNotu.includes(kw));
    if (!matched) continue;

    if (rule.testKey === "") {
      // Special: check vitals
      if (rule.keywords.some((k) => egitimNotu.includes(k) && (k.includes("hipertansiyon") || k.includes("ht ")))) {
        const sistolik = getVitalTansiyonSistolik(vaka);
        if (sistolik !== undefined && sistolik < 140) {
          findings.push({
            code: "EDU_NOTE_VS_VITALS",
            severity: rule.severity,
            field: "vitals.tansiyon",
            message: rule.description,
            evidence: `egitimNotu: "${rule.keywords.find((k) => egitimNotu.includes(k))}" → tansiyon: ${vaka.vitals?.tansiyon || "tanımsız"}`,
            suggestion: "Vital bulguları eğitim notuyla tutarlı olacak şekilde güncelleyin.",
          });
        }
      }
      continue;
    }

    const result = allTests[rule.testKey];
    if (!result) {
      findings.push({
        code: "EDU_NOTE_MISSING_TEST",
        severity: rule.severity === "critical" ? "warning" : "info",
        field: `statikTestler.${rule.testKey}`,
        message: `Eğitim notunda "${rule.keywords.find((k) => egitimNotu.includes(k))}" geçiyor ama ${rule.testKey} testi tanımlı değil.`,
        evidence: `egitimNotu: "${rule.keywords.find((k) => egitimNotu.includes(k))}"`,
        suggestion: `${rule.testKey} testini statikTestler'e patolojik değerle ekleyin.`,
      });
      continue;
    }

    if (rule.check === "present_in_text") {
      const text = getTextValue(result);
      const requiredTerms = rule.requiredFields || [];
      const anyMatched = requiredTerms.length === 0 || textContainsWithoutNegation(text, requiredTerms);
      if (!anyMatched) {
        findings.push({
          code: "EDU_NOTE_TEXT_MISMATCH",
          severity: rule.severity,
          field: `statikTestler.${rule.testKey}.sonuc`,
          message: rule.description,
          evidence: `egitimNotu: "${rule.keywords.find((k) => egitimNotu.includes(k))}" → ${rule.testKey} raporunda "${(rule.requiredFields || []).join('" veya "')}" bulunamadı`,
          suggestion: `${rule.testKey} rapor metnini eğitim notuyla tutarlı güncelleyin.`,
        });
      }
      continue;
    }

    const deger = getNumericValue(result);
    if (deger === undefined) continue;

    const testKey = rule.testKey;
    const lowThresholds: Record<string, number> = {
      K: 3.5, GLUKOZ: 60, HGB: 12.0, PH: 7.35, PO2: 60,
    };
    const highThresholds: Record<string, number> = {
      K: 5.1, NA: 145, GLUKOZ: 100, HBA1C: 5.7, TROPONIN: 0.04,
      WBC: 11.0, CRP: 5.0, KREATININ: 1.3, AMILAZ: 110, LIPAZ: 140,
      ALT: 40, PH: 7.45, PCO2: 45, LACTATE: 2.2, U_PROTEIN: 15,
    };

    let inconsistent = false;
    if (rule.check === "low") {
      inconsistent = deger >= (lowThresholds[testKey] ?? deger);
    } else if (rule.check === "high") {
      inconsistent = deger <= (highThresholds[testKey] ?? deger);
    }

    if (inconsistent) {
      findings.push({
        code: "EDU_NOTE_VALUE_MISMATCH",
        severity: rule.severity,
        field: `statikTestler.${rule.testKey}.sonuc`,
        message: rule.description,
        evidence: `egitimNotu: "${rule.keywords.find((k) => egitimNotu.includes(k))}" → ${rule.testKey}=${deger}`,
        suggestion: `${rule.testKey} değerini eğitim notuyla tutarlı olacak şekilde güncelleyin.`,
      });
    }
  }

  return findings;
}

function checkRedFlagCoverage(vaka: AdminVaka): PedagogicFinding[] {
  const findings: PedagogicFinding[] = [];
  const egitimNotu = (vaka.egitimNotu || "").toLowerCase();
  const anaSikayet = (vaka.anaSikayet || "").toLowerCase();
  const combinedText = egitimNotu + " " + anaSikayet;

  const existingRedFlags = new Set(
    (vaka.rubric?.redFlagler || []).map((rf) => rf.key)
  );

  for (const rule of RED_FLAG_RULES) {
    const matched = rule.keywords.some((kw) => combinedText.includes(kw));
    if (!matched) continue;

    if (!existingRedFlags.has(rule.suggestedRedFlag) && !existingRedFlags.has(rule.suggestedRedFlag.toLowerCase())) {
      findings.push({
        code: "MISSING_RED_FLAG",
        severity: rule.severity,
        field: "rubric.redFlagler",
        message: `Eğitim notunda/ana şikayette "${rule.keywords.find((k) => combinedText.includes(k))}" geçiyor ama rubric.redFlagler'da "${rule.suggestedRedFlag}" tanımlı değil.`,
        evidence: `Metin: "${rule.keywords.find((k) => combinedText.includes(k))}"`,
        suggestion: `rubric.redFlagler'a "${rule.suggestedRedFlag}" anahtarını ekleyin.`,
      });
    }
  }

  return findings;
}

function checkPatientResponseConsistency(vaka: AdminVaka): PedagogicFinding[] {
  const findings: PedagogicFinding[] = [];
  const yanitlar = vaka.hastaYanitlari || {};

  const allTests: Record<string, TestSonucu> = {
    ...(vaka.statikTestler || {}),
    ...(vaka.generatedTests || {}),
    ...(vaka.testOverrides || {}),
  };

  for (const rule of PATIENT_RESPONSE_RULES) {
    const yanit = (yanitlar[rule.questionKey] || "").toLowerCase();
    if (!yanit) continue;

    const isPositive = textContainsAny(yanit, rule.positivePatterns);
    if (!isPositive) continue;

    // Rule with no related test → info/warning only
    if (rule.relatedTest === "") {
      findings.push({
        code: "PATIENT_RESPONSE_FLAG",
        severity: rule.severity,
        field: `hastaYanitlari.${rule.questionKey}`,
        message: rule.description,
        evidence: `Hasta: "${yanitlar[rule.questionKey]}"`,
        suggestion: "İlgili test veya red flag'in rubric'te tanımlandığından emin olun.",
      });
      continue;
    }

    // Rule with related test → cross-check test value
    const result = allTests[rule.relatedTest];
    if (!result) {
      findings.push({
        code: "PATIENT_RESPONSE_NO_TEST",
        severity: rule.severity,
        field: `statikTestler.${rule.relatedTest}`,
        message: `Hasta "${rule.questionKey}" için pozitif yanıt verdi ama ${rule.relatedTest} testi tanımlı değil.`,
        evidence: `Hasta: "${yanitlar[rule.questionKey]}" → ${rule.relatedTest} yok`,
        suggestion: `${rule.relatedTest} için statikTestler'e sonuç ekleyin.`,
      });
      continue;
    }

    if (rule.check === "positive_implies_abnormal") {
      const deger = getNumericValue(result);
      if (deger === undefined) continue;

      // ATES_SORGU → check if VITAL_ATES is elevated
      if (rule.relatedTest === "VITAL_ATES") {
        const ates = typeof result.sonuc === "object" && result.sonuc
          ? Number((result.sonuc as Record<string, unknown>).deger)
          : undefined;
        if (ates !== undefined && ates < 37.5) {
          findings.push({
            code: "PATIENT_RESPONSE_VS_TEST",
            severity: rule.severity,
            field: `statikTestler.${rule.relatedTest}`,
            message: `Hasta ateş bildiriyor ama vital ateş normal (${ates}°C).`,
            evidence: `Hasta: "${yanitlar[rule.questionKey]}" → ${rule.relatedTest}=${ates}°C`,
            suggestion: "Vital bulgudaki ateş değerini hasta cevabıyla tutarlı güncelleyin.",
          });
        }
      }
    }
  }

  return findings;
}

function checkRubricTestConsistency(vaka: AdminVaka): PedagogicFinding[] {
  const findings: PedagogicFinding[] = [];
  const rubric = vaka.rubric;
  if (!rubric) return findings;

  const expected = new Set((rubric.beklenenTestler || []).map((t) => t.key));
  const allTests: Record<string, TestSonucu> = {
    ...(vaka.statikTestler || {}),
    ...(vaka.generatedTests || {}),
    ...(vaka.testOverrides || {}),
  };

  for (const key of Array.from(expected)) {
    if (!allTests[key]) {
      findings.push({
        code: "EXPECTED_TEST_NO_RESULT",
        severity: "warning",
        field: `rubric.beklenenTestler.${key}`,
        message: `Beklenen test "${key}" için statikTestler'de sonuç tanımlı değil.`,
        evidence: `rubric.beklenenTestler içinde ${key} var ama statikTestler'de yok.`,
        suggestion: `${key} için statikTestler'e patolojiye uygun bir sonuç ekleyin veya pipeline doldursun.`,
      });
    }
  }

  return findings;
}

function checkDiagnosisLabAlignment(vaka: AdminVaka): PedagogicFinding[] {
  const findings: PedagogicFinding[] = [];
  const tani = (vaka.rubric?.kabulEdilenTani || []).join(" ").toLowerCase();
  if (!tani) return findings;

  const allTests: Record<string, TestSonucu> = {
    ...(vaka.statikTestler || {}),
    ...(vaka.generatedTests || {}),
    ...(vaka.testOverrides || {}),
  };

  const diagnosisChecks: Array<{
    term: string;
    testKey: string;
    expectedDir: "high" | "low";
    threshold: number;
    severity: Severity;
    description: string;
  }> = [
    { term: "stemi", testKey: "TROPONIN", expectedDir: "high", threshold: 0.04, severity: "critical", description: "STEMI tanısı kabul ediliyor ama troponin normal" },
    { term: "mi", testKey: "TROPONIN", expectedDir: "high", threshold: 0.04, severity: "critical", description: "MI tanısı kabul ediliyor ama troponin normal" },
    { term: "akut koroner", testKey: "TROPONIN", expectedDir: "high", threshold: 0.04, severity: "critical", description: "AKS tanısı kabul ediliyor ama troponin normal" },
    { term: "diyabet", testKey: "HBA1C", expectedDir: "high", threshold: 5.7, severity: "warning", description: "Diyabet tanısı kabul ediliyor ama HbA1c normal" },
    { term: "hipoglisemi", testKey: "GLUKOZ", expectedDir: "low", threshold: 70, severity: "critical", description: "Hipoglisemi tanısı kabul ediliyor ama glukoz normal/yüksek" },
    { term: "hipotiroidi", testKey: "TSH", expectedDir: "high", threshold: 4.0, severity: "warning", description: "Hipotiroidi tanısı kabul ediliyor ama TSH normal" },
    { term: "hipertiroidi", testKey: "TSH", expectedDir: "low", threshold: 0.4, severity: "warning", description: "Hipertiroidi tanısı kabul ediliyor ama TSH normal" },
    { term: "pankreatit", testKey: "LIPAZ", expectedDir: "high", threshold: 60, severity: "critical", description: "Pankreatit tanısı kabul ediliyor ama lipaz normal" },
    { term: "anemi", testKey: "HGB", expectedDir: "low", threshold: 12.0, severity: "warning", description: "Anemi tanısı kabul ediliyor ama hemoglobin normal" },
    { term: "kbh", testKey: "KREATININ", expectedDir: "high", threshold: 1.3, severity: "warning", description: "KBH tanısı kabul ediliyor ama kreatinin normal" },
    { term: "kronik böbrek", testKey: "KREATININ", expectedDir: "high", threshold: 1.3, severity: "warning", description: "KBH tanısı kabul ediliyor ama kreatinin normal" },
    { term: "preeklampsi", testKey: "U_PROTEIN", expectedDir: "high", threshold: 15, severity: "critical", description: "Preeklampsi tanısı kabul ediliyor ama idrar proteini normal" },
    { term: "sepsis", testKey: "LACTATE", expectedDir: "high", threshold: 2.2, severity: "critical", description: "Sepsis tanısı kabul ediliyor ama laktat normal" },
    { term: "pnömoni", testKey: "CRP", expectedDir: "high", threshold: 5, severity: "warning", description: "Pnömoni tanısı kabul ediliyor ama CRP normal" },
  ];

  for (const dc of diagnosisChecks) {
    if (!tani.includes(dc.term)) continue;

    const result = allTests[dc.testKey];
    if (!result) {
      findings.push({
        code: "DIAGNOSIS_MISSING_KEY_TEST",
        severity: dc.severity,
        field: `statikTestler.${dc.testKey}`,
        message: `"${dc.term}" tanısı kabul ediliyor ama ${dc.testKey} testi tanımlı değil.`,
        evidence: `kabulEdilenTani: ${vaka.rubric?.kabulEdilenTani?.join(", ")} → ${dc.testKey} yok`,
        suggestion: `${dc.testKey} testini patolojik değerle statikTestler'e ekleyin.`,
      });
      continue;
    }

    const deger = getNumericValue(result);
    if (deger === undefined) continue;

    const inconsistent =
      dc.expectedDir === "high" ? deger <= dc.threshold : deger >= dc.threshold;

    if (inconsistent) {
      findings.push({
        code: "DIAGNOSIS_LAB_MISMATCH",
        severity: dc.severity,
        field: `statikTestler.${dc.testKey}.sonuc`,
        message: dc.description,
        evidence: `kabulEdilenTani: "${dc.term}" → ${dc.testKey}=${deger}`,
        suggestion: `${dc.testKey} değerini tanıyla uyumlu olacak şekilde güncelleyin.`,
      });
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════
// Main scanner
// ═══════════════════════════════════════════════════

export function checkPedagogicConsistency(vaka: AdminVaka): PedagogicReport {
  const findings: PedagogicFinding[] = [
    ...checkEgitimNotuTestConsistency(vaka),
    ...checkRedFlagCoverage(vaka),
    ...checkPatientResponseConsistency(vaka),
    ...checkRubricTestConsistency(vaka),
    ...checkDiagnosisLabAlignment(vaka),
  ];

  const critical = findings.filter((f) => f.severity === "critical");
  const warning = findings.filter((f) => f.severity === "warning");
  const info = findings.filter((f) => f.severity === "info");

  return {
    vakaId: vaka.id,
    hastalikAdi: vaka.hastalikAdi,
    poliklinikKey: vaka.poliklinikKey,
    durum: vaka.durum,
    uzmanOnayi: vaka.uzmanOnayi,
    findings,
    summary: {
      total: findings.length,
      critical: critical.length,
      warning: warning.length,
      info: info.length,
      needsReview: critical.length > 0 || warning.length >= 3,
    },
  };
}

export function checkAllPedagogicConsistency(
  cases: AdminVaka[]
): {
  reports: PedagogicReport[];
  grandTotal: {
    totalCases: number;
    totalFindings: number;
    critical: number;
    warning: number;
    info: number;
    casesNeedingReview: number;
  };
} {
  const reports = cases.map(checkPedagogicConsistency);

  return {
    reports,
    grandTotal: {
      totalCases: reports.length,
      totalFindings: reports.reduce((s, r) => s + r.summary.total, 0),
      critical: reports.reduce((s, r) => s + r.summary.critical, 0),
      warning: reports.reduce((s, r) => s + r.summary.warning, 0),
      info: reports.reduce((s, r) => s + r.summary.info, 0),
      casesNeedingReview: reports.filter((r) => r.summary.needsReview).length,
    },
  };
}

export function formatPedagogicReportText(reports: PedagogicReport[]): string {
  const lines: string[] = [];
  lines.push("TIP-AI Pedagojik Tutarlılık Raporu");
  lines.push("===================================");
  lines.push("");

  const problemReports = reports.filter((r) => r.findings.length > 0);

  for (const report of problemReports) {
    lines.push(`\n## ${report.vakaId} — ${report.hastalikAdi} (${report.durum})`);
    lines.push(`  Bulgu: ${report.summary.total} (kritik: ${report.summary.critical}, uyarı: ${report.summary.warning}, bilgi: ${report.summary.info})`);
    if (report.uzmanOnayi) {
      lines.push("  ⚠ Bu vaka uzman onaylı olmasına rağmen tutarsızlık içeriyor!");
    }

    const bySeverity = [
      { label: "KRİTİK", items: report.findings.filter((f) => f.severity === "critical") },
      { label: "UYARI", items: report.findings.filter((f) => f.severity === "warning") },
      { label: "BİLGİ", items: report.findings.filter((f) => f.severity === "info") },
    ];

    for (const group of bySeverity) {
      if (group.items.length === 0) continue;
      lines.push(`  [${group.label}]`);
      for (const f of group.items) {
        lines.push(`    - [${f.code}] ${f.message}`);
        lines.push(`      Kanıt: ${f.evidence}`);
        lines.push(`      Öneri: ${f.suggestion}`);
      }
    }
  }

  return lines.join("\n");
}
