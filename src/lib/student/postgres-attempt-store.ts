import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { learningAttempts } from "@/lib/auth/schema";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { loadCasesStore, recordPlaySession } from "@/lib/admin/store";
import { getLabResult } from "@/lib/lab-motor";
import { degerlendir } from "@/lib/scoring/degerlendir";
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
  askedActions: string[];
  requestedTests: string[];
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
    askedActions: stringList(row.askedActions),
    requestedTests: stringList(row.requestedTests),
    clinicalReasoning: normalizeClinicalReasoning(row.clinicalReasoning),
  };
}

function publicAttempt(record: StoredAttempt): PublicAttemptCase {
  return {
    id: record.id,
    semptom: record.vaka.semptom,
    alan: record.vaka.alan,
    seviye: record.vaka.seviye,
    hasta: record.vaka.hasta,
    soruChipleri: record.vaka.soruChipleri,
    testler: Object.values(record.vaka.statikTestler).map((test) => ({ testKey: test.testKey, testAdi: test.testAdi })),
  };
}

function answer(record: StoredAttempt, action: string): string {
  return record.vaka.hastaYanitlari[action] || record.vaka.hastaYanitlari.OZEL || "Bu konuda ek bilgi veremiyorum.";
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

async function findActive(studentId: string, id: string): Promise<AttemptRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(learningAttempts)
    .where(and(eq(learningAttempts.id, id), eq(learningAttempts.studentId, studentId), eq(learningAttempts.status, "active")))
    .limit(1);
  return row ?? null;
}

export async function startPostgresStudentAttempt(studentId: string, poliklinikKey: string): Promise<PublicAttemptCase | null> {
  const candidates = loadCasesStore().cases.filter(
    (item) => item.durum === "aktif" && (poliklinikKey === "*" || item.poliklinikKey === poliklinikKey)
  );
  const template = candidates[Math.floor(Math.random() * candidates.length)];
  if (!template) return null;
  return insertAttempt(studentId, template.id, template.poliklinikKey);
}

export async function startPostgresAssignedAttempt(studentId: string, assignmentId: string, caseId: string): Promise<PublicAttemptCase | null> {
  const template = loadCasesStore().cases.find((item) => item.id === caseId && item.durum === "aktif");
  if (!template) return null;
  return insertAttempt(studentId, template.id, template.poliklinikKey, assignmentId);
}

async function insertAttempt(studentId: string, caseId: string, poliklinikKey: string, assignmentId?: string) {
  const template = loadCasesStore().cases.find((item) => item.id === caseId);
  if (!template) return null;
  const vaka = adminVakaToPlayable(template);
  const now = new Date();
  const db = getDb();
  const [row] = await db
    .insert(learningAttempts)
    .values({
      studentId,
      assignmentId: assignmentId ?? null,
      caseId,
      caseVersion: vaka.sourceCaseVersion ? String(vaka.sourceCaseVersion) : null,
      poliklinikKey,
      caseSnapshot: vaka,
      askedActions: [],
      requestedTests: [],
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

export async function answerPostgresAttempt(id: string, studentId: string, action: string): Promise<string | null> {
  const row = await findActive(studentId, id);
  if (!row) return null;
  const record = fromRow(row);
  const askedActions = record.askedActions.includes(action) ? record.askedActions : [...record.askedActions, action];
  await getDb().update(learningAttempts).set({ askedActions, updatedAt: new Date() }).where(eq(learningAttempts.id, id));
  return answer(record, action);
}

export async function requestPostgresAttemptTest(id: string, studentId: string, testKey: string): Promise<TestSonucu | null> {
  const row = await findActive(studentId, id);
  if (!row) return null;
  const record = fromRow(row);
  const result = testResult(record, testKey);
  if (!result) return null;
  const requestedTests = record.requestedTests.includes(testKey) ? record.requestedTests : [...record.requestedTests, testKey];
  await getDb().update(learningAttempts).set({ requestedTests, updatedAt: new Date() }).where(eq(learningAttempts.id, id));
  return result;
}

export async function savePostgresAttemptClinicalReasoning(
  id: string,
  studentId: string,
  reasoning: ClinicalReasoningInput
): Promise<boolean> {
  const row = await findActive(studentId, id);
  if (!row) return false;
  await getDb().update(learningAttempts).set({ clinicalReasoning: reasoning, updatedAt: new Date() }).where(eq(learningAttempts.id, id));
  return true;
}

export async function completePostgresAttempt(
  id: string,
  studentId: string,
  actor: string,
  taniGirildi: string,
  reasoning: ClinicalReasoningInput | null
): Promise<DegerlendirmeSonuc | null> {
  const row = await findActive(studentId, id);
  if (!row) return null;
  const record = fromRow(row);
  const effectiveReasoning = reasoning ?? record.clinicalReasoning;
  const sonuc = withClinicalReasoningFeedback(
    degerlendir(record.vaka, record.askedActions, record.requestedTests, taniGirildi),
    effectiveReasoning
  );
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
  await getDb().update(learningAttempts).set({
    status: "completed",
    clinicalReasoning: effectiveReasoning,
    evaluation: sonuc,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(learningAttempts.id, id));
  return sonuc;
}
