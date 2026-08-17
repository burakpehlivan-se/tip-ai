import crypto from "crypto";
import path from "path";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";
import type { AdminVaka } from "@/lib/admin/types";
import { adminDataDir } from "@/lib/admin/paths";
import { readJsonOrRecover, withJsonStoreLock, writeJsonAtomic } from "@/lib/admin/json-store";
import type { DegerlendirmeSonuc, TestSonucu, Vaka } from "@/lib/types";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { hastaDilineCevir } from "@/lib/ai/hasta-dili";
import { getLabResult } from "@/lib/lab-motor";
import { getHastaTipiById, loadHastaTipleriStore, recordPlaySession } from "@/lib/admin/store";
import { uslupDonustur } from "@/lib/ai/uslup-donusturucu";
import { getRadiologyTestResult, RADIOLOGY_TEST_KEY } from "@/lib/student/radiology-test";
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
  getPostgresAttemptSourceCaseId,
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
  /** Denemeye atanan hasta tipi; yoksa nötr ("sakin") üslup kullanılır. */
  hastaTipiId?: string;
  vaka: Vaka;
  sorulanAksiyonlar: string[];
  istenenTestler: string[];
  /** Aksiyon → dönüştürülmüş cevap (devam eden oturumun birebir tekrarı). */
  cevaplar?: Record<string, string>;
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
  /** Denemeye atanan hasta tipi (gösterim için); yoksa null. */
  hastaTipi?: { id: string; ad: string } | null;
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
  const tip = record.hastaTipiId ? getHastaTipiById(record.hastaTipiId) : undefined;
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
    hastaTipi: record.hastaTipiId ? { id: record.hastaTipiId, ad: tip?.ad || record.hastaTipiId } : null,
  };
}

function baseCevap(record: AttemptRecord, action: string): string {
  return hastaDilineCevir(record.vaka.hastaYanitlari[action] || record.vaka.hastaYanitlari.OZEL || "Bu konuda ek bilgi veremiyorum.");
}

function attemptAnswer(record: AttemptRecord, action: string) {
  return record.cevaplar?.[action] || baseCevap(record, action);
}

/** Taban cevabı hasta tipi üslubuna dönüştürür ve kayda yazar. */
async function yanitHesapla(record: AttemptRecord, action: string): Promise<string> {
  const tip = record.hastaTipiId ? getHastaTipiById(record.hastaTipiId) : undefined;
  const yanit = await uslupDonustur({
    vakaId: record.vaka.sourceCaseId || record.vaka.id,
    tip,
    actionKey: action,
    baseCevap: baseCevap(record, action),
    baglam: {
      yas: record.vaka.hasta.yas != null ? String(record.vaka.hasta.yas) : undefined,
      cinsiyet: record.vaka.hasta.cinsiyet === "E" ? "Erkek" : record.vaka.hasta.cinsiyet === "K" ? "Kadın" : undefined,
      anaSikayet: record.vaka.hasta.anaSikayet,
    },
  });
  record.cevaplar = record.cevaplar || {};
  record.cevaplar[action] = yanit;
  return yanit;
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

function rastgeleHastaTipiId(): string | null {
  const tipler = loadHastaTipleriStore().tipler;
  if (!tipler.length) return null;
  return tipler[Math.floor(Math.random() * tipler.length)].id;
}

export function startStudentAttempt(actor: string, poliklinikKey: string, studentId?: string, hastaTipiId?: string | null): Promise<PublicAttemptCase | null> {
  // PostgreSQL adapter'ı cutover sırasında bu çağrı sınırına bağlanacaktır.
  // Şimdiden açıkça doğrulamak, yanlış env ile sessiz JSON yazımını engeller.
  assertSupportedAttemptStore(actor);
  const seciliTip = hastaTipiId && getHastaTipiById(hastaTipiId) ? hastaTipiId : rastgeleHastaTipiId();
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return startPostgresStudentAttempt(studentId, poliklinikKey, seciliTip ?? undefined);
  }
  return withJsonStoreLock(async () => {
    const candidates = (await loadRuntimeCasesStore()).cases.filter(
      (item) => item.durum === "aktif" && (poliklinikKey === "*" || item.poliklinikKey === poliklinikKey)
    );
    if (!candidates.length) return null;

    const template = candidates[Math.floor(Math.random() * candidates.length)];
    return createAttemptFromTemplate(actor, template, poliklinikKey, undefined, seciliTip ?? undefined);
  });
}

function createAttemptFromTemplate(
  actor: string,
  template: AdminVaka,
  poliklinikKey: string,
  assignmentId?: string,
  hastaTipiId?: string
): PublicAttemptCase {
  const record: AttemptRecord = {
    id: crypto.randomUUID(),
    actor,
    assignmentId,
    poliklinikKey,
    hastaTipiId,
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
  template: AdminVaka,
  studentId?: string
): Promise<PublicAttemptCase | null> {
  assertSupportedAttemptStore(actor);
  const hastaTipiId = rastgeleHastaTipiId();
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return startPostgresAssignedAttempt(studentId, assignmentId, template, hastaTipiId ?? undefined);
  }
  return withJsonStoreLock(async () => {
    return createAttemptFromTemplate(actor, template, template.poliklinikKey, assignmentId, hastaTipiId ?? undefined);
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

/** Sahibi doğrulanmış denemenin kaynak vaka kimliğini yalnızca sunucuya döndürür. */
export async function getStudentAttemptSourceCaseId(
  id: string,
  actor: string,
  studentId?: string
): Promise<string | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return getPostgresAttemptSourceCaseId(id, studentId);
  }
  return withJsonStoreLock(() => {
    const found = ownAttempt(id, actor);
    return found?.attempt.vaka.sourceCaseId || null;
  });
}

export function answerStudentAttempt(id: string, actor: string, action: string, studentId?: string): Promise<string | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return answerPostgresAttempt(id, studentId, action);
  }
  return withJsonStoreLock(async () => {
    const found = ownAttempt(id, actor);
    if (!found) return null;
    if (!found.attempt.sorulanAksiyonlar.includes(action)) found.attempt.sorulanAksiyonlar.push(action);
    const yanit = await yanitHesapla(found.attempt, action);
    found.attempt.updatedAt = Date.now();
    save(found.store);
    return yanit;
  });
}

export function requestStudentAttemptTest(id: string, actor: string, testKey: string, studentId?: string): Promise<TestSonucu | null> {
  assertSupportedAttemptStore(actor);
  if (shouldUsePostgresAttemptStore(actor)) {
    if (!studentId) throw new Error("PostgreSQL deneme deposu öğrenci kimliği gerektirir.");
    return requestPostgresAttemptTest(id, studentId, testKey);
  }
  return withJsonStoreLock(async () => {
    const found = ownAttempt(id, actor);
    if (!found) return null;
    const result = testKey === RADIOLOGY_TEST_KEY
      ? await getRadiologyTestResult(id, found.attempt.vaka.sourceCaseId || found.attempt.vaka.id) || attemptTest(found.attempt, testKey)
      : attemptTest(found.attempt, testKey);
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
  tedaviGirildi: string,
  reasoning: ClinicalReasoningInput | null,
  studentId?: string
): Promise<DegerlendirmeSonuc | null> {
  if (!taniGirildi.trim() || !tedaviGirildi.trim()) return Promise.resolve(null);
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
