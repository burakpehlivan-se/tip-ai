/**
 * TIP-AI Vaka Doğrulama Raporu
 *
 * Tüm vakaların eksiksiz, tutarlı ve klinik olarak mantıklı olduğunu denetler.
 * Hata = invalid · Uyarı = valid_with_warnings · Temiz = valid
 */

import { AdminVaka } from "../admin/types";
import { DEFAULT_CDM_PUANLAMA, TipAiCdmDocument, TIP_AI_CDM_VERSION } from "./types";
import { adminVakaToCdm } from "./convert";
import { canonicalizeTestKey, knownTestKeys } from "./vocabulary";

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
}

export type VakaValidationStatus = "valid" | "valid_with_warnings" | "invalid";

export interface VakaValidationResult {
  id: string;
  hastalikAdi?: string;
  poliklinikKey?: string;
  durum?: string;
  seviye?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  status: VakaValidationStatus;
}

export interface ValidationReportSummary {
  total: number;
  valid: number;
  validWithWarnings: number;
  invalid: number;
  errorCount: number;
  warningCount: number;
  /** En sık hata kodları */
  topErrorCodes: { code: string; count: number }[];
  topWarningCodes: { code: string; count: number }[];
}

export interface ValidationReport {
  generatedAt: string;
  cdmVersion: string;
  summary: ValidationReportSummary;
  results: VakaValidationResult[];
}

const REQUIRED_SCORES = Object.keys(DEFAULT_CDM_PUANLAMA) as (keyof typeof DEFAULT_CDM_PUANLAMA)[];

function addError(
  errors: ValidationIssue[],
  field: string,
  message: string,
  code = "MISSING_FIELD"
) {
  errors.push({ code, field, message });
}

function addWarning(
  warnings: ValidationIssue[],
  field: string,
  message: string,
  code = "WARNING"
) {
  warnings.push({ code, field, message });
}

