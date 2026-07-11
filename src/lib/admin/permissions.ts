/**
 * Rol tabanlı yetki
 * - admin: her şey
 * - doktor: vaka düzenleme + onay (uzmanOnayi), oynama, doğrulama okuma
 */

import { AdminRole, AdminSessionPayload } from "./types";
import { NextResponse } from "next/server";

export type Permission =
  | "panel.access"
  | "cases.read"
  | "cases.write"
  | "cases.approve"
  | "cases.export"
  | "cases.import"
  | "cases.validate"
  | "feedback.write"
  | "play"
  | "analytics.read"
  | "settings.read"
  | "settings.write"
  | "logs.read"
  | "logs.undo"
  | "backups.read"
  | "backups.restore"
  | "users.manage"
  | "system.migrate";

const DOKTOR_PERMS: Permission[] = [
  "panel.access",
  "cases.read",
  "cases.write",
  "cases.approve",
  "cases.export",
  "cases.validate",
  "feedback.write",
  "play",
];

const ADMIN_PERMS: Permission[] = [
  ...DOKTOR_PERMS,
  "cases.import",
  "analytics.read",
  "settings.read",
  "settings.write",
  "logs.read",
  "logs.undo",
  "backups.read",
  "backups.restore",
  "users.manage",
  "system.migrate",
];

export function permissionsForRole(role: AdminRole): Set<Permission> {
  if (role === "admin") return new Set(ADMIN_PERMS);
  return new Set(DOKTOR_PERMS);
}

export function hasPermission(
  session: AdminSessionPayload | null | undefined,
  perm: Permission
): boolean {
  if (!session?.role) return false;
  return permissionsForRole(session.role).has(perm);
}

export function requirePermission(
  session: AdminSessionPayload | null,
  perm: Permission
): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (!hasPermission(session, perm)) {
    return NextResponse.json(
      {
        error: "Bu işlem için yetkiniz yok.",
        required: perm,
        role: session.role,
      },
      { status: 403 }
    );
  }
  return null;
}

/** UI nav filtreleme */
export function navAllowedForRole(role: AdminRole, href: string): boolean {
  const perms = permissionsForRole(role);
  if (href === "/admin/panel") return perms.has("panel.access");
  if (href.startsWith("/admin/panel/vakalar")) return perms.has("cases.read");
  if (href.startsWith("/admin/panel/dogrulama")) return perms.has("cases.validate");
  if (href.startsWith("/admin/panel/analitik")) return perms.has("analytics.read");
  if (href.startsWith("/admin/panel/ayarlar")) return perms.has("settings.read");
  if (href.startsWith("/admin/panel/logs")) return perms.has("logs.read");
  if (href.startsWith("/admin/panel/kural-motoru")) return perms.has("system.migrate");
  if (href.startsWith("/admin/panel/yedekler")) return perms.has("backups.read");
  if (href.startsWith("/admin/panel/kullanicilar")) return perms.has("users.manage");
  if (href.includes("/oyna/")) return perms.has("play");
  return role === "admin";
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Admin",
  doktor: "Doktor",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  admin: "Tüm panel, kullanıcılar, ayarlar, yedekler, loglar",
  doktor: "Vaka düzenleme, onaylama, oynama ve doğrulama",
};
