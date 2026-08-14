export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getCaseById, loadHastaTipleriStore } from "@/lib/admin/store";
import { vakaCevaplariniUret } from "@/lib/ai";
import { getRequestId, logger } from "@/lib/logger";

const encoder = new TextEncoder();

/**
 * AI ile vaka cevaplarını üretir; sonucu SSE (text/event-stream) olarak akıtır.
 *
 * - tipIds boşsa: tek koşu (geriye dönük — kisilik/kisilikTipi ile).
 * - tipIds doluysa: her hasta tipi için sırayla (ard arda) ayrı ayrı üretir.
 *
 * Akış gerekli: reasoning modeli ile tam üretim 100sn'yi aşabildiğinden,
 * eşzamanlı istek Cloudflare (524) ve reverse proxy'lerde zaman aşımına düşer.
 * Kaydetmez — yönetici sonucu gözden geçirip CDM kaydını kendisi yapar.
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

  const rawTipIds: unknown[] = Array.isArray(body?.tipIds) ? body.tipIds : [];
  const tipIdList: string[] = rawTipIds.filter((t): t is string => typeof t === "string" && t.length > 0);
  const tipler = tipIdList
    .map((tid) => loadHastaTipleriStore().tipler.find((t) => t.id === tid))
    .filter((t) => t !== undefined);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const gonder = (olay: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(olay)}\n\n`));
      };
      gonder({ tip: "basla" });
      const kalp = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* akış kapandı */
        }
      }, 15_000);

      try {
        if (tipler.length === 0) {
          // Tek koşu (eski davranış) — hasta tipi yok
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
        } else {
          // Çoklu hasta tipi: ard arda, her biri ayrı çıktı
          for (const tip of tipler) {
            gonder({ tip: "tip-basla", tipId: tip.id, tipAd: tip.ad });
            const sonuc = await vakaCevaplariniUret(
              vaka,
              { hastaTipi: tip },
              (ilerleme) =>
                gonder({ tip: "ilerleme", tur: ilerleme.tip, tamamlanan: ilerleme.tamamlanan, toplam: ilerleme.toplam })
            );
            gonder({
              tip: "tip-tamam",
              tipId: tip.id,
              tipAd: tip.ad,
              cevaplar: sonuc.cevaplar,
              rapor: sonuc.rapor,
              basarili: sonuc.basarili,
              debug: sonuc.debug,
            });
          }
          gonder({ tip: "bitti" });
        }
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
