import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AdminRole, SessionPayload } from "./types";
import { getAdminCredentials } from "./auth-env";
import {
  authenticateUser,
  findUserById,
  findUserByUsername,
} from "@/lib/auth/runtime-user-store";
import { storeMode } from "@/lib/store-mode";
import { createAuthSession, isAuthSessionActive, revokeAuthSession } from "@/lib/auth/session-store";
import { sessionPolicyForRole } from "@/lib/auth/session-policy";

export const SESSION_COOKIE = "tip_ai_admin_session";
export const SESSION_TTL_MS = sessionPolicyForRole("admin").absoluteTtlMs; // 8 saat

export { getAdminCredentials };

// Geliştirme/test için süreç başına rastgele sır: kaynakta sabit fallback
// bulunmaz ve uygulama her yeniden başladığında eski geliştirme cookie'leri
// geçersizleşir. Production bu yola hiçbir zaman düşmez.
const DEV_SESSION_SECRET = randomBytes(32).toString("base64url");

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
    DEV_SESSION_SECRET
  );
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(
  username: string,
  role: AdminRole = "admin",
  userId?: string,
  sessionId?: string
): string {
  const payload: SessionPayload = {
    username,
    role,
    userId,
    sessionId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/** PostgreSQL kullanıcı deposunda her login için iptal edilebilir bir kayıt açar. */
export async function createRuntimeSessionId(
  userId: string,
  role: AdminRole,
  ttlMs = sessionPolicyForRole(role).absoluteTtlMs,
  deviceLabel?: string
): Promise<string | undefined> {
  if (storeMode() === "json") return undefined;
  return (await createAuthSession({ userId, role, ttlMs, deviceLabel })).id;
}

/** Çıkışta merkezi kaydı iptal eder; JSON modunda eski cookie temizleme davranışı sürer. */
export async function revokeRuntimeSession(token: string | undefined | null): Promise<void> {
  if (storeMode() === "json") return;
  const session = verifySessionToken(token);
  if (!session?.sessionId) return;
  await revokeAuthSession(session.sessionId);
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
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
    ) as SessionPayload;
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
): Promise<SessionPayload | null> {
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = session.userId
    ? (await findUserById(session.userId)) || (await findUserByUsername(session.username))
    : await findUserByUsername(session.username);
  if (!user || !user.active) return null;
  if (user.username.toLowerCase() !== session.username.toLowerCase()) return null;
  if (user.role !== session.role) return null;
  if (storeMode() === "postgres") {
    if (!session.sessionId) return null;
    if (!(await isAuthSessionActive({ id: session.sessionId, userId: user.id, role: user.role }))) {
      return null;
    }
  }

  return {
    ...session,
    username: user.username,
    role: user.role,
    userId: user.id,
  };
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const session = await getCurrentSession(jar.get(SESSION_COOKIE)?.value);
  return session && isPanelRole(session.role) ? session : null;
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
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
