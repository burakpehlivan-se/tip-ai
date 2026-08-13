/**
 * Runtime kimlik deposu sınırı.
 *
 * Varsayılan JSON deposudur. PostgreSQL yalnızca `AUTH_USER_STORE=postgres`
 * ile, shadow-read parity gözlemi tamamlandıktan sonra seçilir. Tüm çağrılar
 * async'tir; böylece bir oturumun doğrulaması ve kullanıcı yönetimi aynı
 * depoyu kullanır. Bu katman çift yazma yapmaz.
 */

import type { AdminRole, AdminUser } from "@/lib/admin/types";
import * as jsonUsers from "@/lib/admin/users";
import { appendLog } from "@/lib/admin/store";
import { logger } from "@/lib/logger";
import * as postgresUsers from "./user-store";

export type AuthUserStoreMode = "json" | "postgres";

export function authUserStoreMode(value = process.env.AUTH_USER_STORE): AuthUserStoreMode {
  if (value === undefined || value === "" || value === "json") return "json";
  if (value === "postgres") return "postgres";
  throw new Error("AUTH_USER_STORE yalnızca json veya postgres olabilir.");
}

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
  if (authUserStoreMode() === "json") return jsonUsers.findUserById(id);
  const row = await postgresUsers.findUserById(id);
  return row ? fromPostgres(row) : undefined;
}

/** JSON deposundaki davranışla uyumlu olarak pasif kayıtlar görünmez. */
export async function findUserByUsername(username: string): Promise<AdminUser | undefined> {
  if (authUserStoreMode() === "json") return jsonUsers.findUserByUsername(username);
  const row = await postgresUsers.findUserByUsername(username);
  return row?.active ? fromPostgres(row) : undefined;
}

export async function listUsersPublic() {
  if (authUserStoreMode() === "json") return jsonUsers.listUsersPublic();
  return postgresUsers.listUsersPublic();
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<{ user: AdminUser } | null> {
  if (authUserStoreMode() === "json") return jsonUsers.authenticateUser(username, password);
  const result = await postgresUsers.authenticateUser(username, password);
  return result ? { user: fromPostgres(result.user) } : null;
}

/**
 * Başarılı girişlerin tek kayıt noktası. JSON modunda panel audit günlüğüne,
 * PostgreSQL modunda ise kimlik denetim tablosuna yazılır. Denetim kaydı
 * arızası kullanıcının girişini engellemez.
 */
export async function recordSuccessfulLogin(
  user: Pick<AdminUser, "id" | "username" | "role">
): Promise<void> {
  try {
    if (authUserStoreMode() === "json") {
      appendLog({
        action: "user_login",
        actor: user.username,
        message: "Başarılı kullanıcı girişi",
        metadata: { role: user.role },
        patches: [],
      });
      return;
    }
    await postgresUsers.recordLoginSuccess(user);
  } catch {
    logger.warn("Başarılı giriş denetim kaydı yazılamadı", {
      store: authUserStoreMode(),
    });
  }
}

export async function createUser(input: {
  username: string;
  password: string;
  role: AdminRole;
  displayName?: string;
  createdBy: string;
}): Promise<AdminUser> {
  if (authUserStoreMode() === "json") return jsonUsers.createUser(input);
  return fromPostgres(await postgresUsers.createUser(input));
}

export async function registerStudent(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<AdminUser> {
  if (authUserStoreMode() === "json") return jsonUsers.registerStudent(input);
  return fromPostgres(await postgresUsers.registerStudent(input));
}

export async function updateUser(
  id: string,
  patch: { role?: AdminRole; displayName?: string; active?: boolean; password?: string },
  actor?: { username: string; userId?: string }
): Promise<AdminUser> {
  if (authUserStoreMode() === "json") return jsonUsers.updateUser(id, patch, actor);
  return fromPostgres(await postgresUsers.updateUser(id, patch, actor));
}

export async function deleteUser(id: string): Promise<void> {
  if (authUserStoreMode() === "json") {
    jsonUsers.deleteUser(id);
    return;
  }
  await postgresUsers.deleteUser(id);
}
