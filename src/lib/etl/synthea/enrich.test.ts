import { describe, expect, it } from "vitest";
import { enrichSyntheaCase, syntheaProfilOlustur } from "./enrich";
import { etlSyntheaPatientToCdm } from "./pipeline";
import { pneumoniaBundle } from "./fixtures";

describe("Synthea AI zenginleştirme", () => {
  it("objektif veriden Türkçe profil üretir", () => {
    const result = etlSyntheaPatientToCdm(pneumoniaBundle());
    expect(result).not.toBeNull();
    const profil = syntheaProfilOlustur(result!.vaka);
    expect(profil).toContain("Pnömoni");
    expect(profil).toContain("Kadın");
    expect(profil).toContain("CRP");
  });

  it("GEMINI_API_KEY yoksa vakayı değiştirmeden döner", async () => {
    const result = etlSyntheaPatientToCdm(pneumoniaBundle());
    expect(result).not.toBeNull();
    const onceki = JSON.stringify(result!.vaka);

    const enrich = await enrichSyntheaCase(result!.vaka);
    expect(enrich.basarili).toBe(false);
    expect(enrich.vaka).toEqual(result!.vaka);
    expect(JSON.stringify(enrich.vaka)).toBe(onceki);
    expect(enrich.rapor.uyarilar).toContain("GEMINI_API_KEY tanımlı değil.");
  });
});
