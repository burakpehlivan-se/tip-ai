import type { ChatMesaj, TestIstegi, Vaka } from "@/lib/types";
import { humanizeKey } from "@/lib/types";
import type { PublicAttemptCase, ResumableAttemptCase } from "@/lib/student/attempt-store";
import type { ClinicalReasoningInput } from "@/lib/student/clinical-reasoning";
import type { ExamFinding } from "@/lib/simulated-patient/exam";

export interface AttemptResumeSnapshot {
  mesajlar: ChatMesaj[];
  testIstekleri: TestIstegi[];
  muayeneBulgulari: ExamFinding[];
  sorulanAksiyonlar: string[];
  faz: "anamnez" | "test" | "tani" | "tedavi";
  taniInput: string;
  tedaviInput: string;
  clinicalReasoning: ClinicalReasoningInput | null;
}

function resumeTurn(turn: { question?: string; answer?: string; actions?: string[]; aksiyon?: string; yanit?: string; channel?: string }) {
  const actions = turn.actions?.filter((action): action is string => typeof action === "string") || (turn.aksiyon ? [turn.aksiyon] : []);
  return {
    question: turn.question || "",
    answer: turn.answer || turn.yanit || "",
    actions,
    channel: turn.channel || "hasta",
  };
}

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

/** Sahibinin daha önce aldığı bilgi ve sonuçlarla çalışma alanını yeniden kurar. */
export function resumableAttemptToSnapshot(remote: ResumableAttemptCase): AttemptResumeSnapshot {
  const startedAt = Date.now();
  const soruEtiketi = (aksiyon: string) =>
    remote.soruChipleri.find((chip) => chip.aksiyon === aksiyon)?.etiket || humanizeKey(aksiyon);
  const mesajlar: ChatMesaj[] = [
    {
      id: "0",
      rol: "sistem",
      metin: `Vaka sürdürüldü. Hasta: ${remote.hasta.yas} yaş, ${remote.hasta.cinsiyet === "E" ? "Erkek" : "Kadın"} — ${remote.hasta.anaSikayet}.`,
      zaman: startedAt,
    },
    ...remote.ilerleme.yanitlar.map(resumeTurn).flatMap(({ question, answer, actions, channel }, index) => [
      { id: `resume-question-${index}`, rol: "ogrenci" as const, metin: question || soruEtiketi(actions[0] || ""), zaman: startedAt + index * 2 + 1 },
      { id: `resume-answer-${index}`, rol: channel === "hasta" ? "hasta" as const : "sistem" as const, metin: answer, zaman: startedAt + index * 2 + 2 },
    ]),
    ...remote.ilerleme.muayeneBulgulari.map((finding, index) => ({
      id: `resume-exam-${index}`,
      rol: "sistem" as const,
      metin: `🩺 ${finding.label}: ${finding.answer}`,
      zaman: startedAt + remote.ilerleme.yanitlar.length * 2 + index + 1,
    })),
    ...remote.ilerleme.testSonuclari.map((sonuc, index) => ({
      id: `resume-test-${index}`,
      rol: "sistem" as const,
      metin: `🧪 ${sonuc.testAdi} istendi`,
      zaman: startedAt + remote.ilerleme.yanitlar.length * 2 + remote.ilerleme.muayeneBulgulari.length + index + 1,
      testSonucu: sonuc,
      testAdi: sonuc.testAdi,
    })),
  ];

  return {
    mesajlar,
    testIstekleri: remote.ilerleme.testSonuclari.map((sonuc, index) => ({
      testKey: sonuc.testKey,
      testAdi: sonuc.testAdi,
      sonuc,
      zaman: startedAt + remote.ilerleme.yanitlar.length * 2 + remote.ilerleme.muayeneBulgulari.length + index + 1,
    })),
    muayeneBulgulari: remote.ilerleme.muayeneBulgulari,
    sorulanAksiyonlar: remote.ilerleme.yanitlar
      .map(resumeTurn)
      .filter((turn) => turn.channel === "hasta")
      .flatMap((turn) => turn.actions),
    faz: remote.ilerleme.testSonuclari.length ? "test" : "anamnez",
    taniInput: "",
    tedaviInput: "",
    clinicalReasoning: remote.ilerleme.clinicalReasoning,
  };
}
