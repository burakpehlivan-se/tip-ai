export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadLogsStore } from "@/lib/admin/store";
import { listRecentLoginEvents } from "@/lib/auth/audit";
import { storeMode } from "@/lib/store-mode";
import type { AdminRole, AuditLog } from "@/lib/admin/types";

const ROLES: AdminRole[] = ["admin", "doktor", "ogrenci"];

function safeRole(value: unknown): AdminRole | null {
  return typeof value === "string" && ROLES.includes(value as AdminRole)
    ? (value as AdminRole)
    : null;
}

function jsonRecentLogins(limit: number) {
  return loadLogsStore().logs
    .filter((log) => log.action === "user_login" || log.action === "student_login")
    .slice(0, limit)
    .map((log: AuditLog) => ({
      id: log.id,
      username: log.actor,
      role: safeRole(log.metadata?.role) || (log.action === "student_login" ? "ogrenci" : null),
      createdAt: log.timestamp,
    }));
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  const rawLimit = Number(req.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 20;

  if (storeMode() === "json") {
    return NextResponse.json({ logins: jsonRecentLogins(limit) });
  }

  try {
    const logins = await listRecentLoginEvents(limit);
    return NextResponse.json({
      logins: logins.map((login) => ({
        id: login.id,
        username: login.username,
        role: safeRole(login.role),
        createdAt: login.createdAt.getTime(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Son girişler yüklenemedi." }, { status: 503 });
  }
}
