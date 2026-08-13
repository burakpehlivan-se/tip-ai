/**
 * Postgres destekli kullanıcı deposu.
 *
 * Kod önceliği: süper admin kilidi, son-admin koruması, kullanıcı adı
 * benzersizliği ve aktiflik denetimi JSON deposuyla aynı davranır; kalıcılık
 * artık tamamen PostgreSQL'dedir.
 */

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, type UserRole } from "./schema";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { recordAuthEvent } from "./audit";
import { revokeAuthSessionsForUser } from "./session-store";
import { getAdminCredentials } from "../admin/auth-env";

export type DbUserRow = typeof users.$inferSelect;

export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string | null;
  active: boolean;
  superAdmin: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

export interface StoredUser {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  displayName: string | null;
  superAdmin: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/** Bootstrap kullanıcı adı (env admin, varsayılan: admin). */
export function superAdminUsername(): string {
  try {
    return getAdminCredentials().username;
  } catch {
    return "admin";
  }
}

export function isSuperAdminRow(row: Pick<DbUserRow, "superAdmin" | "username" | "createdBy">): boolean {
  if (row.superAdmin) return true;
  if (row.createdBy === "system" || row.createdBy === "env") {
    return row.username.toLowerCase() === superAdminUsername().toLowerCase();
  }
  return false;
}

function toEpoch(date: Date | null): number | null {
  return date ? date.getTime() : null;
}

export function publicUser(row: DbUserRow): PublicUser {
  const isSuper = isSuperAdminRow(row);
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.displayName,
    active: row.active,
    superAdmin: isSuper,
    createdAt: toEpoch(row.createdAt) ?? 0,
    updatedAt: toEpoch(row.updatedAt) ?? 0,
    createdBy: row.createdBy,
  };
}

/** Süper admin kilidi: rol/aktiflik/silme parse edilmez. */
export function enforceSuperAdminLock(
  row: DbUserRow,
  patch: { role?: UserRole; active?: boolean }
): void {
  const isSuper = isSuperAdminRow(row);
  if (!isSuper) return;
  if (patch.role !== undefined && patch.role !== "admin") {
    throw new Error("Süper admin rolü değiştirilemez.");
  }
  if (patch.active === false) {
    throw new Error("Süper admin pasifleştirilemez.");
  }
}

export async function findUserById(id: string): Promise<DbUserRow | null> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findUserByUsername(username: string): Promise<DbUserRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function listUsersPublic(): Promise<PublicUser[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.username));
  return rows.map(publicUser);
}

