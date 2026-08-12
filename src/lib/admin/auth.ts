import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AdminRole, AdminSessionPayload } from "./types";
import { getAdminCredentials } from "./auth-env";
import { authenticateUser, findUserById, findUserByUsername } from "@/lib/auth/runtime-user-store";

export const SESSION_COOKIE = "tip_ai_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 saat

export { getAdminCredentials };

function secret(): string {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ADMIN_SESSION_SECRET) {
      throw new Error(
        "ADMIN_SESSION_SECRET production ortamında zorunludur (oturum imzalama)."
      );
    }
    return process.env.ADMIN_SESSION_SECRET;
  }
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-only-insecure-secret-change-me"
  );
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(
  username: string,
  role: AdminRole = "admin",
  userId?: string
): string {
  const payload: AdminSessionPayload = {
    username,
    role,
    userId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as AdminSessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.username) return null;
    // Eski oturumlar (role yok) → admin say (bootstrap)
    if (!payload.role) payload.role = "admin";
    return payload;
  } catch {
    return null;
  }
}

/** Kullanıcı deposu + env bootstrap */
export async function verifyPassword(username: string, password: string): Promise<boolean> {
  return (await authenticateUser(username, password)) !== null;
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ username: string; role: AdminRole; userId: string } | null> {
  const auth = await authenticateUser(username, password);
  if (!auth) return null;
  return {
    username: auth.user.username,
    role: auth.user.role,
    userId: auth.user.id,
  };
}

/** Yönetim paneline erişebilen roller. Öğrenci oturumu ayrı cookie ile taşınır. */
export function isPanelRole(role: AdminRole): role is "admin" | "doktor" {
  return role === "admin" || role === "doktor";
}

/**
 * İmzalı token tek başına yeterli değildir: kullanıcı hâlâ aktif mi ve rolü
 * token üretildiğinden sonra değişti mi kontrol edilir. Böylece pasifleştirme
 * veya rol düşürme mevcut oturumları da anında geçersiz kılar.
 */
export async function getCurrentSession(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = session.userId
    ? (await findUserById(session.userId)) || (await findUserByUsername(session.username))
    : await findUserByUsername(session.username);
  if (!user || !user.active) return null;
  if (user.username.toLowerCase() !== session.username.toLowerCase()) return null;
  if (user.role !== session.role) return null;

  return {
    ...session,
    username: user.username,
    role: user.role,
    userId: user.id,
  };
}

export async function getSessionFromCookies(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  const session = await getCurrentSession(jar.get(SESSION_COOKIE)?.value);
  return session && isPanelRole(session.role) ? session : null;
}

export async function getSessionFromRequest(req: NextRequest): Promise<AdminSessionPayload | null> {
  const session = await getCurrentSession(req.cookies.get(SESSION_COOKIE)?.value);
  return session && isPanelRole(session.role) ? session : null;
}

export function sessionCookieOptions(maxAgeSec = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
