export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { findUserByUsername } from "@/lib/auth/runtime-user-store";

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const user = await findUserByUsername(session.username);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    username: user.username,
    displayName: user.displayName || user.username,
    userId: user.id,
  });
}
