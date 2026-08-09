export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { answerStudentAttempt, completeStudentAttempt, requestStudentAttemptTest } from "@/lib/student/attempt-store";

const KEY = /^[A-Za-z0-9_-]{1,80}$/;
const GUEST_COOKIE = "tip_ai_guest_attempt";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getStudentSessionFromRequest(req);
  const actor = session?.username || (req.cookies.get(GUEST_COOKIE)?.value ? `guest:${req.cookies.get(GUEST_COOKIE)!.value}` : null);
  if (!actor) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.type !== "string") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  if (body.type === "ask" && typeof body.action === "string" && KEY.test(body.action)) {
    const yanit = answerStudentAttempt(id, actor, body.action);
    return yanit == null ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ yanit });
  }
  if (body.type === "test" && typeof body.testKey === "string" && KEY.test(body.testKey)) {
    const sonuc = requestStudentAttemptTest(id, actor, body.testKey);
    return sonuc == null ? NextResponse.json({ error: "Test veya vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ sonuc });
  }
  if (body.type === "complete" && typeof body.taniGirildi === "string" && body.taniGirildi.trim().length <= 500) {
    const sonuc = completeStudentAttempt(id, actor, body.taniGirildi.trim());
    return sonuc == null ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ sonuc });
  }
  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
