import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AdminSessionPayload } from "./types";

export const SESSION_COOKIE = "tip_ai_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 saat

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-only-insecure-secret-change-me"
  );
}

export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
  };
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(username: string): string {
  const payload: AdminSessionPayload = {
    username,
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
    return payload;
  } catch {
    return null;
  }
}

export function verifyPassword(username: string, password: string): boolean {
  const creds = getAdminCredentials();
  try {
    const uOk =
      username.length === creds.username.length &&
      timingSafeEqual(Buffer.from(username), Buffer.from(creds.username));
    const pOk =
      password.length === creds.password.length &&
      timingSafeEqual(Buffer.from(password), Buffer.from(creds.password));
    return uOk && pOk;
  } catch {
    return false;
  }
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
