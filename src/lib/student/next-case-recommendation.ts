import type { PlaySession } from "@/lib/admin/types";
import type { Seviye } from "@/lib/types";

export interface RecommendationCandidate {
  id: string;
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  hastalikAdi: string;
  seviye: Seviye;
}

export interface NextCaseRecommendation {
  caseId: string;
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  hastalikAdi: string;
  seviye: Seviye;
  reason: string;
  focus: {
    kind: "safety" | "clinic" | "foundation";
    label: string;
  };
}

const RECENT_ATTEMPT_LIMIT = 8;
const levelOrder: Record<Seviye, number> = {
  baslangic: 0,
  orta: 1,
  ileri: 2,
};

function scorePercentage(session: PlaySession): number {
  return session.maxPuan > 0 ? (session.toplamPuan / session.maxPuan) * 100 : 0;
}

function sortCandidates(candidates: RecommendationCandidate[], attemptedCaseIds: Set<string>) {
  return [...candidates].sort(
    (a, b) =>
      Number(attemptedCaseIds.has(a.id)) - Number(attemptedCaseIds.has(b.id)) ||
      levelOrder[a.seviye] - levelOrder[b.seviye] ||
      a.poliklinikKey.localeCompare(b.poliklinikKey, "tr") ||
      a.id.localeCompare(b.id)
  );
}

function toRecommendation(
  candidate: RecommendationCandidate,
  reason: string,
  focus: NextCaseRecommendation["focus"]
): NextCaseRecommendation {
  return {
    caseId: candidate.id,
    poliklinikKey: candidate.poliklinikKey,
    poliklinikAd: candidate.poliklinikAd,
    poliklinikIcon: candidate.poliklinikIcon,
    hastalikAdi: candidate.hastalikAdi,
    seviye: candidate.seviye,
    reason,
    focus,
  };
}

/**
 * Öğrencinin kendi tamamlanmış oturumlarına göre açıklanabilir, deterministik
 * bir sonraki vaka önerisi üretir. Bu ilk sürüm kural tabanlıdır: güvenlik
 * eksikleri, tekrarlayan düşük performans ve başlangıç seviyesi sırasıyla
 * önceliklendirilir. Öneri bağlayıcı değildir; öğrenci başka bir vaka seçebilir.
 */
export function recommendNextCase(
  sessions: PlaySession[],
  candidates: RecommendationCandidate[]
): NextCaseRecommendation | null {
  if (candidates.length === 0) return null;

  const recentSessions = sessions
    .filter((session) => session.mode === "ogrenci")
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
    .slice(0, RECENT_ATTEMPT_LIMIT);
  const attemptedCaseIds = new Set(recentSessions.map((session) => session.caseId));

  const choose = (pool: RecommendationCandidate[]) => sortCandidates(pool, attemptedCaseIds)[0] || null;

  const safetyCounts = new Map<string, { count: number; latestAt: number; clinic: string }>();
  for (const session of recentSessions) {
    for (const redFlag of session.atlananRedFlagler || []) {
      const previous = safetyCounts.get(redFlag);
      safetyCounts.set(redFlag, {
        count: (previous?.count || 0) + 1,
        latestAt: Math.max(previous?.latestAt || 0, session.createdAt),
        clinic: previous?.clinic || session.poliklinikKey,
      });
    }
  }
  const topSafety = Array.from(safetyCounts.entries()).sort(
    ([labelA, a], [labelB, b]) => b.count - a.count || b.latestAt - a.latestAt || labelA.localeCompare(labelB, "tr")
  )[0];
  if (topSafety) {
    const [label, safety] = topSafety;
    const candidate = choose(candidates.filter((item) => item.poliklinikKey === safety.clinic)) || choose(candidates);
    if (candidate) {
      return toRecommendation(
        candidate,
        `Güvenlik odağı: “${label}” bulgusunu son denemelerinizde ${safety.count} kez atladınız.`,
        { kind: "safety", label }
      );
    }
  }

  const clinicPerformance = new Map<string, { count: number; scoreTotal: number }>();
  for (const session of recentSessions) {
    const row = clinicPerformance.get(session.poliklinikKey) || { count: 0, scoreTotal: 0 };
    row.count += 1;
    row.scoreTotal += scorePercentage(session);
    clinicPerformance.set(session.poliklinikKey, row);
  }
  const weakClinic = Array.from(clinicPerformance.entries())
    .map(([clinic, row]) => ({ clinic, count: row.count, average: Math.round(row.scoreTotal / row.count) }))
    .filter((row) => row.count >= 2 && row.average < 70)
    .sort((a, b) => a.average - b.average || b.count - a.count || a.clinic.localeCompare(b.clinic, "tr"))[0];
  if (weakClinic) {
    const candidate = choose(candidates.filter((item) => item.poliklinikKey === weakClinic.clinic)) || choose(candidates);
    if (candidate) {
      return toRecommendation(
        candidate,
        `${candidate.poliklinikAd} alanında son ${weakClinic.count} denemenizde ortalama puanınız %${weakClinic.average}; temel yaklaşımı pekiştirebilirsiniz.`,
        { kind: "clinic", label: candidate.poliklinikAd }
      );
    }
  }

  const candidate = choose(candidates.filter((item) => item.seviye === "baslangic")) || choose(candidates);
  if (!candidate) return null;
  return toRecommendation(
    candidate,
    recentSessions.length === 0
      ? "Başlangıç için temel düzeyde bir vaka seçildi."
      : "Farklı bir klinik bağlamla temel yaklaşımı tazelemeniz için seçildi.",
    { kind: "foundation", label: candidate.poliklinikAd }
  );
}
