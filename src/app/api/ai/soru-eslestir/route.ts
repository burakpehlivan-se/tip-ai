export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/admin/store";
import { deepseekYapilandirilmisMi } from "@/lib/ai/deepseek";
import { serbestMetinEslestir } from "@/lib/ai";
import { getRequestId, logger } from "@/lib/logger";

/**
 * Serbest metin → chip eşleştirme (öğrenci akışında normalizeSoru OZEL döndüğünde).
 * Yalnızca ayarlarda etkinleştirildiyse ve API anahtarı varsa çalışır.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const metin = typeof body?.metin === "string" ? body.metin.trim().slice(0, 400) : "";
  if (!metin) return NextResponse.json({ chipKey: null });

  const etkin = loadSettings().ai?.eslestirme === true && deepseekYapilandirilmisMi();
  if (!etkin) return NextResponse.json({ chipKey: null });

  try {
    const sonuc = await serbestMetinEslestir(metin);
    return NextResponse.json({ chipKey: sonuc.chipKey });
  } catch (error) {
    logger.exception("AI soru eşleştirme başarısız", error, {
      requestId: getRequestId(req),
      route: "/api/ai/soru-eslestir",
    });
    return NextResponse.json({ chipKey: null });
  }
}
