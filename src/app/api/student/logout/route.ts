export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("tip_ai_student_session", "", { maxAge: 0, path: "/" });
  return res;
}
