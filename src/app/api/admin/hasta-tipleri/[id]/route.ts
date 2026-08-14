export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadHastaTipleriStore, saveHastaTipleriStore, createBackup } from "@/lib/admin/store";
import { hastaTipiSlug, parseHastaTipiInput } from "@/lib/admin/hasta-tipi-input";
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
  const tip = loadHastaTipleriStore().tipler.find((t) => t.id === id);
  if (!tip) return NextResponse.json({ error: "Hasta tipi bulunamadı." }, { status: 404 });
  return NextResponse.json({ tip });
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

  try {
    const raw = await req.json().catch(() => null);
    const parsed = parseHastaTipiInput(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Geçersiz hasta tipi.", issues: parsed.issues }, { status: 400 });
    }

    const store = loadHastaTipleriStore();
    const index = store.tipler.findIndex((t) => t.id === id);
    if (index < 0) return NextResponse.json({ error: "Hasta tipi bulunamadı." }, { status: 404 });

    const updates = { ...parsed.value };
    // ad değişirse id (slug) yeniden üretilir; çakışma varsa reddedilir.
    if (updates.ad !== undefined) {
      const yeniSlug = hastaTipiSlug(updates.ad);
      if (!yeniSlug) return NextResponse.json({ error: "Geçerli bir tip adı girin." }, { status: 400 });
      if (yeniSlug !== id && store.tipler.some((t) => t.id === yeniSlug)) {
        return NextResponse.json({ error: "Bu isimde bir hasta tipi zaten var." }, { status: 409 });
      }
      updates.id = yeniSlug;
    }

    store.tipler[index] = { ...store.tipler[index], ...updates, updatedAt: Date.now() };
    saveHastaTipleriStore(store);
    createBackup("hasta-tipi-guncellendi", session!.username);

    return NextResponse.json({ ok: true, tip: store.tipler[index] });
  } catch (error) {
    logger.exception("Hasta tipi güncellenemedi", error, {
      requestId: getRequestId(req),
      route: "/api/admin/hasta-tipleri/[id]",
    });
    return NextResponse.json({ error: "Hasta tipi güncellenemedi." }, { status: 500 });
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

  const store = loadHastaTipleriStore();
  const index = store.tipler.findIndex((t) => t.id === id);
  if (index < 0) return NextResponse.json({ error: "Hasta tipi bulunamadı." }, { status: 404 });

  store.tipler.splice(index, 1);
  saveHastaTipleriStore(store);
  createBackup("hasta-tipi-silindi", session!.username);

  return NextResponse.json({ ok: true });
}
