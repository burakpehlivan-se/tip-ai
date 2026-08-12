export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { findUserById, findUserByUsername } from "@/lib/auth/runtime-user-store";
import { getStudentSessionFromRequest } from "@/lib/student/auth";

type SessionSummary = {
  username: string;
  displayName: string;
  role: "admin" | "doktor" | "ogrenci";
  href: string;
};

async function summaryFor(
  session: { username: string; userId?: string; role: "admin" | "doktor" | "ogrenci" },
  href: string
): Promise<SessionSummary> {
  const user = session.userId
    ? (await findUserById(session.userId)) || (await findUserByUsername(session.username))
    : await findUserByUsername(session.username);

  return {
    username: user?.username || session.username,
    displayName: user?.displayName || user?.username || session.username,
    role: session.role,
    href,
  };
}

/**
 * İstemci ekranlarının tek bir sözleşmeyle oturum durumunu öğrenmesini sağlar.
 * Yalnızca görüntüleme için gerekli ad, rol ve hedef yol döner; token/izin/sır
 * asla dönmez. Yanıt önbelleğe alınmaz, böylece çıkış/pasifleştirme anında görünür.
 */
export async function GET(req: NextRequest) {
  const student = await getStudentSessionFromRequest(req);
  const admin = await getSessionFromRequest(req);

  return NextResponse.json(
    {
      student: student ? await summaryFor(student, "/profilim") : null,
      admin: admin ? await summaryFor(admin, "/admin/panel") : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
