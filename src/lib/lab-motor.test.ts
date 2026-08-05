import { describe, expect, it } from "vitest";
import { getLabResult, generateFullPanel, isTestKnown, getKnownTestKeys } from "./lab-motor";
import { ClinicalProfile, TestSonucu } from "./types";

const stemiProfile: ClinicalProfile = {
  age: 55,
  sex: "E",
  diagnoses: ["STEMI"],
  comorbidities: [],
  severity: "agir",
  hastalikKey: "stemi",
};

describe("getLabResult", () => {
  it("statik override varsa onu döner (Layer 1)", () => {
    const statik: Record<string, TestSonucu> = {
      TROPONIN: {
        testKey: "TROPONIN",
        testAdi: "Troponin",
        tip: "numeric",
        sonuc: { deger: 42, birim: "ng/mL", referansAralik: "<0.1" },
        source: "original",
      },
    };
    const result = getLabResult("TROPONIN", stemiProfile, statik);
    expect(result).not.toBeNull();
    expect(result!.sonuc).toEqual({ deger: 42, birim: "ng/mL", referansAralik: "<0.1" });
  });

  it("stemi profilinde TROPONIN anormal yüksek üretir (Layer 2)", () => {
    const result = getLabResult("TROPONIN", stemiProfile);
    expect(result).not.toBeNull();
    expect(result!.tip).toBe("numeric");
    const deger = (result!.sonuc as { deger: number }).deger;
    expect(deger).toBeGreaterThan(0);
    expect(result!.source).toBe("synthetic");
  });

  it("bilinmeyen test anahtarı null döner", () => {
    const result = getLabResult("OLMAYAN_TEST_XYZ", stemiProfile);
    expect(result).toBeNull();
  });

  it("bilinen test anahtarı isTestKnown ile doğrulanır", () => {
    expect(isTestKnown("TROPONIN")).toBe(true);
    expect(isTestKnown("OLMAYAN_TEST_XYZ")).toBe(false);
  });
});

describe("generateFullPanel", () => {
  it("hastalık map'inden panel üretir ve statik testleri korur", () => {
    const panel = generateFullPanel("stemi", stemiProfile, {});
    expect(Object.keys(panel).length).toBeGreaterThan(0);
    const t = panel.TROPONIN;
    expect(t).toBeDefined();
    expect(t!.source).toBe("synthetic");
  });

  it("getKnownTestKeys boş değildir", () => {
    expect(getKnownTestKeys().length).toBeGreaterThan(10);
  });
});
