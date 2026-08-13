export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { createCohort, listCohorts, parseCohortName, parseOptionalText } from "@/lib/learning/cohort-store";

function unavailable() {
  return NextResponse.json(
    { error: "Grup ve atama yönetimi PostgreSQL kullanıcı deposu etkinleştirildiğinde kullanılabilir." },
    { status: 409 }
  );
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "assignments.manage");
  if (denied) return denied;
  if (authUserStoreMode() !== "postgres") return unavailable();
  return NextResponse.json({ cohorts: await listCohorts() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "assignments.manage");
  if (denied) return denied;
  if (authUserStoreMode() !== "postgres") return unavailable();

  const body = await req.json().catch(() => null);
  const name = parseCohortName(body?.name);
  const description = parseOptionalText(body?.description, 1000);
  if (!name || description === undefined) {
    return NextResponse.json({ error: "Grup adı 3-100, açıklama en fazla 1000 karakter olmalıdır." }, { status: 422 });
  }
  try {
    const cohort = await createCohort({ name, description, actorId: session!.userId! });
    return NextResponse.json({ cohort }, { status: 201, headers: { Location: `/api/admin/cohorts/${cohort.id}` } });
  } catch {
    return NextResponse.json({ error: "Bu grup adı zaten kullanılıyor veya grup oluşturulamadı." }, { status: 409 });
  }
}
