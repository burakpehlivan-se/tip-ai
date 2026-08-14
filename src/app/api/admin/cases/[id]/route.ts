export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  clone,
} from "@/lib/admin/store";
import {
  getRuntimeCaseById,
  recordRuntimeCaseMutation,
} from "@/lib/admin/runtime-case-store";
import { AdminVaka } from "@/lib/admin/types";
import { parseCasePatchInput } from "@/lib/admin/case-input";
import { getRequestId, logger } from "@/lib/logger";

function decodeId(raw: string): string {
  return decodeURIComponent(raw);
}

function expectedUpdatedAtFrom(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function staleCaseResponse(currentUpdatedAt: number) {
  return NextResponse.json(
    {
      error: "Vaka başka bir kullanıcı tarafından güncellendi. Değişiklikleri yeniden yükleyip tekrar deneyin.",
      currentUpdatedAt,
    },
    { status: 409 }
  );
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
  const vaka = await getRuntimeCaseById(id);
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
  const existing = await getRuntimeCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  try {
    const rawBody = await req.json().catch(() => null);
    const expectedUpdatedAt = expectedUpdatedAtFrom((rawBody as { expectedUpdatedAt?: unknown } | null)?.expectedUpdatedAt);
    if (expectedUpdatedAt === null) {
      return NextResponse.json({ error: "Güncel vaka sürümü belirtilmelidir." }, { status: 400 });
    }
    if (expectedUpdatedAt !== existing.updatedAt) return staleCaseResponse(existing.updatedAt);
    const parsed = parseCasePatchInput(rawBody);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Geçersiz vaka verisi.", issues: parsed.issues },
        { status: 400 }
      );
    }
    const updates = parsed.value;
    const protectedFields: Array<keyof AdminVaka> = [
      "surum",
      "uzmanOnayi",
      "uzmanOnaylayan",
      "uzmanOnayTarihi",
    ];
    if (protectedFields.some((field) => updates[field] !== undefined)) {
      return NextResponse.json(
        { error: "Sürüm ve uzman onayı yalnızca inceleme akışıyla değiştirilebilir." },
        { status: 400 }
      );
    }
    if (updates.durum === "aktif") {
      return NextResponse.json(
        { error: "Vaka doğrudan yayınlanamaz; önce incelemeye gönderilmelidir." },
        { status: 409 }
      );
    }

    const updateKeys = Object.keys(updates) as (keyof AdminVaka)[];
    const contentFields = new Set<keyof AdminVaka>([
      "hastalikAdi", "seviye", "yasAraligi", "cinsiyetTercih", "anaSikayet",
      "ozetBilgiler", "semptomSablon", "rubric", "statikTestler", "generatedTests",
      "testOverrides", "hastaYanitlari", "idealYol", "egitimNotu", "cdmVersion",
      "patientProfil", "vitals", "conditions", "tedavi",
    ]);
    const contentChanged = updateKeys.some((key) => contentFields.has(key));
    const lifecycleUpdates: Partial<AdminVaka> = { sonDuzenleyen: session!.username };
    if (contentChanged && existing.incelemeDurumu !== "taslak") {
      lifecycleUpdates.durum = "taslak";
      lifecycleUpdates.surum = existing.surum + 1;
      lifecycleUpdates.uzmanOnayi = false;
      lifecycleUpdates.uzmanOnaylayan = undefined;
      lifecycleUpdates.uzmanOnayTarihi = undefined;
      lifecycleUpdates.contentChecksum = undefined;
      lifecycleUpdates.incelemeDurumu = "taslak";
      lifecycleUpdates.incelemeyeGonderen = undefined;
      lifecycleUpdates.incelemeyeGonderilmeTarihi = undefined;
      lifecycleUpdates.incelemeNotu = undefined;
    } else if (contentChanged && existing.incelemeDurumu === "incelemede") {
      lifecycleUpdates.incelemeDurumu = "taslak";
      lifecycleUpdates.incelemeyeGonderen = undefined;
      lifecycleUpdates.incelemeyeGonderilmeTarihi = undefined;
    }
    const persistedUpdates = { ...updates, ...lifecycleUpdates };
    const patchKeys = Object.keys(persistedUpdates) as (keyof AdminVaka)[];
    const patches = patchKeys.map((key) => ({
      path: `cases.${id}.${key}`,
      caseId: id,
      field: key,
      before: clone(existing[key]),
      after: clone(persistedUpdates[key]),
    }));

    if (!patches.length) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    const modifiedAt = Math.max(Date.now(), existing.updatedAt + 1);
    const result = await recordRuntimeCaseMutation({
      actor: session!.username,
      action: "update_case",
      message: `"${existing.hastalikAdi}" vakası güncellendi (${patches.map((p) => p.field).join(", ")}).`,
      patches,
      mutate: (s) => {
        const idx = s.cases.findIndex((c) => c.id === id);
        if (idx >= 0) {
          s.cases[idx] = { ...s.cases[idx], ...persistedUpdates, updatedAt: modifiedAt };
        }
      },
    });

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
  const existing = await getRuntimeCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const result = await recordRuntimeCaseMutation({
    actor: session!.username,
    action: "delete_case",
    message: `"${existing.hastalikAdi}" vakası silindi (${id}).`,
    patches: [
      {
        path: `__case_delete__:${id}`,
        caseId: id,
        before: clone(existing),
        after: null,
      },
    ],
    mutate: (s) => {
      s.cases = s.cases.filter((c) => c.id !== id);
    },
  });

  return NextResponse.json({ ok: true, log: result.log, backup: result.backup });
}
