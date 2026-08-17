import { describe, expect, it } from "vitest";
import { hastaDilineCevir, yuksekTibbiTerimVarMi } from "./hasta-dili";

describe("hasta dili", () => {
  it("teknik terimleri gündelik Türkçeye çevirir", () => {
    const yanit = hastaDilineCevir("Hipertansiyon ve dispne yüzünden miyokard enfarktüsü geçirdim.");
    expect(yanit).toContain("yüksek tansiyon");
    expect(yanit).toContain("nefes darlığı");
    expect(yanit).toContain("kalp krizi");
    expect(yuksekTibbiTerimVarMi(yanit)).toBe(false);
  });
});
