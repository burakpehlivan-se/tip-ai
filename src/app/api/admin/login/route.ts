export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "");
    const password = String(body.password || "");
    if (!username || !password) {
      return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli." }, { status: 400 });
    }
    if (!verifyPassword(username, password)) {
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya şifre." }, { status: 401 });
    }
    const token = createSessionToken(username);
    const res = NextResponse.json({ ok: true, username });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "İstek işlenemedi." }, { status: 500 });
  }
}
