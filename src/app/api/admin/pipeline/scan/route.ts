export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadCasesStore } from "@/lib/admin/store";
import { buildTestInventory } from "@/lib/pipeline/master-catalogue";
import { scanAllCases, problemCases } from "@/lib/pipeline/case-scanner";

/** Pipeline tarama raporu (envanter + eksik testler) */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.validate");
  if (denied) return denied;

  const cases = loadCasesStore().cases;
  const inventory = buildTestInventory(cases);
  const scan = scanAllCases(cases);

  return NextResponse.json({
    inventory,
    scan,
    problems: problemCases(scan),
  });
}
