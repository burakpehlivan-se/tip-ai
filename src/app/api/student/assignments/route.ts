export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { listAssignmentsForStudent } from "@/lib/learning/cohort-store";

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  if (authUserStoreMode() !== "postgres" || !session.userId) {
    return NextResponse.json({ assignments: [], available: false }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { assignments: await listAssignmentsForStudent(session.userId), available: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
