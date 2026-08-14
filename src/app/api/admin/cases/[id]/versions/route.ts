export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  getRuntimeCaseById,
  listRuntimePublishedCaseVersions,
} from "@/lib/admin/runtime-case-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  if (!(await getRuntimeCaseById(id))) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  // Tam klinik gövde yerine yalnızca yönetim geçmişi döner; büyük içerik on-demand
  // endpoint'e taşınana kadar API ve log yüzeyi gereksiz büyümez.
  const versions = (await listRuntimePublishedCaseVersions(id)).map(({ content, ...version }) => ({
    ...version,
    clinicalSource: content.klinikKaynak || null,
    sourceDate: content.klinikKaynakTarihi || null,
    learningObjectiveCount: content.egitimHedefleri?.length || 0,
  }));
  return NextResponse.json({ versions });
}
