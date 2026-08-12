/**
 * Drizzle migration yürütücü — PostgreSQL advisory lock ile.
 *
 * `standalone-migrate.mjs` (üretim başlangıcı) ve entegrasyon testleri bu
 * modülü kullanır; böylece gerçek üretim yolu test edilmiş olur. Concurrent
 * deploys yarışmaz: kilit alınmadan migration koşmaz, kilit session-lock
 * olduğu için süreç ölürse otomatik serbest kalır.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** `src/lib/auth/` altından repo kökündeki `drizzle/` klasörüne gider. */
export const MIGRATIONS_DIR = path.resolve(HERE, "../../../drizzle");

/** tip-ai uygulamasına özel sabit kilit anahtarı (tüm süreçler aynı değeri kullanır). */
export const ADVISORY_LOCK_KEY = 742913723;

export interface RunMigrationsOptions {
  connectionString: string;
  migrationsFolder?: string;
}

/**
 * Drizzle migrator'ı advisory lock altında koşturur.
 * Kilidi, migration'ın kullanmadığı ayrı bir bağlantıda tutar (idempotent).
 */
export async function runMigrations(options: RunMigrationsOptions): Promise<void> {
  const pool = new Pool({ connectionString: options.connectionString });
  const lockClient = await pool.connect();
  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder: options.migrationsFolder ?? MIGRATIONS_DIR,
    });
  } finally {
    await lockClient
      .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
      .catch((err) => {
        console.error("[migrate] kilit serbest bırakılamadı", err.message || String(err));
      });
    lockClient.release();
    await pool.end();
  }
}