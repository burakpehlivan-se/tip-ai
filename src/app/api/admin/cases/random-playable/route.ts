export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { loadRuntimeCasesStore } from "@/lib/admin/runtime-case-store";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";

/**
 * Karışık (rastgele) oyna — kimliği açıklamadan rastgele bir yayınlanmış
 * vaka döndürür. İstemci id'yi URL'e yazmaz; böylece vaka kör oynanır.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "play");
  if (denied) return denied;

  const aktifler = (await loadRuntimeCasesStore()).cases.filter((c) => c.durum === "aktif");
  if (aktifler.length === 0) {
    return NextResponse.json({ error: "Oynanacak yayınlanmış vaka yok." }, { status: 404 });
  }
  const vaka = aktifler[Math.floor(Math.random() * aktifler.length)];
  return NextResponse.json({ id: vaka.id, vaka: adminVakaToPlayable(vaka) });
}
