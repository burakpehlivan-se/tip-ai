export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { computeAnalyticsSummary, listFeedbacks } from "@/lib/admin/store";
import { loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";

import { requirePermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "analytics.read");
  if (denied) return denied;

  const cases = await loadRuntimeCasesStore();
  const summary = computeAnalyticsSummary(cases.cases);
  const feedbacks = listFeedbacks();
  return NextResponse.json({
    ...summary,
    caseCount: cases.cases.length,
    activeCount: cases.cases.filter((c) => c.durum === "aktif").length,
    draftCount: cases.cases.filter((c) => c.durum === "taslak").length,
    feedbackCount: feedbacks.length,
  });
}
