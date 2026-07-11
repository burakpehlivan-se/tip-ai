export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore } from "@/lib/admin/store";
import {
  checkPedagogicConsistency,
  checkAllPedagogicConsistency,
  formatPedagogicReportText,
} from "@/lib/pipeline/pedagogic-checker";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

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
    console.error("pedagogic-check failed:", err);
    return NextResponse.json({ error: "Pedagojik tutarlılık taraması başarısız." }, { status: 500 });
  }
}
