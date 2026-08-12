export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { getStudentProgress } from "@/lib/student/progress";

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  return NextResponse.json({ progress: getStudentProgress(session.username) });
}
