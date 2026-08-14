export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { clone } from "@/lib/admin/store";
import { loadRuntimeCasesStore, recordRuntimeCaseMutation } from "@/lib/admin/runtime-case-store";
import {
  analyzeVakaOverrides,
  applyOverrideMigration,
} from "@/lib/pipeline/override-migrator";
import { getRequestId, logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { requirePermission } = await import("@/lib/admin/permissions");
  const denied = requirePermission(session, "system.migrate");
  if (denied) return denied;

  try {
    const body = await req.json();
    const vakaId = body.vakaId as string | undefined;
    const dryRun = body.dryRun !== false; // default true

    const store = await loadRuntimeCasesStore();

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
      await recordRuntimeCaseMutation({
        actor: session!.username,
        action: "update_case",
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
        mutate: (target) => {
          const index = target.cases.findIndex((item) => item.id === vakaId);
          if (index >= 0) target.cases[index] = updated;
        },
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

    if (!dryRun && results.length > 0) {
      const totalRemoved = results.reduce((s, r) => s + r.removed, 0);
      await recordRuntimeCaseMutation({
        actor: session!.username,
        action: "update_case",
        message: `Toplu override migration: ${results.length} vaka işlendi, ${totalRemoved} test temizlendi.`,
        patches: [],
        mutate: (target) => {
          for (const result of results) {
            const original = target.cases.find((item) => item.id === result.vakaId);
            if (!original) continue;
            const report = analyzeVakaOverrides(original);
            const index = target.cases.findIndex((item) => item.id === result.vakaId);
            if (index >= 0) target.cases[index] = applyOverrideMigration(original, report);
          }
        },
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
    logger.exception("Override migration başarısız", err, {
      requestId: getRequestId(req),
      route: "/api/admin/cases/apply-overrides",
    });
    return NextResponse.json(
      { error: "Migration başarısız." },
      { status: 500 }
    );
  }
}
