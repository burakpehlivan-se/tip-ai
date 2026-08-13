import { describe, expect, it } from "vitest";
import type { DegerlendirmeSonuc } from "@/lib/types";
import { buildFeedbackPriorities } from "./feedback-priorities";

function result(overrides: Partial<DegerlendirmeSonuc> = {}): DegerlendirmeSonuc {
  return {
    toplamPuan: 50,
    maxPuan: 100,
    dogruSorular: [], eksikSorular: [], dogruTestler: [], eksikTestler: [], gereksizTestler: [], atlananRedFlagler: [],
    taniDogru: true, taniGirildi: "tanı", gucluYonler: [], zayifYonler: [], idealYol: [], egitimNotu: "",
    anamnezAnalizi: { kategoriBazinda: [], toplamSoruldu: 0, toplamBeklenen: 0, tumKategorilerSoruldu: true, enCokEksikKategori: null, enIyiKategori: null },
    ...overrides,
  };
}

describe("feedback priorities", () => {
  it("red flagleri diğer geri bildirimlerden önce sıralar ve üç maddede sınırlar", () => {
    const priorities = buildFeedbackPriorities(result({
      atlananRedFlagler: ["Senkop", "İstirahatte ağrı"],
      taniDogru: false,
      eksikTestler: ["EKG"],
    }));
    expect(priorities).toHaveLength(3);
    expect(priorities.map((item) => item.id)).toEqual(["red-flag", "red-flag", "diagnosis"]);
  });

  it("güvenlik eksikliği yoksa test ve anamnez adımını öne alır", () => {
    const priorities = buildFeedbackPriorities(result({
      eksikTestler: ["Troponin"],
      anamnezAnalizi: { kategoriBazinda: [], toplamSoruldu: 1, toplamBeklenen: 4, tumKategorilerSoruldu: false, enCokEksikKategori: "Vital bulgular", enIyiKategori: null },
    }));
    expect(priorities.map((item) => item.id)).toEqual(["test", "anamnesis"]);
  });
});
