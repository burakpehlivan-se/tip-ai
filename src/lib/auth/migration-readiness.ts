import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type AuthMigrationReadiness = {
  migrationJournal: boolean;
  migrationApplied: boolean;
  usersTable: boolean;
  auditTable: boolean;
  sessionsTable: boolean;
  learningAttemptsTable: boolean;
  cohortsTable: boolean;
  cohortMembershipsTable: boolean;
  cohortAssignmentsTable: boolean;
};

export type AuthReadinessResult =
  | { ok: true; checks: AuthMigrationReadiness }
  | { ok: false; checks: AuthMigrationReadiness };

const unavailable: AuthMigrationReadiness = {
  migrationJournal: false,
  migrationApplied: false,
  usersTable: false,
  auditTable: false,
  sessionsTable: false,
  learningAttemptsTable: false,
  cohortsTable: false,
  cohortMembershipsTable: false,
  cohortAssignmentsTable: false,
};

/** `drizzle/0000`–`0005`; yeni zorunlu şema özelliği eklendiğinde artırılır. */
export const REQUIRED_SCHEMA_MIGRATION_COUNT = 6;

export function isAuthMigrationReady(checks: AuthMigrationReadiness): boolean {
  return (
    checks.migrationJournal &&
    checks.migrationApplied &&
    checks.usersTable &&
    checks.auditTable &&
    checks.sessionsTable &&
    checks.learningAttemptsTable &&
    checks.cohortsTable &&
    checks.cohortMembershipsTable &&
    checks.cohortAssignmentsTable
  );
}

/**
 * Uygulamanın auth + P2 öğrenme özellikleri için ihtiyaç duyduğu migration
 * defteri ve tablolarını kontrol eder. Bağlantı dizesi, hata ayrıntısı veya
 * kullanıcı verisi asla döndürülmez.
 */
export async function checkAuthMigrationReadiness(): Promise<AuthReadinessResult> {
  try {
    const db = getDb();
    const result = await db.execute(sql`
      SELECT
        to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS migration_journal,
        (SELECT COUNT(*) FROM drizzle.__drizzle_migrations) >= ${REQUIRED_SCHEMA_MIGRATION_COUNT} AS migration_applied,
        to_regclass('public.users') IS NOT NULL AS users_table,
        to_regclass('public.auth_audit_logs') IS NOT NULL AS audit_table,
        to_regclass('public.auth_sessions') IS NOT NULL AS sessions_table,
        to_regclass('public.learning_attempts') IS NOT NULL AS learning_attempts_table,
        to_regclass('public.cohorts') IS NOT NULL AS cohorts_table,
        to_regclass('public.cohort_memberships') IS NOT NULL AS cohort_memberships_table,
        to_regclass('public.cohort_case_assignments') IS NOT NULL AS cohort_assignments_table
    `);
    const row = result.rows[0] as
      | {
          migration_journal?: boolean;
          migration_applied?: boolean;
          users_table?: boolean;
          audit_table?: boolean;
          sessions_table?: boolean;
          learning_attempts_table?: boolean;
          cohorts_table?: boolean;
          cohort_memberships_table?: boolean;
          cohort_assignments_table?: boolean;
        }
      | undefined;
    const checks: AuthMigrationReadiness = {
      migrationJournal: row?.migration_journal === true,
      migrationApplied: row?.migration_applied === true,
      usersTable: row?.users_table === true,
      auditTable: row?.audit_table === true,
      sessionsTable: row?.sessions_table === true,
      learningAttemptsTable: row?.learning_attempts_table === true,
      cohortsTable: row?.cohorts_table === true,
      cohortMembershipsTable: row?.cohort_memberships_table === true,
      cohortAssignmentsTable: row?.cohort_assignments_table === true,
    };
    return isAuthMigrationReady(checks) ? { ok: true, checks } : { ok: false, checks };
  } catch {
    return { ok: false, checks: unavailable };
  }
}
