import { describe, expect, it } from "vitest";
import type { PlaySession } from "@/lib/admin/types";
import { buildStudentPerformanceInsights } from "./performance-insights";

function session(overrides: Partial<PlaySession>): PlaySession {
  return {
    id: "session",
    caseId: "kardiyoloji::stemi",
    hastalikKey: "stemi",
    poliklinikKey: "kardiyoloji",
    actor: "ogrenci",
    mode: "ogrenci",
    toplamPuan: 50,
    maxPuan: 100,
    taniDogru: false,
    atlananRedFlagler: [],
    gereksizTestler: [],
    eksikSorular: [],
    eksikTestler: [],
    createdAt: 1,
    ...overrides,
  };
}

describe("student performance insights", () => {
  it("prioritizes recurring weak clinics and missed safety questions", () => {
    const insights = buildStudentPerformanceInsights([
      session({ id: "1", toplamPuan: 40, atlananRedFlagler: ["Akut koroner sendrom red flagleri"] }),
      session({ id: "2", toplamPuan: 50, atlananRedFlagler: ["Akut koroner sendrom red flagleri"] }),
      session({
        id: "3",
        caseId: "dermatoloji::egzama",
        hastalikKey: "egzama",
        poliklinikKey: "dermatoloji",
        toplamPuan: 90,
        taniDogru: true,
      }),
    ]);

    expect(insights.overall).toEqual({
      completedCaseCount: 3,
      averageScorePercentage: 60,
      diagnosisAccuracyPercentage: 33,
      missedRedFlagCount: 2,
    });
    expect(insights.practicePriorities[0]).toMatchObject({
      kind: "safety",
      label: "Akut koroner sendrom red flagleri",
      occurrenceCount: 2,
    });
    expect(insights.weakClinics).toEqual([
      expect.objectContaining({
        poliklinikKey: "kardiyoloji",
        completedCaseCount: 2,
        averageScorePercentage: 45,
      }),
    ]);
  });
});
