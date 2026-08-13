import { authUserStoreMode } from "@/lib/auth/runtime-user-store";

export type AttemptStoreMode = "json" | "postgres";

/**
 * Deneme deposu cutover anahtarı. PostgreSQL modu yalnızca merkezi kullanıcı
 * deposuyla birlikte çalışabilir; guest denemeler yine JSON'da tutulur.
 */
export function attemptStoreMode(value = process.env.ATTEMPT_STORE): AttemptStoreMode {
  if (value === undefined || value === "" || value === "json") return "json";
  if (value === "postgres") {
    if (authUserStoreMode() !== "postgres") {
      throw new Error("ATTEMPT_STORE=postgres için AUTH_USER_STORE=postgres zorunludur.");
    }
    return "postgres";
  }
  throw new Error("ATTEMPT_STORE yalnızca json veya postgres olabilir.");
}

/** Geçici/guest oturumlar hiçbir zaman PostgreSQL kullanıcı kimliği gerektirmez. */
export function shouldUsePostgresAttemptStore(actor: string): boolean {
  return !actor.startsWith("guest:") && attemptStoreMode() === "postgres";
}

/** Adapter bağlanana kadar PostgreSQL seçiminin JSON'a sessizce düşmesini engeller. */
export function assertSupportedAttemptStore(actor: string): void {
  if (shouldUsePostgresAttemptStore(actor)) {
    throw new Error("PostgreSQL deneme deposu adapter'ı bu sürümde henüz etkin değil.");
  }
}
