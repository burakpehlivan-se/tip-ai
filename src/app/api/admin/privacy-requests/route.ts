export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { listPrivacyRequests } from "@/lib/privacy/requests";

/** Gizlilik talepleri yalnızca kullanıcı yönetimi yetkisi olan adminlere görünür. */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  const rawLimit = Number(req.nextUrl.searchParams.get("limit") || 100);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 100;
  try {
    const requests = await listPrivacyRequests({ limit });
    return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Gizlilik talepleri şu anda yüklenemedi." }, { status: 503 });
  }
}
