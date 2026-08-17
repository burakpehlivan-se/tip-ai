import { describe, expect, it, vi } from "vitest";
import { pneumoniaBundle } from "./fixtures";

vi.mock("../../ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../ai/deepseek")>();
  return {
    ...actual,
    deepseekYapilandirilmisMi: () => true,
    deepseekChat: async () => ({
      content: JSON.stringify({
        anaSikayet: "Cough with fever for three days",
        ozetBilgiler: [
          "Productive cough for three days",
          "Fever up to 38.4 C",
          "Feeling short of breath",
          "No known sick contacts",
        ],
        hastaYanitlari: {
          COUGH: "I have been coughing with yellow sputum for three days.",
          FEVER: "I had a fever of 38.4 yesterday.",
          DYSPNEA: "I get short of breath walking upstairs.",
          SMOKING: "I quit smoking five years ago.",
          IMMUNOSUPPRESSION: "No immune problems that I know of.",
        },
      }),
      reasoningContent: "",
    }),
  };
});

import { enrichSyntheaCase } from "./enrich";
import { etlSyntheaPatientToCdm } from "./pipeline";

describe("Synthea AI zenginleştirme (mocked DeepSeek)", () => {
  it("AI yanıtını presentation + hastaYanitlari'na birleştirir, vitalleri korur", async () => {
    const result = etlSyntheaPatientToCdm(pneumoniaBundle());
    expect(result).not.toBeNull();
    const enrich = await enrichSyntheaCase(result!.vaka);

    expect(enrich.basarili).toBe(true);
    expect(enrich.vaka.presentation.anaSikayet).toBe("Cough with fever for three days");
    expect(enrich.vaka.presentation.ozetBilgiler).toHaveLength(4);
    expect(enrich.vaka.hastaYanitlari.COUGH).toContain("yellow sputum");
    // Vitaller AI ile ezilmemeli
    expect(enrich.vaka.hastaYanitlari.VITAL_NABIZ).toBe(String(result!.vaka.vitals?.nabiz));
    expect(enrich.vaka.hastaYanitlari.VITAL_TANSIYON).toBe(result!.vaka.vitals?.tansiyon);
  });
});
