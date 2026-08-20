import {
  checkAuthMigrationReadiness,
  checkCaseStoreMigrationReadiness,
} from "@/lib/auth/migration-readiness";
import { storeMode } from "@/lib/store-mode";
import { rateLimitStoreMode, type RateLimitStoreMode } from "@/lib/security/rate-limit";

export type HealthStatus = "ok" | "not_ready";

export type ReadinessPayload = {
  status: HealthStatus;
  auth: {
    store: "json" | "postgres" | "invalid";
    migration: "not_required" | "not_checked" | Record<string, boolean>;
  };
  attempts?: {
    store: "json" | "postgres";
    runtime: "ready" | "not_ready";
  };
  rateLimit?: {
    store: RateLimitStoreMode | "invalid";
    runtime: "ready" | "not_ready";
  };
  cases?: {
    store: "json" | "postgres";
    runtime: "ready" | "not_ready";
    migration: "not_required" | Record<string, boolean>;
    shadowRead: boolean;
  };
};

/**
 * Trafiğe kabul kararının tek kaynağı. JSON auth modu dış bağımlılık olmadan
 * çalışabildiği için yalnızca yapılandırma geçerliliği aranır; PostgreSQL modu
 * ise zorunlu şema migration'ları tamamlanmadan hazır sayılmaz.
 */
export async function getReadiness(): Promise<{ ready: boolean; payload: ReadinessPayload }> {
  try {
    const store = storeMode();
    const attempts = storeMode();
    const rateLimit = rateLimitStoreMode();
    const cases = storeMode();
    // Artık tüm vaka verileri postgres'te; JSON file-store kontrolü kaldırıldı.
    const needsAuthReadiness = store === "postgres" || rateLimit === "postgres";
    const [authReadiness, caseReadiness] = await Promise.all([
      needsAuthReadiness ? checkAuthMigrationReadiness() : Promise.resolve(null),
      checkCaseStoreMigrationReadiness(),
    ]);
    const attemptsReady = attempts === "postgres";
    const authReady = authReadiness?.ok ?? false;
    const rateLimitReady = rateLimit === "memory" || authReady;
    const casesReady = caseReadiness?.ok ?? false;
    const ready = authReady && attemptsReady && rateLimitReady && casesReady;
    return {
      ready,
      payload: {
        status: ready ? "ok" : "not_ready",
        auth: { store, migration: authReadiness?.checks ?? "not_required" },
        attempts: { store: attempts, runtime: attemptsReady ? "ready" : "not_ready" },
        rateLimit: { store: rateLimit, runtime: rateLimitReady ? "ready" : "not_ready" },
        cases: {
          store: cases,
          runtime: casesReady ? "ready" : "not_ready",
          migration: caseReadiness?.checks ?? "not_required",
          shadowRead: false,
        },
      },
    };
  } catch {
    return {
      ready: false,
      payload: {
        status: "not_ready",
        auth: { store: "invalid", migration: "not_checked" },
        rateLimit: { store: "invalid", runtime: "not_ready" },
      },
    };
  }
}
