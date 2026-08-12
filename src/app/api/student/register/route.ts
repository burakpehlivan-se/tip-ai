export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { registerStudent } from "@/lib/auth/runtime-user-store";
import { appendLog } from "@/lib/admin/store";
import { createStudentSessionToken, studentSessionCookieOptions } from "@/lib/student/auth";

export async function POST(req: NextRequest) {
  try {
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

    const token = createStudentSessionToken(user.username, user.id);
    const res = NextResponse.json({ ok: true, user: { username: user.username, displayName: user.displayName } }, { status: 201 });
    res.cookies.set("tip_ai_student_session", token, studentSessionCookieOptions());
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Kayıt başarısız";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
