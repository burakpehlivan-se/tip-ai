export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { listRecentLoginEvents } from "@/lib/auth/audit";
import { getRequestId, logger } from "@/lib/logger";
import type { AdminRole } from "@/lib/admin/types";

const ROLES: AdminRole[] = ["admin", "doktor", "ogrenci"];

function safeRole(value: unknown): AdminRole | null {
  return typeof value === "string" && ROLES.includes(value as AdminRole)
    ? (value as AdminRole)
    : null;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  const rawLimit = Number(req.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 20;

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
  } catch (error) {
    logger.warn("Son giriş kayıtları okunamadı", {
      requestId: getRequestId(req),
      route: "/api/admin/users/recent-logins",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Son girişler yüklenemedi." }, { status: 503 });
  }
}
