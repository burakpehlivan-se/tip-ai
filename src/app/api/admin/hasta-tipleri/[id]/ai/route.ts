export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getHastaTipiById } from "@/lib/admin/store";
import { hastaTipiOrnekCevaplariniUret } from "@/lib/ai";
import { getRequestId, logger } from "@/lib/logger";

const encoder = new TextEncoder();

/**
 * Hasta tipi için AI ile örnek hasta cevapları üretir; SSE olarak akıtır.
 * Kaydetmez — yönetici sonucu gözden geçirip kaydeder.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const tip = getHastaTipiById(id);
  if (!tip) return NextResponse.json({ error: "Hasta tipi bulunamadı." }, { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const gonder = (olay: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(olay)}\n\n`));
      };
      gonder({ tip: "basla" });
      try {
        const sonuc = await hastaTipiOrnekCevaplariniUret(tip);
        gonder({
          tip: "tamam",
          cevaplar: sonuc.cevaplar,
          rapor: sonuc.rapor,
          basarili: sonuc.basarili,
          debug: sonuc.debug,
        });
      } catch (error) {
        logger.exception("Hasta tipi örnek cevap üretimi başarısız", error, {
          requestId: getRequestId(req),
          route: "/api/admin/hasta-tipleri/[id]/ai",
        });
        gonder({ tip: "hata", mesaj: "Örnek cevap üretimi başarısız." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
