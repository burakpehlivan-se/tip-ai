export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { loadSettings, saveSettings } from "@/lib/admin/store";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  return NextResponse.json({ settings: loadSettings() });
}

export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  try {
    const body = await req.json();
    const current = loadSettings();
    const next = {
      ...current,
      cemicegek: {
        ...current.cemicegek,
        ...(body.cemicegek || {}),
      },
      version: current.version,
    };
    // clamp
    next.cemicegek.geriDonusMin = Math.max(1, Number(next.cemicegek.geriDonusMin) || 2);
    next.cemicegek.geriDonusMax = Math.max(
      next.cemicegek.geriDonusMin,
      Number(next.cemicegek.geriDonusMax) || next.cemicegek.geriDonusMin
    );
    const saved = saveSettings(next, session.username);
    return NextResponse.json({ ok: true, settings: saved });
  } catch {
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }
}
