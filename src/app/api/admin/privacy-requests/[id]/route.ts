export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { resolvePrivacyRequest } from "@/lib/privacy/requests";

/** Talebin fiilen silindiğini değil, yetkili operasyon incelemesinin tamamlandığını kaydeder. */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (body?.status !== "resolved") {
    return NextResponse.json({ error: "Yalnızca çözümlendi durumu atanabilir." }, { status: 400 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Geçersiz talep kimliği." }, { status: 400 });
  try {
    const request = await resolvePrivacyRequest(id, session!.username);
    if (!request) return NextResponse.json({ error: "Gizlilik talebi bulunamadı." }, { status: 404 });
    return NextResponse.json({ request }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Gizlilik talebi çözümlenmiş olarak kaydedilemedi." }, { status: 503 });
  }
}
