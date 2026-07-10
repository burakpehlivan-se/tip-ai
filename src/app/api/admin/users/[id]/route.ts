export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { requirePermission } from "@/lib/admin/permissions";
import { deleteUser, publicUser, updateUser } from "@/lib/admin/users";
import { appendLog } from "@/lib/admin/store";
import { AdminRole } from "@/lib/admin/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  try {
    const body = await req.json();
    const user = updateUser(params.id, {
      role: body.role as AdminRole | undefined,
      displayName: body.displayName,
      active: body.active,
      password: body.password ? String(body.password) : undefined,
    });

    appendLog({
      action: "update_user",
      actor: session!.username,
      message: `Kullanıcı güncellendi: ${user.username}`,
      patches: [
        {
          path: `users.${user.id}`,
          before: null,
          after: { role: user.role, active: user.active },
        },
      ],
    });

    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Güncellenemedi" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromRequest(req);
  const denied = requirePermission(session, "users.manage");
  if (denied) return denied;

  try {
    if (session!.userId === params.id) {
      return NextResponse.json(
        { error: "Kendi hesabınızı silemezsiniz." },
        { status: 400 }
      );
    }
    deleteUser(params.id);
    appendLog({
      action: "delete_user",
      actor: session!.username,
      message: `Kullanıcı silindi: ${params.id}`,
      patches: [],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Silinemedi" },
      { status: 400 }
    );
  }
}
