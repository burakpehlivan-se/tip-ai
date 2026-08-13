export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revokeRuntimeSession } from "@/lib/admin/auth";
import { STUDENT_SESSION_COOKIE, studentSessionCookieOptions } from "@/lib/student/auth";

/** Öğrenci çıkışında PostgreSQL modundaki merkezi session kaydını da iptal eder. */
export async function POST(req: NextRequest) {
  await revokeRuntimeSession(req.cookies.get(STUDENT_SESSION_COOKIE)?.value).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_SESSION_COOKIE, "", { ...studentSessionCookieOptions(), maxAge: 0 });
  return res;
}
