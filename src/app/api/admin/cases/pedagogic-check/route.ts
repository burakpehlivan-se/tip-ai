export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadCasesStore } from "@/lib/admin/store";
import {
  checkPedagogicConsistency,
  checkAllPedagogicConsistency,
  formatPedagogicReportText,
} from "@/lib/pipeline/pedagogic-checker";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.validate");
  if (denied) return denied;

  try {
  const store = loadCasesStore();
  const vakaId = req.nextUrl.searchParams.get("vakaId");
  const format = req.nextUrl.searchParams.get("format");
  const onlyProblems = req.nextUrl.searchParams.get("onlyProblems") !== "false";

  if (vakaId) {
    const vaka = store.cases.find((c) => c.id === vakaId);
    if (!vaka) {
      return NextResponse.json({ error: "Vaka bulunamadı" }, { status: 404 });
    }

    const report = checkPedagogicConsistency(vaka);

    if (format === "text") {
      return NextResponse.json({
        report,
        text: formatPedagogicReportText([report]),
      });
    }

    return NextResponse.json({ report });
  }

  const { reports, grandTotal } = checkAllPedagogicConsistency(store.cases);
  const filtered = onlyProblems
    ? reports.filter((r) => r.findings.length > 0)
    : reports;

  if (format === "text") {
    return NextResponse.json({
      grandTotal,
      reports: filtered,
      text: formatPedagogicReportText(reports),
    });
  }

  return NextResponse.json({ grandTotal, reports: filtered });
  } catch (err) {
    logger.exception("Pedagojik tutarlılık taraması başarısız", err, {
      requestId: getRequestId(req),
      route: "/api/admin/cases/pedagogic-check",
    });
    return NextResponse.json({ error: "Pedagojik tutarlılık taraması başarısız." }, { status: 500 });
  }
}
