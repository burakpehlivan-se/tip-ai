import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { cohortCaseAssignments, cohortMemberships, cohorts, users } from "@/lib/auth/schema";

export function parseCohortName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 3 && name.length <= 100 ? name : null;
}

export function parseOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

export async function listCohorts() {
  const db = getDb();
  const [cohortRows, memberships, assignments] = await Promise.all([
    db.select().from(cohorts).orderBy(asc(cohorts.name)),
    db.select({ cohortId: cohortMemberships.cohortId }).from(cohortMemberships),
    db.select({ cohortId: cohortCaseAssignments.cohortId }).from(cohortCaseAssignments),
  ]);
  const memberCounts = new Map<string, number>();
  const assignmentCounts = new Map<string, number>();
  for (const row of memberships) memberCounts.set(row.cohortId, (memberCounts.get(row.cohortId) || 0) + 1);
  for (const row of assignments) assignmentCounts.set(row.cohortId, (assignmentCounts.get(row.cohortId) || 0) + 1);

  return cohortRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    memberCount: memberCounts.get(row.id) || 0,
    assignmentCount: assignmentCounts.get(row.id) || 0,
  }));
}

export async function createCohort(input: { name: string; description?: string | null; actorId: string }) {
  const db = getDb();
  const now = new Date();
  const [cohort] = await db
    .insert(cohorts)
    .values({ name: input.name, description: input.description ?? null, createdBy: input.actorId, createdAt: now, updatedAt: now })
    .returning();
  return cohort;
}

export async function addCohortMember(input: { cohortId: string; studentId: string; actorId: string }) {
  const db = getDb();
  const [[cohort], [student]] = await Promise.all([
    db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.id, input.cohortId)).limit(1),
    db
      .select({ id: users.id, role: users.role, active: users.active })
      .from(users)
      .where(eq(users.id, input.studentId))
      .limit(1),
  ]);
  if (!cohort) return { status: "cohort_not_found" as const };
  if (!student || student.role !== "ogrenci" || !student.active) return { status: "student_not_found" as const };

  const added = await db
    .insert(cohortMemberships)
    .values({ cohortId: input.cohortId, studentId: input.studentId, addedBy: input.actorId })
    .onConflictDoNothing()
    .returning();
  return { status: added.length > 0 ? ("added" as const) : ("already_member" as const) };
}

export async function createCohortCaseAssignment(input: {
  cohortId: string;
  caseId: string;
  caseVersion: string;
  title?: string | null;
  instructions?: string | null;
  dueAt?: Date | null;
  actorId: string;
}) {
  const db = getDb();
  const [cohort] = await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.id, input.cohortId)).limit(1);
  if (!cohort) return null;
  const now = new Date();
  const [assignment] = await db
    .insert(cohortCaseAssignments)
    .values({
      cohortId: input.cohortId,
      caseId: input.caseId,
      caseVersion: input.caseVersion,
      title: input.title ?? null,
      instructions: input.instructions ?? null,
      dueAt: input.dueAt ?? null,
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return assignment;
}

/** Öğrenci yalnızca kendi aktif gruplarından atanmış vaka özetlerini görebilir. */
export async function listAssignmentsForStudent(studentId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: cohortCaseAssignments.id,
      cohortId: cohorts.id,
      cohortName: cohorts.name,
      caseId: cohortCaseAssignments.caseId,
      caseVersion: cohortCaseAssignments.caseVersion,
      title: cohortCaseAssignments.title,
      instructions: cohortCaseAssignments.instructions,
      dueAt: cohortCaseAssignments.dueAt,
      createdAt: cohortCaseAssignments.createdAt,
    })
    .from(cohortMemberships)
    .innerJoin(cohorts, eq(cohortMemberships.cohortId, cohorts.id))
    .innerJoin(cohortCaseAssignments, eq(cohortCaseAssignments.cohortId, cohorts.id))
    .where(and(eq(cohortMemberships.studentId, studentId), eq(cohorts.active, true)))
    .orderBy(asc(cohortCaseAssignments.dueAt), desc(cohortCaseAssignments.createdAt));

  return rows.map((row) => ({
    ...row,
    dueAt: row.dueAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
  }));
}

/** Atamayı yalnızca aktif gruptaki kendi öğrencisi için döndürür. */
export async function getAssignmentForStudent(assignmentId: string, studentId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: cohortCaseAssignments.id,
      caseId: cohortCaseAssignments.caseId,
      caseVersion: cohortCaseAssignments.caseVersion,
    })
    .from(cohortMemberships)
    .innerJoin(cohorts, eq(cohortMemberships.cohortId, cohorts.id))
    .innerJoin(cohortCaseAssignments, eq(cohortCaseAssignments.cohortId, cohorts.id))
    .where(
      and(
        eq(cohortMemberships.studentId, studentId),
        eq(cohorts.active, true),
        eq(cohortCaseAssignments.id, assignmentId)
      )
    )
    .limit(1);
  return row ?? null;
}
