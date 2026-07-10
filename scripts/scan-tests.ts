/**
 * Layer 1 + 2 — Test Envanteri & Eksik Test Taraması
 *
 * Çıktı: reports/test-pipeline/scan-report.json + konsol özeti.
 *
 *   npx tsx scripts/scan-tests.ts
 *   npx tsx scripts/scan-tests.ts --json   (sadece JSON yazar)
 */

import fs from "fs";
import path from "path";
import { loadCasesStore } from "../src/lib/admin/store";
import { buildTestInventory } from "../src/lib/pipeline/master-catalogue";
import { scanAllCases, problemCases } from "../src/lib/pipeline/case-scanner";

const onlyJson = process.argv.includes("--json");

function main() {
  const store = loadCasesStore();
  const cases = store.cases;
  const inventory = buildTestInventory(cases);
  const report = scanAllCases(cases);

  const outDir = path.join(process.cwd(), "reports", "test-pipeline");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "scan-report.json"),
    JSON.stringify({ inventory, report }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outDir, "inventory.json"),
    JSON.stringify(inventory, null, 2),
    "utf8"
  );

  if (onlyJson) {
    console.log(
      `scan-report.json + inventory.json yazıldı (${cases.length} vaka).`
    );
    return;
  }

  console.log("TIP-AI · Test Pipeline — Tarama Raporu");
  console.log(`Tarih: ${report.generatedAt}`);
  console.log("");
  console.log("MASTER CATALOGUE");
  console.log(`  Bilinen test key:   ${inventory.totalKeys}`);
  console.log(`  Rubrikte kullanılan: ${inventory.usage.filter((u) => u.usedInRubric).length}`);
  console.log(`  Statikte kullanılan: ${inventory.usage.filter((u) => u.usedInStatic).length}`);
  console.log(`  Katalog dışı key:   ${inventory.unknownKeys.length}`);
  console.log("");
  console.log("EKSİK TEST ÖZETİ");
  console.log(`  Vaka sayısı:        ${report.totalCases}`);
  console.log(`  OK (sonuçlu):      ${report.totalOk}`);
  console.log(`  Motor dolduracak:    ${report.totalNeedsGenerated}`);
  console.log(`  Statik gerekli:      ${report.totalStaticRequired}`);
  console.log(`  Geçersiz (katalog dışı): ${report.totalInvalid}`);

  const problems = problemCases(report);
  if (problems.length) {
    console.log("");
    console.log(`SORUNLU VAKALAR (${problems.length}):`);
    for (const c of problems) {
      const bits: string[] = [];
      if (c.needsGenerated.length)
        bits.push(`motor→[${c.needsGenerated.join(", ")}]`);
      if (c.staticRequired.length)
        bits.push(`statik→[${c.staticRequired.join(", ")}]`);
      if (c.invalidKeys.length)
        bits.push(`geçersiz→[${c.invalidKeys.join(", ")}]`);
      console.log(`  • ${c.vakaId} (${c.hastalikAdi || "?"})`);
      for (const b of bits) console.log(`      ${b}`);
    }
  }

  if (inventory.unknownKeys.length) {
    console.log("");
    console.log("KATALOG DIŞI KEY'LER (alias/canonical ekle):");
    for (const u of inventory.unknownKeys) {
      console.log(`  • ${u.key}  →  ${u.vakaIds.length} vaka`);
    }
  }

  console.log("");
  console.log(`Tam rapor: reports/test-pipeline/scan-report.json`);
}

main();
