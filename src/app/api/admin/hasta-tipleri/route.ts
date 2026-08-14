export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadHastaTipleriStore, saveHastaTipleriStore, createBackup } from "@/lib/admin/store";
import { hastaTipiSlug, parseHastaTipiInput } from "@/lib/admin/hasta-tipi-input";
import { getRequestId, logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.read");
  if (denied) return denied;

  const store = loadHastaTipleriStore();
  const tipler = [...store.tipler].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  return NextResponse.json({ tipler });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "cases.write");
  if (denied) return denied;

  try {
    const raw = await req.json().catch(() => null);
    const parsed = parseHastaTipiInput(raw, { requireAd: true });
    if (!parsed.ok) {
      return NextResponse.json({ error: "Geçersiz hasta tipi.", issues: parsed.issues }, { status: 400 });
    }

    const ad = (parsed.value.ad || "").trim();
    const slug = hastaTipiSlug(ad);
    if (!slug) {
      return NextResponse.json({ error: "Geçerli bir tip adı girin." }, { status: 400 });
    }

    const store = loadHastaTipleriStore();
    if (store.tipler.some((t) => t.id === slug)) {
      return NextResponse.json({ error: "Bu isimde bir hasta tipi zaten var." }, { status: 409 });
    }

    const now = Date.now();
    const tip = {
      id: slug,
      ad,
      aciklama: parsed.value.aciklama,
      yasAraligi: parsed.value.yasAraligi ?? [30, 70],
      cinsiyetTercih: parsed.value.cinsiyetTercih ?? "herhangi",
      komorbiditeler: parsed.value.komorbiditeler ?? [],
      kisilikTipi: parsed.value.kisilikTipi,
      konusmaKurallari: parsed.value.konusmaKurallari,
      konusmaOrnekleri: parsed.value.konusmaOrnekleri,
      ornekCumleler: parsed.value.ornekCumleler,
      ornekCevaplar: parsed.value.ornekCevaplar,
      createdAt: now,
      updatedAt: now,
    };
    store.tipler.push(tip);
    saveHastaTipleriStore(store);
    createBackup("hasta-tipi-eklendi", session!.username);

    return NextResponse.json({ ok: true, tip });
  } catch (error) {
    logger.exception("Hasta tipi oluşturulamadı", error, {
      requestId: getRequestId(req),
      route: "/api/admin/hasta-tipleri",
    });
    return NextResponse.json({ error: "Hasta tipi oluşturulamadı." }, { status: 500 });
  }
}
