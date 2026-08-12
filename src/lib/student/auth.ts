/**
 * Öğrenci oturumu — admin oturumundan tamamen ayrı cookie.
 * Token üretim/doğrulama admin auth'taki HMAC altyapısını paylaşır.
 */

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
} from "@/lib/admin/auth";
import type { AdminSessionPayload } from "@/lib/admin/types";
import { authenticateUser, findUserById, findUserByUsername } from "@/lib/auth/runtime-user-store";

export const STUDENT_SESSION_COOKIE = "tip_ai_student_session";
export const STUDENT_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 saat

export function createStudentSessionToken(
  username: string,
  userId: string
): string {
  return createSessionToken(username, "ogrenci", userId);
}

export function verifyStudentSessionToken(
  token: string | undefined | null
): AdminSessionPayload | null {
  const session = verifySessionToken(token);
  if (session && session.role !== "ogrenci") return null;
  return session;
}

/**
 * İmzalı öğrenci token'ını güncel kullanıcı kaydıyla eşleştirir. Böylece hesap
 * pasifleştirildiğinde veya rol değiştiğinde mevcut öğrenci oturumu da anında
 * geçersiz olur.
 */
export async function getCurrentStudentSession(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  const session = verifyStudentSessionToken(token);
  if (!session) return null;

  const user = session.userId
    ? (await findUserById(session.userId)) || (await findUserByUsername(session.username))
    : await findUserByUsername(session.username);
  if (!user || !user.active || user.role !== "ogrenci") return null;
  if (user.username.toLowerCase() !== session.username.toLowerCase()) return null;

  return { ...session, username: user.username, role: user.role, userId: user.id };
}

export async function getStudentSessionFromCookies(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  return getCurrentStudentSession(jar.get(STUDENT_SESSION_COOKIE)?.value);
}

export async function getStudentSessionFromRequest(
  req: NextRequest
): Promise<AdminSessionPayload | null> {
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
