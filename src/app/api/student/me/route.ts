export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getStudentSessionFromRequest } from "@/lib/student/auth";
import { findUserByUsername } from "@/lib/admin/users";

export async function GET(req: NextRequest) {
  const session = getStudentSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const user = findUserByUsername(session.username);
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