async function countActiveAdminsExcluding(id: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)));
  return rows.filter((r) => r.id !== id).length;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  displayName?: string;
  createdBy: string;
}): Promise<DbUserRow> {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,30}$/.test(username)) {
    throw new Error("Kullanıcı adı en az 2 karakter olmalı; yalnızca harf, rakam, nokta ve tire kullanılabilir.");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("Şifre en az 6 karakter olmalı.");
  }
  if (input.role !== "admin" && input.role !== "doktor" && input.role !== "ogrenci") {
    throw new Error("Geçersiz rol (admin | doktor | ogrenci).");
  }

  const db = getDb();
  const existing = await findUserByUsername(username);
  if (existing) throw new Error("Bu kullanıcı adı zaten var.");

  const now = new Date();
  const passwordHash = await hashPassword(input.password);
  const id = digestId();
  const [row] = await db
    .insert(users)
    .values({
      id,
      username,
      email: null,
      passwordHash,
      role: input.role,
      displayName: input.displayName?.trim() || username,
      active: true,
      superAdmin: false,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

/** Self-registration öğrenci hesabı oluşturur. */
export async function registerStudent(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<DbUserRow> {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new Error(
      "Kullanıcı adı 3-30 karakter olmalı; yalnızca harf, rakam, nokta ve tire kullanılabilir."
    );
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("Şifre en az 6 karakter olmalı.");
  }

  const existing = await findUserByUsername(username);
  if (existing) throw new Error("Bu kullanıcı adı zaten kullanılıyor.");

  const db = getDb();
  const now = new Date();
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(users)
    .values({
      id: digestId(),
      username,
      email: null,
      passwordHash,
      role: "ogrenci",
      displayName: input.displayName?.trim() || username,
      active: true,
      superAdmin: false,
      createdBy: "self",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

export async function updateUser(
  id: string,
  patch: {
    role?: UserRole;
    displayName?: string;
    active?: boolean;
    password?: string;
  },
  actor?: { username: string; userId?: string }
): Promise<DbUserRow> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) throw new Error("Kullanıcı bulunamadı.");

  const isSuper = isSuperAdminRow(row);
  enforceSuperAdminLock(row, patch);

  const isSelf =
    actor !== undefined &&
    (actor.userId === row.id || actor.username === undefined || actor.username.toLowerCase() === row.username.toLowerCase());

  // Süper admin şifresi yalnızca kendisi değiştirebilir
  if (isSuper && patch.password && !isSelf) {
    throw new Error("Süper admin şifresini yalnızca kendisi değiştirebilir.");
  }

  const updates: Partial<DbUserRow> = { updatedAt: new Date() };

  if (patch.role !== undefined && !isSuper) {
    if (patch.role !== "admin" && patch.role !== "doktor" && patch.role !== "ogrenci") {
      throw new Error("Geçersiz rol.");
    }
    if (row.role === "admin" && patch.role !== "admin") {
      const otherAdmins = await countActiveAdminsExcluding(row.id);
      if (otherAdmins === 0) {
        throw new Error("Son admin kullanıcının rolü değiştirilemez.");
      }
    }
    updates.role = patch.role;
  }
  if (patch.displayName !== undefined) {
    updates.displayName = patch.displayName;
  }
  if (patch.active !== undefined && !isSuper) {
    if (row.role === "admin" && patch.active === false) {
      const otherAdmins = await countActiveAdminsExcluding(row.id);
      if (otherAdmins === 0) {
        throw new Error("Son admin pasifleştirilemez.");
      }
    }
    updates.active = patch.active;
  }
  if (patch.password) {
    if (patch.password.length < 6) throw new Error("Şifre en az 6 karakter olmalı.");
    updates.passwordHash = await hashPassword(patch.password);
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();

  // Rol değişikliği denetim kaydı
  if (updated.role !== row.role) {
    await recordAuthEvent({
      event: "role_change",
      username: updated.username,
      role: updated.role,
      actor: actor?.username || "system",
      meta: { from: row.role, to: updated.role },
    });
  }

  // İmzalı cookie'ler token süresini beklemesin: kritik hesap değişikliği
  // mevcut PostgreSQL oturumlarını anında geçersizleştirir.
  if (patch.password || updated.role !== row.role || (patch.active === false && row.active)) {
    await revokeAuthSessionsForUser(updated.id);
  }

  return updated;
}

export async function deleteUser(id: string): Promise<void> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) throw new Error("Kullanıcı bulunamadı.");
  if (isSuperAdminRow(row)) throw new Error("Süper admin silinemez.");
  if (row.role === "admin") {
    const otherAdmins = await countActiveAdminsExcluding(row.id);
    if (otherAdmins === 0) throw new Error("Son admin silinemez.");
  }
  await db.delete(users).where(eq(users.id, id));
}

/**
 * Kimlik doğrulama. Şifre doğrulandıysa, eski scrypt hash'i Argon2id'e
 * yükseltilir (rehash-on-login). Aktif olmayan hesaplar her zaman reddedilir.
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ user: DbUserRow } | null> {
  await ensureBootstrapAdmin();
  const row = await findUserByUsername(username);
  if (!row) return null;
  if (!row.active) return null;

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return null;

  if (needsRehash(row.passwordHash)) {
    const db = getDb();
    const newHash = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, row.id));
    row.passwordHash = newHash;
  }

  return { user: row };
}

export async function recordLoginSuccess(
  row: Pick<DbUserRow, "id" | "username" | "role">,
  ip?: string
): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, row.id));
  await recordAuthEvent({
    event: "login_success",
    username: row.username,
    role: row.role,
    actor: row.username,
    ip,
  });
}

/**
 * Env bootstrap süper admin'ini yoksa oluşturur, varsa kilitler.
 * Kimlik doğrulama öncesi bir kez koşulur (memoize).
 */
let bootstrapEnsured = false;

export async function ensureBootstrapAdmin(): Promise<void> {
  if (bootstrapEnsured) return;
  bootstrapEnsured = true;

  let creds: { username: string; password: string };
  try {
    creds = getAdminCredentials();
  } catch {
    bootstrapEnsured = false; // env eksikse tekrar denenebilir
    return;
  }

  const username = creds.username.trim().toLowerCase();
  try {
    const existing = await findUserByUsername(username);
    if (existing) {
      const needs = !existing.superAdmin || existing.role !== "admin" || !existing.active;
      if (needs) {
        const db = getDb();
        await db
          .update(users)
          .set({
            superAdmin: true,
            role: "admin",
            active: true,
            displayName: existing.displayName || "Süper Admin",
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      }
      return;
    }

    const db = getDb();
    const now = new Date();
    const passwordHash = await hashPassword(creds.password);
    await db.insert(users).values({
      id: digestId(),
      username,
      email: null,
      passwordHash,
      role: "admin",
      displayName: "Süper Admin",
      active: true,
      superAdmin: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    bootstrapEnsured = false; // geçici DB hatası sonrası yeniden denenebilir
    throw error;
  }
}

export function resetBootstrapAdminFlagForTests(): void {
  bootstrapEnsured = false;
}

function digestId(): string {
  return randomUUID();
}
