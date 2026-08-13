import { authUserStoreMode } from "@/lib/auth/runtime-user-store";
import { attemptStoreMode } from "@/lib/student/attempt-store-mode";
import { rateLimitStoreMode } from "@/lib/security/rate-limit";
import { getReadiness, type ReadinessPayload } from "./readiness";

export type AdminDiagnostics = {
  generatedAt: string;
  readiness: ReadinessPayload;
  runtime: {
    node: string;
    uptimeSeconds: number;
  };
  stores: {
    auth: "json" | "postgres" | "invalid";
    attempts: "json" | "postgres" | "invalid";
    rateLimit: "memory" | "postgres" | "invalid";
  };
};

function safeMode<T extends string>(read: () => T): T | "invalid" {
  try {
    return read();
  } catch {
    return "invalid";
  }
}

/**
 * Yetkili operasyon ekranı için sır içermeyen anlık durum özeti.
 * Bağlantı dizgisi, kullanıcı, vaka gövdesi, token veya hata ayrıntısı
 * döndürmez; ayrıntılı bağımlılık denetimi yalnızca readiness alanındadır.
 */
export async function getAdminDiagnostics(): Promise<AdminDiagnostics> {
  const { payload } = await getReadiness();
  return {
    generatedAt: new Date().toISOString(),
    readiness: payload,
    runtime: {
      node: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    stores: {
      auth: safeMode(authUserStoreMode),
      attempts: safeMode(attemptStoreMode),
      rateLimit: safeMode(rateLimitStoreMode),
    },
  };
}
