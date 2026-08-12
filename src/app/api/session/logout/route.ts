export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin/auth";
import { STUDENT_SESSION_COOKIE } from "@/lib/student/auth";

/** Ortak üst navigasyondan güvenli çıkış için iki uygulama oturumunu da temizler. */
export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const expired = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set(SESSION_COOKIE, "", expired);
  response.cookies.set(STUDENT_SESSION_COOKIE, "", expired);
  return response;
}
