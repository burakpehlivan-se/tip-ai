/**
 * Kimlik olaylarının denetim (audit) kaydı — Postgres `auth_audit_logs`.
 *
 * Yalnızca şifre/erişim olayı meta verileri tutulur: kullanıcı adı, rol,
 * işlemi yapan, kaynak IP ve olay tipi. Hasta/sağlık verisi ve özet (hash)
 * asla bu tabloya yazılmaz; şifre hash'leri loglara ve audit'e düşmez.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getDb } from "./db";
import { authAuditLogs } from "./schema";

export type AuthEvent =
  | "login_failed"
  | "login_success"
  | "logout"
  | "register_student"
  | "role_change"
  | "account_deactivated"
  | "account_activated"
  | "user_created"
  | "user_deleted"
  | "session_revoked"
  | "sessions_revoked_all"
  | "student_data_exported"
  | "student_privacy_request_submitted"
  | "student_privacy_request_resolved"
  | "admin_diagnostics_viewed";

export interface RecordAuthEventInput {
  event: AuthEvent;
  username: string;
  role?: string;
  actor?: string;
  ip?: string;
  meta?: Record<string, unknown>;
}

/** Denetim kaydını yazar; başarısızlıkta uygulama akışını kırmaz. */
export async function recordAuthEvent(input: RecordAuthEventInput): Promise<boolean> {
  try {
    const db = getDb();
    await db.insert(authAuditLogs).values({
      event: input.event,
      username: input.username,
      role: input.role ?? null,
      actor: input.actor ?? null,
      ip: input.ip ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
    return true;
  } catch (error) {
    // Denetim kaydı başarısız olsa bile ana istek akışı devam eder.
    logger.exception("Kimlik denetim kaydı yazılamadı", error, { event: input.event });
    return false;
  }
}

/** Belirli denetim olaylarını, en az gerekli alanlarla döndürür. */
export async function listAuthEventsByType(
  events: readonly AuthEvent[],
  options: { username?: string; limit?: number } = {}
): Promise<
  Array<{
    id: string;
    event: string;
    username: string;
    role: string | null;
    actor: string | null;
    meta: unknown;
    createdAt: Date;
  }>
> {
  if (events.length === 0) return [];
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 100), 1), 500);
  const condition = options.username
    ? and(inArray(authAuditLogs.event, [...events]), eq(authAuditLogs.username, options.username))
    : inArray(authAuditLogs.event, [...events]);
  const rows = await getDb()
    .select({
      id: authAuditLogs.id,
      event: authAuditLogs.event,
      username: authAuditLogs.username,
      role: authAuditLogs.role,
      actor: authAuditLogs.actor,
      meta: authAuditLogs.meta,
      createdAt: authAuditLogs.createdAt,
    })
    .from(authAuditLogs)
    .where(condition)
    .orderBy(desc(authAuditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, meta: row.meta === null ? null : safeParseMeta(row.meta) }));
}

/** Son N denetim kaydını döndürür (yönetim paneli gösterimi için). */
export async function listRecentAuthEvents(
  limit = 100
): Promise<
  Array<{
    id: string;
    event: string;
    username: string;
    role: string | null;
    actor: string | null;
    ip: string | null;
    meta: unknown;
    createdAt: Date;
  }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: authAuditLogs.id,
      event: authAuditLogs.event,
      username: authAuditLogs.username,
      role: authAuditLogs.role,
      actor: authAuditLogs.actor,
      ip: authAuditLogs.ip,
      meta: authAuditLogs.meta,
      createdAt: authAuditLogs.createdAt,
    })
    .from(authAuditLogs)
    .orderBy(desc(authAuditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    meta: row.meta === null ? null : safeParseMeta(row.meta),
  }));
}

/** Yönetici görünümünde gösterilecek son başarılı girişler. */
export async function listRecentLoginEvents(
  limit = 20
): Promise<Array<{ id: string; username: string; role: string | null; createdAt: Date }>> {
  const db = getDb();
  return db
    .select({
      id: authAuditLogs.id,
      username: authAuditLogs.username,
      role: authAuditLogs.role,
      createdAt: authAuditLogs.createdAt,
    })
    .from(authAuditLogs)
    .where(eq(authAuditLogs.event, "login_success"))
    .orderBy(desc(authAuditLogs.createdAt))
    .limit(limit);
}

function safeParseMeta(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
