export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getStudentAttemptSourceCaseId } from "@/lib/student/attempt-store";
import { auditSyntheaClinicalHistoryAccess, getSyntheaClinicalHistory } from "@/lib/clinical-history/synthea-history";
import { JsonStoreReadError } from "@/lib/admin/json-store";

const GUEST_COOKIE = "tip_ai_guest_attempt";
const ATTEMPT_ID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ATTEMPT_ID.test(id)) return NextResponse.json({ error: "Geçersiz vaka oturumu." }, { status: 400 });

  const session = await getStudentSessionFromRequest(req);
  const guestId = req.cookies.get(GUEST_COOKIE)?.value;
  const actor = session?.username || (guestId ? `guest:${guestId}` : null);
  if (!actor) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  try {
    const caseId = await getStudentAttemptSourceCaseId(id, actor, session?.userId);
    if (!caseId) return NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 });

    const history = await getSyntheaClinicalHistory(caseId);
    if (!history) return NextResponse.json({ error: "Bu vaka için klinik geçmiş henüz hazır değil." }, { status: 404 });

    await auditSyntheaClinicalHistoryAccess(caseId, actor);
    return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof JsonStoreReadError) {
      return NextResponse.json({ error: "Vaka oturumu geçici olarak kullanılamıyor. Lütfen tekrar deneyin." }, { status: 503 });
    }
    return NextResponse.json({ error: "Klinik geçmiş şu anda alınamadı. Lütfen tekrar deneyin." }, { status: 503 });
  }
}
