export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getRequestId, logger } from "@/lib/logger";
import { toggleStaticQuestion } from "@/lib/admin/questions-store";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const aksiyon = String(body?.aksiyon || "").trim().toUpperCase();
    const disabled = Boolean(body?.disabled);
    if (!aksiyon || !/^[A-Z0-9_]{2,40}$/.test(aksiyon)) {
      return NextResponse.json({ error: "Geçersiz aksiyon." }, { status: 400 });
    }
    await toggleStaticQuestion(aksiyon, disabled);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.exception("Statik soru toggle hatası", error, {
      requestId: getRequestId(req),
      route: "/api/admin/questions/toggle",
    });
    return NextResponse.json({ error: "İşlem başarısız." }, { status: 500 });
  }
}
