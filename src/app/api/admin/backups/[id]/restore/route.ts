export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { restoreBackup } from "@/lib/admin/store";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  const { requirePermission } = await import("@/lib/admin/permissions");
  const denied = requirePermission(session, "backups.restore");
  if (denied) return denied;

  const result = restoreBackup(params.id, session!.username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
