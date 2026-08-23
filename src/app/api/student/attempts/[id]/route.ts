export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import {
  askStudentAttempt,
  completeStudentAttempt,
  requestStudentAttemptTest,
  requestStudentAttemptExam,
  resetStudentAttempt,
  saveStudentAttemptClinicalReasoning,
} from "@/lib/student/attempt-store";
import { ClinicalReasoningValidationError, normalizeClinicalReasoning } from "@/lib/student/clinical-reasoning";
import { JsonStoreReadError } from "@/lib/admin/json-store";
import { getRequestId, logger } from "@/lib/logger";
import { clientRateLimitKey, rateLimitHeaders, takeRateLimit } from "@/lib/security/rate-limit";

const ATTEMPT_MUTATION_WINDOW_MS = 60 * 1000;
const ATTEMPT_MUTATION_IP_LIMIT = 60;

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
  const quota = await takeRateLimit({
    namespace: "student-attempt-mutation:ip",
    key: clientRateLimitKey(req),
    limit: ATTEMPT_MUTATION_IP_LIMIT,
    windowMs: ATTEMPT_MUTATION_WINDOW_MS,
  });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen kısa bir süre sonra tekrar deneyin." },
      { status: 429, headers: rateLimitHeaders(quota) }
    );
  }
  const headers = rateLimitHeaders(quota);
  const session = await getStudentSessionFromRequest(req);
  const actor = session?.username || (req.cookies.get(GUEST_COOKIE)?.value ? `guest:${req.cookies.get(GUEST_COOKIE)!.value}` : null);
  if (!actor) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.type !== "string") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  try {
    const question = typeof body.question === "string" ? body.question : body.action;
    if (body.type === "ask" && typeof question === "string" && question.trim().length > 0 && question.trim().length <= 400) {
      const reply = await askStudentAttempt(id, actor, question.trim(), session?.userId);
      const res = reply == null ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ reply, yanit: reply.answer });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    }
    if (body.type === "test" && typeof body.testKey === "string" && KEY.test(body.testKey)) {
      const sonuc = await requestStudentAttemptTest(id, actor, body.testKey, session?.userId);
      const res = sonuc == null ? NextResponse.json({ error: "Test veya vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ sonuc });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    }
    if (body.type === "exam" && typeof body.action === "string" && KEY.test(body.action)) {
      const finding = await requestStudentAttemptExam(id, actor, body.action, session?.userId);
      const res = finding == null ? NextResponse.json({ error: "Muayene bulgusu veya vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ finding });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    }
    if (body.type === "reasoning") {
      const reasoning = normalizeClinicalReasoning(body.reasoning);
      if (!reasoning) return NextResponse.json({ error: "Klinik muhakeme bilgisi gerekli." }, { status: 400 });
      const saved = await saveStudentAttemptClinicalReasoning(id, actor, reasoning, session?.userId);
      const res = saved ? NextResponse.json({ saved: true }) : NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    }
    if (body.type === "reset") {
      const vaka = await resetStudentAttempt(id, actor, session?.userId);
      const res = vaka == null
        ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 })
        : NextResponse.json({ vaka }, { headers: { "Cache-Control": "no-store" } });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
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
      const res = sonuc == null ? NextResponse.json({ error: "Vaka oturumu bulunamadı." }, { status: 404 }) : NextResponse.json({ sonuc });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      return res;
    }
  } catch (error) {
    if (error instanceof JsonStoreReadError) return attemptStoreUnavailable(req, error);
    if (error instanceof ClinicalReasoningValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
