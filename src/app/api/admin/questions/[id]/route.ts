export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getRequestId, logger } from "@/lib/logger";
import { ChipKategorisi } from "@/lib/types";
import {
  deleteCustomQuestion,
  updateCustomQuestion,
} from "@/lib/admin/questions-store";

const VALID_KATEGORILER: ChipKategorisi[] = [
  "anamnez-agri",
  "anamnez-sistemik",
  "anamnez-oyku",
  "soygecmis",
  "vital",
  "fizik",
  "red-flag",
];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  const { id } = await params;
  try {
    const body = await req.json().catch(() => null);
    const patch: Record<string, unknown> = {};
    if (body.etiket !== undefined) {
      const v = String(body.etiket).trim();
      if (v.length < 3 || v.length > 120) return NextResponse.json({ error: "Soru metni 3-120 karakter olmalı." }, { status: 400 });
      patch.etiket = v;
    }
    if (body.kategori !== undefined) {
      if (!VALID_KATEGORILER.includes(body.kategori)) return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
      patch.kategori = body.kategori;
    }
    if (body.scope !== undefined) {
      if (body.scope !== "global" && body.scope !== "poliklinik") return NextResponse.json({ error: "Geçersiz kapsam." }, { status: 400 });
      patch.scope = body.scope;
      patch.poliklinikKey = body.scope === "poliklinik" ? String(body.poliklinikKey || "").trim() || null : null;
      if (body.scope === "poliklinik" && !patch.poliklinikKey) return NextResponse.json({ error: "Klinik seçimi gerekli." }, { status: 400 });
    } else if (body.poliklinikKey !== undefined) {
      patch.poliklinikKey = String(body.poliklinikKey).trim() || null;
    }

    const updated = await updateCustomQuestion(id, patch as never);
    return NextResponse.json({ ok: true, question: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Güncellenemedi.";
    logger.exception("Soru güncellenemedi", error, { requestId: getRequestId(req), route: "/api/admin/questions/[id]" });
    const status = msg.includes("bulunamadı") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteCustomQuestion(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Silinemedi.";
    logger.exception("Soru silinemedi", error, { requestId: getRequestId(req), route: "/api/admin/questions/[id]" });
    const status = msg.includes("bulunamadı") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
