/**
 * MIMIC → TIP-AI CDM v1 ETL demo (fixture; PhysioNet gerekmez)
 *
 *   npm run etl:mimic-demo
 *   npx tsx scripts/etl-mimic-demo.ts --import   # admin depo’ya taslak import
 *   npx tsx scripts/etl-mimic-demo.ts --out tmp/cdm-from-mimic.json
 */

import fs from "fs";
import path from "path";
import {
  etlMimicEpisodeToCdm,
  FIXTURE_STEMI_EPISODE,
  FIXTURE_T2DM_EPISODE,
} from "../src/lib/etl/mimic";
import { cdmToAdminVaka } from "../src/lib/cdm";
import { appendLog, clone, loadCasesStore, saveCasesStore } from "../src/lib/admin/store";

async function main() {
  const args = process.argv.slice(2);
  const doImport = args.includes("--import");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

  const bundles = [FIXTURE_T2DM_EPISODE, FIXTURE_STEMI_EPISODE];
  const results = bundles.map((b) => etlMimicEpisodeToCdm(b));

  console.log("MIMIC → TIP-AI CDM v1 ETL demo\n");
  for (const r of results) {
    console.log(`=== ${r.vaka.id} ===`);
    console.log(`  source: ${r.meta.source} · ${r.meta.subject_id}/${r.meta.hadm_id}`);
    console.log(
      `  disease: ${r.meta.diseaseMapping?.hastalikKey || "?"} · labs mapped ${r.meta.labMapped} (unmapped ${r.meta.labUnmapped})`
    );
    console.log(
      `  validation: ${r.validation.status} · errors ${r.validation.errors.length} · warnings ${r.validation.warnings.length}`
    );
    if (r.validation.errors.length) {
      for (const e of r.validation.errors.slice(0, 5)) {
        console.log(`    [ERR] ${e.field}: ${e.message}`);
      }
    }
    if (r.validation.warnings.length) {
      for (const w of r.validation.warnings.slice(0, 4)) {
        console.log(`    [WARN] ${w.field}: ${w.message}`);
      }
    }
    console.log(`  steps: ${r.meta.steps.join(" → ")}`);
    console.log("");
  }

  const bundleOut = {
    format: "tip_ai_cdm_bundle",
    cdmVersion: "tip-ai-cdm-v1",
    exportedAt: new Date().toISOString(),
    caseCount: results.length,
    etl: "mimic-fixture-demo",
    cases: results.map((r) => r.vaka),
  };

  if (outPath) {
    const abs = path.resolve(outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(bundleOut, null, 2), "utf8");
    console.log(`CDM bundle yazıldı: ${abs}`);
  } else {
    // default write under data/etl-out
    const abs = path.join(process.cwd(), "data", "etl-out", "mimic-fixture-cdm-bundle.json");
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(bundleOut, null, 2), "utf8");
    console.log(`CDM bundle yazıldı: ${abs}`);
  }

  if (doImport) {
    const store = loadCasesStore();
    let added = 0;
    for (const r of results) {
      const av = cdmToAdminVaka(r.vaka);
      const idx = store.cases.findIndex((c) => c.id === av.id);
      if (idx >= 0) {
        store.cases[idx] = av;
      } else {
        store.cases.push(av);
        added++;
      }
    }
    store.changeCount = (store.changeCount || 0) + 1;
    store.updatedAt = Date.now();
    saveCasesStore(store);
    appendLog({
      action: "import_cdm",
      actor: "etl-mimic-demo",
      message: `MIMIC fixture ETL: ${results.length} CDM vaka (yeni ${added}).`,
      patches: results.map((r) => ({
        path: `__case_create__:${r.vaka.id}`,
        caseId: r.vaka.id,
        before: null,
        after: clone(cdmToAdminVaka(r.vaka)),
      })),
    });
    console.log(`Admin depo’ya yazıldı (${results.length} vaka, +${added} yeni).`);
  }

  const invalid = results.filter((r) => r.validation.status === "invalid").length;
  if (invalid > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
