export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import {
  answerStudentAttempt,
  completeStudentAttempt,
  requestStudentAttemptTest,
  saveStudentAttemptClinicalReasoning,
} from "@/lib/student/attempt-store";
import { ClinicalReasoningValidationError, normalizeClinicalReasoning } from "@/lib/student/clinical-reasoning";
import { JsonStoreReadError } from "@/lib/admin/json-store";
import { getRequestId, logger } from "@/lib/logger";

const KEY = /^[\p{L}0-9_-]{1,80}$/u;
const GUEST_COOKIE = "tip_ai_guest_attempt";

function attemptStoreUnavailable(req: NextRequest, error: unknown) {
  logger.exception("Öğrenci oturumu deposuna erişilemedi", error, {
    requestId: getRequestId(req),
    route: "/api/student/attempts/[id]",
  });
  return NextResponse.json({ error: "Oturum geçici olarak kullanılamıyor. Lütfen tekrar deneyin." }, { status: 503 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStudentSessionFromRequest(req);
  const actor = session?.username || (req.cookies.get(GUEST_COOKIE)?.value ? `guest:${req.cookies.get(GUEST_COOKIE)!.value}` : null);
  if (!actor) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.type !== "string") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  try {
    if (body.type === "ask" && typeof body.action === "string" && KEY.test(body.action)) {
      const yanit = await answerStudentAttempt(id, actor, body.action, session?.userId);
      return yanit == null ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ yanit });
    }
    if (body.type === "test" && typeof body.testKey === "string" && KEY.test(body.testKey)) {
      const sonuc = await requestStudentAttemptTest(id, actor, body.testKey, session?.userId);
      return sonuc == null ? NextResponse.json({ error: "Test veya vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ sonuc });
    }
    if (body.type === "reasoning") {
      const reasoning = normalizeClinicalReasoning(body.reasoning);
      if (!reasoning) return NextResponse.json({ error: "Klinik muhakeme bilgisi gerekli." }, { status: 400 });
      const saved = await saveStudentAttemptClinicalReasoning(id, actor, reasoning, session?.userId);
      return saved ? NextResponse.json({ saved: true }) : NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 });
    }
    if (
      body.type === "complete" &&
      typeof body.taniGirildi === "string" &&
      typeof body.tedaviGirildi === "string" &&
      body.taniGirildi.trim().length > 0 &&
      body.taniGirildi.trim().length <= 500 &&
      body.tedaviGirildi.trim().length > 0 &&
      body.tedaviGirildi.trim().length <= 4000
    ) {
      const reasoning = normalizeClinicalReasoning(body.reasoning);
      const sonuc = await completeStudentAttempt(id, actor, body.taniGirildi.trim(), body.tedaviGirildi.trim(), reasoning, session?.userId);
      return sonuc == null ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ sonuc });
    }
  } catch (error) {
    if (error instanceof JsonStoreReadError) return attemptStoreUnavailable(req, error);
    if (error instanceof ClinicalReasoningValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
