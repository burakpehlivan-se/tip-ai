import { describe, expect, it } from "vitest";
import { vakaChipleriniUret } from "./vaka-chip-uretici";
import { CHIP_HAVUZU } from "./chip-havuzu";

describe("vakaChipleriniUret", () => {
  it("yanıtı olan TR aksiyonlar için havuz chip'ini döndürür", () => {
    const chips = vakaChipleriniUret({ NEFES_DARLIGI: "Evet, var." });
    const nefes = chips.find((c) => c.aksiyon === "NEFES_DARLIGI");
    expect(nefes).toBeDefined();
    expect(nefes!.etiket).toBe("Nefes darlığın var mı?");
  });

  it("EN uzun kodları Türkçe sentetik chip'e çevirir", () => {
    const chips = vakaChipleriniUret({
      CHIEF_COMPLAINT: "Burnum akıyor.",
      MEDICATIONS: "Alerji hapı.",
    });
    const sikayet = chips.find((c) => c.aksiyon === "CHIEF_COMPLAINT");
    expect(sikayet?.kategori).toBe("anamnez-sistemik");
    expect(sikayet?.etiket).toContain("Şikayetinizi");
    const ilac = chips.find((c) => c.aksiyon === "MEDICATIONS");
    expect(ilac?.kategori).toBe("soygecmis");
  });

  it("VITAL_* ve OZEL anahtarlarını chip yapmaz", () => {
    const chips = vakaChipleriniUret({
      VITAL_ATES: "36.5",
      VITAL_NABIZ: "80",
      OZEL: "Anlamadım",
      SIGARA: "Yok",
    });
    expect(chips.some((c) => c.aksiyon.startsWith("VITAL_"))).toBe(false);
    expect(chips.some((c) => c.aksiyon === "OZEL")).toBe(false);
    expect(chips.map((c) => c.aksiyon)).toEqual(["SIGARA"]);
  });

  it("rubrik ekstra aksiyonlarını yanıtsız da dahil eder (varsayılan negatif için)", () => {
    const chips = vakaChipleriniUret(
      { CHIEF_COMPLAINT: "Öksürük." },
      ["OKSURUK", "HT_OYKUSU"]
    );
    // OKSURUK havuzda vardır ve rubrik istediği için gelir
    expect(chips.some((c) => c.aksiyon === "OKSURUK")).toBe(true);
    // HT_OYKUSU havuzda yoksa ve EN sözlükte değilse gelmez (sessiz atlanır)
    const htIndex = CHIP_HAVUZU.findIndex((c) => c.aksiyon === "HT_OYKUSU");
    if (htIndex < 0) {
      expect(chips.some((c) => c.aksiyon === "HT_OYKUSU")).toBe(false);
    }
  });

  it("aynı aksiyonu iki kez eklemez", () => {
    const chips = vakaChipleriniUret({ SIGARA: "Yok" }, ["SIGARA"]);
    expect(chips.filter((c) => c.aksiyon === "SIGARA").length).toBe(1);
  });

  it("boş yanıtla çalışma alanını boş bırakmayan temel chipleri döner", () => {
    for (const chips of [vakaChipleriniUret({}, []), vakaChipleriniUret(undefined, [])]) {
      expect(chips.map((chip) => chip.aksiyon)).toEqual([
        "SIKAYET", "SIKAYET_SURE", "ALERJI", "ILAC", "SIGARA", "DIYABET",
      ]);
    }
  });
});
