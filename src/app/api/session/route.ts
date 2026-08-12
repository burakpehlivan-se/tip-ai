export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin/auth";
import { findUserById, findUserByUsername } from "@/lib/admin/users";
import { getStudentSessionFromRequest } from "@/lib/student/auth";

type SessionSummary = {
  username: string;
  displayName: string;
  role: "admin" | "doktor" | "ogrenci";
  href: string;
};

function summaryFor(
  session: { username: string; userId?: string; role: "admin" | "doktor" | "ogrenci" },
  href: string
): SessionSummary {
  const user = session.userId
    ? findUserById(session.userId)
    : findUserByUsername(session.username);

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
  const student = getStudentSessionFromRequest(req);
  const admin = getSessionFromRequest(req);

  return NextResponse.json(
    {
      student: student ? summaryFor(student, "/profilim") : null,
      admin: admin ? summaryFor(admin, "/admin/panel") : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
