import { describe, expect, it } from "vitest";
import {
  cxrLabelForSnomed,
  matchCandidates,
  matchChestXray,
  pickDeterministic,
  primarySnomedForCaseId,
  type CxrRow,
} from "./matching";

function row(imageIndex: string, labels: string[], gender: "M" | "F", age: number): CxrRow {
  return { imageIndex, labels, gender, age };
}

const rows: CxrRow[] = [
  row("00000001_000.png", ["Pneumonia"], "M", 55),
  row("00000001_001.png", ["Pneumonia", "Effusion"], "M", 58),
  row("00000002_000.png", ["Pneumonia"], "F", 40),
  row("00000003_000.png", ["Emphysema"], "M", 60),
  row("00000004_000.png", ["No Finding"], "F", 50),
];

describe("chestxray matching", () => {
  it("SNOMED kodunu CXR etiketine çevirir", () => {
    expect(cxrLabelForSnomed("233604007")).toBe("Pneumonia");
    expect(cxrLabelForSnomed("185086009")).toBe("Emphysema");
    expect(cxrLabelForSnomed("254637007")).toBe("Mass");
    expect(cxrLabelForSnomed("999999999")).toBeNull();
  });

  it("etiket + cinsiyet + yaş filtresi adayları daraltır", () => {
    const candidates = matchCandidates(rows, "Pneumonia", "M", 55);
    expect(candidates.map((r) => r.imageIndex).sort()).toEqual(["00000001_000.png", "00000001_001.png"]);
  });

  it("aynı tohum deterministik seçer", () => {
    const candidates = matchCandidates(rows, "Pneumonia", "M", 55);
    const a = pickDeterministic(candidates, "kardiyoloji::stemi");
    const b = pickDeterministic(candidates, "kardiyoloji::stemi");
    expect(a?.imageIndex).toBe(b?.imageIndex);
  });

  it("tanıya göre doğru görüntüyü eşleştirir (yaş/cinsiyet)", () => {
    const match = matchChestXray(rows, ["233604007"], 55, "M", "seed");
    expect(match?.label).toBe("Pneumonia");
    expect(match?.imageIndex).toBeTruthy();
  });

  it("eşleşen etiket/yaş/cinsiyet yoksa null döner", () => {
    expect(matchChestXray(rows, ["233604007"], 90, "M", "seed")).toBeNull();
    expect(matchChestXray(rows, ["87433001"], 20, "F", "seed")).toBeNull();
  });

  describe("primarySnomedForCaseId", () => {
    it("synthea-tani-<kod> vaka kimliğinden ana tanı kodunu çıkarır", () => {
      expect(primarySnomedForCaseId("dahiliye::synthea-tani-424132000-synthea-071d02d1879884ce")).toEqual([
        "424132000",
      ]);
    });

    it("hastalikKey ile eşlenen vaka kimliğinden ana tanı kodlarını türetir", () => {
      expect(primarySnomedForCaseId("solunum::koah-synthea-004bd50a90141b80")).toContain("87433001");
    });

    it("CXR eşleşmesi olmayan ana tanıyı (diyabet) hariç tutar", () => {
      const codes = primarySnomedForCaseId("endokrin::tip-2-diyabet-synthea-da936b58ff6b23f9");
      expect(codes).not.toContain("87433001");
      expect(codes).not.toContain("233604007");
    });

    it("eşleşmeyen vaka kimliği için null döner", () => {
      expect(primarySnomedForCaseId("cocuk-cerrahisi::invajinasyon-synthea-abc")).toBeNull();
      expect(primarySnomedForCaseId("kardiyoloji::tanimsiz-xyz-synthea-abc")).toBeNull();
    });
  });
});
