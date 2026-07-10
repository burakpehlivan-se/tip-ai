/**
 * TIP-AI Vaka Doğrulama Raporu — CLI
 *
 * Kullanım:
 *   npx tsx scripts/validate-vakalar.ts
 *   npx tsx scripts/validate-vakalar.ts --json > report.json
 *   npm run validate:vakalar
 *
 * Exit code 1 = en az bir invalid vaka (CI fail).
 */

import fs from "fs";
import path from "path";
import { loadCasesStore } from "../src/lib/admin/store";
import {
  buildValidationReport,
  formatValidationReportText,
} from "../src/lib/cdm/validate-report";

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

  const store = loadCasesStore();
  const report = buildValidationReport(store.cases);

  if (asJson) {
    const body = JSON.stringify(report, null, 2);
    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), body, "utf8");
      console.error(`Rapor yazıldı: ${outPath}`);
    } else {
      console.log(body);
    }
  } else {
    const text = formatValidationReportText(report);
    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), text, "utf8");
      console.log(text);
      console.error(`\nRapor yazıldı: ${outPath}`);
    } else {
      console.log(text);
    }
  }

  if (report.summary.invalid > 0) {
    process.exitCode = 1;
  }
}

main();
