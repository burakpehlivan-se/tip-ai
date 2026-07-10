export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore, recordMutation } from "@/lib/admin/store";
import { fillAllCases, fillCaseGeneratedTests } from "@/lib/pipeline/lab-fill";
import { scanAllCases } from "@/lib/pipeline/case-scanner";

/**
 * Pipeline ETL — eksik testleri lab motoruyla doldurup kaydeder.
 *   POST { id?: string }  → tek vaka veya tümü
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  let body: { id?: string } = {};
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    /* ignore */
  }

  if (body.id) {
    const result = recordMutation(
      session.username,
      "add_test",
      `Pipeline: ${body.id} eksik testleri lab motoruyla dolduruldu`,
      [],
      (store) => {
        const idx = store.cases.findIndex((c) => c.id === body.id);
        if (idx < 0) return;
        const { vaka } = fillCaseGeneratedTests(store.cases[idx]);
        store.cases[idx] = vaka;
      }
    );
    const target = result.store.cases.find((c) => c.id === body.id);
    return NextResponse.json({
      ok: true,
      after: target ? scanAllCases([target]) : null,
    });
  }

  const result = recordMutation(
    session.username,
    "add_test",
    "Pipeline: tüm vakaların eksik testleri lab motoruyla dolduruldu",
    [],
    (store) => {
      const { cases } = fillAllCases(store.cases);
      store.cases = cases;
    }
  );

  const summary = fillAllCases(result.store.cases);
  return NextResponse.json({
    ok: true,
    totalFilled: summary.totalFilled,
    totalStaticRequired: summary.totalStaticRequired,
    totalInvalid: summary.totalInvalid,
    after: scanAllCases(result.store.cases),
  });
}
