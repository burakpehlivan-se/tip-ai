/**
 * Layer 5 — Validasyon (Son Kontrol / CI Kapısı)
 *
 * Tüm vakaları doğrular:
 *   - CDM raporu (yapısal hatalar / uyarılar)
 *   - Pipeline taraması (eksik / geçersiz testler)
 *
 * Çıkış kodu:
 *   0  → tüm vakalar geçerli (veya sadece uyarı)
 *   1  → hâlâ çözülmemiş hata var (MISSING/UNKNOWN test, CDM error)
 *
 *   npx tsx scripts/validate-vakalar.ts
 *   npx tsx scripts/validate-vakalar.ts --json
 *
 * Akış: önce `fill-tests` çalıştır (eksikleri motorla doldur),
 * sonra bu script — çözülmemiş hata kalmadıysa yeşil döner.
 */

import fs from "fs";
import path from "path";
import { loadCasesStore } from "../src/lib/admin/store";
import { buildValidationReport, formatValidationReportText } from "../src/lib/cdm/validate-report";
import { scanAllCases } from "../src/lib/pipeline/case-scanner";
import { computeCatalogueFlags } from "../src/lib/pipeline/catalogue-flags";
import { buildTestInventory } from "../src/lib/pipeline/master-catalogue";

const onlyJson = process.argv.includes("--json");

function main() {
  const store = loadCasesStore();
  const report = buildValidationReport(store.cases);
  const scan = scanAllCases(store.cases);
  const flags = computeCatalogueFlags(store.cases);
  const inventory = buildTestInventory(store.cases);

  // Çekirdek test coverage — motor-capable'da olmayan core testler blocking hata
  const coreMissingData: string[] = [];
  for (const [key, entry] of Object.entries(inventory.entries)) {
    if (entry.visibility === "visible_default" && !flags.hasData.has(key)) {
      coreMissingData.push(key);
    }
  }

  // Çözülmemiş sorunlar
  const unresolvedErrors =
    report.summary.errorCount +
    scan.totalNeedsGenerated +
    scan.totalInvalid +
    coreMissingData.length;

  const hasBlocking = unresolvedErrors > 0;

  if (onlyJson) {
    const outDir = path.join(process.cwd(), "reports", "test-pipeline");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "validate-report.json"),
      JSON.stringify({ report, scan, flags: { totalWithData: flags.totalWithData, motorCapable: flags.totalMotorCapable, coreMissingData } }, null, 2),
      "utf8"
    );
    console.log(
      `validate-report.json yazıldı · blocking=${hasBlocking} · errors=${report.summary.errorCount} · needsGen=${scan.totalNeedsGenerated} · invalid=${scan.totalInvalid} · coreMissing=${coreMissingData.length}`
    );
  } else {
    console.log(formatValidationReportText(report));
    console.log("");
    console.log("PIPELINE (eksik test) DURUMU");
    console.log(`  Motor→doldurulacak: ${scan.totalNeedsGenerated}`);
    console.log(`  Statik gerekli:      ${scan.totalStaticRequired}`);
    console.log(`  Geçersiz (katalog dışı): ${scan.totalInvalid}`);
    console.log("");
    console.log("GÖRÜNÜRLÜK KATMANLARI");
    console.log(`  Çekirdek test:        ${flags.totalVisibleDefault} · hasData=${flags.totalVisibleDefault - coreMissingData.length} · eksik=${coreMissingData.length}`);
    console.log(`  Motor-capable:        ${flags.totalMotorCapable}`);
    if (coreMissingData.length > 0) {
      console.log(`  ⚠ Çekirdek eksik veri: ${coreMissingData.join(", ")}`);
    }
    console.log("");
    if (hasBlocking) {
      const parts: string[] = [];
      if (report.summary.errorCount > 0) parts.push(`${report.summary.errorCount} CDM hatası`);
      if (scan.totalNeedsGenerated > 0) parts.push(`${scan.totalNeedsGenerated} doldurolmamış`);
      if (scan.totalInvalid > 0) parts.push(`${scan.totalInvalid} geçersiz test`);
      if (coreMissingData.length > 0) parts.push(`${coreMissingData.length} çekirdek test verisiz`);
      console.log(`✗ GEÇEMEDİ: ${parts.join(", ")}.`);
      console.log(
        `  Çözüm: 'npm run pipeline:fill' çalıştır, sonra tekrar validate et.`
      );
    } else {
      console.log(`✓ TÜM VAKALAR GEÇERLİ (${store.cases.length} vaka).`);
    }
  }

  process.exit(hasBlocking ? 1 : 0);
}

main();
