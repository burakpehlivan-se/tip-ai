export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getRequestId, logger } from "@/lib/logger";
import { toggleStaticQuestion, updateStaticQuestion } from "@/lib/admin/questions-store";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const aksiyon = String(body?.aksiyon || "").trim().toUpperCase();
    if (!aksiyon || !/^[A-Z0-9_]{2,40}$/.test(aksiyon)) {
      return NextResponse.json({ error: "Geçersiz aksiyon." }, { status: 400 });
    }
    // Etiket/kategori güncellemesi varsa önce uygula (varsa)
    if (body?.etiket !== undefined || body?.kategori !== undefined) {
      const patch: Record<string, unknown> = {};
      if (body.etiket !== undefined) patch.etiket = String(body.etiket);
      if (body.kategori !== undefined) patch.kategori = String(body.kategori);
      await updateStaticQuestion(aksiyon, patch as never);
    }
    // disabled alanı verilmişse toggle uygula
    if (body?.disabled !== undefined) {
      await toggleStaticQuestion(aksiyon, Boolean(body.disabled));
    } else if (body?.etiket === undefined && body?.kategori === undefined) {
      // Sadece aksiyon verilmişse varsayılan toggle davranışı (geriye dönük uyum)
      await toggleStaticQuestion(aksiyon, true);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "İşlem başarısız.";
    logger.exception("Statik soru toggle hatası", error, {
      requestId: getRequestId(req),
      route: "/api/admin/questions/toggle",
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
