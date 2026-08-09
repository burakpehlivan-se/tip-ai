export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { addFeedback, getCaseById, listFeedbacks } from "@/lib/admin/store";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "feedback.write");
  if (denied) return denied;

  const caseId = req.nextUrl.searchParams.get("caseId") || undefined;
  const feedbacks = listFeedbacks(caseId || undefined);
  return NextResponse.json({ feedbacks, total: feedbacks.length });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "feedback.write");
  if (denied) return denied;

  try {
    const body = await req.json();
    const caseId = String(body.caseId || "").trim();
    const metin = String(body.metin || "").trim();
    if (!caseId || !metin) {
      return NextResponse.json({ error: "caseId ve metin zorunlu." }, { status: 400 });
    }
    const vaka = getCaseById(caseId);
    if (!vaka) {
      return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
    }

    const fb = addFeedback(
      {
        caseId,
        hastalikKey: vaka.hastalikKey,
        poliklinikKey: vaka.poliklinikKey,
        actor: session!.username,
        metin,
        vakaSnapshot: body.vakaSnapshot || {
          hastalikAdi: vaka.hastalikAdi,
          anaSikayet: vaka.anaSikayet,
          seviye: vaka.seviye,
          testKeys: Object.keys(vaka.statikTestler || {}),
          beklenenTani: vaka.rubric?.kabulEdilenTani || [],
          debugNotlar: body.debugNotlar,
        },
        debugPuan: body.debugPuan,
      },
      session!.username
    );

    return NextResponse.json({ ok: true, feedback: fb });
  } catch (error) {
    logger.exception("Geri bildirim kaydedilemedi", error, {
      requestId: getRequestId(req),
      route: "/api/admin/feedback",
    });
    return NextResponse.json({ error: "Feedback kaydedilemedi." }, { status: 500 });
  }
}
