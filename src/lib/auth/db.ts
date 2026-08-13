import { drizzle as drizzlePg, NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { logger } from "@/lib/logger";
import * as schema from "./schema";

export type AuthSchema = typeof schema;

export type AuthDb = NodePgDatabase<AuthSchema> | PgliteDatabase<AuthSchema>;

const TEST_DB_OVERRIDE = Symbol.for("tip_ai.auth.testDbOverride");

interface GlobalWithTestDb {
  [TEST_DB_OVERRIDE]?: AuthDb | undefined;
}

function globalForTestDb(): GlobalWithTestDb {
  return globalThis as GlobalWithTestDb;
}

/**
 * DATABASE_URL içindeki kullanıcı adı/şifreyi URL-encode eder.
 * Özel karakterli parolaların (örn. `@`, `:`, `#`) bağlantı dizgisini bozmasını
 * önler. Bozuk URL'ler olduğu gibi döner (hatayı burada değil, bağlantıda verir).
 */
export function encodeDatabaseUrl(url: string): string {
  if (!url.includes("://")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = encodeURIComponent(parsed.username);
    if (parsed.password) parsed.password = encodeURIComponent(parsed.password);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Loglara asla sır / bağlantı dizgisi / şifre hash'i yazılmaz. */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "***";
    parsed.password = "***";
    return parsed.toString();
  } catch {
    return "(geçersiz bağlantı dizgisi)";
  }
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.length === 0) {
    throw new Error(
      "DATABASE_URL ortam değişkeni eksik. PostgreSQL bağlantı dizgisi tanımlanmalıdır."
    );
  }
  return encodeDatabaseUrl(url);
}

let pgClient: AuthDb | null = null;

/**
 * Aktif veritabanı istemcisi. Üretimde DATABASE_URL üzerinden node-postgres
 * havuzu kurar; testler `setDbForTests` ile PGlite (process-içi Postgres)
 * enjekte edebilir.
 */
export function getDb(): AuthDb {
  const injected = globalForTestDb()[TEST_DB_OVERRIDE];
  if (injected) return injected;

  if (pgClient) return pgClient;

  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  pool.on("error", (err) => {
    // Boşta havuz hataları istek zincirini kırmasın; yalnızca güvenli özet loglanır.
    logger.exception("Kimlik veritabanı havuzu hatası", err, { component: "auth-db-pool" });
  });
  pgClient = drizzlePg(pool, { schema });
  return pgClient;
}

/** Üretimde bağlantı dizgisinin gizlenmiş haliyle hata ayıklama yardımcısı. */
export function safeDatabaseUrlForLog(): string {
  const url = process.env.DATABASE_URL;
  return url ? redactUrl(url) : "(tanımsız)";
}

/** Test / göç araçları için; üretim akışında çağrılmaz. */
export function setDbForTests(db: AuthDb | null): void {
  const g = globalForTestDb();
  if (db === null) {
    delete g[TEST_DB_OVERRIDE];
  } else {
    g[TEST_DB_OVERRIDE] = db;
  }
}

/** pg havuzunu sıfırlar (yalnızca test yardımcıları için). */
export function resetDbForTests(): void {
  pgClient = null;
  setDbForTests(null);
}
