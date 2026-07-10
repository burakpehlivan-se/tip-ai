export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { computeAnalyticsSummary, listFeedbacks, loadCasesStore } from "@/lib/admin/store";

import { requirePermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "analytics.read");
  if (denied) return denied;

  const summary = computeAnalyticsSummary();
  const cases = loadCasesStore();
  const feedbacks = listFeedbacks();
  return NextResponse.json({
    ...summary,
    caseCount: cases.cases.length,
    activeCount: cases.cases.filter((c) => c.durum === "aktif").length,
    draftCount: cases.cases.filter((c) => c.durum === "taslak").length,
    feedbackCount: feedbacks.length,
  });
}
