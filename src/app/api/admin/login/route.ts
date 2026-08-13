export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  loginUser,
  createRuntimeSessionId,
  isPanelRole,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/admin/auth";
import { recordSuccessfulLogin } from "@/lib/auth/runtime-user-store";
import { observeAuthShadowRead } from "@/lib/auth/shadow-read";
import { getRequestId, logger } from "@/lib/logger";
import { clientRateLimitKey, rateLimitHeaders, refundRateLimit, takeRateLimit, usernameRateLimitKey } from "@/lib/security/rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 20;
const ACCOUNT_LIMIT = 8;

function rateLimited() {
  return NextResponse.json({ error: "Çok fazla giriş denemesi. Lütfen kısa süre sonra tekrar deneyin." }, { status: 429 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "");
    const password = String(body.password || "");
    if (!username || !password) {
      return NextResponse.json(
        { error: "Kullanıcı adı ve şifre gerekli." },
        { status: 400 }
      );
    }
    const ipKey = clientRateLimitKey(req);
    const accountKey = usernameRateLimitKey(username);
    const ipQuota = takeRateLimit({ namespace: "admin-login:ip", key: ipKey, limit: IP_LIMIT, windowMs: LOGIN_WINDOW_MS });
    const accountQuota = takeRateLimit({ namespace: "admin-login:account", key: accountKey, limit: ACCOUNT_LIMIT, windowMs: LOGIN_WINDOW_MS });
    if (!ipQuota.allowed || !accountQuota.allowed) {
      const decision = !ipQuota.allowed ? ipQuota : accountQuota;
      const response = rateLimited();
      for (const [key, value] of Object.entries(rateLimitHeaders(decision))) response.headers.set(key, value);
      return response;
    }

    const user = await loginUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz kullanıcı adı veya şifre." },
        { status: 401 }
      );
    }
    if (!isPanelRole(user.role)) {
      return NextResponse.json(
        { error: "Yönetim paneli yalnızca admin ve doktor hesaplarına açıktır." },
        { status: 403 }
      );
    }
    refundRateLimit({ namespace: "admin-login:ip", key: ipKey });
    refundRateLimit({ namespace: "admin-login:account", key: accountKey });
    await recordSuccessfulLogin({ id: user.userId, username: user.username, role: user.role });
    void observeAuthShadowRead(
      { username: user.username, role: user.role, active: true },
      { route: "/api/admin/login", requestId: getRequestId(req) }
    );
    const sessionId = await createRuntimeSessionId(user.userId, user.role);
    const token = createSessionToken(user.username, user.role, user.userId, sessionId);
    const res = NextResponse.json({
      ok: true,
      username: user.username,
      role: user.role,
    });
    for (const [key, value] of Object.entries(rateLimitHeaders(accountQuota))) res.headers.set(key, value);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    logger.exception("Yönetici oturum açma isteği işlenemedi", error, {
      requestId: getRequestId(req),
      route: "/api/admin/login",
    });
    return NextResponse.json({ error: "İstek işlenemedi." }, { status: 500 });
  }
}
