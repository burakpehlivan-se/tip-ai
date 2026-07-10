export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  loginUser,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/admin/auth";

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
    const user = loginUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz kullanıcı adı veya şifre." },
        { status: 401 }
      );
    }
    const token = createSessionToken(user.username, user.role, user.userId);
    const res = NextResponse.json({
      ok: true,
      username: user.username,
      role: user.role,
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "İstek işlenemedi." }, { status: 500 });
  }
}
