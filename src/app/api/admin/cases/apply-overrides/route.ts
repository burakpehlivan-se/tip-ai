export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadCasesStore, saveCasesStore, appendLog, clone } from "@/lib/admin/store";
import {
  analyzeVakaOverrides,
  applyOverrideMigration,
} from "@/lib/pipeline/override-migrator";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { requirePermission } = await import("@/lib/admin/permissions");
  const denied = requirePermission(session, "system.migrate");
  if (denied) return denied;

  try {
    const body = await req.json();
    const vakaId = body.vakaId as string | undefined;
    const dryRun = body.dryRun !== false; // default true

    const store = loadCasesStore();

    if (vakaId) {
      const vaka = store.cases.find((c) => c.id === vakaId);
      if (!vaka) {
        return NextResponse.json({ error: "Vaka bulunamadı" }, { status: 404 });
      }

      const report = analyzeVakaOverrides(vaka);

      if (dryRun) {
        return NextResponse.json({
          dryRun: true,
          vakaId,
          report,
          message: `Dry run — ${report.summary.removableCount} test referans kütüphanesinden karşılanabilir.`,
        });
      }

      const updated = applyOverrideMigration(vaka, report);
      const index = store.cases.findIndex((c) => c.id === vakaId);
      store.cases[index] = updated;
      store.updatedAt = Date.now();
      store.changeCount = (store.changeCount || 0) + 1;
      saveCasesStore(store);

      appendLog({
        action: "update_case",
        actor: session!.username,
        message: `Override migration uygulandı: ${vakaId} — ${report.summary.removableCount} test temizlendi.`,
        patches: [
          {
            path: `__override_migration__:${vakaId}`,
            caseId: vakaId,
            field: "statikTestler",
            before: clone(vaka.statikTestler),
            after: clone(updated.statikTestler),
          },
        ],
      });

      return NextResponse.json({
        ok: true,
        vakaId,
        removed: report.summary.removableCount,
        kept: report.summary.keepCount,
        message: `${report.summary.removableCount} test referans kütüphanesine taşındı, ${report.summary.keepCount} test override olarak korundu.`,
      });
    }

    // Bulk apply
    const results: Array<{
      vakaId: string;
      removed: number;
      kept: number;
    }> = [];

    for (const vaka of store.cases) {
      const report = analyzeVakaOverrides(vaka);
      if (report.summary.removableCount === 0) continue;

      if (!dryRun) {
        const updated = applyOverrideMigration(vaka, report);
        const index = store.cases.findIndex((c) => c.id === vaka.id);
        store.cases[index] = updated;
      }

      results.push({
        vakaId: vaka.id,
        removed: report.summary.removableCount,
        kept: report.summary.keepCount,
      });
    }

    if (!dryRun) {
      store.updatedAt = Date.now();
      store.changeCount = (store.changeCount || 0) + 1;
      saveCasesStore(store);

      const totalRemoved = results.reduce((s, r) => s + r.removed, 0);
      appendLog({
        action: "update_case",
        actor: session!.username,
        message: `Toplu override migration: ${results.length} vaka işlendi, ${totalRemoved} test temizlendi.`,
        patches: [],
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      results,
      totalMigrated: results.length,
      totalRemoved: results.reduce((s, r) => s + r.removed, 0),
      totalKept: results.reduce((s, r) => s + r.kept, 0),
      message: dryRun
        ? `Dry run: ${results.length} vakada ${results.reduce((s, r) => s + r.removed, 0)} test temizlenebilir.`
        : `${results.length} vaka güncellendi.`,
    });
  } catch (err) {
    console.error("apply-overrides failed:", err);
    return NextResponse.json(
      { error: "Migration başarısız." },
      { status: 500 }
    );
  }
}
