export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import {
  createUser,
  listUsersPublic,
  publicUser,
} from "@/lib/admin/users";
import { appendLog } from "@/lib/admin/store";
import { AdminRole } from "@/lib/admin/types";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  return NextResponse.json({ users: listUsersPublic() });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  try {
    const body = await req.json();
    const user = createUser({
      username: String(body.username || ""),
      password: String(body.password || ""),
      role: (body.role as AdminRole) || "doktor",
      displayName: body.displayName ? String(body.displayName) : undefined,
      createdBy: session!.username,
    });

    appendLog({
      action: "create_user",
      actor: session!.username,
      message: `Kullanıcı eklendi: ${user.username} (${user.role})`,
      patches: [
        {
          path: `users.${user.id}`,
          before: null,
          after: { username: user.username, role: user.role },
        },
      ],
    });

    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Kullanıcı oluşturulamadı" },
      { status: 400 }
    );
  }
}
