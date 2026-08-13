export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/admin/store";
import { observeAuthShadowRead } from "@/lib/auth/shadow-read";
import { getRequestId } from "@/lib/logger";
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
    const ipQuota = takeRateLimit({ namespace: "student-login:ip", key: ipKey, limit: IP_LIMIT, windowMs: LOGIN_WINDOW_MS });
    const accountQuota = takeRateLimit({ namespace: "student-login:account", key: accountKey, limit: ACCOUNT_LIMIT, windowMs: LOGIN_WINDOW_MS });
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
    refundRateLimit({ namespace: "student-login:ip", key: ipKey });
    refundRateLimit({ namespace: "student-login:account", key: accountKey });

    void observeAuthShadowRead(
      { username: auth.username, role: "ogrenci", active: true },
      { route: "/api/student/login", requestId: getRequestId(req) }
    );

    appendLog({
      action: "student_login",
      actor: auth.username,
      message: `Öğrenci girişi · ${auth.username}`,
      patches: [],
    });

    const token = await createStudentSessionToken(auth.username, auth.userId);
    const res = NextResponse.json({ ok: true, user: { username: auth.username } });
    for (const [key, value] of Object.entries(rateLimitHeaders(accountQuota))) res.headers.set(key, value);
    res.cookies.set("tip_ai_student_session", token, studentSessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "Giriş başarısız" }, { status: 400 });
  }
}
