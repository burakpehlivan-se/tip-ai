export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { restoreBackup } from "@/lib/admin/store";
import { caseStoreMode } from "@/lib/admin/postgres-case-store-mode";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "backups.restore");
  if (denied) return denied;
  if (caseStoreMode() === "postgres") {
    return NextResponse.json(
      { error: "PostgreSQL vaka kaynağında JSON yedeği geri yüklenemez." },
      { status: 409 }
    );
  }

  const { id } = await params;
  const result = await restoreBackup(id, session!.username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
