export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { observeAuthShadowRead } from "@/lib/auth/shadow-read";
import { recordSuccessfulLogin } from "@/lib/auth/runtime-user-store";
import { deviceLabelFromUserAgent } from "@/lib/auth/client-device";
import { getRequestId, logger } from "@/lib/logger";
import { authenticateStudent, createStudentSessionToken, studentSessionCookieOptions } from "@/lib/student/auth";
import { clientRateLimitKey, rateLimitHeaders, refundRateLimit, takeRateLimit, usernameRateLimitKey } from "@/lib/security/rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 30;
const ACCOUNT_LIMIT = 8;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli." }, { status: 400 });
    const ipKey = clientRateLimitKey(req);
    const accountKey = usernameRateLimitKey(username);
    const [ipQuota, accountQuota] = await Promise.all([
      takeRateLimit({ namespace: "student-login:ip", key: ipKey, limit: IP_LIMIT, windowMs: LOGIN_WINDOW_MS }),
      takeRateLimit({ namespace: "student-login:account", key: accountKey, limit: ACCOUNT_LIMIT, windowMs: LOGIN_WINDOW_MS }),
    ]);
    if (!ipQuota.allowed || !accountQuota.allowed) {
      const decision = !ipQuota.allowed ? ipQuota : accountQuota;
      return NextResponse.json(
        { error: "Çok fazla giriş denemesi. Lütfen kısa süre sonra tekrar deneyin." },
        { status: 429, headers: rateLimitHeaders(decision) }
      );
    }

    const auth = await authenticateStudent(username, password);
    if (!auth) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });
    }
    await Promise.all([
      refundRateLimit({ namespace: "student-login:ip", key: ipKey }),
      refundRateLimit({ namespace: "student-login:account", key: accountKey }),
    ]);

    void observeAuthShadowRead(
      { username: auth.username, role: "ogrenci", active: true },
      { route: "/api/student/login", requestId: getRequestId(req) }
    );

    await recordSuccessfulLogin({ id: auth.userId, username: auth.username, role: "ogrenci" });

    const token = await createStudentSessionToken(
      auth.username,
      auth.userId,
      deviceLabelFromUserAgent(req.headers.get("user-agent"))
    );
    const res = NextResponse.json({ ok: true, user: { username: auth.username } });
    for (const [key, value] of Object.entries(rateLimitHeaders(accountQuota))) res.headers.set(key, value);
    res.cookies.set("tip_ai_student_session", token, studentSessionCookieOptions());
    return res;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }
    logger.exception("Öğrenci girişi beklenmeyen hata", error, {
      requestId: getRequestId(req),
      route: "/api/student/login",
    });
    return NextResponse.json({ error: "Giriş başarısız. Lütfen kısa süre sonra tekrar deneyin." }, { status: 503 });
  }
}
