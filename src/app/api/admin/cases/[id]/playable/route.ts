export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getCaseById } from "@/lib/admin/store";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "play");
  if (denied) return denied;
  const { id: rawId } = await params;
  const vaka = getCaseById(decodeURIComponent(rawId));
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  return NextResponse.json({ vaka: adminVakaToPlayable(vaka) });
}
