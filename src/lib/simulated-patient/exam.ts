import type { Vaka } from "@/lib/types";

export interface ExamFinding {
  action: string;
  label: string;
  answer: string;
}

export function isExamAction(action: string): boolean {
  return action.startsWith("VITAL_") || action.startsWith("FIZIK_");
}

/** Muayene bulguları hasta sohbetinden ayrı tutulur. */
export function requestExamFinding(vaka: Vaka, action: string): ExamFinding | null {
  if (!isExamAction(action)) return null;
  const answer = vaka.hastaYanitlari[action]?.trim();
  if (!answer) return null;
  const label = vaka.soruChipleri.find((chip) => chip.aksiyon === action)?.etiket || action;
  return { action, label, answer };
}
