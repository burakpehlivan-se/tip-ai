import { describe, expect, it } from "vitest";
import { degerlendir } from "./degerlendir";
import { Vaka, Rubric } from "../types";

function makeRubric(overrides: Partial<Rubric> = {}): Rubric {
  return {
    beklenenSorular: [
      { key: "AGRI_SURE", etiket: "Ağrı süresi", aciklama: "" },
      { key: "ATES_VAR", etiket: "Ateş var mı?", aciklama: "" },
    ],
    redFlagler: [{ key: "BILINC", etiket: "Bilinç durumu", aciklama: "" }],
    beklenenTestler: [
      { key: "CRP", etiket: "CRP", aciklama: "" },
      { key: "WBC", etiket: "WBC", aciklama: "" },
    ],
    gereksizTestler: [{ key: "BT_BATIN", etiket: "Batın BT", aciklama: "" }],
    kabulEdilenTani: ["Pnömoni"],
    puanlama: {
      dogru_kritik_soru: 10,
      red_flag_atlama: -5,
      dogru_test: 15,
      gereksiz_test: -10,
      tani_dogru: 40,
      tani_yanlis: 0,
    },
    ...overrides,
  };
}

function makeVaka(overrides: Partial<Vaka> = {}): Vaka {
  return {
    id: "vaka-1",
    rubric: makeRubric(),
    idealYol: [],
    egitimNotu: "",
    soruChipleri: [],
    relevantAksiyonlar: [],
    ...overrides,
  } as unknown as Vaka;
}

describe("degerlendir", () => {
  it("tam doğru akışta maksimum puan ve güçlü yönler döner", () => {
    const sonuc = degerlendir(
      makeVaka(),
      ["AGRI_SURE", "ATES_VAR", "BILINC"],
      ["CRP", "WBC"],
      "Pnömoni"
    );
    expect(sonuc.toplamPuan).toBe(sonuc.maxPuan);
    expect(sonuc.dogruSorular).toHaveLength(3);
    expect(sonuc.dogruTestler).toHaveLength(2);
    expect(sonuc.atlananRedFlagler).toHaveLength(0);
    expect(sonuc.gereksizTestler).toHaveLength(0);
  });

  it("hiçbir şey sorulmazsa puan düşer, eksikler ve red flag listelenir", () => {
    const sonuc = degerlendir(makeVaka(), [], [], "Yanlış Tanı");
    expect(sonuc.toplamPuan).toBeLessThan(sonuc.maxPuan);
    expect(sonuc.eksikSorular).toHaveLength(2);
    expect(sonuc.eksikTestler).toHaveLength(2);
    expect(sonuc.atlananRedFlagler).toHaveLength(1);
    expect(sonuc.zayifYonler.length).toBeGreaterThan(0);
  });

  it("gereksiz test istendiğinde ceza uygulanır", () => {
    const sonuc = degerlendir(
      makeVaka(),
      ["AGRI_SURE", "ATES_VAR", "BILINC"],
      ["CRP", "WBC", "BT_BATIN"],
      "Pnömoni"
    );
    expect(sonuc.gereksizTestler).toContain("Batın BT");
    expect(sonuc.toplamPuan).toBeLessThan(sonuc.maxPuan);
  });

  it("kısmi doğrulukta puan maxPuan'ı aşmaz (negatif değil)", () => {
    const sonuc = degerlendir(makeVaka(), ["ATES_VAR"], ["WBC"], "Pnömoni");
    expect(sonuc.toplamPuan).toBeGreaterThanOrEqual(0);
    expect(sonuc.toplamPuan).toBeLessThanOrEqual(sonuc.maxPuan);
  });

  it("tanı büyük/küçük harf duyarsız eşleşir", () => {
    const sonuc = degerlendir(
      makeVaka(),
      ["AGRI_SURE", "ATES_VAR", "BILINC"],
      ["CRP", "WBC"],
      "pnÖmOnİ"
    );
    expect(sonuc.toplamPuan).toBe(sonuc.maxPuan);
  });
});
