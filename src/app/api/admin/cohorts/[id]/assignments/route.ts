export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getCaseById } from "@/lib/admin/store";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { createCohortCaseAssignment, parseOptionalText } from "@/lib/learning/cohort-store";

function parseDueAt(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const dueAt = new Date(value);
  return Number.isNaN(dueAt.getTime()) ? undefined : dueAt;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "assignments.manage");
  if (denied) return denied;
  if (authUserStoreMode() !== "postgres") {
    return NextResponse.json({ error: "Grup yönetimi PostgreSQL kullanıcı deposu gerektirir." }, { status: 409 });
  }
  const { id: cohortId } = await context.params;
  const body = await req.json().catch(() => null);
  const caseId = typeof body?.caseId === "string" ? body.caseId : "";
  const title = parseOptionalText(body?.title, 160);
  const instructions = parseOptionalText(body?.instructions, 2000);
  const dueAt = parseDueAt(body?.dueAt);
  const caseItem = getCaseById(caseId);
  const reviewStatus = caseItem?.incelemeDurumu || "legacy";
  if (!caseItem || caseItem.durum !== "aktif" || !["onayli", "legacy"].includes(reviewStatus)) {
    return NextResponse.json({ error: "Yalnızca aktif ve onaylı vakalar atanabilir." }, { status: 422 });
  }
  if (title === undefined || instructions === undefined || dueAt === undefined) {
    return NextResponse.json({ error: "Atama alanları geçersiz." }, { status: 422 });
  }
  try {
    const assignment = await createCohortCaseAssignment({
      cohortId,
      caseId: caseItem.id,
      caseVersion: String(caseItem.surum),
      title,
      instructions,
      dueAt,
      actorId: session!.userId!,
    });
    if (!assignment) return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bu vaka sürümü gruba zaten atanmış." }, { status: 409 });
  }
}
