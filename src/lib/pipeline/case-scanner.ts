/**
 * Layer 2 — Vaka Tarayıcı ve Eksik Test Raporu
 *
 * Her vaka için:
 *   R = rubricten gelen test key seti (beklenen + gereksiz)
 *   S = statikTestler key seti
 *   C = masterCatalogue key seti
 *
 *   R ∩ S                → OK (zaten sonuçlu)
 *   R ∩ C \ S           → needsGenerated (motor dolduracak)
 *   R \ C (never hariç)→ invalidKeys (tasarım hatası)
 *
 * never_generate testler (görüntüleme/patoloji) statik olmalı;
 * eksiklerse `staticRequired` olarak raporlanır (motor dokunmaz).
 */

import { canonicalizeTestKey } from "../cdm/vocabulary";
import { AdminVaka } from "../admin/types";
import {
  CaseScanResult,
  ScanReport,
} from "./types";
import { MASTER_TEST_CATALOGUE, masterCatalogueKeySet } from "./master-catalogue";

export function scanCase(vaka: AdminVaka): CaseScanResult {
  const known = masterCatalogueKeySet();
  const rubric = vaka.rubric || ({} as AdminVaka["rubric"]);

  const R = new Set<string>();
  for (const t of [
    ...(rubric.beklenenTestler || []),
    ...(rubric.gereksizTestler || []),
  ]) {
    if (t?.key) R.add(canonicalizeTestKey(t.key));
  }

  const S = new Set<string>();
  for (const k of Object.keys(vaka.statikTestler || {})) {
    S.add(canonicalizeTestKey(k));
  }
  // Pipeline tarafından üretilip kalıcılaştırılanlar da "dolu" sayılır
  for (const k of Object.keys(vaka.generatedTests || {})) {
    S.add(canonicalizeTestKey(k));
  }

  const okTests: string[] = [];
  const needsGenerated: string[] = [];
  const staticRequired: string[] = [];
  const invalidKeys: string[] = [];

  R.forEach((key) => {
    if (S.has(key)) {
      okTests.push(key);
      return;
    }
    if (!known.has(key)) {
      invalidKeys.push(key);
      return;
    }
    const entry = MASTER_TEST_CATALOGUE[key];
    if (entry?.generationStrategy === "never_generate") {
      staticRequired.push(key);
    } else {
      needsGenerated.push(key);
    }
  });

  return {
    vakaId: vaka.id,
    hastalikAdi: vaka.hastalikAdi,
    poliklinikKey: vaka.poliklinikKey,
    durum: vaka.durum,
    okTests: okTests.sort(),
    needsGenerated: needsGenerated.sort(),
    staticRequired: staticRequired.sort(),
    invalidKeys: invalidKeys.sort(),
  };
}

export function scanAllCases(cases: AdminVaka[]): ScanReport {
  const results = cases.map(scanCase);
  return {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    totalOk: results.reduce((n, r) => n + r.okTests.length, 0),
    totalNeedsGenerated: results.reduce((n, r) => n + r.needsGenerated.length, 0),
    totalStaticRequired: results.reduce((n, r) => n + r.staticRequired.length, 0),
    totalInvalid: results.reduce((n, r) => n + r.invalidKeys.length, 0),
    cases: results,
  };
}

/** Sadece eksik/internal sorunlu vakaları döndürür (rapor için) */
export function problemCases(report: ScanReport): CaseScanResult[] {
  return report.cases.filter(
    (c) =>
      c.needsGenerated.length > 0 ||
      c.staticRequired.length > 0 ||
      c.invalidKeys.length > 0
  );
}
