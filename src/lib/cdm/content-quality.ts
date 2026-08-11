import type { ValidationIssue, ValidationReport } from "./validate-report";

export type ContentQualityPriority = "critical" | "high" | "medium" | "low";

export interface ContentQualityWorkItem {
  code: string;
  priority: ContentQualityPriority;
  action: string;
  affectedCaseCount: number;
  cases: Array<{ id: string; hastalikAdi?: string; poliklinikKey?: string }>;
}

export interface ContentQualityQueue {
  summary: {
    totalItems: number;
    criticalItems: number;
    affectedCaseCount: number;
  };
  items: ContentQualityWorkItem[];
}

const PRIORITY_RANK: Record<ContentQualityPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const IMPROVEMENT_RULES: Record<string, Omit<ContentQualityWorkItem, "code" | "affectedCaseCount" | "cases">> = {
  MISSING_ANSWER_FOR_QUESTION: {
    priority: "critical",
    action: "Her beklenen soru için hasta yanıtını ekleyin.",
  },
  NO_LABS: {
    priority: "critical",
    action: "Beklenen testleri karşılayan laboratuvar sonuçlarını ekleyin.",
  },
  MISSING_LAB_FOR_EXPECTED_TEST: {
    priority: "critical",
    action: "Her beklenen test için kullanılabilir bir laboratuvar sonucu ekleyin.",
  },
  NO_VITALS: {
    priority: "critical",
    action: "Öğrencinin değerlendirebilmesi için temel vital bulguları ekleyin.",
  },
  CONFLICTING_TEST_RULE: {
    priority: "critical",
    action: "Bir testi aynı anda beklenen ve gereksiz olarak tanımlamayın.",
  },
  MISSING_RESPIRATORY_RATE: {
    priority: "high",
    action: "Vital bulgulara solunum sayısını ekleyin.",
  },
  NO_TREATMENT_PLAN: {
    priority: "high",
    action: "Öğrenme hedefiyle uyumlu, gözden geçirilmiş bir tedavi planı ekleyin.",
  },
  NO_PATIENT_PROFILE: {
    priority: "medium",
    action: "Hasta profiline BMI, sigara öyküsü ve komorbiditeleri ekleyin.",
  },
  EDU_NOTE_WORD_COUNT: {
    priority: "medium",
    action: "Eğitim notunu klinik gerekçe ve güvenlik noktalarıyla hedef uzunluğa getirin.",
  },
  SHORT_IDEAL_PATH: {
    priority: "medium",
    action: "İdeal klinik yolu değerlendirme, ayırıcı tanı ve takip adımlarıyla tamamlayın.",
  },
  LIMITED_QUESTION_COVERAGE: {
    priority: "medium",
    action: "Öykü sorularını daha fazla klinik kategoriye yayarak kapsamı artırın.",
  },
  NO_RED_FLAGS: {
    priority: "medium",
    action: "Vaka için ayırt edici acil red flagleri tanımlayın.",
  },
  DIAGNOSIS_CONTRADICTION: {
    priority: "high",
    action: "Tanı, laboratuvar sonucu ve referans aralığı arasındaki klinik tutarlılığı gözden geçirin.",
  },
};

function fallbackRule(issue: ValidationIssue, isError: boolean) {
  return {
    priority: isError ? "critical" : "low" as ContentQualityPriority,
    action: issue.message,
  };
}

/**
 * Doğrulama çıktısını editörün uygulayabileceği, vaka verisine yan etkisi olmayan
 * bir iş kuyruğuna çevirir. Klinik hatalar içerik tercihleri üzerinde önceliklidir.
 */
export function buildContentQualityQueue(report: Pick<ValidationReport, "results">): ContentQualityQueue {
  const grouped = new Map<
    string,
    ContentQualityWorkItem & { caseIds: Set<string> }
  >();

  for (const result of report.results) {
    const collect = (issue: ValidationIssue, isError: boolean) => {
      const rule = IMPROVEMENT_RULES[issue.code] || fallbackRule(issue, isError);
      const existing = grouped.get(issue.code);
      if (existing) {
        if (!existing.caseIds.has(result.id)) {
          existing.caseIds.add(result.id);
          existing.cases.push({
            id: result.id,
            hastalikAdi: result.hastalikAdi,
            poliklinikKey: result.poliklinikKey,
          });
        }
        return;
      }
      grouped.set(issue.code, {
        code: issue.code,
        priority: rule.priority,
        action: rule.action,
        affectedCaseCount: 1,
        cases: [
          {
            id: result.id,
            hastalikAdi: result.hastalikAdi,
            poliklinikKey: result.poliklinikKey,
          },
        ],
        caseIds: new Set([result.id]),
      });
    };

    result.errors.forEach((issue) => collect(issue, true));
    result.warnings.forEach((issue) => collect(issue, false));
  }

  const items = Array.from(grouped.values())
    .map(({ caseIds, ...item }) => ({ ...item, affectedCaseCount: caseIds.size }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.affectedCaseCount - a.affectedCaseCount ||
        a.code.localeCompare(b.code)
    );

  return {
    summary: {
      totalItems: items.length,
      criticalItems: items.filter((item) => item.priority === "critical").length,
      affectedCaseCount: new Set(items.flatMap((item) => item.cases.map((entry) => entry.id))).size,
    },
    items,
  };
}
