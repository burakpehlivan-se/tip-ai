import { describe, expect, it } from "vitest";
import { normalizeAdminVaka } from "@/lib/admin/types";
import { scanAllCases } from "./case-scanner";

function caseWithTests(id: string, hasResult: boolean) {
  return normalizeAdminVaka({
    id,
    poliklinikKey: "test",
    hastalikKey: id,
    hastalikAdi: id,
    rubric: {
      beklenenSorular: [],
      beklenenTestler: [{ key: "CBC", etiket: "Hemogram", aciklama: "Bazal" }],
      gereksizTestler: [],
      redFlagler: [],
      kabulEdilenTani: [id],
      puanlama: {},
    },
    statikTestler: hasResult
      ? { CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "14" } } }
      : {},
  });
}

describe("case scan summary metrics", () => {
  it("separates case counts from aggregate result-row counts", () => {
    const report = scanAllCases([caseWithTests("ready", true), caseWithTests("missing", false)]);

    expect(report.totalCases).toBe(2);
    expect(report.totalOkTests).toBe(1);
    expect(report.totalCasesWithResults).toBe(1);
    expect(report.totalCasesComplete).toBe(1);
    expect(report.totalCasesWithProblems).toBe(1);
    expect(report.totalExpectedTests).toBe(2);
    expect(report.coveragePercent).toBe(50);
  });
});
