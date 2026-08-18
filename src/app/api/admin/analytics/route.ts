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

  const daysRaw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.round(daysRaw) : null;
  const offsetRaw = Number(req.nextUrl.searchParams.get("offset"));
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.round(offsetRaw) : 0;
  const window = days
    ? { from: Date.now() - (offset + days) * 24 * 60 * 60 * 1000, to: Date.now() - offset * 24 * 60 * 60 * 1000 }
    : undefined;

  const cases = await loadRuntimeCasesStore();
  const summary = computeAnalyticsSummary(cases.cases, window);
  const feedbacks = listFeedbacks();
  return NextResponse.json({
    ...summary,
    caseCount: cases.cases.length,
    activeCount: cases.cases.filter((c) => c.durum === "aktif").length,
    draftCount: cases.cases.filter((c) => c.durum === "taslak").length,
    feedbackCount: feedbacks.length,
    days,
  });
}
