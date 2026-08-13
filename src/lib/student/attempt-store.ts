import crypto from "crypto";
import path from "path";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { loadCasesStore } from "@/lib/admin/store";
import { adminDataDir } from "@/lib/admin/paths";
import { readJsonOrRecover, withJsonStoreLock, writeJsonAtomic } from "@/lib/admin/json-store";
import type { DegerlendirmeSonuc, TestSonucu, Vaka } from "@/lib/types";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { getLabResult } from "@/lib/lab-motor";
import { recordPlaySession } from "@/lib/admin/store";
import { assertSupportedAttemptStore } from "./attempt-store-mode";
import { shouldUsePostgresAttemptStore } from "./attempt-store-mode";
import {
  clinicalReasoningFeedback,
  type ClinicalReasoningInput,
  withClinicalReasoningFeedback,
} from "./clinical-reasoning";
import {
  answerPostgresAttempt,
  completePostgresAttempt,
  getPostgresActiveAttempt,
  getPostgresAssignedAttempt,
  requestPostgresAttemptTest,
  savePostgresAttemptClinicalReasoning,
  startPostgresAssignedAttempt,
  startPostgresStudentAttempt,
} from "./postgres-attempt-store";

const ATTEMPT_TTL_MS = 1000 * 60 * 60 * 12;

interface AttemptRecord {
  id: string;
  actor: string;
  /** Grup atamasından başlatıldıysa, aynı atamaya geri dönüş için sunucu içi bağ. */
  assignmentId?: string;
  poliklinikKey: string;
  vaka: Vaka;
  sorulanAksiyonlar: string[];
  istenenTestler: string[];
  clinicalReasoning?: ClinicalReasoningInput | null;
  createdAt: number;
  updatedAt: number;
}

interface AttemptStore {
  version: 1;
  attempts: AttemptRecord[];
}

function storePath() {
  return path.join(adminDataDir(), "student-attempts.json");
}

function load(): AttemptStore {
  const parsed = readJsonOrRecover<AttemptStore>(storePath(), { version: 1, attempts: [] }, "Öğrenci oturumu deposu");
  const now = Date.now();
  return { version: 1, attempts: (parsed.attempts || []).filter((a) => now - a.updatedAt < ATTEMPT_TTL_MS) };
}

function save(store: AttemptStore) {
  writeJsonAtomic(storePath(), store);
}

export interface PublicAttemptCase {
  id: string;
  semptom: string;
  alan: string;
  seviye: Vaka["seviye"];
  hasta: Vaka["hasta"];
  soruChipleri: Vaka["soruChipleri"];
  testler: Array<{ testKey: string; testAdi: string }>;
}

/**
 * Sadece sahibinin devam ettiği oturuma gönderilen ilerleme verisi.
 * Yeni vaka başlangıcında cevaplar ve sonuçlar asla istemciye gönderilmez.
 */
export interface ResumableAttemptCase extends PublicAttemptCase {
  ilerleme: {
    yanitlar: Array<{ aksiyon: string; yanit: string }>;
    testSonuclari: TestSonucu[];
    clinicalReasoning: ClinicalReasoningInput | null;
  };
}

function toPublicAttempt(record: AttemptRecord): PublicAttemptCase {
  return {
    id: record.id,
    semptom: record.vaka.semptom,
    alan: record.vaka.alan,
    seviye: record.vaka.seviye,
    hasta: record.vaka.hasta,
    soruChipleri: record.vaka.soruChipleri,
    testler: Object.values(record.vaka.statikTestler).map((test) => ({
      testKey: test.testKey,
      testAdi: test.testAdi,
    })),
  };
}

function attemptAnswer(record: AttemptRecord, action: string) {
  return record.vaka.hastaYanitlari[action] || record.vaka.hastaYanitlari.OZEL || "Bu konuda ek bilgi veremiyorum.";
}

function attemptTest(record: AttemptRecord, testKey: string) {
  const { vaka } = record;
  return vaka.statikTestler[testKey] || (vaka.profile ? getLabResult(testKey, vaka.profile, vaka.statikTestler) : null);
}

