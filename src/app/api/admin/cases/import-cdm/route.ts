export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { clone, loadCasesStore, recordMutation } from "@/lib/admin/store";
import {
  cdmToAdminVaka,
  parseCdmInput,
  validateCdmDocument,
  TipAiCdmDocument,
} from "@/lib/cdm";

/**
 * POST /api/admin/cases/import-cdm
 * Body: TipAiCdmDocument | TipAiCdmBundle | { cases: [...] }
 * Query: dryRun=1 → sadece validate; overwrite=1 → mevcut id güncelle
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
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

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        count: docs.length,
        validations,
        previewIds: docs.map((d) => d.id),
      });
    }

    const store = loadCasesStore();
    const existingIds = new Set(store.cases.map((c) => c.id));
    const imported: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];

    const adminCases = docs.map((d) => cdmToAdminVaka(d));

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
      session.username,
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import başarısız" },
      { status: 500 }
    );
  }
}
