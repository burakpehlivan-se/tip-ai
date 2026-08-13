import type { DegerlendirmeSonuc } from "@/lib/types";

const MAX_PROBLEM_REPRESENTATION_LENGTH = 600;
const MAX_FINDING_LENGTH = 180;
const MAX_DIFFERENTIAL_LENGTH = 120;
const MAX_LIST_ITEMS = 5;

export interface ClinicalReasoningInput {
  problemRepresentation: string;
  differentials: string[];
  supportingFindings: string[];
  opposingFindings: string[];
  confidence: number | null;
}

export interface ClinicalReasoningFeedback {
  recorded: boolean;
  differentialCount: number;
  confidence: number | null;
  calibrationGap: number | null;
  calibrationLabel: "iyi-kalibre" | "asiri-guvenli" | "temkinli" | null;
}

export class ClinicalReasoningValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalReasoningValidationError";
  }
}

function normalizeText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new ClinicalReasoningValidationError(`${label} metin olmalıdır.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw new ClinicalReasoningValidationError(`${label} en fazla ${maxLength} karakter olabilir.`);
  }
  return normalized;
}

function normalizeList(value: unknown, label: string, maxLength: number): string[] {
  if (!Array.isArray(value)) throw new ClinicalReasoningValidationError(`${label} bir liste olmalıdır.`);
  if (value.length > MAX_LIST_ITEMS) {
    throw new ClinicalReasoningValidationError(`${label} en fazla ${MAX_LIST_ITEMS} madde içerebilir.`);
  }
  const seen = new Set<string>();
  return value.reduce<string[]>((items, entry) => {
    const text = normalizeText(entry, label, maxLength);
    const key = text.toLocaleLowerCase("tr");
    if (text && !seen.has(key)) {
      seen.add(key);
      items.push(text);
    }
    return items;
  }, []);
}

/**
 * API sınırında kabul edilen klinik muhakeme gövdesini daraltır. `undefined`
 * eski istemciler için yok sayılır; kısmi ama geçerli taslaklar kaydedilebilir.
 */
export function normalizeClinicalReasoning(value: unknown): ClinicalReasoningInput | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ClinicalReasoningValidationError("Klinik muhakeme bilgisi geçersiz.");
  }
  const input = value as Record<string, unknown>;
  const rawConfidence = input.confidence;
  let confidence: number | null = null;
  if (rawConfidence !== null && rawConfidence !== undefined) {
    if (typeof rawConfidence !== "number" || !Number.isInteger(rawConfidence) || rawConfidence < 0 || rawConfidence > 100) {
      throw new ClinicalReasoningValidationError("Güven düzeyi 0 ile 100 arasında tam sayı olmalıdır.");
    }
    confidence = rawConfidence;
  }
  return {
    problemRepresentation: normalizeText(input.problemRepresentation ?? "", "Problem temsili", MAX_PROBLEM_REPRESENTATION_LENGTH),
    differentials: normalizeList(input.differentials ?? [], "Ayırıcı tanı", MAX_DIFFERENTIAL_LENGTH),
    supportingFindings: normalizeList(input.supportingFindings ?? [], "Destekleyen bulgular", MAX_FINDING_LENGTH),
    opposingFindings: normalizeList(input.opposingFindings ?? [], "Karşı çıkan bulgular", MAX_FINDING_LENGTH),
    confidence,
  };
}

export function isClinicalReasoningRecorded(reasoning: ClinicalReasoningInput | null | undefined): boolean {
  return Boolean(
    reasoning &&
      (reasoning.problemRepresentation || reasoning.differentials.length || reasoning.supportingFindings.length || reasoning.opposingFindings.length || reasoning.confidence !== null)
  );
}

export function clinicalReasoningFeedback(
  reasoning: ClinicalReasoningInput | null | undefined,
  diagnosisCorrect: boolean
): ClinicalReasoningFeedback {
  const recorded = isClinicalReasoningRecorded(reasoning);
  const confidence = reasoning?.confidence ?? null;
  const calibrationGap = confidence === null ? null : Math.abs(confidence - (diagnosisCorrect ? 100 : 0));
  const calibrationLabel = calibrationGap === null
    ? null
    : calibrationGap <= 20
      ? "iyi-kalibre"
      : diagnosisCorrect
        ? "temkinli"
        : "asiri-guvenli";
  return {
    recorded,
    differentialCount: reasoning?.differentials.length ?? 0,
    confidence,
    calibrationGap,
    calibrationLabel,
  };
}

export function withClinicalReasoningFeedback(
  sonuc: DegerlendirmeSonuc,
  reasoning: ClinicalReasoningInput | null | undefined
): DegerlendirmeSonuc {
  if (!isClinicalReasoningRecorded(reasoning)) return sonuc;
  return {
    ...sonuc,
    clinicalReasoning: {
      input: reasoning!,
      feedback: clinicalReasoningFeedback(reasoning, sonuc.taniDogru),
    },
  };
}