/** CDM belge üzerinde tam doğrulama (rapor kuralları) */
export function validateVakaDocument(doc: TipAiCdmDocument): VakaValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const known = knownTestKeys();

  // ── 1. Kimlik & meta ──
  if (!doc.id) addError(errors, "id", "Vaka id eksik");
  if (!doc.meta?.poliklinikKey) {
    addError(errors, "meta.poliklinikKey", "Poliklinik key eksik");
  }
  if (!doc.meta?.hastalikKey) {
    addError(errors, "meta.hastalikKey", "Hastalık key eksik");
  }
  if (!doc.meta?.hastalikAdi) {
    addError(errors, "meta.hastalikAdi", "Hastalık adı eksik");
  }
  if (!doc.meta?.seviye) {
    addError(errors, "meta.seviye", "Seviye (baslangic/orta/ileri) eksik");
  } else if (!["baslangic", "orta", "ileri"].includes(doc.meta.seviye)) {
    addError(errors, "meta.seviye", `Geçersiz seviye: ${doc.meta.seviye}`, "INVALID_VALUE");
  }
  if (!doc.meta?.durum) {
    addError(errors, "meta.durum", "Durum (taslak/aktif/arsiv) eksik");
  } else if (!["taslak", "aktif", "arsiv"].includes(doc.meta.durum)) {
    addError(errors, "meta.durum", `Geçersiz durum: ${doc.meta.durum}`, "INVALID_VALUE");
  }
  if (doc.cdmVersion && doc.cdmVersion !== TIP_AI_CDM_VERSION) {
    addWarning(
      warnings,
      "cdmVersion",
      `Beklenen ${TIP_AI_CDM_VERSION}, gelen: ${doc.cdmVersion}`,
      "CDM_VERSION_MISMATCH"
    );
  }
  if (!doc.cdmVersion) {
    addWarning(warnings, "cdmVersion", "cdmVersion yok (legacy kayıt)", "LEGACY_CASE");
  }

  // ── 2. Demografi ──
  const ya = doc.patient?.yasAraligi;
  if (!ya || !Array.isArray(ya) || ya.length !== 2) {
    addError(
      errors,
      "patient.yasAraligi",
      "Yaş aralığı [min,max] formatında tanımlı değil"
    );
  } else {
    const [min, max] = ya;
    if (
      typeof min !== "number" ||
      typeof max !== "number" ||
      min <= 0 ||
      max <= 0 ||
      min > max ||
      max > 120
    ) {
      addError(
        errors,
        "patient.yasAraligi",
        `Yaş aralığı geçersiz: [${min}, ${max}]`,
        "INVALID_VALUE"
      );
    }
  }
  if (!doc.patient?.cinsiyetTercih) {
    addError(errors, "patient.cinsiyetTercih", "Cinsiyet tercihi eksik");
  } else if (!["E", "K", "herhangi"].includes(doc.patient.cinsiyetTercih)) {
    addError(
      errors,
      "patient.cinsiyetTercih",
      `Geçersiz cinsiyet: ${doc.patient.cinsiyetTercih}`,
      "INVALID_VALUE"
    );
  }

  // ── 3. Klinik sunum ──
  if (!doc.presentation?.anaSikayet?.trim()) {
    addError(errors, "presentation.anaSikayet", "Ana şikayet eksik");
  }
  if (
    !Array.isArray(doc.presentation?.ozetBilgiler) ||
    doc.presentation.ozetBilgiler.length < 2
  ) {
    addWarning(
      warnings,
      "presentation.ozetBilgiler",
      "Özet bilgiler 2 maddeden az",
      "SHORT_SUMMARY"
    );
  }
  if (!doc.presentation?.semptomSablon?.trim()) {
    addError(errors, "presentation.semptomSablon", "Semptom şablonu eksik");
  }

  // ── 4. Conditions ──
  if (!Array.isArray(doc.conditions) || doc.conditions.length === 0) {
    addWarning(
      warnings,
      "conditions",
      "conditions listesi boş — OMOP condition önerilir",
      "NO_CONDITIONS"
    );
  } else {
    doc.conditions.forEach((c, i) => {
      if (!c?.code) {
        addError(errors, `conditions[${i}].code`, "Condition code eksik");
      }
      if (!c?.ad) {
        addError(errors, `conditions[${i}].ad`, "Condition adı eksik");
      }
    });
    if (!doc.conditions.some((c) => c.primary)) {
      addWarning(
        warnings,
        "conditions",
        "primary condition işaretli değil",
        "NO_PRIMARY_CONDITION"
      );
    }
  }

  // ── 5. Rubrik ──
  const rub = doc.rubric;
  if (!rub) {
    addError(errors, "rubric", "Rubrik eksik");
  } else {
    if (!Array.isArray(rub.beklenenSorular) || rub.beklenenSorular.length < 3) {
      addWarning(
        warnings,
        "rubric.beklenenSorular",
        "Beklenen sorular 3'ten az",
        "FEW_EXPECTED_QUESTIONS"
      );
    } else {
      rub.beklenenSorular.forEach((s, i) => {
        if (!s?.key) {
          addError(errors, `rubric.beklenenSorular[${i}].key`, "Soru key eksik");
        }
        if (!s?.etiket) {
          addError(errors, `rubric.beklenenSorular[${i}].etiket`, "Soru etiket eksik");
        }
      });
    }

    if (!Array.isArray(rub.beklenenTestler) || rub.beklenenTestler.length === 0) {
      addError(
        errors,
        "rubric.beklenenTestler",
        "Beklenen testler tanımlı değil",
        "NO_EXPECTED_TESTS"
      );
    } else {
      rub.beklenenTestler.forEach((t, i) => {
        if (!t?.key) {
          addError(errors, `rubric.beklenenTestler[${i}].key`, "Test key eksik");
          return;
        }
        const canon = canonicalizeTestKey(t.key);
        if (!known.has(canon)) {
          addWarning(
            warnings,
            `rubric.beklenenTestler[${i}].key`,
            `"${t.key}" birleşik test kataloğunda yok`,
            "UNKNOWN_TEST_KEY"
          );
        }
      });
    }

    if (!Array.isArray(rub.redFlagler) || rub.redFlagler.length === 0) {
      addWarning(
        warnings,
        "rubric.redFlagler",
        "Red flag tanımlı değil",
        "NO_RED_FLAGS"
      );
    }

    if (!Array.isArray(rub.kabulEdilenTani) || rub.kabulEdilenTani.length === 0) {
      addError(
        errors,
        "rubric.kabulEdilenTani",
        "Kabul edilen tanı listesi boş",
        "NO_ACCEPTED_DIAGNOSIS"
      );
    }

    const p = rub.puanlama as Record<string, unknown> | undefined;
    if (!p || typeof p !== "object") {
      addError(errors, "rubric.puanlama", "Puanlama alanı eksik");
    } else {
      for (const key of REQUIRED_SCORES) {
        if (typeof p[key] !== "number") {
          addError(
            errors,
            `rubric.puanlama.${key}`,
            `Puanlama alanı eksik veya sayı değil: ${key}`
          );
        }
      }
    }
  }

  // ── 6. Labs ──
  const labMap = doc.labs?.statikTestler || {};
  const labKeysRaw = Object.keys(labMap);
  if (labKeysRaw.length === 0) {
    addError(
      errors,
      "labs.statikTestler",
      "Statik test sonuçları tanımlı değil",
      "NO_LABS"
    );
  } else {
    const labKeysCanon = new Set(labKeysRaw.map(canonicalizeTestKey));
    for (const [rawKey, val] of Object.entries(labMap)) {
      const path = `labs.statikTestler.${rawKey}`;
      if (!val || typeof val !== "object") {
        addError(errors, path, "Test sonucu nesne olmalı", "INVALID_LAB");
        continue;
      }
      const t = val as { testKey?: string; testAdi?: string; tip?: string; sonuc?: unknown };
      if (t.sonuc === undefined || t.sonuc === null || t.sonuc === "") {
        addError(errors, `${path}.sonuc`, "sonuc zorunlu", "EMPTY_LAB_RESULT");
      }
      if (!t.tip) {
        addWarning(warnings, `${path}.tip`, "tip eksik", "LAB_MISSING_TIP");
      }
      if (!t.testAdi) {
        addWarning(warnings, `${path}.testAdi`, "testAdi eksik", "LAB_MISSING_NAME");
      }
      const canon = canonicalizeTestKey(rawKey);
      if (canon !== rawKey) {
        addWarning(
          warnings,
          path,
          `Alias key "${rawKey}" → kanonik "${canon}" olmalı`,
          "LAB_KEY_ALIAS"
        );
      }
      if (!known.has(canon)) {
        addWarning(
          warnings,
          path,
          `"${canon}" katalogda yok`,
          "UNKNOWN_TEST_KEY"
        );
      }
    }

    // 6b. Rubrik vs labs
    if (rub?.beklenenTestler) {
      for (const t of rub.beklenenTestler) {
        if (!t?.key) continue;
        const canon = canonicalizeTestKey(t.key);
        if (!labKeysCanon.has(canon) && !labKeysRaw.includes(t.key)) {
          addError(
            errors,
            `labs.statikTestler.${t.key}`,
            `Beklenen test için statik sonuç yok: ${t.key}`,
            "MISSING_LAB_FOR_EXPECTED_TEST"
          );
        }
      }
    }

    // 6c. beklenen ∩ gereksiz
    if (rub) {
      const gereksizKeys = new Set(
        (rub.gereksizTestler || []).map((g) => canonicalizeTestKey(g.key))
      );
      for (const t of rub.beklenenTestler || []) {
        if (!t?.key) continue;
        const canon = canonicalizeTestKey(t.key);
        if (gereksizKeys.has(canon)) {
          addError(
            errors,
            `rubric.gereksizTestler.${t.key}`,
            `Aynı test hem beklenen hem gereksiz: ${t.key}`,
            "CONFLICTING_TEST_RULE"
          );
        }
      }
    }
  }

  // ── 7. Vitals ──
  if (!doc.vitals) {
    addError(errors, "vitals", "Vital bulgular eksik", "NO_VITALS");
  } else {
    if (!doc.vitals.tansiyon?.trim()) {
      addError(errors, "vitals.tansiyon", "Tansiyon eksik");
    } else if (!/^\d{2,3}\s*\/\s*\d{2,3}/.test(doc.vitals.tansiyon)) {
      addWarning(
        warnings,
        "vitals.tansiyon",
        `Tansiyon formatı şüpheli: "${doc.vitals.tansiyon}" (beklenen 120/80)`,
        "VITAL_FORMAT"
      );
    }
    if (typeof doc.vitals.nabiz !== "number") {
      addError(errors, "vitals.nabiz", "Nabız eksik veya sayı değil");
    } else if (doc.vitals.nabiz < 30 || doc.vitals.nabiz > 220) {
      addWarning(
        warnings,
        "vitals.nabiz",
        `Nabız klinik aralık dışı: ${doc.vitals.nabiz}`,
        "VITAL_OUT_OF_RANGE"
      );
    }
    if (typeof doc.vitals.ates !== "number") {
      addError(errors, "vitals.ates", "Ateş eksik veya sayı değil");
    } else if (doc.vitals.ates < 34 || doc.vitals.ates > 43) {
      addWarning(
        warnings,
        "vitals.ates",
        `Ateş klinik aralık dışı: ${doc.vitals.ates}`,
        "VITAL_OUT_OF_RANGE"
      );
    }
    if (typeof doc.vitals.spo2 !== "number") {
      addError(errors, "vitals.spo2", "SpO2 eksik veya sayı değil");
    } else if (doc.vitals.spo2 < 50 || doc.vitals.spo2 > 100) {
      addWarning(
        warnings,
        "vitals.spo2",
        `SpO2 klinik aralık dışı: ${doc.vitals.spo2}`,
        "VITAL_OUT_OF_RANGE"
      );
    }
  }

  // ── 8. hastaYanitlari ──
  const yanitlar = doc.hastaYanitlari || {};
  if (Object.keys(yanitlar).length === 0) {
    addWarning(
      warnings,
      "hastaYanitlari",
      "Hasta yanıtları boş",
      "NO_PATIENT_ANSWERS"
    );
  } else {
    if (!yanitlar.OZEL) {
      addWarning(
        warnings,
        "hastaYanitlari.OZEL",
        "OZEL fallback yanıtı yok",
        "NO_FALLBACK_ANSWER"
      );
    }
    // Beklenen sorular için yanıt
    for (const s of rub?.beklenenSorular || []) {
      if (s?.key && !yanitlar[s.key]) {
        addWarning(
          warnings,
          `hastaYanitlari.${s.key}`,
          `Beklenen soru için yanıt yok: ${s.key}`,
          "MISSING_ANSWER_FOR_QUESTION"
        );
      }
    }
  }

  // ── 9. Management ──
  if (!doc.management?.idealYol?.length) {
    addWarning(
      warnings,
      "management.idealYol",
      "İdeal klinik yol boş",
      "NO_IDEAL_PATH"
    );
  }
  if (!doc.management?.egitimNotu?.trim()) {
    addWarning(
      warnings,
      "management.egitimNotu",
      "Eğitim notu boş",
      "NO_EDU_NOTE"
    );
  }

  // ── 10. Demografi vs semptom ──
  // Şablonda {{cinsiyet}} varsa dinamik; sabit "erkek"/"kadın" + zıt cinsiyet tercihi uyarı
  const semptom = (doc.presentation?.semptomSablon || "").toLowerCase();
  const cins = doc.patient?.cinsiyetTercih;
  const hasPlaceholder = /\{\{\s*cinsiyet\s*\}\}/i.test(doc.presentation?.semptomSablon || "");
  if (!hasPlaceholder) {
    if (cins === "K" && /\berkek\b/.test(semptom) && !/\bkad[iı]n\b/.test(semptom)) {
      addWarning(
        warnings,
        "presentation.semptomSablon",
        "cinsiyetTercih=K ancak semptomda sabit 'erkek' geçiyor",
        "DEMOGRAPHIC_INCONSISTENCY"
      );
    }
    if (cins === "E" && /\bkad[iı]n\b/.test(semptom) && !/\berkek\b/.test(semptom)) {
      addWarning(
        warnings,
        "presentation.semptomSablon",
        "cinsiyetTercih=E ancak semptomda sabit 'kadın' geçiyor",
        "DEMOGRAPHIC_INCONSISTENCY"
      );
    }
  }

  // ── 11. Aktif vaka sıkılaştırma ──
  if (doc.meta?.durum === "aktif") {
    if (!doc.vitals) {
      /* already error */
    }
    if (labKeysRaw.length === 0) {
      /* already error */
    }
    if (!doc.management?.idealYol?.length) {
      addWarning(
        warnings,
        "management.idealYol",
        "Aktif vakada idealYol önerilir",
        "ACTIVE_INCOMPLETE"
      );
    }
  }

  const status: VakaValidationStatus =
    errors.length > 0
      ? "invalid"
      : warnings.length > 0
        ? "valid_with_warnings"
        : "valid";

  return {
    id: doc.id || "(no-id)",
    hastalikAdi: doc.meta?.hastalikAdi,
    poliklinikKey: doc.meta?.poliklinikKey,
    durum: doc.meta?.durum,
    seviye: doc.meta?.seviye,
    errors,
    warnings,
    status,
  };
}

