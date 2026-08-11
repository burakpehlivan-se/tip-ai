import { describe, expect, it } from "vitest";
import { buildContentQualityQueue } from "./content-quality";
import type { ValidationReport } from "./validate-report";

describe("content quality queue", () => {
  it("prioritizes clinical completeness over recurring editorial warnings", () => {
    const report = {
      results: [
        {
          id: "kardiyoloji::stemi",
          hastalikAdi: "STEMI",
          poliklinikKey: "kardiyoloji",
          errors: [
            {
              code: "MISSING_ANSWER_FOR_QUESTION",
              field: "hastaYanitlari.AĞRI_SURE",
              message: "Beklenen soru için yanıt yok",
            },
          ],
          warnings: [{ code: "EDU_NOTE_WORD_COUNT", field: "management.egitimNotu", message: "Kısa" }],
          status: "invalid" as const,
        },
        {
          id: "solunum::pnomoni",
          hastalikAdi: "Pnömoni",
          poliklinikKey: "solunum",
          errors: [],
          warnings: [
            { code: "MISSING_RESPIRATORY_RATE", field: "vitals.solunum", message: "Eksik" },
            { code: "EDU_NOTE_WORD_COUNT", field: "management.egitimNotu", message: "Kısa" },
          ],
          status: "valid_with_warnings" as const,
        },
      ],
    } as ValidationReport;

    const queue = buildContentQualityQueue(report);

    expect(queue.items[0]).toMatchObject({
      code: "MISSING_ANSWER_FOR_QUESTION",
      priority: "critical",
      affectedCaseCount: 1,
      action: "Her beklenen soru için hasta yanıtını ekleyin.",
    });
    expect(queue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EDU_NOTE_WORD_COUNT",
          affectedCaseCount: 2,
          priority: "medium",
        }),
      ])
    );
    expect(queue.summary).toEqual({ totalItems: 3, criticalItems: 1, affectedCaseCount: 2 });
  });
});
