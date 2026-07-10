/**
 * Layer 4 — ETL: Eksik testleri kaynağa yazma
 *
 * Tüm vakaları tarar; rubrikte olup statikTestler'de eksik, katalogda
 * olan (never_generate hariç) testleri lab motoruyla üretip `generatedTests`'e yazar.
 * Sonuçu data/admin/cases.json'a atomik olarak kaydeder.
 *
 *   npx tsx scripts/fill-tests.ts
 *   npx tsx scripts/fill-tests.ts --dry   (sadece rapor, yazmaz)
 */

import { loadCasesStore, saveCasesStore } from "../src/lib/admin/store";
import { fillAllCases } from "../src/lib/pipeline/lab-fill";
import { scanAllCases } from "../src/lib/pipeline/case-scanner";

const dry = process.argv.includes("--dry");

function main() {
  const store = loadCasesStore();
  const before = scanAllCases(store.cases);

  if (!dry) {
    const { cases: filled, totalFilled, totalStaticRequired, totalInvalid } =
      fillAllCases(store.cases);
    store.cases = filled;
    saveCasesStore(store);

    const after = scanAllCases(filled);

    console.log("TIP-AI · Test Pipeline — ETL Doldurma");
    console.log(`Tarih: ${new Date().toISOString()}`);
    console.log("");
    console.log(`Vaka:               ${filled.length}`);
    console.log(`Motorla doldurulan:  ${totalFilled}`);
    console.log(`Statik gerekli (atlandı): ${totalStaticRequired}`);
    console.log(`Geçersiz (atlandı): ${totalInvalid}`);
    console.log("");
    console.log("SONRASI DURUM");
    console.log(`  OK:               ${after.totalOk}`);
    console.log(`  Motor→doldurulacak: ${after.totalNeedsGenerated}`);
    console.log(`  Statik gerekli:   ${after.totalStaticRequired}`);
    console.log(`  Geçersiz:         ${after.totalInvalid}`);
    console.log("");
    console.log(
      `Kaydedildi: data/admin/cases.json (changeCount=${store.changeCount})`
    );
  } else {
    const { cases, totalFilled, totalStaticRequired, totalInvalid } =
      fillAllCases(store.cases);
    void cases;
    console.log("TIP-AI · Test Pipeline — DRY RUN (yazılmadı)");
    console.log(`Motorla doldurulacak:  ${totalFilled}`);
    console.log(`Statik gerekli (atlanır): ${totalStaticRequired}`);
    console.log(`Geçersiz (atlanır): ${totalInvalid}`);
  }
}

main();
