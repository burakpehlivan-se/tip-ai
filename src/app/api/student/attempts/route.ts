export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getActiveStudentAttempt, startStudentAttempt } from "@/lib/student/attempt-store";

const GUEST_COOKIE = "tip_ai_guest_attempt";

function poliklinikKeyFrom(value: string | null) {
  if (!value) return "*";
  return value === "*" || /^[a-z0-9-]{2,80}$/.test(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const session = getStudentSessionFromRequest(req);
  const guestId = req.cookies.get(GUEST_COOKIE)?.value;
  const isGuestLookup = req.nextUrl.searchParams.get("guest") === "1";
  const poliklinikKey = poliklinikKeyFrom(req.nextUrl.searchParams.get("poliklinikKey"));

  if (!poliklinikKey) return NextResponse.json({ error: "Geçersiz poliklinik." }, { status: 400 });
  if (!session && !guestId) {
    return isGuestLookup
      ? NextResponse.json({ vaka: null })
      : NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  const actor = session?.username || `guest:${guestId}`;
  return NextResponse.json({ vaka: getActiveStudentAttempt(actor, poliklinikKey) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session = getStudentSessionFromRequest(req);
  const guest = body?.guest === true;
  if (!session && !guest) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  const poliklinikKey = poliklinikKeyFrom(typeof body?.poliklinikKey === "string" ? body.poliklinikKey : null);
  if (!poliklinikKey) return NextResponse.json({ error: "Geçersiz poliklinik." }, { status: 400 });
  const guestId = req.cookies.get(GUEST_COOKIE)?.value || crypto.randomUUID();
  const vaka = startStudentAttempt(session?.username || `guest:${guestId}`, poliklinikKey);
  if (!vaka) return NextResponse.json({ error: "Aktif vaka bulunamadı." }, { status: 404 });
  const response = NextResponse.json({ vaka });
  if (!session) response.cookies.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
