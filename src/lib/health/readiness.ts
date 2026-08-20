import fs from "fs";
import {
  checkAuthMigrationReadiness,
  checkCaseStoreMigrationReadiness,
} from "@/lib/auth/migration-readiness";
import { isShadowReadEnabled, storeMode } from "@/lib/store-mode";
import { rateLimitStoreMode, type RateLimitStoreMode } from "@/lib/security/rate-limit";
import { adminDataDir } from "@/lib/admin/paths";

function checkJsonStoreReadiness(): boolean {
  try {
    const dir = adminDataDir();
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    // cases.json yoksa seed edilecek — var ise okunabilir olmalı
    const casesFile = `${dir}/cases.json`;
    if (fs.existsSync(casesFile)) fs.accessSync(casesFile, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

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
    const caseShadowRead = isShadowReadEnabled();
    const jsonReady = checkJsonStoreReadiness();
    if (store === "json" && rateLimit === "memory" && cases === "json") {
      return {
        ready: jsonReady,
        payload: {
          status: jsonReady ? "ok" : "not_ready",
          auth: { store, migration: "not_required" },
          attempts: { store: attempts, runtime: jsonReady ? "ready" : "not_ready" },
          rateLimit: { store: rateLimit, runtime: jsonReady ? "ready" : "not_ready" },
          cases: { store: cases, runtime: jsonReady ? "ready" : "not_ready", migration: "not_required", shadowRead: caseShadowRead },
        },
      };
    }
    const needsAuthReadiness = store === "postgres" || rateLimit === "postgres";
    const [authReadiness, caseReadiness] = await Promise.all([
      needsAuthReadiness ? checkAuthMigrationReadiness() : Promise.resolve(null),
      cases === "postgres" ? checkCaseStoreMigrationReadiness() : Promise.resolve(null),
    ]);
    const attemptsReady = attempts === "json" || attempts === "postgres";
    // PostgreSQL rate limit, JSON auth'ta bile merkezi DB bağımlılığıdır; bu
    // nedenle migration/readiness geçmeden trafik kabul edilmez.
    const authReady = authReadiness?.ok ?? true;
    const rateLimitReady = rateLimit === "memory" || authReady;
    const casesReady = caseReadiness?.ok ?? true;
    const jsonNeeded = store === "json" || cases === "json" || attempts === "json";
    const ready = authReady && attemptsReady && rateLimitReady && casesReady && (!jsonNeeded || jsonReady);
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
          shadowRead: caseShadowRead,
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
