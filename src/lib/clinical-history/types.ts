export type ClinicalHistoryEventKind =
  | "Tanı"
  | "İlaç"
  | "İşlem"
  | "Başvuru"
  | "Tanısal rapor"
  | "Bakım planı";

export interface ClinicalHistoryEvent {
  date: string | null;
  kind: ClinicalHistoryEventKind;
  title: string;
  detail?: string;
  /** Kaynak kod (SNOMED/LOINC/RxNorm) — izlenebilirlik rozeti. */
  code?: string;
  /** Kod sistemi kısa etiketi (SNOMED/LOINC/RxNorm). */
  codeSystem?: string;
}

export interface ClinicalHistoryItem {
  date: string | null;
  title: string;
  detail?: string;
  code?: string;
  codeSystem?: string;
}

export interface ClinicalHistoryLabTrend {
  title: string;
  unit: string | null;
  code?: string;
  codeSystem?: string;
  values: Array<{ date: string | null; value: string }>;
}

/** İstemciye yalnızca kimliksiz klinik projeksiyon gönderilir. */
export interface ClinicalHistory {
  timeline: ClinicalHistoryEvent[];
  allergies: ClinicalHistoryItem[];
  immunizations: ClinicalHistoryItem[];
  labTrends: ClinicalHistoryLabTrend[];
}

export function clinicalHistoryChatSummary(history: ClinicalHistory): string {
  const parts: string[] = [];
  if (history.timeline.length) parts.push(`${history.timeline.length} geçmiş klinik olay`);
  if (history.allergies.length) parts.push(`${history.allergies.length} alerji kaydı`);
  if (history.immunizations.length) parts.push(`${history.immunizations.length} aşı kaydı`);
  if (history.labTrends.length) parts.push(`${history.labTrends.length} laboratuvar eğilimi`);
  return parts.length
    ? `Klinik geçmiş istendi ve sohbet bağlamına eklendi: ${parts.join(", ")}. Ayrıntılar “Klinik geçmiş” penceresinde görüntülenebilir.`
    : "Klinik geçmiş istendi; bu vaka için gösterilebilir ek kayıt bulunamadı.";
}
