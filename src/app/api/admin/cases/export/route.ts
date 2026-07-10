export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore } from "@/lib/admin/store";
import {
  buildCasesJsonExport,
  buildCasesPdfBuffer,
  exportFilename,
  filterCasesForExport,
  ExportFormat,
} from "@/lib/admin/export-cases";
import { adminCasesToCdmBundle } from "@/lib/cdm";

/**
 * GET /api/admin/cases/export?format=json|pdf|cdm&poliklinik=<key>
 * - json: depodaki düz AdminVaka dump
 * - cdm: TIP-AI CDM v1 bundle (standart yazar şeması)
 * - pdf: klinisyen özeti
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase() as ExportFormat;
  if (format !== "json" && format !== "pdf" && format !== "cdm") {
    return NextResponse.json(
      { error: "format=json | pdf | cdm olmalı." },
      { status: 400 }
    );
  }

  const poliklinikKey = req.nextUrl.searchParams.get("poliklinik")?.trim() || null;
  const store = loadCasesStore();
  const cases = filterCasesForExport(store.cases, poliklinikKey);

  if (poliklinikKey && cases.length === 0) {
    const anyPoli = store.cases.some((c) => c.poliklinikKey === poliklinikKey);
    if (!anyPoli) {
      return NextResponse.json(
        { error: `Poliklinik bulunamadı: ${poliklinikKey}` },
        { status: 404 }
      );
    }
  }

  const poliklinikAd = poliklinikKey
    ? cases[0]?.poliklinikAd ||
      store.cases.find((c) => c.poliklinikKey === poliklinikKey)?.poliklinikAd ||
      poliklinikKey
    : undefined;

  const filename = exportFilename(format, { poliklinikKey, poliklinikAd });

  try {
    if (format === "json") {
      const payload = buildCasesJsonExport(store, cases, { poliklinikKey });
      const body = JSON.stringify(payload, null, 2);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "cdm") {
      const bundle = adminCasesToCdmBundle(cases);
      const body = JSON.stringify(bundle, null, 2);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = await buildCasesPdfBuffer(cases, { poliklinikKey, poliklinikAd });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
