import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type AuthMigrationReadiness = {
  migrationJournal: boolean;
  migrationApplied: boolean;
  usersTable: boolean;
  auditTable: boolean;
  sessionsTable: boolean;
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
};

export function isAuthMigrationReady(checks: AuthMigrationReadiness): boolean {
  return (
    checks.migrationJournal &&
    checks.migrationApplied &&
    checks.usersTable &&
    checks.auditTable &&
    checks.sessionsTable
  );
}

/**
 * Uygulamanın ihtiyaç duyduğu migration defteri ve auth tablolarını kontrol eder.
 * Bağlantı dizesi, hata ayrıntısı veya kullanıcı verisi asla döndürülmez.
 */
export async function checkAuthMigrationReadiness(): Promise<AuthReadinessResult> {
  try {
    const db = getDb();
    const result = await db.execute(sql`
      SELECT
        to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS migration_journal,
        EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations) AS migration_applied,
        to_regclass('public.users') IS NOT NULL AS users_table,
        to_regclass('public.auth_audit_logs') IS NOT NULL AS audit_table,
        to_regclass('public.auth_sessions') IS NOT NULL AS sessions_table
    `);
    const row = result.rows[0] as
      | {
          migration_journal?: boolean;
          migration_applied?: boolean;
          users_table?: boolean;
          audit_table?: boolean;
          sessions_table?: boolean;
        }
      | undefined;
    const checks: AuthMigrationReadiness = {
      migrationJournal: row?.migration_journal === true,
      migrationApplied: row?.migration_applied === true,
      usersTable: row?.users_table === true,
      auditTable: row?.audit_table === true,
      sessionsTable: row?.sessions_table === true,
    };
    return isAuthMigrationReady(checks) ? { ok: true, checks } : { ok: false, checks };
  } catch {
    return { ok: false, checks: unavailable };
  }
}
