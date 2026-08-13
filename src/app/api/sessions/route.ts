export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { listActiveAuthSessionsForUser, revokeAllAuthSessionsForUser } from "@/lib/auth/session-store";
import { getSessionPrincipal } from "@/lib/auth/session-principal";
import { recordAuthEvent } from "@/lib/auth/audit";

const NO_STORE = { "Cache-Control": "no-store" };

function unavailable() {
  return NextResponse.json(
    { error: "Oturum yönetimi PostgreSQL kimlik deposu etkinleştirildiğinde kullanılabilir." },
    { status: 409, headers: NO_STORE }
  );
}

function clearSessionCookie(response: NextResponse, cookieName: string) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(req: NextRequest) {
  const principal = await getSessionPrincipal(req);
  if (!principal) return NextResponse.json({ error: "Yetkisiz" }, { status: 401, headers: NO_STORE });

  // JSON modunda merkezi session tablosu bulunmadığından uydurma cihaz bilgisi
  // dönmeyiz. Cutover sonrasında aynı endpoint otomatik olarak etkinleşir.
  if (authUserStoreMode() !== "postgres") {
    return NextResponse.json({ available: false, sessions: [] }, { headers: NO_STORE });
  }

  const sessions = await listActiveAuthSessionsForUser(principal.session.userId!);
  return NextResponse.json(
    {
      available: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        role: session.role,
        deviceLabel: session.deviceLabel || "Bilinmeyen cihaz",
        issuedAt: session.issuedAt.getTime(),
        lastSeenAt: session.lastSeenAt.getTime(),
        expiresAt: session.expiresAt.getTime(),
        current: session.id === principal.session.sessionId,
      })),
    },
    { headers: NO_STORE }
  );
}

/** Tüm cihazları (mevcut oturum dahil) kapatır; cookie de aynı yanıtta temizlenir. */
export async function POST(req: NextRequest) {
  const principal = await getSessionPrincipal(req);
  if (!principal) return NextResponse.json({ error: "Yetkisiz" }, { status: 401, headers: NO_STORE });
  if (authUserStoreMode() !== "postgres") return unavailable();

  const count = await revokeAllAuthSessionsForUser(principal.session.userId!);
  await recordAuthEvent({
    event: "sessions_revoked_all",
    username: principal.session.username,
    role: principal.session.role,
    actor: principal.session.username,
    meta: { count },
  });

  const response = NextResponse.json({ ok: true, count }, { headers: NO_STORE });
  clearSessionCookie(response, principal.cookieName);
  return response;
}
