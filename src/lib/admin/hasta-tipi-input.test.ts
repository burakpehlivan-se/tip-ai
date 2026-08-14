import { describe, expect, it } from "vitest";
import { hastaTipiSlug, parseHastaTipiInput } from "./hasta-tipi-input";

describe("hasta tipi input", () => {
  it("ad'dan Türkçe karakterleri katlanmış ASCII slug üretir", () => {
    expect(hastaTipiSlug("Diyabetik Kadın")).toBe("diyabetik-kadin");
    expect(hastaTipiSlug("Şeker Hastası (Tip 2)")).toBe("seker-hastasi-tip-2");
    expect(hastaTipiSlug("KOAH + Sigara İçen")).toBe("koah-sigara-icen");
  });

  it("ad zorunlu ise eksik ad'ı reddeder", () => {
    expect(parseHastaTipiInput({}, { requireAd: true })).toEqual({
      ok: false,
      issues: [{ field: "ad", message: "Tip adı zorunlu." }],
    });
  });

  it("geçerli alanları tip olarak döndürür", () => {
    expect(
      parseHastaTipiInput(
        {
          ad: "Diyabetik Kadın",
          aciklama: "T2DM + HT",
          yasAraligi: [45, 65],
          cinsiyetTercih: "K",
          komorbiditeler: ["T2DM", "HTN"],
          kisilikTipi: "endiseli",
          ornekCevaplar: { ILAC_OYKUSU: "Metformin kullanıyorum." },
        },
        { requireAd: true }
      )
    ).toEqual({
      ok: true,
      value: {
        ad: "Diyabetik Kadın",
        aciklama: "T2DM + HT",
        yasAraligi: [45, 65],
        cinsiyetTercih: "K",
        komorbiditeler: ["T2DM", "HTN"],
        kisilikTipi: "endiseli",
        ornekCevaplar: { ILAC_OYKUSU: "Metformin kullanıyorum." },
      },
    });
  });

  it("geçersiz cinsiyet ve kişilik tipini reddeder", () => {
    const res = parseHastaTipiInput({ cinsiyetTercih: "X", kisilikTipi: "uzayli" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.map((i) => i.field)).toEqual(["cinsiyetTercih", "kisilikTipi"]);
    }
  });
});
