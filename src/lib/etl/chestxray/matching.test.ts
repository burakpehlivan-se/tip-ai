import { describe, expect, it } from "vitest";
import {
  cxrLabelForSnomed,
  matchCandidates,
  matchChestXray,
  pickDeterministic,
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
});
