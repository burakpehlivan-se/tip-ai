export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/admin/store";
import { geminiYapilandirilmisMi } from "@/lib/ai/gemini";
import { serbestMetinEslestir } from "@/lib/ai";
import { getRequestId, logger } from "@/lib/logger";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { rateLimitHeaders, takeRateLimit } from "@/lib/security/rate-limit";

const ESLESTIR_WINDOW_MS = 60 * 1000;
const ESLESTIR_ACCOUNT_LIMIT = 30;

/**
 * Serbest metin → chip eşleştirme (öğrenci akışında normalizeSoru OZEL döndüğünde).
 * Yalnızca ayarlarda etkinleştirildiyse ve API anahtarı varsa çalışır.
 */
export async function POST(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ chipKey: null }, { status: 401 });

  const quota = await takeRateLimit({
    namespace: "ai-eslestir:account",
    key: session.username,
    limit: ESLESTIR_ACCOUNT_LIMIT,
    windowMs: ESLESTIR_WINDOW_MS,
  });
  if (!quota.allowed) {
    return NextResponse.json({ chipKey: null }, { status: 429, headers: rateLimitHeaders(quota) });
  }

  const body = await req.json().catch(() => null);
  const metin = typeof body?.metin === "string" ? body.metin.trim().slice(0, 400) : "";
  if (!metin) return NextResponse.json({ chipKey: null });

  const etkin = loadSettings().ai?.eslestirme === true && geminiYapilandirilmisMi();
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
