export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getCaseById, recordPlaySession } from "@/lib/admin/store";
import { getRequestId, logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "play");
  if (denied) return denied;

  try {
    const body = await req.json();
    const caseId = String(body.caseId || "");
    const vaka = getCaseById(caseId);
    if (!vaka) return NextResponse.json({ error: "Vaka yok" }, { status: 404 });

    const ps = recordPlaySession(
      {
        caseId,
        hastalikKey: vaka.hastalikKey,
        poliklinikKey: vaka.poliklinikKey,
        actor: session!.username,
        mode: body.mode === "ogrenci" ? "ogrenci" : "admin-debug",
        toplamPuan: Number(body.toplamPuan) || 0,
        maxPuan: Number(body.maxPuan) || 0,
        taniDogru: !!body.taniDogru,
        atlananRedFlagler: body.atlananRedFlagler || [],
        gereksizTestler: body.gereksizTestler || [],
        eksikSorular: body.eksikSorular || [],
        eksikTestler: body.eksikTestler || [],
        anamnezCoverage: body.anamnezCoverage,
      },
      session!.username
    );
    return NextResponse.json({ ok: true, session: ps });
  } catch (error) {
    logger.exception("Yönetici oyun oturumu kaydedilemedi", error, {
      requestId: getRequestId(req),
      route: "/api/admin/play-session",
    });
    return NextResponse.json({ error: "Kayıt başarısız" }, { status: 500 });
  }
}
