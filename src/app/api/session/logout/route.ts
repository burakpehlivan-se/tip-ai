export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revokeRuntimeSession, SESSION_COOKIE } from "@/lib/admin/auth";
import { STUDENT_SESSION_COOKIE } from "@/lib/student/auth";

/** Ortak üst navigasyondan güvenli çıkış için iki uygulama oturumunu da temizler. */
export async function POST(req: NextRequest) {
  // Merkezi iptal başarısız olsa bile cookie'leri temizle; kullanıcı istemciyi
  // terk eder ve sonraki PostgreSQL isteğinde hata fail-closed davranır.
  await Promise.allSettled([
    revokeRuntimeSession(req.cookies.get(SESSION_COOKIE)?.value),
    revokeRuntimeSession(req.cookies.get(STUDENT_SESSION_COOKIE)?.value),
  ]);
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
