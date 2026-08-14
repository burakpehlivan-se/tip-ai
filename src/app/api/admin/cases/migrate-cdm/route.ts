export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadRuntimeCasesStore, recordRuntimeCaseMutation } from "@/lib/admin/runtime-case-store";
import { upgradeAllCasesToCdm, needsCdmUpgrade } from "@/lib/cdm";

/** POST — tüm vakaları TIP-AI CDM v1 şekline zorla yükselt */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const { requirePermission } = await import("@/lib/admin/permissions");
  const denied = requirePermission(session, "system.migrate");
  if (denied) return denied;

  const store = await loadRuntimeCasesStore();
  const needing = store.cases.filter(needsCdmUpgrade).length;
  const { cases, upgradedCount, upgradedIds } = upgradeAllCasesToCdm(store.cases);
  await recordRuntimeCaseMutation({
    actor: session!.username,
    action: "import_cdm",
    message: `Toplu CDM v1 migrate: ${upgradedCount} vaka işlendi (${needing} aday).`,
    patches: [],
    mutate: (target) => {
      target.cases = cases;
    },
  });

  return NextResponse.json({
    ok: true,
    upgradedCount,
    upgradedIds,
    total: cases.length,
  });
}
