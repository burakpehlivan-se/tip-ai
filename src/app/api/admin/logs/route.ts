export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadLogsStore } from "@/lib/admin/store";

import { requirePermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "logs.read");
  if (denied) return denied;

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 200), 1000);
  const store = loadLogsStore();
  return NextResponse.json({
    logs: store.logs.slice(0, limit),
    total: store.logs.length,
  });
}
