export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revokeRuntimeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  await revokeRuntimeSession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
}
