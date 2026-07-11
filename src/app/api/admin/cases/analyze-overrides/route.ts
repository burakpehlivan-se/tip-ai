export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore } from "@/lib/admin/store";
import {
  analyzeAllVakasOverrides,
  buildOverrideMigrationSummary,
} from "@/lib/pipeline/override-migrator";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  try {
  const store = loadCasesStore();
  const { reports, grandTotal } = analyzeAllVakasOverrides(store.cases);

  const vakaId = req.nextUrl.searchParams.get("vakaId");
  const format = req.nextUrl.searchParams.get("format");

  if (vakaId) {
    const report = reports.find((r) => r.vakaId === vakaId);
    if (!report) {
      return NextResponse.json({ error: "Vaka bulunamadı" }, { status: 404 });
    }
    const summaryText = buildOverrideMigrationSummary([report]);
    return NextResponse.json({ report, summaryText });
  }

  if (format === "text") {
    const summaryText = buildOverrideMigrationSummary(reports);
    return NextResponse.json({ reports, grandTotal, summaryText });
  }

  return NextResponse.json({ reports, grandTotal });
  } catch (err) {
    console.error("analyze-overrides failed:", err);
    return NextResponse.json({ error: "Override analizi başarısız." }, { status: 500 });
  }
}
