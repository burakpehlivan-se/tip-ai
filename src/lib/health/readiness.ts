import { checkAuthMigrationReadiness } from "@/lib/auth/migration-readiness";
import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { attemptStoreMode } from "@/lib/student/attempt-store-mode";

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
};

/**
 * Trafiğe kabul kararının tek kaynağı. JSON auth modu dış bağımlılık olmadan
 * çalışabildiği için yalnızca yapılandırma geçerliliği aranır; PostgreSQL modu
 * ise zorunlu şema migration'ları tamamlanmadan hazır sayılmaz.
 */
export async function getReadiness(): Promise<{ ready: boolean; payload: ReadinessPayload }> {
  try {
    const store = authUserStoreMode();
    const attempts = attemptStoreMode();
    if (store === "json") {
      return {
        ready: true,
        payload: {
          status: "ok",
          auth: { store, migration: "not_required" },
          attempts: { store: attempts, runtime: "ready" },
        },
      };
    }

    const readiness = await checkAuthMigrationReadiness();
    const attemptsReady = attempts === "json" || attempts === "postgres";
    return {
      ready: readiness.ok && attemptsReady,
      payload: {
        status: readiness.ok && attemptsReady ? "ok" : "not_ready",
        auth: { store, migration: readiness.checks },
        attempts: { store: attempts, runtime: attemptsReady ? "ready" : "not_ready" },
      },
    };
  } catch {
    return {
      ready: false,
      payload: { status: "not_ready", auth: { store: "invalid", migration: "not_checked" } },
    };
  }
}
