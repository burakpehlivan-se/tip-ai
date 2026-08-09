export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { startStudentAttempt } from "@/lib/student/attempt-store";

const GUEST_COOKIE = "tip_ai_guest_attempt";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session = getStudentSessionFromRequest(req);
  const guest = body?.guest === true;
  if (!session && !guest) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  const poliklinikKey = typeof body?.poliklinikKey === "string" ? body.poliklinikKey : "";
  if (!(poliklinikKey === "*" || /^[a-z0-9-]{2,80}$/.test(poliklinikKey))) return NextResponse.json({ error: "Geçersiz poliklinik." }, { status: 400 });
  const guestId = req.cookies.get(GUEST_COOKIE)?.value || crypto.randomUUID();
  const vaka = startStudentAttempt(session?.username || `guest:${guestId}`, poliklinikKey);
  if (!vaka) return NextResponse.json({ error: "Aktif vaka bulunamadı." }, { status: 404 });
  const response = NextResponse.json({ vaka });
  if (!session) response.cookies.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
