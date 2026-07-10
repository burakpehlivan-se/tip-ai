export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore } from "@/lib/admin/store";
import { buildTestInventory } from "@/lib/pipeline/master-catalogue";
import { scanAllCases, problemCases } from "@/lib/pipeline/case-scanner";

/** Pipeline tarama raporu (envanter + eksik testler) */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const cases = loadCasesStore().cases;
  const inventory = buildTestInventory(cases);
  const scan = scanAllCases(cases);

  return NextResponse.json({
    inventory,
    scan,
    problems: problemCases(scan),
  });
}
