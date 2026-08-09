import type { Vaka } from "@/lib/types";
import type { PublicAttemptCase } from "@/lib/student/attempt-store";

/** Sunucu oturumundan gelen gizli olmayan vaka görünümünü çalışma alanı modeline çevirir. */
export function publicAttemptToVaka(remote: PublicAttemptCase): Vaka {
  return {
    id: remote.id, semptom: remote.semptom, hastalik: "gizli", alan: remote.alan, seviye: remote.seviye,
    hasta: remote.hasta, beklenenTani: [],
    rubric: { beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [], kabulEdilenTani: [], puanlama: {} },
    statikTestler: Object.fromEntries(remote.testler.map((test) => [test.testKey, { testKey: test.testKey, testAdi: test.testAdi, tip: "text", sonuc: "" }])),
    hastaYanitlari: {}, soruChipleri: remote.soruChipleri, relevantAksiyonlar: [],
  };
}
