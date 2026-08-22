import { describe, expect, it, vi } from "vitest";
import type { DeepseekSonuc } from "../../ai/deepseek";

const deepseekMock = vi.fn<[], Promise<DeepseekSonuc>>();

vi.mock("../../ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../ai/deepseek")>();
  return {
    ...actual,
    deepseekYapilandirilmisMi: () => true,
    deepseekChat: () => deepseekMock(),
  };
});

import { enrichSyntheaCase } from "./enrich";
import { etlSyntheaPatientToCdm } from "./pipeline";
import { pneumoniaBundle } from "./fixtures";

function aiYaniti(hastaYanitlari: Record<string, string>): DeepseekSonuc {
  return {
    content: JSON.stringify({
      anaSikayet: "Üç gün önce başlayan öksürük ve ateş şikayetim var.",
      ozetBilgiler: ["Öksürük 3 gündür", "Ateş 38.5 dereceye çıktı", "Balgam sarı-yeşil"],
      hastaYanitlari,
    }),
    finishReason: "stop",
  };
}

describe("enrich eksik anahtar uyarısı", () => {
  it("AI tüm beklenen cevapları verirse temiz üretir", async () => {
    const etl = etlSyntheaPatientToCdm(pneumoniaBundle());
    expect(etl).not.toBeNull();
    const vaka = etl!.vaka;
    const tumAnahtarlar = Object.fromEntries(
      (vaka.rubric?.beklenenSorular || []).map((s) => [s.key, "Cevap örneği."])
    );
    deepseekMock.mockResolvedValue(aiYaniti(tumAnahtarlar));

    const sonuc = await enrichSyntheaCase(vaka);
    expect(sonuc.basarili).toBe(true);
    expect(sonuc.rapor.uyarilar).toHaveLength(0);
  });

  it("AI bir cevap anahtarını atlayorsa uyarı basar ve placeholder'ı ezmez", async () => {
    const etl = etlSyntheaPatientToCdm(pneumoniaBundle());
    expect(etl).not.toBeNull();
    const vaka = etl!.vaka;
    const beklenenKeys = (vaka.rubric?.beklenenSorular || []).map((s) => s.key);
    expect(beklenenKeys.length).toBeGreaterThan(1);
    const atlanan = beklenenKeys[0];
    const kismi = Object.fromEntries(
      beklenenKeys.slice(1).map((k) => [k, "Cevap örneği."])
    );
    deepseekMock.mockResolvedValue(aiYaniti(kismi));

    const sonuc = await enrichSyntheaCase(vaka);
    expect(sonuc.basarili).toBe(false);
    expect(
      sonuc.rapor.uyarilar.some((u) =>
        u.includes(`hastaYanitlari eksik anahtarlar: ${atlanan}`)
      )
    ).toBe(true);
    // Verilen anahtarlar yine de uygulanmış olmalı (kısmi iyileştirme korunur).
    expect(sonuc.vaka.hastaYanitlari[beklenenKeys[1]]).toBe("Cevap örneği.");
    // Atanan anahtardaki pipeline placeholder'ı olduğu gibi kalır (ezilmedi).
    expect(sonuc.vaka.hastaYanitlari[atlanan]).toContain("(Synthea iskeleti");
  });
});