function toResumableAttempt(record: AttemptRecord): ResumableAttemptCase {
  return {
    ...toPublicAttempt(record),
    ilerleme: {
      yanitlar: record.sorulanAksiyonlar.map((aksiyon) => ({ aksiyon, yanit: attemptAnswer(record, aksiyon) })),
      testSonuclari: record.istenenTestler
        .map((testKey) => attemptTest(record, testKey))
        .filter((test): test is TestSonucu => test !== null),
      clinicalReasoning: record.clinicalReasoning || null,
    },
  };
}

function ownAttempt(id: string, actor: string): { store: AttemptStore; attempt: AttemptRecord } | null {
  const store = load();
  const attempt = store.attempts.find((item) => item.id === id && item.actor === actor);
  return attempt ? { store, attempt } : null;
}

export function startStudentAttempt(actor: string, poliklinikKey: string, studentId?: string): Promise<PublicAttemptCase | null> {
  // PostgreSQL adapter'ı cutover sırasında bu çağrı sınırına bağlanacaktır.
  // Şimdiden açıkça doğrulamak, yanlış env ile sessiz JSON yazımını engeller.
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return startPostgresStudentAttempt(studentId, poliklinikKey);
  }
  return withJsonStoreLock(() => {
    const candidates = loadCasesStore().cases.filter(
      (item) => item.durum === "aktif" && (poliklinikKey === "*" || item.poliklinikKey === poliklinikKey)
    );
    if (!candidates.length) return null;

    const template = candidates[Math.floor(Math.random() * candidates.length)];
    return createAttemptFromTemplate(actor, template, poliklinikKey);
  });
}

function createAttemptFromTemplate(
  actor: string,
  template: ReturnType<typeof loadCasesStore>["cases"][number],
  poliklinikKey: string,
  assignmentId?: string
): PublicAttemptCase {
  const record: AttemptRecord = {
    id: crypto.randomUUID(),
    actor,
    assignmentId,
    poliklinikKey,
    vaka: adminVakaToPlayable(template),
    sorulanAksiyonlar: [],
    istenenTestler: [],
    clinicalReasoning: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const store = load();
  store.attempts.push(record);
  save(store);
  return toPublicAttempt(record);
}

/** Yalnızca daha önce doğrulanmış bir grup atamasının belirttiği vaka için kullanılır. */
export function startAssignedStudentAttempt(
  actor: string,
  assignmentId: string,
  caseId: string,
  studentId?: string
): Promise<PublicAttemptCase | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return startPostgresAssignedAttempt(studentId, assignmentId, caseId);
  }
  return withJsonStoreLock(() => {
    const template = loadCasesStore().cases.find((item) => item.id === caseId && item.durum === "aktif");
    if (!template) return null;
    return createAttemptFromTemplate(actor, template, template.poliklinikKey, assignmentId);
  });
}

/** Aynı kullanıcı ve poliklinik için son 12 saatte güncellenmiş vakayı döndürür. */
export function getActiveStudentAttempt(actor: string, poliklinikKey: string, studentId?: string): Promise<ResumableAttemptCase | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return getPostgresActiveAttempt(studentId, poliklinikKey);
  }
  return withJsonStoreLock(() => {
    const candidates = load().attempts.filter(
      (attempt) =>
        attempt.actor === actor &&
        (poliklinikKey === "*" || attempt.poliklinikKey === poliklinikKey || attempt.vaka.profile?.poliklinikKey === poliklinikKey)
    );
    const latest = candidates.reduce<AttemptRecord | null>(
      (current, attempt) => (!current || attempt.updatedAt > current.updatedAt ? attempt : current),
      null
    );
    return latest ? toResumableAttempt(latest) : null;
  });
}

/** Öğrencinin yalnızca kendi atamasına bağlı aktif oturumunu geri döndürür. */
export function getActiveStudentAttemptForAssignment(
  actor: string,
  assignmentId: string,
  studentId?: string
): Promise<ResumableAttemptCase | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return getPostgresAssignedAttempt(studentId, assignmentId);
  }
  return withJsonStoreLock(() => {
    const attempt = load().attempts
      .filter((item) => item.actor === actor && item.assignmentId === assignmentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return attempt ? toResumableAttempt(attempt) : null;
  });
}

