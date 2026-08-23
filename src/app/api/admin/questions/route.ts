export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { getRequestId, logger } from "@/lib/logger";
import { ChipKategorisi } from "@/lib/types";
import {
  addCustomQuestion,
  listAllQuestions,
  getEffectiveChipHavuzu,
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

function isValidAksiyon(s: string): boolean {
  return /^[A-Z0-9_]{2,40}$/.test(s);
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const poliklinikKey = req.nextUrl.searchParams.get("poliklinikKey");
  const effective = getEffectiveChipHavuzu(poliklinikKey);
  const all = listAllQuestions();

  return NextResponse.json({
    effective,
    all,
    total: effective.length,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const etiket = String(body?.etiket || "").trim();
    const aksiyon = String(body?.aksiyon || "").trim().toUpperCase().replace(/\s+/g, "_");
    const kategori = String(body?.kategori || "").trim() as ChipKategorisi;
    const scope = body?.scope === "poliklinik" ? "poliklinik" : "global";
    const poliklinikKey = body?.poliklinikKey ? String(body.poliklinikKey).trim() : null;

    if (!etiket || etiket.length < 3 || etiket.length > 120) {
      return NextResponse.json({ error: "Soru metni 3-120 karakter olmalı." }, { status: 400 });
    }
    if (!isValidAksiyon(aksiyon)) {
      return NextResponse.json({ error: "Aksiyon 2-40 karakter, yalnızca A-Z, 0-9, _ içermeli." }, { status: 400 });
    }
    if (!VALID_KATEGORILER.includes(kategori)) {
      return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
    }
    if (scope === "poliklinik" && !poliklinikKey) {
      return NextResponse.json({ error: "Klinik seçimi gerekli." }, { status: 400 });
    }

    const q = await addCustomQuestion({
      etiket,
      aksiyon,
      kategori,
      scope,
      poliklinikKey,
      createdBy: session!.username,
    });

    return NextResponse.json({ ok: true, question: q });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Soru eklenemedi.";
    logger.exception("Soru eklenemedi", error, {
      requestId: getRequestId(req),
      route: "/api/admin/questions",
    });
    const status = msg.includes("zaten var") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
