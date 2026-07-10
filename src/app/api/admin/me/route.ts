export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/admin/auth";
import { permissionsForRole, ROLE_LABELS } from "@/lib/admin/permissions";

export async function GET() {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const role = session.role || "admin";
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role,
    roleLabel: ROLE_LABELS[role],
    userId: session.userId,
    permissions: Array.from(permissionsForRole(role)),
    exp: session.exp,
  });
}