export function answerStudentAttempt(id: string, actor: string, action: string, studentId?: string): Promise<string | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return answerPostgresAttempt(id, studentId, action);
  }
  return withJsonStoreLock(() => {
    const found = ownAttempt(id, actor);
    if (!found) return null;
    if (!found.attempt.sorulanAksiyonlar.includes(action)) found.attempt.sorulanAksiyonlar.push(action);
    found.attempt.updatedAt = Date.now();
    save(found.store);
    return attemptAnswer(found.attempt, action);
  });
}

export function requestStudentAttemptTest(id: string, actor: string, testKey: string, studentId?: string): Promise<TestSonucu | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return requestPostgresAttemptTest(id, studentId, testKey);
  }
  return withJsonStoreLock(() => {
    const found = ownAttempt(id, actor);
    if (!found) return null;
    const result = attemptTest(found.attempt, testKey);
    if (!result) return null;
    if (!found.attempt.istenenTestler.includes(testKey)) found.attempt.istenenTestler.push(testKey);
    found.attempt.updatedAt = Date.now();
    save(found.store);
    return result;
  });
}

export function saveStudentAttemptClinicalReasoning(
  id: string,
  actor: string,
  reasoning: ClinicalReasoningInput,
  studentId?: string
): Promise<boolean> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return savePostgresAttemptClinicalReasoning(id, studentId, reasoning);
  }
  return withJsonStoreLock(() => {
    const found = ownAttempt(id, actor);
    if (!found) return false;
    found.attempt.clinicalReasoning = reasoning;
    found.attempt.updatedAt = Date.now();
    save(found.store);
    return true;
  });
}

export function completeStudentAttempt(
  id: string,
  actor: string,
  taniGirildi: string,
  reasoning: ClinicalReasoningInput | null,
  studentId?: string
): Promise<DegerlendirmeSonuc | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return completePostgresAttempt(id, studentId, actor, taniGirildi, reasoning);
  }
  return withJsonStoreLock(() => {
    const found = ownAttempt(id, actor);
    if (!found) return null;
    const effectiveReasoning = reasoning ?? found.attempt.clinicalReasoning ?? null;
    const sonuc = withClinicalReasoningFeedback(
      degerlendir(found.attempt.vaka, found.attempt.sorulanAksiyonlar, found.attempt.istenenTestler, taniGirildi),
      effectiveReasoning
    );
    const reasoningFeedback = clinicalReasoningFeedback(effectiveReasoning, sonuc.taniDogru);
    if (!actor.startsWith("guest:")) recordPlaySession({
      caseId: found.attempt.vaka.id,
      hastalikKey: found.attempt.vaka.hastalik,
      poliklinikKey: found.attempt.vaka.profile?.poliklinikKey || "",
      actor,
      mode: "ogrenci",
      toplamPuan: sonuc.toplamPuan,
      maxPuan: sonuc.maxPuan,
      taniDogru: sonuc.taniDogru,
      atlananRedFlagler: sonuc.atlananRedFlagler,
      gereksizTestler: sonuc.gereksizTestler,
      eksikSorular: sonuc.eksikSorular,
      eksikTestler: sonuc.eksikTestler,
      anamnezCoverage: sonuc.anamnezAnalizi.toplamBeklenen ? Math.round(sonuc.anamnezAnalizi.toplamSoruldu / sonuc.anamnezAnalizi.toplamBeklenen * 100) : undefined,
      clinicalReasoningRecorded: reasoningFeedback.recorded,
      differentialCount: reasoningFeedback.differentialCount || undefined,
      clinicalConfidence: reasoningFeedback.confidence ?? undefined,
      confidenceCalibrationGap: reasoningFeedback.calibrationGap ?? undefined,
      caseVersion: found.attempt.vaka.sourceCaseVersion,
      caseChecksum: found.attempt.vaka.sourceCaseChecksum,
    }, actor);
    found.store.attempts = found.store.attempts.filter((item) => item.id !== id);
    save(found.store);
    return sonuc;
  });
}
