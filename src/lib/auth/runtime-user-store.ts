/**
 * Runtime kimlik deposu — üretimde PostgreSQL, testte JSON (tmpDir izolasyonu).
 */

import type { AdminRole, AdminUser } from "@/lib/admin/types";
import * as jsonUsers from "@/lib/admin/users";
import { logger } from "@/lib/logger";
import * as postgresUsers from "./user-store";
import { storeMode } from "@/lib/store-mode";

function fromPostgres(row: postgresUsers.DbUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role,
    displayName: row.displayName || undefined,
    active: row.active,
    superAdmin: postgresUsers.isSuperAdminRow(row),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    createdBy: row.createdBy || undefined,
  };
}

function isPostgresStore(): boolean {
  return storeMode() === "postgres";
}

export function publicUser(user: AdminUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    superAdmin: jsonUsers.isSuperAdminUser(user),
    displayName: user.displayName,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy,
  };
}

export async function findUserById(id: string): Promise<AdminUser | undefined> {
  if (!isPostgresStore()) return jsonUsers.findUserById(id);
  const row = await postgresUsers.findUserById(id);
  return row ? fromPostgres(row) : undefined;
}

export async function findUserByUsername(username: string): Promise<AdminUser | undefined> {
  if (!isPostgresStore()) {
    const u = jsonUsers.findUserByUsername(username);
    return u?.active ? u : undefined;
  }
  const row = await postgresUsers.findUserByUsername(username);
  return row?.active ? fromPostgres(row) : undefined;
}

export async function listUsersPublic() {
  if (!isPostgresStore()) return jsonUsers.listUsersPublic().map((u) => ({ ...u, superAdmin: jsonUsers.isSuperAdminUser(u as AdminUser) }));
  return postgresUsers.listUsersPublic();
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<{ user: AdminUser } | null> {
  if (!isPostgresStore()) {
    return jsonUsers.authenticateUser(username, password);
  }
  const result = await postgresUsers.authenticateUser(username, password);
  return result ? { user: fromPostgres(result.user) } : null;
}

export async function recordSuccessfulLogin(
  user: Pick<AdminUser, "id" | "username" | "role">
): Promise<void> {
  if (!isPostgresStore()) {
    return;
  }
  try {
    await postgresUsers.recordLoginSuccess(user);
  } catch {
    logger.warn("Başarılı giriş denetim kaydı yazılamadı", { store: "postgres" });
  }
}

export async function createUser(input: {
  username: string;
  password: string;
  role: AdminRole;
  displayName?: string;
  createdBy: string;
}): Promise<AdminUser> {
  if (!isPostgresStore()) return jsonUsers.createUser(input);
  return fromPostgres(await postgresUsers.createUser(input));
}

export async function registerStudent(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<AdminUser> {
  if (!isPostgresStore()) return jsonUsers.registerStudent(input);
  return fromPostgres(await postgresUsers.registerStudent(input));
}

export async function updateUser(
  id: string,
  patch: { role?: AdminRole; displayName?: string; active?: boolean; password?: string },
  actor?: { username: string; userId?: string }
): Promise<AdminUser> {
  if (!isPostgresStore()) return jsonUsers.updateUser(id, patch, actor as never);
  return fromPostgres(await postgresUsers.updateUser(id, patch, actor));
}

export async function deleteUser(id: string): Promise<void> {
  if (!isPostgresStore()) return jsonUsers.deleteUser(id);
  await postgresUsers.deleteUser(id);
}
