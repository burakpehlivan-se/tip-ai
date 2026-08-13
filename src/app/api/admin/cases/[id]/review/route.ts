export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { caseContentChecksum } from "@/lib/admin/case-integrity";
import { requirePermission } from "@/lib/admin/permissions";
import { clone, getCaseById, recordMutation } from "@/lib/admin/store";
import type { AdminVaka, AuditPatch } from "@/lib/admin/types";
import { validateAdminVakaForPublication } from "@/lib/cdm/validate-report";

type ReviewAction = "submit" | "approve" | "request_changes";

function decodeId(raw: string): string {
  return decodeURIComponent(raw);
}

function sameUser(left: string | undefined, right: string): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}

function parseBody(value: unknown): { action: ReviewAction; note?: string; expectedUpdatedAt: number } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { action?: unknown; note?: unknown; expectedUpdatedAt?: unknown };
  if (body.action !== "submit" && body.action !== "approve" && body.action !== "request_changes") return null;
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.trim().length > 2_000)) return null;
  if (typeof body.expectedUpdatedAt !== "number" || !Number.isSafeInteger(body.expectedUpdatedAt) || body.expectedUpdatedAt < 0) return null;
  return { action: body.action, note: typeof body.note === "string" ? body.note.trim() || undefined : undefined, expectedUpdatedAt: body.expectedUpdatedAt };
}

function lifecyclePatches(id: string, before: AdminVaka, after: Partial<AdminVaka>): AuditPatch[] {
  return (Object.keys(after) as Array<keyof AdminVaka>).map((field) => ({
    path: `cases.${id}.${field}`,
    caseId: id,
    field,
    before: before[field] === undefined ? undefined : clone(before[field]),
    after: after[field] === undefined ? undefined : clone(after[field]),
  }));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.approve");
  if (denied) return denied;

  const body = parseBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Geçersiz inceleme isteği." }, { status: 400 });

  const { id: rawId } = await params;
  const id = decodeId(rawId);
  const existing = getCaseById(id);
  if (!existing) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (body.expectedUpdatedAt !== existing.updatedAt) {
    return NextResponse.json(
      { error: "Vaka başka bir kullanıcı tarafından güncellendi. Değişiklikleri yeniden yükleyip tekrar deneyin.", currentUpdatedAt: existing.updatedAt },
      { status: 409 }
    );
  }

  const actor = session!.username;
  let updates: Partial<AdminVaka>;
  let action: "submit_case_review" | "approve_case_review" | "request_case_changes";
  let message: string;

  if (body.action === "submit") {
    if (existing.durum === "arsiv") {
      return NextResponse.json({ error: "Arşivdeki vaka incelemeye gönderilemez." }, { status: 409 });
    }
    if (existing.incelemeDurumu === "incelemede") {
      return NextResponse.json({ error: "Vaka zaten incelemede." }, { status: 409 });
    }
    updates = {
      durum: "taslak",
      uzmanOnayi: false,
      incelemeDurumu: "incelemede",
      incelemeyeGonderen: actor,
      incelemeyeGonderilmeTarihi: Date.now(),
      incelemeNotu: undefined,
      sonDuzenleyen: actor,
    };
    action = "submit_case_review";
    message = `"${existing.hastalikAdi}" vakası incelemeye gönderildi.`;
  } else {
    if (existing.incelemeDurumu !== "incelemede") {
      return NextResponse.json({ error: "Bu vaka onay için inceleme durumunda değil." }, { status: 409 });
    }
    if (sameUser(existing.olusturan, actor)) {
      return NextResponse.json(
        { error: "Vaka yazarı kendi vakasını onaylayamaz veya değişiklik talebi veremez." },
        { status: 403 }
      );
    }
    if (body.action === "request_changes") {
      updates = {
        durum: "taslak",
        uzmanOnayi: false,
        incelemeDurumu: "degisiklik_istendi",
        uzmanOnaylayan: actor,
        uzmanOnayTarihi: Date.now(),
        incelemeNotu: body.note || "Reviewer değişiklik istedi.",
      };
      action = "request_case_changes";
      message = `"${existing.hastalikAdi}" vakası için değişiklik istendi.`;
    } else {
      const publication = validateAdminVakaForPublication(existing);
      if (!publication.allowed) {
        return NextResponse.json(
          {
            error: "Vaka yayın için klinik kontrolleri geçemedi.",
            validation: publication.validation,
          },
          { status: 422 }
        );
      }
      updates = {
        durum: "aktif",
        uzmanOnayi: true,
        uzmanOnaylayan: actor,
        uzmanOnayTarihi: Date.now(),
        incelemeDurumu: "onayli",
        incelemeNotu: body.note,
        sonKlinikGozdenGecirmeTarihi: Date.now(),
      };
      action = "approve_case_review";
      message = `"${existing.hastalikAdi}" vakası bağımsız reviewer tarafından onaylandı.`;
    }
  }

  const candidate = { ...existing, ...updates } as AdminVaka;
  if (body.action === "approve") updates.contentChecksum = caseContentChecksum(candidate);
  const patches = lifecyclePatches(id, existing, updates);
  const modifiedAt = Math.max(Date.now(), existing.updatedAt + 1);
  const publishedVersion = body.action === "approve"
    ? {
        id: `${id}@${existing.surum}`,
        caseId: id,
        version: existing.surum,
        contentChecksum: updates.contentChecksum!,
        approvedBy: actor,
        approvedAt: updates.uzmanOnayTarihi!,
        content: {
          ...candidate,
          ...updates,
          updatedAt: modifiedAt,
        },
      }
    : null;
  if (publishedVersion) {
    patches.push({
      path: `__case_version_create__:${publishedVersion.id}`,
      caseId: id,
      before: null,
      after: {
        version: publishedVersion.version,
        contentChecksum: publishedVersion.contentChecksum,
        approvedBy: publishedVersion.approvedBy,
        approvedAt: publishedVersion.approvedAt,
      },
    });
  }
  const result = recordMutation(actor, action, message, patches, (store) => {
    const index = store.cases.findIndex((item) => item.id === id);
    if (index >= 0) store.cases[index] = { ...store.cases[index], ...updates, updatedAt: modifiedAt };
    if (publishedVersion) {
      const duplicate = store.publishedVersions.find((item) => item.id === publishedVersion.id);
      if (duplicate) {
        throw new Error("Bu vaka sürümü daha önce yayınlandı; aynı sürüm yeniden onaylanamaz.");
      }
      store.publishedVersions.push(publishedVersion);
    }
  });
  const vaka = result.store.cases.find((item) => item.id === id);
  return NextResponse.json({ ok: true, case: vaka, log: result.log, backup: result.backup });
}
