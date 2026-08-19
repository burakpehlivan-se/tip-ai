export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { storeMode } from "@/lib/store-mode";
import { listAssignmentsForStudent } from "@/lib/learning/cohort-store";

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  if (storeMode() !== "postgres" || !session.userId) {
    return NextResponse.json({ assignments: [], available: false }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { assignments: await listAssignmentsForStudent(session.userId), available: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
