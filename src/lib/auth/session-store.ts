/** PostgreSQL kullanıcı deposu için sunucu tarafı oturum kaydı ve iptali. */

import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { getDb } from "./db";
import { authSessions, type UserRole } from "./schema";
import { SESSION_ACTIVITY_TOUCH_INTERVAL_MS, sessionPolicyForRole } from "./session-policy";

export function sessionExpiresAt(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}

export async function createAuthSession(input: {
  userId: string;
  role: UserRole;
  ttlMs: number;
  deviceLabel?: string;
}): Promise<{ id: string; expiresAt: Date }> {
  const issuedAt = new Date();
  const expiresAt = sessionExpiresAt(issuedAt, input.ttlMs);
  const id = randomUUID();
  const db = getDb();
  await db.insert(authSessions).values({
    id,
    userId: input.userId,
    role: input.role,
    issuedAt,
    lastSeenAt: issuedAt,
    deviceLabel: input.deviceLabel || null,
    expiresAt,
  });
  return { id, expiresAt };
}

/** Token imzası geçerli olsa bile oturum sunucu tarafında iptal edilmiş olabilir. */
export async function isAuthSessionActive(input: {
  id: string;
  userId: string;
  role: UserRole;
}): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const idleCutoff = new Date(now.getTime() - sessionPolicyForRole(input.role).idleTtlMs);
  const [row] = await db
    .select({ id: authSessions.id, lastSeenAt: authSessions.lastSeenAt })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, input.id),
        eq(authSessions.userId, input.userId),
        eq(authSessions.role, input.role),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
        gt(authSessions.lastSeenAt, idleCutoff)
      )
    )
    .limit(1);
  if (!row) return false;

  // Her API isteği için bir yazma üretmemek adına, etkinlik işaretini en fazla
  // beş dakikada bir güncelleriz. Idle süresi yine DB tarafındaki son değerle
  // doğrulanır; istemci beyanına güvenilmez.
  if (now.getTime() - row.lastSeenAt.getTime() >= SESSION_ACTIVITY_TOUCH_INTERVAL_MS) {
    await db
      .update(authSessions)
      .set({ lastSeenAt: now })
      .where(and(eq(authSessions.id, input.id), isNull(authSessions.revokedAt)));
  }
  return true;
}

export async function revokeAuthSession(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)));
}

/** Kullanıcı yalnızca kendi oturum kimliğini hedefleyebilsin diye sahiplik sorguda zorunludur. */
export async function revokeAuthSessionForUser(input: {
  id: string;
  userId: string;
}): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.id, input.id), eq(authSessions.userId, input.userId), isNull(authSessions.revokedAt)))
    .returning();
  return rows.length === 1;
}

/** Parola/rol/aktiflik değişiminde tüm aktif oturumlar tek seferde geçersiz olur. */
export async function revokeAuthSessionsForUser(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

export type ActiveAuthSession = {
  id: string;
  role: UserRole;
  issuedAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  deviceLabel: string | null;
};

/** Süresi veya rolün idle penceresi geçmiş kayıtları aktif cihaz olarak dönmez. */
export async function listActiveAuthSessionsForUser(userId: string): Promise<ActiveAuthSession[]> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: authSessions.id,
      role: authSessions.role,
      issuedAt: authSessions.issuedAt,
      lastSeenAt: authSessions.lastSeenAt,
      expiresAt: authSessions.expiresAt,
      deviceLabel: authSessions.deviceLabel,
    })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, now)))
    .orderBy(desc(authSessions.lastSeenAt));

  return rows.filter((row) => row.lastSeenAt.getTime() > now.getTime() - sessionPolicyForRole(row.role).idleTtlMs);
}

/** Tüm cihazlardan çıkış için mevcut oturum da dahil aktif kayıtları iptal eder. */
export async function revokeAllAuthSessionsForUser(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
    .returning();
  return rows.length;
}

/** İleride "diğer cihazlardan çıkış" akışı için ayrı, sahiplik korumalı yardımcı. */
export async function revokeOtherAuthSessionsForUser(input: {
  userId: string;
  currentSessionId: string;
}): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authSessions.userId, input.userId),
        ne(authSessions.id, input.currentSessionId),
        isNull(authSessions.revokedAt)
      )
    )
    .returning();
  return rows.length;
}
