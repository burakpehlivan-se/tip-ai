import { type NextRequest } from "next/server";
import {
  getCurrentSession,
  isPanelRole,
  SESSION_COOKIE,
} from "@/lib/admin/auth";
import { getCurrentStudentSession, STUDENT_SESSION_COOKIE } from "@/lib/student/auth";
import type { SessionPayload } from "@/lib/admin/types";

export type SessionPrincipal = {
  session: SessionPayload;
  cookieName: typeof SESSION_COOKIE | typeof STUDENT_SESSION_COOKIE;
};

/**
 * Oturum API'leri için tek kullanıcıyı belirler. Aynı istekte birden fazla
 * geçerli oturum cookie'si görülürse belirsizliği kabul etmek yerine reddeder.
 */
export async function getSessionPrincipal(req: NextRequest): Promise<SessionPrincipal | null> {
  const staffCandidate = await getCurrentSession(req.cookies.get(SESSION_COOKIE)?.value);
  const staff = staffCandidate && isPanelRole(staffCandidate.role) ? staffCandidate : null;
  const student = await getCurrentStudentSession(req.cookies.get(STUDENT_SESSION_COOKIE)?.value);

  if (staff && student) return null;
  const session = staff || student;
  if (!session?.userId) return null;

  return {
    session,
    cookieName: staff ? SESSION_COOKIE : STUDENT_SESSION_COOKIE,
  };
}
