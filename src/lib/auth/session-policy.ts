import type { UserRole } from "./schema";

export type SessionPolicy = {
  idleTtlMs: number;
  absoluteTtlMs: number;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Raporun rol-temelli başlangıç politikası; token süresi absolute sınırdır. */
export const SESSION_POLICIES: Record<UserRole, SessionPolicy> = {
  admin: { idleTtlMs: 30 * MINUTE, absoluteTtlMs: 8 * HOUR },
  doktor: { idleTtlMs: 30 * MINUTE, absoluteTtlMs: 8 * HOUR },
  ogrenci: { idleTtlMs: 2 * HOUR, absoluteTtlMs: 12 * HOUR },
};

/** Her doğrulanmış istekte yazma yapmamak için last_seen güncellemesini seyreltir. */
export const SESSION_ACTIVITY_TOUCH_INTERVAL_MS = 5 * MINUTE;

export function sessionPolicyForRole(role: UserRole): SessionPolicy {
  return SESSION_POLICIES[role];
}
