import { AdminVaka } from "../admin/types";
import { TestSonucu } from "../types";
import { getReferenceEntry } from "../lab-reference-library";

export type OverrideAction = "remove" | "keep" | "unknown";

export interface OverrideAnalysis {
  testKey: string;
  testAdi: string;
  action: OverrideAction;
  reason: string;
  currentValue: unknown;
  referenceNormal: unknown;
}

export interface VakaOverrideReport {
  vakaId: string;
  hastalikAdi: string;
  poliklinikKey: string;
  totalStaticTests: number;
  removable: OverrideAnalysis[];
  keep: OverrideAnalysis[];
  unknown: OverrideAnalysis[];
  summary: {
    total: number;
    removableCount: number;
    keepCount: number;
    unknownCount: number;
    reductionPercent: number;
  };
}

function isNumericResult(sonuc: unknown): sonuc is { deger: number; birim?: string; referansAralik?: string } {
  return typeof sonuc === "object" && sonuc !== null && "deger" in sonuc && typeof (sonuc as Record<string, unknown>).deger === "number";
}

function isJsonResult(sonuc: unknown): sonuc is Record<string, unknown> {
  return typeof sonuc === "object" && sonuc !== null && !("deger" in sonuc);
}

function valueInNormalRange(
  deger: number,
  min: number,
  max: number
): boolean {
  const tolerance = (max - min) * 0.1;
  return deger >= min - tolerance && deger <= max + tolerance;
}

function analyzeTestOverride(
  testKey: string,
  result: TestSonucu
): OverrideAnalysis {
  const entry = getReferenceEntry(testKey);

  if (!entry) {
    return {
      testKey,
      testAdi: result.testAdi || testKey,
      action: "unknown",
      reason: "Referans kütüphanesinde bu test tanımlı değil.",
      currentValue: result.sonuc,
      referenceNormal: null,
    };
  }

  // Imaging/pathology tests are always hand-written — keep them
  if (entry.tip === "text") {
    return {
      testKey,
      testAdi: entry.testAdi,
      action: "keep",
      reason: `${entry.kategori} raporu — her zaman vaka özel (never_generate).`,
      currentValue: result.sonuc,
      referenceNormal: entry.varsayilanDeger,
    };
  }

  // Original-source results always stay (they were hand-written for a reason)
  if (result.source === "original") {
    return {
      testKey,
      testAdi: result.testAdi || entry.testAdi,
      action: "keep",
      reason: "source=original — el yapımı patoloji değeri, override olarak kalmalı.",
      currentValue: result.sonuc,
      referenceNormal: entry.varsayilanDeger,
    };
  }

  // Numeric tests: compare value against reference range
  if (entry.tip === "numeric" && isNumericResult(result.sonuc)) {
    const norm = entry.varsayilanDeger.tumHastalar || entry.varsayilanDeger.erkek || entry.varsayilanDeger.kadin;
    if (!norm || typeof (norm as Record<string, unknown>).min !== "number") {
      return {
        testKey,
        testAdi: entry.testAdi,
        action: "keep",
        reason: "Referans aralığı tanımsız — manuel override olarak korunuyor.",
        currentValue: result.sonuc,
        referenceNormal: entry.varsayilanDeger,
      };
    }

    const { min, max } = norm as { min: number; max: number };
    if (valueInNormalRange(result.sonuc.deger, min, max)) {
      return {
        testKey,
        testAdi: entry.testAdi,
        action: "remove",
        reason: `Değer normal aralıkta (${result.sonuc.deger} ∈ [${min}, ${max}]) — referans kütüphanesi otomatik üretebilir.`,
        currentValue: result.sonuc,
        referenceNormal: norm,
      };
    }

    return {
      testKey,
      testAdi: entry.testAdi,
      action: "keep",
      reason: `Anormal değer (${result.sonuc.deger}, normal: [${min}, ${max}]) — override olarak korunmalı.`,
      currentValue: result.sonuc,
      referenceNormal: norm,
    };
  }

  // JSON panel tests
  if (entry.tip === "json" && isJsonResult(result.sonuc)) {
    const norm = entry.varsayilanDeger.tumHastalar || entry.varsayilanDeger.erkek || entry.varsayilanDeger.kadin;
    if (!norm || typeof norm !== "object") {
      return {
        testKey,
        testAdi: entry.testAdi,
        action: "keep",
        reason: "Panel referans değer tanımsız.",
        currentValue: result.sonuc,
        referenceNormal: entry.varsayilanDeger,
      };
    }

    // Compare JSON fields — if all numeric fields match normal, mark removable
    const normObj = norm as Record<string, number | string>;
    let allNormal = true;
    let hasDifference = false;

    for (const [field, normalValue] of Object.entries(normObj)) {
      if (typeof normalValue === "number" && field in result.sonuc) {
        const actualValue = (result.sonuc as Record<string, unknown>)[field];
        if (typeof actualValue === "number" && Math.abs(actualValue - normalValue) > normalValue * 0.15) {
          allNormal = false;
          hasDifference = true;
          break;
        }
      }
    }

    if (allNormal && Object.keys(normObj).length > 0) {
      return {
        testKey,
        testAdi: entry.testAdi,
        action: "remove",
        reason: "Panel değerleri normal aralıkta — referans kütüphanesi otomatik üretebilir.",
        currentValue: result.sonuc,
        referenceNormal: norm,
      };
    }

    return {
      testKey,
      testAdi: entry.testAdi,
      action: "keep",
      reason: hasDifference ? "Panel değerlerinden en az biri normalden sapmış." : "Panel değerleri manuel override olarak korunuyor.",
      currentValue: result.sonuc,
      referenceNormal: norm,
    };
  }

  return {
    testKey,
    testAdi: entry.testAdi,
    action: "keep",
    reason: "Tip uyuşmazlığı veya tanımsız durum — manuel olarak korunuyor.",
    currentValue: result.sonuc,
    referenceNormal: entry.varsayilanDeger,
  };
}

