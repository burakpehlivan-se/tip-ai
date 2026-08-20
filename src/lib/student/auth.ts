/**
 * Öğrenci oturumu — admin oturumundan tamamen ayrı cookie.
 * Token üretim/doğrulama admin auth'taki HMAC altyapısını paylaşır.
 */

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createRuntimeSessionId, sessionCookieOptions, studentSecret } from "@/lib/admin/auth";
import { storeMode } from "@/lib/store-mode";
import { isAuthSessionActive } from "@/lib/auth/session-store";
import { sessionPolicyForRole } from "@/lib/auth/session-policy";
import type { SessionPayload } from "@/lib/admin/types";
import { authenticateUser, findUserById, findUserByUsername } from "@/lib/auth/runtime-user-store";

export const STUDENT_SESSION_COOKIE = "tip_ai_student_session";
export const STUDENT_SESSION_TTL_MS = sessionPolicyForRole("ogrenci").absoluteTtlMs; // 12 saat

function signStudent(payloadB64: string): string {
  return createHmac("sha256", studentSecret()).update(payloadB64).digest("base64url");
}

function createStudentSessionTokenRaw(
  username: string,
  role: "ogrenci",
  userId: string,
  sessionId?: string
): string {
  const payload: SessionPayload = {
    username,
    role,
    userId,
    sessionId,
    exp: Date.now() + STUDENT_SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signStudent(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function createStudentSessionToken(
  username: string,
  userId: string,
  deviceLabel?: string
): Promise<string> {
  const sessionId = await createRuntimeSessionId(userId, "ogrenci", STUDENT_SESSION_TTL_MS, deviceLabel);
  return createStudentSessionTokenRaw(username, "ogrenci", userId, sessionId);
}

export function verifyStudentSessionToken(
  token: string | undefined | null
): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = signStudent(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.username) return null;
    if (payload.role !== "ogrenci") return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * İmzalı öğrenci token'ını güncel kullanıcı kaydıyla eşleştirir. Böylece hesap
 * pasifleştirildiğinde veya rol değiştiğinde mevcut öğrenci oturumu da anında
 * geçersiz olur.
 */
export async function getCurrentStudentSession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  const session = verifyStudentSessionToken(token);
  if (!session) return null;

  const user = session.userId
    ? (await findUserById(session.userId)) || (await findUserByUsername(session.username))
    : await findUserByUsername(session.username);
  if (!user || !user.active || user.role !== "ogrenci") return null;
  if (user.username.toLowerCase() !== session.username.toLowerCase()) return null;
  if (storeMode() === "postgres") {
    if (!session.sessionId) return null;
    if (!(await isAuthSessionActive({ id: session.sessionId, userId: user.id, role: user.role }))) {
      return null;
    }
  }

  return { ...session, username: user.username, role: user.role, userId: user.id };
}

export async function getStudentSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return getCurrentStudentSession(jar.get(STUDENT_SESSION_COOKIE)?.value);
}

export async function getStudentSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  return getCurrentStudentSession(req.cookies.get(STUDENT_SESSION_COOKIE)?.value);
}

export function studentSessionCookieOptions() {
  return sessionCookieOptions(STUDENT_SESSION_TTL_MS / 1000);
}

/** Sadece aktif öğrenci hesapları giriş yapabilir (admin/doktor değil). */
export async function authenticateStudent(
  username: string,
  password: string
): Promise<{ username: string; userId: string } | null> {
  const auth = await authenticateUser(username, password);
  if (!auth) return null;
  if (auth.user.role !== "ogrenci") return null;
  return { username: auth.user.username, userId: auth.user.id };
}
