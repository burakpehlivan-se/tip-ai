export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadSettings, saveSettings } from "@/lib/admin/store";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "settings.read");
  if (denied) return denied;
  return NextResponse.json({ settings: loadSettings() });
}

export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "settings.write");
  if (denied) return denied;

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
    const saved = saveSettings(next, session!.username);
    return NextResponse.json({ ok: true, settings: saved });
  } catch {
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }
}
