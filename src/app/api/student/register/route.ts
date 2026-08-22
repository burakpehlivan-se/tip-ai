export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { registerStudent } from "@/lib/auth/runtime-user-store";
import { appendLog } from "@/lib/admin/store";
import { createStudentSessionToken, studentSessionCookieOptions } from "@/lib/student/auth";
import { deviceLabelFromUserAgent } from "@/lib/auth/client-device";
import { clientRateLimitKey, rateLimitHeaders, takeRateLimit } from "@/lib/security/rate-limit";
import { getRequestId, logger } from "@/lib/logger";

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_IP_LIMIT = 5;

/** registerStudent'ın istemciye iletilebilir doğrulama hataları. */
const KAYIT_DOGRULAMA_MESAJLARI = new Set([
  "Kullanıcı adı 3-30 karakter olmalı; yalnızca harf, rakam, nokta ve tire kullanılabilir.",
  "Şifre en az 6 karakter olmalı.",
  "Bu kullanıcı adı zaten kullanılıyor.",
]);

export async function POST(req: NextRequest) {
  try {
    const quota = await takeRateLimit({
      namespace: "student-register:ip",
      key: clientRateLimitKey(req),
      limit: REGISTER_IP_LIMIT,
      windowMs: REGISTER_WINDOW_MS,
    });
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin." },
        { status: 429, headers: rateLimitHeaders(quota) }
      );
    }
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const displayName = body.displayName ? String(body.displayName).trim() : undefined;

    const user = await registerStudent({ username, password, displayName });

    appendLog({
      action: "register_student",
      actor: user.username,
      message: `Öğrenci kaydı · ${user.username}`,
      patches: [],
    });

    const token = await createStudentSessionToken(
      user.username,
      user.id,
      deviceLabelFromUserAgent(req.headers.get("user-agent"))
    );
    const res = NextResponse.json({ ok: true, user: { username: user.username, displayName: user.displayName } }, { status: 201 });
    for (const [key, value] of Object.entries(rateLimitHeaders(quota))) res.headers.set(key, value);
    res.cookies.set("tip_ai_student_session", token, studentSessionCookieOptions());
    return res;
  } catch (e) {
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "";
    if (KAYIT_DOGRULAMA_MESAJLARI.has(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    logger.exception("Öğrenci kaydı beklenmeyen hata", e, {
      requestId: getRequestId(req),
      route: "/api/student/register",
    });
    return NextResponse.json({ error: "Kayıt başarısız. Lütfen kısa süre sonra tekrar deneyin." }, { status: 503 });
  }
}
