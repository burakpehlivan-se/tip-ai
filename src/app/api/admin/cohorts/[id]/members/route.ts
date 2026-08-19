export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { storeMode } from "@/lib/store-mode";
import { addCohortMember } from "@/lib/learning/cohort-store";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "assignments.manage");
  if (denied) return denied;
  if (storeMode() !== "postgres") {
    return NextResponse.json({ error: "Grup yönetimi PostgreSQL kullanıcı deposu gerektirir." }, { status: 409 });
  }
  const { id: cohortId } = await context.params;
  const body = await req.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 422 });

  const result = await addCohortMember({ cohortId, studentId, actorId: session!.userId! });
  if (result.status === "cohort_not_found") return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });
  if (result.status === "student_not_found") return NextResponse.json({ error: "Etkin öğrenci hesabı bulunamadı." }, { status: 422 });
  if (result.status === "already_member") return NextResponse.json({ error: "Öğrenci zaten bu grubun üyesi." }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
