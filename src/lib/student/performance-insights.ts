import type { PlaySession } from "@/lib/admin/types";

export interface StudentPerformanceInsights {
  overall: {
    completedCaseCount: number;
    averageScorePercentage: number;
    diagnosisAccuracyPercentage: number;
    missedRedFlagCount: number;
    confidenceCalibration: {
      recordedCaseCount: number;
      averageGap: number | null;
    };
  };
  weakClinics: Array<{
    poliklinikKey: string;
    completedCaseCount: number;
    averageScorePercentage: number;
    diagnosisAccuracyPercentage: number;
  }>;
  practicePriorities: Array<{
    kind: "safety" | "calibration" | "clinic";
    label: string;
    occurrenceCount: number;
    guidance: string;
  }>;
}

function percentage(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Öğrencinin tamamladığı vaka oturumlarından açıklanabilir çalışma öncelikleri
 * üretir. Vaka içeriği veya doğru yanıtlar sızdırılmaz; yalnızca öğrencinin
 * kendi tamamlanmış oturumları kullanılır.
 */
export function buildStudentPerformanceInsights(
  sessions: PlaySession[]
): StudentPerformanceInsights {
  const studentSessions = sessions.filter((session) => session.mode === "ogrenci");
  const clinicRows = new Map<
    string,
    { completedCaseCount: number; scoreTotal: number; correctDiagnoses: number }
  >();
  const missedRedFlags = new Map<string, number>();
  let scoreTotal = 0;
  let correctDiagnoses = 0;
  let calibrationTotal = 0;
  let calibrationCount = 0;

  for (const session of studentSessions) {
    const score = session.maxPuan > 0 ? (session.toplamPuan / session.maxPuan) * 100 : 0;
    scoreTotal += score;
    if (session.taniDogru) correctDiagnoses += 1;
    if (typeof session.confidenceCalibrationGap === "number") {
      calibrationTotal += session.confidenceCalibrationGap;
      calibrationCount += 1;
    }

    const clinic = clinicRows.get(session.poliklinikKey) || {
      completedCaseCount: 0,
      scoreTotal: 0,
      correctDiagnoses: 0,
    };
    clinic.completedCaseCount += 1;
    clinic.scoreTotal += score;
    if (session.taniDogru) clinic.correctDiagnoses += 1;
    clinicRows.set(session.poliklinikKey, clinic);

    for (const redFlag of session.atlananRedFlagler || []) {
      missedRedFlags.set(redFlag, (missedRedFlags.get(redFlag) || 0) + 1);
    }
  }

  const weakClinics = Array.from(clinicRows.entries())
    .map(([poliklinikKey, row]) => ({
      poliklinikKey,
      completedCaseCount: row.completedCaseCount,
      averageScorePercentage: percentage(row.scoreTotal, row.completedCaseCount),
      diagnosisAccuracyPercentage: percentage(row.correctDiagnoses * 100, row.completedCaseCount),
    }))
    .filter((clinic) => clinic.completedCaseCount >= 2 && clinic.averageScorePercentage < 70)
    .sort(
      (a, b) =>
        a.averageScorePercentage - b.averageScorePercentage ||
        b.completedCaseCount - a.completedCaseCount ||
        a.poliklinikKey.localeCompare(b.poliklinikKey)
    );

  const averageCalibrationGap = calibrationCount ? percentage(calibrationTotal, calibrationCount) : null;
  const practicePriorities = [
    ...Array.from(missedRedFlags.entries()).map(([label, occurrenceCount]) => ({
      kind: "safety" as const,
      label,
      occurrenceCount,
      guidance: "Bu güvenlik bulgusunu bir sonraki vakada anamnez ve değerlendirme akışına erken ekleyin.",
    })),
    ...weakClinics.map((clinic) => ({
      kind: "clinic" as const,
      label: clinic.poliklinikKey,
      occurrenceCount: clinic.completedCaseCount,
      guidance: "Bu poliklinikte temel yaklaşımı tekrar edin ve yeni bir vaka ile pekiştirin.",
    })),
    ...(calibrationCount >= 2 && averageCalibrationGap !== null && averageCalibrationGap >= 35
      ? [{
          kind: "calibration" as const,
          label: "Tanı kalibrasyonu",
          occurrenceCount: calibrationCount,
          guidance: `Son ${calibrationCount} vakada güveniniz ile sonuç arasındaki ortalama fark %${averageCalibrationGap}. Ayırıcı tanı ve karşıt bulguları birlikte gözden geçirin.`,
        }]
      : []),
  ].sort(
    (a, b) =>
      priorityOrder(a.kind) - priorityOrder(b.kind) ||
      b.occurrenceCount - a.occurrenceCount ||
      a.label.localeCompare(b.label, "tr")
  );

  return {
    overall: {
      completedCaseCount: studentSessions.length,
      averageScorePercentage: percentage(scoreTotal, studentSessions.length),
      diagnosisAccuracyPercentage: percentage(correctDiagnoses * 100, studentSessions.length),
      missedRedFlagCount: Array.from(missedRedFlags.values()).reduce((total, count) => total + count, 0),
      confidenceCalibration: {
        recordedCaseCount: calibrationCount,
        averageGap: averageCalibrationGap,
      },
    },
    weakClinics,
    practicePriorities,
  };
}

function priorityOrder(kind: StudentPerformanceInsights["practicePriorities"][number]["kind"]): number {
  return kind === "safety" ? 0 : kind === "calibration" ? 1 : 2;
}
