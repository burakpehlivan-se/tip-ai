import type { DegerlendirmeSonuc } from "@/lib/types";

export interface FeedbackPriority {
  id: "red-flag" | "diagnosis" | "test" | "anamnesis" | "unnecessary-test";
  title: string;
  detail: string;
  severity: "critical" | "important";
}

/** Sonuç ekranını eyleme geçirilebilir en fazla üç adıma indirger. */
export function buildFeedbackPriorities(sonuc: DegerlendirmeSonuc): FeedbackPriority[] {
  const priorities: FeedbackPriority[] = [];
  for (const redFlag of sonuc.atlananRedFlagler) {
    priorities.push({
      id: "red-flag",
      title: "Önce güvenlik sinyalini sor",
      detail: `Atlanan red flag: ${redFlag}. Bir sonraki vakada anamnezin erken bölümüne ekle.`,
      severity: "critical",
    });
    if (priorities.length === 3) return priorities;
  }
  if (!sonuc.taniDogru) {
    priorities.push({
      id: "diagnosis",
      title: "Tanı hipotezini kanıtlarla yeniden sınırla",
      detail: "Problem temsili, ayırıcı tanı ve seçtiğin test sonuçları arasındaki uyumu tekrar gözden geçir.",
      severity: "important",
    });
  }
  if (priorities.length < 3 && sonuc.eksikTestler.length) {
    priorities.push({
      id: "test",
      title: "Gerekli tetkiki erken planla",
      detail: `Eksik test: ${sonuc.eksikTestler.slice(0, 2).join(", ")}.`,
      severity: "important",
    });
  }
  if (priorities.length < 3 && sonuc.anamnezAnalizi.enCokEksikKategori) {
    priorities.push({
      id: "anamnesis",
      title: "Anamnezde eksik alanı hedefle",
      detail: `En çok eksik kalan alan: ${sonuc.anamnezAnalizi.enCokEksikKategori}.`,
      severity: "important",
    });
  }
  if (priorities.length < 3 && sonuc.gereksizTestler.length) {
    priorities.push({
      id: "unnecessary-test",
      title: "Test istemini klinik soruyla ilişkilendir",
      detail: `Gereksiz veya erken istenen test: ${sonuc.gereksizTestler.slice(0, 2).join(", ")}.`,
      severity: "important",
    });
  }
  return priorities.slice(0, 3);
}
