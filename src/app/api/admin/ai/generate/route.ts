export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getCaseById } from "@/lib/admin/store";
import { vakaCevaplariniUret } from "@/lib/ai";
import { getRequestId, logger } from "@/lib/logger";

/**
 * AI ile vaka cevaplarını üretir. Kaydetmez — yönetici üretilen yanıtları
 * gözden geçirip CDM kaydını kendisi yapar (klinik içerik incelemesi korunur).
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" && body.id ? body.id : null;
  if (!id) return NextResponse.json({ error: "Vaka kimliği gerekli." }, { status: 400 });

  const vaka = getCaseById(id);
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    const sonuc = await vakaCevaplariniUret(vaka, {
      kisilik: body.kisilik === true,
      kisilikTipi: typeof body.kisilikTipi === "string" ? body.kisilikTipi : undefined,
    });

    return NextResponse.json({
      cevaplar: sonuc.cevaplar,
      rapor: sonuc.rapor,
      basarili: sonuc.basarili,
    });
  } catch (error) {
    logger.exception("AI cevap üretimi başarısız", error, {
      requestId: getRequestId(req),
      route: "/api/admin/ai/generate",
    });
    return NextResponse.json({ error: "AI cevap üretimi başarısız." }, { status: 500 });
  }
}
