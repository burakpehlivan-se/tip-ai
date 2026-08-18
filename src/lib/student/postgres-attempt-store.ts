import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { learningAttempts } from "@/lib/auth/schema";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { getHastaTipiById, loadHastaTipleriStore, recordPlaySession } from "@/lib/admin/store";
import { uslupDonustur } from "@/lib/ai/uslup-donusturucu";
import { getRadiologyTestResult, RADIOLOGY_TEST_KEY } from "@/lib/student/radiology-test";
import { getEkgTestResult, EKG_TEST_KEY } from "@/lib/student/ekg-test";
import { loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";
import type { AdminVaka } from "@/lib/admin/types";
import { getLabResult } from "@/lib/lab-motor";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { hastaDilineCevir } from "@/lib/ai/hasta-dili";
import type { DegerlendirmeSonuc, TestSonucu, Vaka } from "@/lib/types";
import type { PublicAttemptCase, ResumableAttemptCase } from "./attempt-store";
import {
  clinicalReasoningFeedback,
  normalizeClinicalReasoning,
  type ClinicalReasoningInput,
  withClinicalReasoningFeedback,
} from "./clinical-reasoning";

type AttemptRow = typeof learningAttempts.$inferSelect;

interface StoredAttempt {
  id: string;
  vaka: Vaka;
  hastaTipiId?: string;
  askedActions: string[];
  requestedTests: string[];
  /** Aksiyon → dönüştürülmüş cevap (devam eden oturumun birebir tekrarı). */
  answers?: Record<string, string>;
  clinicalReasoning: ClinicalReasoningInput | null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fromRow(row: AttemptRow): StoredAttempt {
  const vaka = row.caseSnapshot as Vaka;
  if (!vaka || typeof vaka !== "object" || typeof vaka.id !== "string" || !vaka.hasta || !vaka.rubric) {
    throw new Error("PostgreSQL deneme anlık görüntüsü geçersiz.");
  }
  return {
    id: row.id,
    vaka,
    hastaTipiId: row.hastaTipiId ?? undefined,
    askedActions: stringList(row.askedActions),
    requestedTests: stringList(row.requestedTests),
    answers: row.answers ? Object.fromEntries(Object.entries(row.answers).filter(([, v]) => typeof v === "string")) : undefined,
    clinicalReasoning: normalizeClinicalReasoning(row.clinicalReasoning),
  };
}

function publicAttempt(record: StoredAttempt): PublicAttemptCase {
  const tip = record.hastaTipiId ? getHastaTipiById(record.hastaTipiId) : undefined;
  return {
    id: record.id,
    semptom: record.vaka.semptom,
    alan: record.vaka.alan,
    seviye: record.vaka.seviye,
    hasta: record.vaka.hasta,
    soruChipleri: record.vaka.soruChipleri,
    testler: Object.values(record.vaka.statikTestler).map((test) => ({ testKey: test.testKey, testAdi: test.testAdi })),
    hastaTipi: record.hastaTipiId ? { id: record.hastaTipiId, ad: tip?.ad || record.hastaTipiId } : null,
  };
}

function baseAnswer(record: StoredAttempt, action: string): string {
  return hastaDilineCevir(record.vaka.hastaYanitlari[action] || record.vaka.hastaYanitlari.OZEL || "Bu konuda ek bilgi veremiyorum.");
}

function answer(record: StoredAttempt, action: string): string {
  return record.answers?.[action] || baseAnswer(record, action);
}

/** Taban cevabı hasta tipi üslubuna dönüştürür ve kayda yazar. */
async function computeAnswer(record: StoredAttempt, action: string): Promise<string> {
  const tip = record.hastaTipiId ? getHastaTipiById(record.hastaTipiId) : undefined;
  const yanit = await uslupDonustur({
    vakaId: record.vaka.sourceCaseId || record.vaka.id,
    tip,
    actionKey: action,
    baseCevap: baseAnswer(record, action),
    baglam: {
      yas: record.vaka.hasta.yas != null ? String(record.vaka.hasta.yas) : undefined,
      cinsiyet: record.vaka.hasta.cinsiyet === "E" ? "Erkek" : record.vaka.hasta.cinsiyet === "K" ? "Kadın" : undefined,
      anaSikayet: record.vaka.hasta.anaSikayet,
    },
  });
  record.answers = record.answers || {};
  record.answers[action] = yanit;
  return yanit;
}

function testResult(record: StoredAttempt, testKey: string): TestSonucu | null {
  const { vaka } = record;
  return vaka.statikTestler[testKey] || (vaka.profile ? getLabResult(testKey, vaka.profile, vaka.statikTestler) : null);
}

function resumableAttempt(record: StoredAttempt): ResumableAttemptCase {
  return {
    ...publicAttempt(record),
    ilerleme: {
      yanitlar: record.askedActions.map((aksiyon) => ({ aksiyon, yanit: answer(record, aksiyon) })),
      testSonuclari: record.requestedTests.map((testKey) => testResult(record, testKey)).filter((item): item is TestSonucu => item !== null),
      clinicalReasoning: record.clinicalReasoning,
    },
  };
}

export async function startPostgresStudentAttempt(studentId: string, poliklinikKey: string, hastaTipiId?: string): Promise<PublicAttemptCase | null> {
  const candidates = (await loadRuntimeCasesStore()).cases.filter(
    (item) => item.durum === "aktif" && (poliklinikKey === "*" || item.poliklinikKey === poliklinikKey)
  );
  const template = candidates[Math.floor(Math.random() * candidates.length)];
  if (!template) return null;
  return insertAttempt(studentId, template, undefined, hastaTipiId);
}

export async function startPostgresAssignedAttempt(
  studentId: string,
  assignmentId: string,
  template: AdminVaka,
  hastaTipiId?: string
): Promise<PublicAttemptCase | null> {
  return insertAttempt(studentId, template, assignmentId, hastaTipiId);
}

async function insertAttempt(studentId: string, template: AdminVaka, assignmentId?: string, hastaTipiId?: string) {
  const vaka = adminVakaToPlayable(template);
  const now = new Date();
  const db = getDb();
  const [row] = await db
    .insert(learningAttempts)
    .values({
      studentId,
      assignmentId: assignmentId ?? null,
      caseId: template.id,
      caseVersion: vaka.sourceCaseVersion ? String(vaka.sourceCaseVersion) : null,
      poliklinikKey: template.poliklinikKey,
      hastaTipiId: hastaTipiId ?? null,
      caseSnapshot: vaka,
      askedActions: [],
      requestedTests: [],
      answers: null,
      clinicalReasoning: null,
      startedAt: now,
      updatedAt: now,
    })
    .returning();
  return publicAttempt(fromRow(row));
}

export async function getPostgresActiveAttempt(studentId: string, poliklinikKey: string): Promise<ResumableAttemptCase | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(learningAttempts)
    .where(and(eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active"), eq(learningAttempts.poliklinikKey, poliklinikKey)))
    .orderBy(desc(learningAttempts.updatedAt))
    .limit(1);
  return rows[0] ? resumableAttempt(fromRow(rows[0])) : null;
}

export async function getPostgresAssignedAttempt(studentId: string, assignmentId: string): Promise<ResumableAttemptCase | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(learningAttempts)
    .where(and(eq(learningAttempts.studentId, studentId), eq(learningAttempts.assignmentId, assignmentId), eq(learningAttempts.status, "active")))
    .orderBy(desc(learningAttempts.updatedAt))
    .limit(1);
  return row ? resumableAttempt(fromRow(row)) : null;
}

/** Kaynak vaka kimliği tarayıcıya gönderilmeden, sahiplik filtresi altında okunur. */
export async function getPostgresAttemptSourceCaseId(id: string, studentId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ caseSnapshot: learningAttempts.caseSnapshot })
    .from(learningAttempts)
    .where(and(eq(learningAttempts.id, id), eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active")))
    .limit(1);
  if (!row) return null;
  const snapshot = row.caseSnapshot as Partial<Vaka> | null;
  return typeof snapshot?.sourceCaseId === "string" ? snapshot.sourceCaseId : null;
}

export async function answerPostgresAttempt(id: string, studentId: string, action: string): Promise<string | null> {
  return getDb().transaction(async (tx) => {
    // Aynı denemeye gelen paralel istekler, read-modify-write yarışında
    // birbirinin aksiyonlarını ezmemelidir. Satır kilidi, değerlendirme
    // gövdesi JSONB kaldığı sürece de tek doğruluk kaynağını korur.
    const [row] = await tx
      .select()
      .from(learningAttempts)
      .where(and(eq(learningAttempts.id, id), eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active")))
      .limit(1)
      .for("update");
    if (!row) return null;

    const record = fromRow(row);
    const askedActions = record.askedActions.includes(action) ? record.askedActions : [...record.askedActions, action];
    const yanit = await computeAnswer(record, action);
    await tx.update(learningAttempts).set({ askedActions, answers: record.answers ?? null, updatedAt: new Date() }).where(eq(learningAttempts.id, id));
    return yanit;
  });
}

export async function requestPostgresAttemptTest(id: string, studentId: string, testKey: string): Promise<TestSonucu | null> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(learningAttempts)
      .where(and(eq(learningAttempts.id, id), eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active")))
      .limit(1)
      .for("update");
    if (!row) return null;

    const record = fromRow(row);
    const result = testKey === RADIOLOGY_TEST_KEY
      ? await getRadiologyTestResult(id, record.vaka.sourceCaseId || record.vaka.id) || testResult(record, testKey)
      : testKey === EKG_TEST_KEY
        ? await getEkgTestResult(id, record.vaka.sourceCaseId || record.vaka.id) || testResult(record, testKey)
        : testResult(record, testKey);
    if (!result) return null;
    const requestedTests = record.requestedTests.includes(testKey) ? record.requestedTests : [...record.requestedTests, testKey];
    await tx.update(learningAttempts).set({ requestedTests, updatedAt: new Date() }).where(eq(learningAttempts.id, id));
    return result;
  });
}

export async function savePostgresAttemptClinicalReasoning(
  id: string,
  studentId: string,
  reasoning: ClinicalReasoningInput
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: learningAttempts.id })
      .from(learningAttempts)
      .where(and(eq(learningAttempts.id, id), eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active")))
      .limit(1)
      .for("update");
    if (!row) return false;
    await tx.update(learningAttempts).set({ clinicalReasoning: reasoning, updatedAt: new Date() }).where(eq(learningAttempts.id, id));
    return true;
  });
}

export async function completePostgresAttempt(
  id: string,
  studentId: string,
  actor: string,
  taniGirildi: string,
  reasoning: ClinicalReasoningInput | null
): Promise<DegerlendirmeSonuc | null> {
  const completed = await getDb().transaction(async (tx) => {
    // Completion is terminal. Kilit, iki "tamamla" isteğinin aynı denemeyi
    // iki kez puanlamasını veya aktif verinin arasında değişmesini önler.
    const [row] = await tx
      .select()
      .from(learningAttempts)
      .where(and(eq(learningAttempts.id, id), eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active")))
      .limit(1)
      .for("update");
    if (!row) return null;

    const record = fromRow(row);
    const effectiveReasoning = reasoning ?? record.clinicalReasoning;
    const sonuc = withClinicalReasoningFeedback(
      degerlendir(record.vaka, record.askedActions, record.requestedTests, taniGirildi),
      effectiveReasoning
    );
    await tx.update(learningAttempts).set({
      status: "completed",
      clinicalReasoning: effectiveReasoning,
      evaluation: sonuc,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(learningAttempts.id, id));
    return { record, reasoning: effectiveReasoning, sonuc };
  });
  if (!completed) return null;

  const { record, reasoning: effectiveReasoning, sonuc } = completed;
  const reasoningFeedback = clinicalReasoningFeedback(effectiveReasoning, sonuc.taniDogru);
  recordPlaySession({
    caseId: record.vaka.id,
    hastalikKey: record.vaka.hastalik,
    poliklinikKey: record.vaka.profile?.poliklinikKey || "",
    actor,
    mode: "ogrenci",
    toplamPuan: sonuc.toplamPuan,
    maxPuan: sonuc.maxPuan,
    taniDogru: sonuc.taniDogru,
    atlananRedFlagler: sonuc.atlananRedFlagler,
    gereksizTestler: sonuc.gereksizTestler,
    eksikSorular: sonuc.eksikSorular,
    eksikTestler: sonuc.eksikTestler,
    anamnezCoverage: sonuc.anamnezAnalizi.toplamBeklenen ? Math.round((sonuc.anamnezAnalizi.toplamSoruldu / sonuc.anamnezAnalizi.toplamBeklenen) * 100) : undefined,
    clinicalReasoningRecorded: reasoningFeedback.recorded,
    differentialCount: reasoningFeedback.differentialCount || undefined,
    clinicalConfidence: reasoningFeedback.confidence ?? undefined,
    confidenceCalibrationGap: reasoningFeedback.calibrationGap ?? undefined,
    caseVersion: record.vaka.sourceCaseVersion,
    caseChecksum: record.vaka.sourceCaseChecksum,
  }, actor);
  return sonuc;
}
