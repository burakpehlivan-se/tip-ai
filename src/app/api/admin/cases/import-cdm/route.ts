export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { caseContentChecksum } from "@/lib/admin/case-integrity";
import { clone, loadCasesStore, recordMutation } from "@/lib/admin/store";
import {
  createCdmImportConfirmation,
  verifyCdmImportConfirmation,
} from "@/lib/cdm/import-confirmation";
import {
  cdmToAdminVaka,
  parseCdmInput,
  validateCdmDocument,
  TipAiCdmDocument,
} from "@/lib/cdm";
import { getRequestId, logger } from "@/lib/logger";

/**
 * POST /api/admin/cases/import-cdm
 * Body: TipAiCdmDocument | TipAiCdmBundle | { cases: [...] }
 * Query: dryRun=1 → plan ve kısa ömürlü onay token'ı; overwrite=1 → mevcut id güncelle
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const { requirePermission } = await import("@/lib/admin/permissions");
  // dryRun: validate ok for doktor; gerçek import admin
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const denied = requirePermission(session, dryRun ? "cases.validate" : "cases.import");
  if (denied) return denied;
  const overwrite = req.nextUrl.searchParams.get("overwrite") === "1";

  try {
    const body = await req.json();
    let docs: TipAiCdmDocument[];
    try {
      docs = parseCdmInput(body);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Parse hatası" },
        { status: 400 }
      );
    }

    if (docs.length === 0) {
      return NextResponse.json({ error: "İçe aktarılacak vaka yok." }, { status: 400 });
    }

    const validations = docs.map((d, i) => {
      const v = validateCdmDocument(d);
      return { index: i, id: d.id || `index-${i}`, ...v };
    });

    const hardErrors = validations.filter((v) => !v.ok);
    if (hardErrors.length > 0) {
      return NextResponse.json(
        {
          error: `${hardErrors.length} belge doğrulamadan geçemedi.`,
          validations,
        },
        { status: 400 }
      );
    }

    const store = loadCasesStore();
    const existingIds = new Set(store.cases.map((c) => c.id));
    const imported: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];

    const adminCases = docs.map((d) => cdmToAdminVaka(d));

    const plan = adminCases.map((av) => ({
      id: av.id,
      action: !existingIds.has(av.id)
        ? "create"
        : overwrite
          ? "update"
          : "conflict",
      currentVersion: store.cases.find((caseItem) => caseItem.id === av.id)?.surum ?? null,
    }));
    const planBinding = {
      actor: session!.username,
      overwrite,
      storeUpdatedAt: store.updatedAt,
      documents: adminCases.map((item) => ({ id: item.id, checksum: caseContentChecksum(item) })),
    };

    if (dryRun) {
      const confirmation = createCdmImportConfirmation(planBinding);
      return NextResponse.json({
        ok: true,
        dryRun: true,
        count: docs.length,
        validations,
        previewIds: docs.map((d) => d.id),
        plan,
        confirmation,
        summary: {
          create: plan.filter((item) => item.action === "create").length,
          update: plan.filter((item) => item.action === "update").length,
          conflict: plan.filter((item) => item.action === "conflict").length,
        },
      });
    }

    if (!req.nextUrl.searchParams.get("confirmation")) {
      return NextResponse.json(
        { error: "İçe aktarma önce dry-run planı oluşturulup açıkça onaylanmalıdır." },
        { status: 428 }
      );
    }
    if (!verifyCdmImportConfirmation(req.nextUrl.searchParams.get("confirmation"), planBinding)) {
      return NextResponse.json(
        { error: "İçe aktarma planı geçersiz veya güncelliğini yitirmiş. Dry-run işlemini yeniden çalıştırın." },
        { status: 409 }
      );
    }

    for (const av of adminCases) {
      if (existingIds.has(av.id)) {
        if (!overwrite) {
          skipped.push(av.id);
          continue;
        }
        updated.push(av.id);
      } else {
        imported.push(av.id);
        existingIds.add(av.id);
      }
    }

    if (imported.length === 0 && updated.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: [],
        updated: [],
        skipped,
        message: "Tüm vakalar zaten var (overwrite=1 ile güncelleyebilirsiniz).",
        validations,
      });
    }

    const result = recordMutation(
      session!.username,
      "import_cdm",
      `CDM import: +${imported.length} yeni, ${updated.length} güncelleme, ${skipped.length} atlandı.`,
      adminCases
        .filter((av) => imported.includes(av.id) || updated.includes(av.id))
        .map((av) => {
          const before = store.cases.find((c) => c.id === av.id) || null;
          return {
            path: before ? `cases.${av.id}` : `__case_create__:${av.id}`,
            caseId: av.id,
            before: before ? clone(before) : null,
            after: clone(av),
          };
        }),
      (s) => {
        for (const av of adminCases) {
          if (skipped.includes(av.id)) continue;
          const idx = s.cases.findIndex((c) => c.id === av.id);
          if (idx >= 0) {
            if (overwrite) s.cases[idx] = av;
          } else {
            s.cases.push(av);
          }
        }
      }
    );

    return NextResponse.json({
      ok: true,
      imported,
      updated,
      skipped,
      validations,
      log: result.log,
      backup: result.backup,
    });
  } catch (e) {
    logger.exception("CDM içe aktarma işlemi başarısız", e, {
      requestId: getRequestId(req),
      route: "/api/admin/cases/import-cdm",
    });
    return NextResponse.json(
      { error: "CDM içe aktarma işlemi tamamlanamadı." },
      { status: 500 }
    );
  }
}
