export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { loadAnalytics } from "@/lib/admin/store";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { buildStudentPerformanceInsights } from "@/lib/student/performance-insights";

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  const sessions = loadAnalytics().sessions.filter(
    (entry) => entry.mode === "ogrenci" && entry.actor.toLowerCase() === session.username.toLowerCase()
  );
  return NextResponse.json({ insights: buildStudentPerformanceInsights(sessions) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
