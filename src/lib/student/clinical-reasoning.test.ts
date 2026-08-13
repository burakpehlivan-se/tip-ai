import { describe, expect, it } from "vitest";
import {
  ClinicalReasoningValidationError,
  clinicalReasoningFeedback,
  normalizeClinicalReasoning,
} from "./clinical-reasoning";

describe("clinical reasoning validation", () => {
  it("kısıtlı, yinelenmeyen bir muhakeme taslağını normalize eder", () => {
    expect(normalizeClinicalReasoning({
      problemRepresentation: "  Yeni başlayan  göğüs ağrısı ",
      differentials: ["Akut koroner sendrom", "akut koroner sendrom", "Pulmoner emboli"],
      supportingFindings: ["Eforla artış"],
      opposingFindings: [],
      confidence: 80,
    })).toEqual({
      problemRepresentation: "Yeni başlayan göğüs ağrısı",
      differentials: ["Akut koroner sendrom", "Pulmoner emboli"],
      supportingFindings: ["Eforla artış"],
      opposingFindings: [],
      confidence: 80,
    });
  });

  it("geçersiz güven düzeyini ve aşırı uzun listeleri reddeder", () => {
    expect(() => normalizeClinicalReasoning({ problemRepresentation: "", differentials: [], supportingFindings: [], opposingFindings: [], confidence: 101 })).toThrow(ClinicalReasoningValidationError);
    expect(() => normalizeClinicalReasoning({ problemRepresentation: "", differentials: ["1", "2", "3", "4", "5", "6"], supportingFindings: [], opposingFindings: [], confidence: null })).toThrow(ClinicalReasoningValidationError);
  });

  it("tanı sonucuna göre güven kalibrasyonunu açıklar", () => {
    expect(clinicalReasoningFeedback({ problemRepresentation: "", differentials: ["Tanı"], supportingFindings: [], opposingFindings: [], confidence: 80 }, true)).toMatchObject({ calibrationGap: 20, calibrationLabel: "iyi-kalibre" });
    expect(clinicalReasoningFeedback({ problemRepresentation: "", differentials: ["Tanı"], supportingFindings: [], opposingFindings: [], confidence: 80 }, false)).toMatchObject({ calibrationGap: 80, calibrationLabel: "asiri-guvenli" });
  });
});
