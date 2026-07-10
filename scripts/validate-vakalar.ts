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

const onlyJson = process.argv.includes("--json");

function main() {
  const store = loadCasesStore();
  const report = buildValidationReport(store.cases);
  const scan = scanAllCases(store.cases);

  // Çözülmemiş sorunlar
  const unresolvedErrors =
    report.summary.errorCount +
    scan.totalNeedsGenerated +
    scan.totalInvalid;

  const hasBlocking = unresolvedErrors > 0;

  if (onlyJson) {
    const outDir = path.join(process.cwd(), "reports", "test-pipeline");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "validate-report.json"),
      JSON.stringify({ report, scan }, null, 2),
      "utf8"
    );
    console.log(
      `validate-report.json yazıldı · blocking=${hasBlocking} · errors=${report.summary.errorCount} · needsGen=${scan.totalNeedsGenerated} · invalid=${scan.totalInvalid}`
    );
  } else {
    console.log(formatValidationReportText(report));
    console.log("");
    console.log("PIPELINE (eksik test) DURUMU");
    console.log(`  Motor→doldurulacak: ${scan.totalNeedsGenerated}`);
    console.log(`  Statik gerekli:      ${scan.totalStaticRequired}`);
    console.log(`  Geçersiz (katalog dışı): ${scan.totalInvalid}`);
    console.log("");
    if (hasBlocking) {
      console.log(
        `✗ GEÇEMEDİ: ${report.summary.errorCount} CDM hatası, ${scan.totalNeedsGenerated} doldurolmamış, ${scan.totalInvalid} geçersiz test.`
      );
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
