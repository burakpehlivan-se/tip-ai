export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore } from "@/lib/admin/store";
import {
  buildValidationReport,
  formatValidationReportText,
} from "@/lib/cdm/validate-report";

/**
 * GET /api/admin/cases/validate
 * ?format=json|text  (default json)
 * ?status=invalid|valid_with_warnings|valid  filtre
 * ?poliklinik=key
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  const statusFilter = req.nextUrl.searchParams.get("status");
  const poliklinik = req.nextUrl.searchParams.get("poliklinik")?.trim() || null;

  const store = loadCasesStore();
  let cases = store.cases;
  if (poliklinik) {
    cases = cases.filter((c) => c.poliklinikKey === poliklinik);
  }

  const report = buildValidationReport(cases);

  if (statusFilter) {
    report.results = report.results.filter((r) => r.status === statusFilter);
  }

  if (format === "text") {
    const text = formatValidationReportText(report);
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
