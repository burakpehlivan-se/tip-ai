export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getRuntimeCaseById } from "@/lib/admin/runtime-case-store";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { getAdminRadiologyTestResult, RADIOLOGY_TEST_KEY } from "@/lib/student/radiology-test";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "play");
  if (denied) return denied;
  const { id: rawId } = await params;
  const vaka = await getRuntimeCaseById(decodeURIComponent(rawId));
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  const playable = adminVakaToPlayable(vaka);
  const radiology = await getAdminRadiologyTestResult(vaka.id);
  if (radiology) playable.statikTestler[RADIOLOGY_TEST_KEY] = radiology;
  return NextResponse.json({ vaka: playable });
}
