export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { revokeAuthSessionForUser } from "@/lib/auth/session-store";
import { getSessionPrincipal } from "@/lib/auth/session-principal";
import { recordAuthEvent } from "@/lib/auth/audit";

const NO_STORE = { "Cache-Control": "no-store" };

function clearSessionCookie(response: NextResponse, cookieName: string) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getSessionPrincipal(req);
  if (!principal) return NextResponse.json({ error: "Yetkisiz" }, { status: 401, headers: NO_STORE });
  if (authUserStoreMode() !== "postgres") {
    return NextResponse.json(
      { error: "Oturum yönetimi PostgreSQL kimlik deposu etkinleştirildiğinde kullanılabilir." },
      { status: 409, headers: NO_STORE }
    );
  }

  const { id } = await params;
  const revoked = await revokeAuthSessionForUser({ id, userId: principal.session.userId! });
  if (!revoked) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 404, headers: NO_STORE });

  await recordAuthEvent({
    event: "session_revoked",
    username: principal.session.username,
    role: principal.session.role,
    actor: principal.session.username,
    meta: { current: id === principal.session.sessionId },
  });

  const response = NextResponse.json({ ok: true, current: id === principal.session.sessionId }, { headers: NO_STORE });
  if (id === principal.session.sessionId) clearSessionCookie(response, principal.cookieName);
  return response;
}
