export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  clone,
  getCaseById,
  loadCasesStore,
  recordMutation,
} from "@/lib/admin/store";
import { AdminVaka, normalizeAdminVaka } from "@/lib/admin/types";
import { parseCasePatchInput } from "@/lib/admin/case-input";
import { validateAdminVakaForPublication } from "@/lib/cdm/validate-report";
import { getRequestId, logger } from "@/lib/logger";

function decodeId(raw: string): string {
  return decodeURIComponent(raw);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = decodeId(rawId);
  const vaka = getCaseById(id);
  if (!vaka) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  return NextResponse.json({ case: vaka });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = decodeId(rawId);
  const existing = getCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    const parsed = parseCasePatchInput(await req.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Geçersiz vaka verisi.", issues: parsed.issues },
        { status: 400 }
      );
    }
    const updates = parsed.value;
    const updateKeys = Object.keys(updates) as (keyof AdminVaka)[];
    const patches = updateKeys.map((key) => ({
      path: `cases.${id}.${key}`,
      caseId: id,
      field: key,
      before: clone(existing[key]),
      after: clone(updates[key]),
    }));

    if (!patches.length) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    // Eski aktif kayıtları düzenlemeyi kilitlemeden, taslak/arsivden yeni bir
    // aktif vakaya geçişte klinik veri doğrulamasını zorunlu tut.
    const candidate = normalizeAdminVaka({ ...existing, ...updates, updatedAt: Date.now() });
    if (existing.durum !== "aktif" && candidate.durum === "aktif") {
      const publication = validateAdminVakaForPublication(candidate);
      if (!publication.allowed) {
        return NextResponse.json(
          {
            error: "Vaka aktif olarak yayınlanamaz. Zorunlu klinik alanları tamamlayın.",
            validation: publication.validation,
          },
          { status: 422 }
        );
      }
    }

    const result = recordMutation(
      session!.username,
      "update_case",
      `"${existing.hastalikAdi}" vakası güncellendi (${patches.map((p) => p.field).join(", ")}).`,
      patches,
      (s) => {
        const idx = s.cases.findIndex((c) => c.id === id);
        if (idx >= 0) {
          s.cases[idx] = { ...s.cases[idx], ...updates, updatedAt: Date.now() };
        }
      }
    );

    const updated = result.store.cases.find((c) => c.id === id);
    return NextResponse.json({ ok: true, case: updated, log: result.log, backup: result.backup });
  } catch (error) {
    logger.exception("Vaka güncellenemedi", error, {
      requestId: getRequestId(req),
      route: "/api/admin/cases/[id]",
    });
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = decodeId(rawId);
  const existing = getCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const result = recordMutation(
    session!.username,
    "delete_case",
    `"${existing.hastalikAdi}" vakası silindi (${id}).`,
    [
      {
        path: `__case_delete__:${id}`,
        caseId: id,
        before: clone(existing),
        after: null,
      },
    ],
    (s) => {
      s.cases = s.cases.filter((c) => c.id !== id);
    }
  );

  return NextResponse.json({ ok: true, log: result.log, backup: result.backup });
}
