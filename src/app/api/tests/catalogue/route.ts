export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadCasesStore } from "@/lib/admin/store";
import { computeCatalogueFlags } from "@/lib/pipeline/catalogue-flags";
import { testCatalogueWithMeta } from "@/lib/data";

/**
 * Public (öğrenci tarafı) — test kataloğu + hasData bayrakları.
 *
 * ?mode=default (varsayılan) → hasData=true + visibility!=hidden
 * ?mode=advanced             → visibility!=hidden
 * ?mode=all                  → tümü
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "default";

  const store = loadCasesStore();
  const flags = computeCatalogueFlags(store.cases);
  const full = testCatalogueWithMeta(flags.hasData);

  let catalogue = full;
  if (mode === "default") {
    catalogue = full.filter(
      (t: { hasData?: boolean; visibility: string }) => t.hasData && t.visibility !== "hidden"
    );
  } else if (mode === "advanced") {
    catalogue = full.filter((t: { visibility: string }) => t.visibility !== "hidden");
  }
  // "all": no filter

  return NextResponse.json({
    mode,
    catalogue,
    stats: {
      total: full.length,
      visibleDefault: full.filter((t: { visibility: string }) => t.visibility === "visible_default").length,
      visibleAdvanced: full.filter((t: { visibility: string }) => t.visibility === "visible_advanced").length,
      hidden: full.filter((t: { visibility: string }) => t.visibility === "hidden").length,
      withData: flags.totalWithData,
      motorCapable: flags.totalMotorCapable,
    },
  });
}
