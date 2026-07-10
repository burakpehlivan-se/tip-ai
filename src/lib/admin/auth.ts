import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AdminRole, AdminSessionPayload } from "./types";
import { getAdminCredentials } from "./auth-env";
import { authenticateUser } from "./users";

export const SESSION_COOKIE = "tip_ai_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 saat

export { getAdminCredentials };

function secret(): string {
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
export function verifyPassword(username: string, password: string): boolean {
  return authenticateUser(username, password) !== null;
}

export function loginUser(
  username: string,
  password: string
): { username: string; role: AdminRole; userId: string } | null {
  const auth = authenticateUser(username, password);
  if (!auth) return null;
  return {
    username: auth.user.username,
    role: auth.user.role,
    userId: auth.user.id,
  };
}

export function getSessionFromCookies(): AdminSessionPayload | null {
  const jar = cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function getSessionFromRequest(req: NextRequest): AdminSessionPayload | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
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
