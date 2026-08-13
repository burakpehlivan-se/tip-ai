/** PostgreSQL kullanıcı deposu için sunucu tarafı oturum kaydı ve iptali. */

import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { authSessions, type UserRole } from "./schema";

export function sessionExpiresAt(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}

export async function createAuthSession(input: {
  userId: string;
  role: UserRole;
  ttlMs: number;
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
  const [row] = await db
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, input.id),
        eq(authSessions.userId, input.userId),
        eq(authSessions.role, input.role),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function revokeAuthSession(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)));
}

/** Parola/rol/aktiflik değişiminde tüm aktif oturumlar tek seferde geçersiz olur. */
export async function revokeAuthSessionsForUser(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}