export function analyzeVakaOverrides(vaka: AdminVaka): VakaOverrideReport {
  const statikTestler = vaka.statikTestler || {};
  const analyses: OverrideAnalysis[] = [];

  for (const [key, result] of Object.entries(statikTestler)) {
    analyses.push(analyzeTestOverride(key, result));
  }

  const removable = analyses.filter((a) => a.action === "remove");
  const keep = analyses.filter((a) => a.action === "keep");
  const unknown = analyses.filter((a) => a.action === "unknown");

  const total = analyses.length;
  const removableCount = removable.length;
  const keepCount = keep.length;
  const unknownCount = unknown.length;

  return {
    vakaId: vaka.id,
    hastalikAdi: vaka.hastalikAdi,
    poliklinikKey: vaka.poliklinikKey,
    totalStaticTests: total,
    removable,
    keep,
    unknown,
    summary: {
      total,
      removableCount,
      keepCount,
      unknownCount,
      reductionPercent: total > 0 ? Math.round((removableCount / total) * 100) : 0,
    },
  };
}

export function analyzeAllVakasOverrides(
  cases: AdminVaka[]
): {
  reports: VakaOverrideReport[];
  grandTotal: {
    totalCases: number;
    totalStaticTests: number;
    totalRemovable: number;
    totalKeep: number;
    totalUnknown: number;
    overallReductionPercent: number;
  };
} {
  const reports = cases.map(analyzeVakaOverrides);

  const grandTotal = {
    totalCases: reports.length,
    totalStaticTests: reports.reduce((s, r) => s + r.totalStaticTests, 0),
    totalRemovable: reports.reduce((s, r) => s + r.summary.removableCount, 0),
    totalKeep: reports.reduce((s, r) => s + r.summary.keepCount, 0),
    totalUnknown: reports.reduce((s, r) => s + r.summary.unknownCount, 0),
    overallReductionPercent:
      reports.reduce((s, r) => s + r.totalStaticTests, 0) > 0
        ? Math.round(
            (reports.reduce((s, r) => s + r.summary.removableCount, 0) /
              reports.reduce((s, r) => s + r.totalStaticTests, 0)) *
              100
          )
        : 0,
  };

  return { reports, grandTotal };
}

export function applyOverrideMigration(
  vaka: AdminVaka,
  report: VakaOverrideReport
): AdminVaka {
  const removableKeys = new Set(report.removable.map((r) => r.testKey));

  const newStaticTestler: Record<string, TestSonucu> = {};
  const newTestOverrides: Record<string, TestSonucu> = {};

  for (const [key, result] of Object.entries(vaka.statikTestler || {})) {
    if (removableKeys.has(key)) {
      // Move to generatedTests conceptually — already covered by reference library
      continue;
    }
    newTestOverrides[key] = result;
    newStaticTestler[key] = result; // keep in statikTestler as well for backward compat
  }

  return {
    ...vaka,
    testOverrides: newTestOverrides,
    statikTestler: newStaticTestler,
  };
}

export function buildOverrideMigrationSummary(
  reports: VakaOverrideReport[]
): string {
  const lines: string[] = [];

  for (const report of reports) {
    if (report.totalStaticTests === 0) continue;

    lines.push(`\n## ${report.vakaId} — ${report.hastalikAdi}`);
    lines.push(
      `  Toplam: ${report.summary.total} | Silinebilir: ${report.summary.removableCount} | Korunacak: ${report.summary.keepCount} | Bilinmeyen: ${report.summary.unknownCount}`
    );

    if (report.removable.length > 0) {
      lines.push("  ✓ Referans kütüphanesinden karşılanabilecekler:");
      for (const r of report.removable) {
        lines.push(`    - ${r.testKey} (${r.testAdi}): ${r.reason}`);
      }
    }

    if (report.keep.length > 0) {
      lines.push("  ✦ Vaka özel kalması gerekenler:");
      for (const k of report.keep) {
        lines.push(`    - ${k.testKey} (${k.testAdi}): ${k.reason}`);
      }
    }
  }

  return lines.join("\n");
}
