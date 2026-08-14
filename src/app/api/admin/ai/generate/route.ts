export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getCaseById } from "@/lib/admin/store";
import { vakaCevaplariniUret } from "@/lib/ai";
import { getRequestId, logger } from "@/lib/logger";

const encoder = new TextEncoder();

/**
 * AI ile vaka cevaplarını üretir; sonucu SSE (text/event-stream) olarak akıtır.
 *
 * Akış gerekli: reasoning modeli ile tam üretim 100sn'yi aşabildiğinden,
 * eşzamanlı istek Cloudflare (524) ve reverse proxy'lerde zaman aşımına düşer.
 * İlerleme olayları bağlantıyı canlı tutar. Kaydetmez — yönetici sonucu gözden
 * geçirip CDM kaydını kendisi yapar.
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const gonder = (olay: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(olay)}\n\n`));
      };
      // İlk byte'ı hemen gönder — Cloudflare/reverse proxy TTFB zaman aşımını önler.
      gonder({ tip: "basla" });
      // Uzun süren tek grup riskine karşı heartbeat (SSE yorum satırı).
      const kalp = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* akış kapandı */
        }
      }, 15_000);

      try {
        const sonuc = await vakaCevaplariniUret(
          vaka,
          {
            kisilik: body.kisilik === true,
            kisilikTipi: typeof body.kisilikTipi === "string" ? body.kisilikTipi : undefined,
          },
          (ilerleme) => gonder({ tip: "ilerleme", tur: ilerleme.tip, tamamlanan: ilerleme.tamamlanan, toplam: ilerleme.toplam })
        );

        gonder({
          tip: "tamam",
          cevaplar: sonuc.cevaplar,
          rapor: sonuc.rapor,
          basarili: sonuc.basarili,
          debug: sonuc.debug,
        });
      } catch (error) {
        logger.exception("AI cevap üretimi başarısız", error, {
          requestId: getRequestId(req),
          route: "/api/admin/ai/generate",
        });
        gonder({ tip: "hata", mesaj: "AI cevap üretimi başarısız." });
      } finally {
        clearInterval(kalp);
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
