export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import {
  CDM_SPEC_SUMMARY,
  CONDITION_VOCAB,
  EXAMPLE_CDM_KBH,
  OSCE_SECTION_CHECKLIST,
  TIP_AI_CDM_VERSION,
  knownTestKeys,
  TEST_KEY_ALIASES,
} from "@/lib/cdm";
import { birlesikTestKatalogu } from "@/lib/data";

/**
 * GET /api/admin/cases/cdm
 * ?template=1 → örnek KBH CDM JSON indir
 * aksi halde sözlük + spec özeti
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("template") === "1") {
    const body = JSON.stringify(EXAMPLE_CDM_KBH, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="tip-ai-cdm-v1-ornek-kbh.json"',
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    spec: CDM_SPEC_SUMMARY,
    cdmVersion: TIP_AI_CDM_VERSION,
    osceChecklist: OSCE_SECTION_CHECKLIST,
    conditions: Object.entries(CONDITION_VOCAB).map(([code, v]) => ({
      code,
      ad: v.ad,
      system: v.system || "local",
    })),
    testKeys: birlesikTestKatalogu,
    testKeyCount: knownTestKeys().size,
    testKeyAliases: TEST_KEY_ALIASES,
  });
}
