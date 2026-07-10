export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore, saveCasesStore, appendLog } from "@/lib/admin/store";
import { upgradeAllCasesToCdm, needsCdmUpgrade } from "@/lib/cdm";

/** POST — tüm vakaları TIP-AI CDM v1 şekline zorla yükselt */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const store = loadCasesStore();
  const needing = store.cases.filter(needsCdmUpgrade).length;
  const { cases, upgradedCount, upgradedIds } = upgradeAllCasesToCdm(store.cases);
  store.cases = cases;
  store.updatedAt = Date.now();
  store.changeCount = (store.changeCount || 0) + 1;
  saveCasesStore(store);

  appendLog({
    action: "import_cdm",
    actor: session.username,
    message: `Toplu CDM v1 migrate: ${upgradedCount} vaka işlendi (${needing} aday).`,
    patches: [],
  });

  return NextResponse.json({
    ok: true,
    upgradedCount,
    upgradedIds,
    total: cases.length,
  });
}
