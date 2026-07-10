export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { createBackup, loadBackupsIndex, loadCasesStore } from "@/lib/admin/store";

import { requirePermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "backups.read");
  if (denied) return denied;

  const index = loadBackupsIndex();
  const store = loadCasesStore();
  return NextResponse.json({
    backups: index.backups,
    changeCount: store.changeCount,
    nextAutoAt: store.changeCount > 0 ? Math.ceil(store.changeCount / 10) * 10 : 10,
  });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "backups.restore");
  if (denied) return denied;

  const meta = createBackup("manual", session!.username);
  return NextResponse.json({ ok: true, backup: meta });
}
