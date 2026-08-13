export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCaseById } from "@/lib/admin/store";
import { JsonStoreReadError } from "@/lib/admin/json-store";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { getAssignmentForStudent } from "@/lib/learning/cohort-store";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getActiveStudentAttemptForAssignment, startAssignedStudentAttempt } from "@/lib/student/attempt-store";

function unavailable() {
  return NextResponse.json({ error: "Atanan vakalar PostgreSQL kullanıcı deposu etkinleştirildiğinde kullanılabilir." }, { status: 409 });
}

async function assignmentForRequest(req: NextRequest, id: string) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return { response: NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 }) };
  if (authUserStoreMode() !== "postgres" || !session.userId) return { response: unavailable() };
  const assignment = await getAssignmentForStudent(id, session.userId);
  if (!assignment) return { response: NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 }) };
  return { session, assignment };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resolved = await assignmentForRequest(req, id);
  if ("response" in resolved) return resolved.response;
  try {
    return NextResponse.json({ vaka: await getActiveStudentAttemptForAssignment(resolved.session.username, id, resolved.session.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof JsonStoreReadError) return NextResponse.json({ error: "Oturum geçici olarak kullanılamıyor." }, { status: 503 });
    throw error;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resolved = await assignmentForRequest(req, id);
  if ("response" in resolved) return resolved.response;

  const caseItem = getCaseById(resolved.assignment.caseId);
  if (!caseItem || caseItem.durum !== "aktif" || String(caseItem.surum) !== resolved.assignment.caseVersion) {
    return NextResponse.json({ error: "Bu atama güncel vaka sürümüyle artık kullanılamıyor. Eğitmeninizle görüşün." }, { status: 409 });
  }
  try {
    const vaka = await startAssignedStudentAttempt(resolved.session.username, id, caseItem.id, resolved.session.userId);
    if (!vaka) return NextResponse.json({ error: "Atanan vaka şu anda kullanılamıyor." }, { status: 409 });
    return NextResponse.json({ vaka }, { status: 201 });
  } catch (error) {
    if (error instanceof JsonStoreReadError) return NextResponse.json({ error: "Oturum geçici olarak kullanılamıyor." }, { status: 503 });
    throw error;
  }
}