/** Depo AdminVaka → CDM → doğrula */
export function validateAdminVaka(av: AdminVaka): VakaValidationResult {
  const doc = adminVakaToCdm(av);
  return validateVakaDocument(doc);
}

function topCodes(
  results: VakaValidationResult[],
  kind: "errors" | "warnings"
): { code: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of results) {
    for (const issue of r[kind]) {
      map.set(issue.code, (map.get(issue.code) || 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

/** Toplu rapor */
export function buildValidationReport(cases: AdminVaka[]): ValidationReport {
  const results = cases.map(validateAdminVaka);
  const valid = results.filter((r) => r.status === "valid").length;
  const validWithWarnings = results.filter((r) => r.status === "valid_with_warnings").length;
  const invalid = results.filter((r) => r.status === "invalid").length;

  return {
    generatedAt: new Date().toISOString(),
    cdmVersion: TIP_AI_CDM_VERSION,
    summary: {
      total: results.length,
      valid,
      validWithWarnings,
      invalid,
      errorCount: results.reduce((n, r) => n + r.errors.length, 0),
      warningCount: results.reduce((n, r) => n + r.warnings.length, 0),
      topErrorCodes: topCodes(results, "errors"),
      topWarningCodes: topCodes(results, "warnings"),
    },
    results,
  };
}

/** Konsol / log için metin rapor */
export function formatValidationReportText(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push("TIP-AI Vaka Doğrulama Raporu");
  lines.push(`CDM: ${report.cdmVersion} · ${report.generatedAt}`);
  lines.push("");
  lines.push("ÖZET");
  lines.push(`  Toplam vaka:        ${report.summary.total}`);
  lines.push(`  Geçerli:            ${report.summary.valid}`);
  lines.push(`  Uyarılı geçerli:    ${report.summary.validWithWarnings}`);
  lines.push(`  Geçersiz (hatalı):  ${report.summary.invalid}`);
  lines.push(`  Toplam hata:        ${report.summary.errorCount}`);
  lines.push(`  Toplam uyarı:       ${report.summary.warningCount}`);

  if (report.summary.topErrorCodes.length) {
    lines.push("");
    lines.push("En sık hatalar:");
    for (const t of report.summary.topErrorCodes.slice(0, 8)) {
      lines.push(`  ${t.code}: ${t.count}`);
    }
  }
  if (report.summary.topWarningCodes.length) {
    lines.push("");
    lines.push("En sık uyarılar:");
    for (const t of report.summary.topWarningCodes.slice(0, 8)) {
      lines.push(`  ${t.code}: ${t.count}`);
    }
  }

  for (const res of report.results) {
    if (!res.errors.length && !res.warnings.length) continue;
    lines.push("");
    lines.push(
      `=== ${res.id} · ${res.hastalikAdi || "?"} (${res.status}) · ${res.durum || "?"} ===`
    );
    if (res.errors.length) {
      lines.push("  HATALAR:");
      for (const e of res.errors) {
        lines.push(`   - [${e.code}] ${e.field}: ${e.message}`);
      }
    }
    if (res.warnings.length) {
      lines.push("  UYARILAR:");
      for (const w of res.warnings) {
        lines.push(`   - [${w.code}] ${w.field}: ${w.message}`);
      }
    }
  }

  return lines.join("\n");
}
