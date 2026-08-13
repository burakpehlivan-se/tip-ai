export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/admin/store";
import { observeAuthShadowRead } from "@/lib/auth/shadow-read";
import { getRequestId } from "@/lib/logger";
import { authenticateStudent, createStudentSessionToken, studentSessionCookieOptions } from "@/lib/student/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const auth = await authenticateStudent(username, password);
    if (!auth) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });
    }

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
    res.cookies.set("tip_ai_student_session", token, studentSessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "Giriş başarısız" }, { status: 400 });
  }
}
