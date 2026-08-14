export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";
import { getRequestId, logger } from "@/lib/logger";

/**
 * Public vaka kataloğu. Cevap anahtarı, test sonuçları, rubrik ve ideal yol
 * yalnızca sunucu tarafında tutulur; bu uç yalnızca listeleme metadatası döner.
 */
export async function GET(req: NextRequest) {
  try {
    const store = await loadRuntimeCasesStore();
    // Öğrenciye yalnızca aktif + (isteğe bağlı) onaylı taslak olmayan vakalar
    const templates = store.cases
      .filter((c) => (c.durum || "aktif") === "aktif")
      .map((c) => ({
      id: c.id,
      poliklinikKey: c.poliklinikKey,
      poliklinikAd: c.poliklinikAd,
      poliklinikIcon: c.poliklinikIcon,
      poliklinikAciklama: c.poliklinikAciklama,
      hastalikKey: c.hastalikKey,
      hastalikAdi: c.hastalikAdi,
      seviye: c.seviye,
      yasAraligi: c.yasAraligi,
      cinsiyetTercih: c.cinsiyetTercih,
      etiketler: c.etiketler || [],
      durum: c.durum || "aktif",
      updatedAt: c.updatedAt,
    }));
    return NextResponse.json({
      templates,
      updatedAt: store.updatedAt,
      total: templates.length,
    });
  } catch (e) {
    logger.exception("Vaka şablonları yüklenemedi", e, {
      requestId: getRequestId(req),
      route: "/api/cases/templates",
    });
    return NextResponse.json({ error: "Şablonlar yüklenemedi", templates: [] }, { status: 500 });
  }
}
