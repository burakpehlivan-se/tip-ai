export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  loginUser,
  isPanelRole,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/admin/auth";
import { observeAuthShadowRead } from "@/lib/auth/shadow-read";
import { getRequestId, logger } from "@/lib/logger";

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
    void observeAuthShadowRead(
      { username: user.username, role: user.role, active: true },
      { route: "/api/admin/login", requestId: getRequestId(req) }
    );
    const token = createSessionToken(user.username, user.role, user.userId);
    const res = NextResponse.json({
      ok: true,
      username: user.username,
      role: user.role,
    });
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
