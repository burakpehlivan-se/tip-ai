import { describe, expect, it } from "vitest";
import type { PlaySession } from "@/lib/admin/types";
import type { RecommendationCandidate } from "./next-case-recommendation";
import { recommendNextCase } from "./next-case-recommendation";

const candidates: RecommendationCandidate[] = [
  { id: "kardiyoloji::stemi", poliklinikKey: "kardiyoloji", poliklinikAd: "Kardiyoloji", poliklinikIcon: "❤️", hastalikAdi: "STEMI", seviye: "orta" },
  { id: "kardiyoloji::aritmi", poliklinikKey: "kardiyoloji", poliklinikAd: "Kardiyoloji", poliklinikIcon: "❤️", hastalikAdi: "Aritmi", seviye: "baslangic" },
  { id: "dermatoloji::egzama", poliklinikKey: "dermatoloji", poliklinikAd: "Dermatoloji", poliklinikIcon: "🩺", hastalikAdi: "Egzama", seviye: "baslangic" },
];

function session(overrides: Partial<PlaySession>): PlaySession {
  return {
    id: "attempt", caseId: "kardiyoloji::stemi", hastalikKey: "stemi", poliklinikKey: "kardiyoloji",
    actor: "ogrenci", mode: "ogrenci", toplamPuan: 50, maxPuan: 100, taniDogru: false,
    atlananRedFlagler: [], gereksizTestler: [], eksikSorular: [], eksikTestler: [], createdAt: 1,
    ...overrides,
  };
}

describe("next case recommendation", () => {
  it("prioritizes a missed safety finding and avoids the most recently attempted case", () => {
    const recommendation = recommendNextCase([
      session({ id: "new", createdAt: 20, atlananRedFlagler: ["Akut koroner sendrom red flagleri"] }),
      session({ id: "old", createdAt: 10, atlananRedFlagler: ["Akut koroner sendrom red flagleri"] }),
    ], candidates);

    expect(recommendation).toMatchObject({
      caseId: "kardiyoloji::aritmi", focus: { kind: "safety", label: "Akut koroner sendrom red flagleri" },
    });
    expect(recommendation?.reason).toContain("2 kez");
  });

  it("uses a recurring weak clinic when there is no missed safety finding", () => {
    const recommendation = recommendNextCase([
      session({ id: "a", createdAt: 20, toplamPuan: 40 }),
      session({ id: "b", createdAt: 10, toplamPuan: 60 }),
    ], candidates);

    expect(recommendation).toMatchObject({ caseId: "kardiyoloji::aritmi", focus: { kind: "clinic", label: "Kardiyoloji" } });
    expect(recommendation?.reason).toContain("%50");
  });

  it("uses a large recurring confidence gap after safety and before clinic performance", () => {
    const recommendation = recommendNextCase([
      session({ id: "a", createdAt: 20, confidenceCalibrationGap: 80 }),
      session({ id: "b", createdAt: 10, confidenceCalibrationGap: 60 }),
    ], candidates);
    expect(recommendation).toMatchObject({ focus: { kind: "calibration", label: "Tanı kalibrasyonu" } });
    expect(recommendation?.reason).toContain("%70");
  });

  it("gives a deterministic beginner-level cold-start recommendation", () => {
    const recommendation = recommendNextCase([], candidates);

    expect(recommendation).toMatchObject({ caseId: "dermatoloji::egzama", focus: { kind: "foundation" } });
  });

  it("returns null without an eligible public case", () => {
    expect(recommendNextCase([session({})], [])).toBeNull();
  });
});
