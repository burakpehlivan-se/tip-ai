export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/admin/store";

/** Çemiçgezek client’ı için auth’suz ayar okuma */
export async function GET() {
  const s = loadSettings();
  return NextResponse.json({ cemicegek: s.cemicegek });
}
