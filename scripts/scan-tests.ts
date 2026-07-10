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
import { computeCatalogueFlags } from "../src/lib/pipeline/catalogue-flags";
import { TestVisibility } from "../src/lib/pipeline/types";

const onlyJson = process.argv.includes("--json");

function main() {
  const store = loadCasesStore();
  const cases = store.cases;
  const inventory = buildTestInventory(cases);
  const report = scanAllCases(cases);
  const flags = computeCatalogueFlags(cases);

  // Görünürlük katmanı istatistiği
  const visibilityStats: Record<TestVisibility, { total: number; withData: number; missing: string[] }> = {
    visible_default: { total: 0, withData: 0, missing: [] },
    visible_advanced: { total: 0, withData: 0, missing: [] },
    hidden: { total: 0, withData: 0, missing: [] },
  };
  for (const [key, entry] of Object.entries(inventory.entries)) {
    const vis = entry.visibility || "visible_default";
    visibilityStats[vis].total++;
    if (flags.hasData.has(key)) visibilityStats[vis].withData++;
    else if (vis !== "hidden") visibilityStats[vis].missing.push(key);
  }

  const outDir = path.join(process.cwd(), "reports", "test-pipeline");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "scan-report.json"),
    JSON.stringify({ inventory, report, flags: { totalWithData: flags.totalWithData, motorCapable: flags.totalMotorCapable, visibilityStats } }, null, 2),
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
  console.log("GÖRÜNÜRLÜK KATMANLARI");
  console.log(`  Çekirdek (default):  ${visibilityStats.visible_default.total} test, ${visibilityStats.visible_default.withData} verili`);
  console.log(`  Branş (advanced):    ${visibilityStats.visible_advanced.total} test, ${visibilityStats.visible_advanced.withData} verili`);
  console.log(`  Gizli (hidden):      ${visibilityStats.hidden.total} test`);
  console.log(`  Motor-capable:       ${flags.totalMotorCapable}`);
  if (visibilityStats.visible_default.missing.length > 0) {
    console.log(`  ⚠ Çekirdek test eksik veri: ${visibilityStats.visible_default.missing.join(", ")}`);
  }
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
