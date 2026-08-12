/**
 * Üretim (standalone) çalışma zamanı migration runner.
 *
 * Drizzle'nin resmi migrator'unu (`drizzle-orm/node-postgres/migrator`) kullanır;
 * elle journal/hash takibi yapmaz. Eşzamanlı deploy'ların (ör. 2 replica aynı
 * anda başlarsa) migration'ı yarıştırmaması için tüm işlem bir PostgreSQL
 * advisory lock altında koşar:
 *   - İlk süreç `pg_advisory_lock` alır, migration'ları uygular, kilit bırakır.
 *   - Diğer süreç kilit boşalana kadar bekler; kilidi alınca `migrate()` idempotent
 *     olduğu için hiçbir şey yapmaz (Drizzle zaten uygulananları atlar).
 *   - Süreç ölürse oturum kapanır, kilit otomatik serbest kalır (session lock).
 *
 * Kullanım: DATABASE_URL ile `node scripts/standalone-migrate.mjs`
 * Çalışma dizininde `drizzle/` klasörü (migration SQL + meta) bekler.
 */

import pg from "pg";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;

/** Sabit kilit anahtarı: tip-ai uygulamasına özel, tüm süreçler aynı değeri kullanır. */
const ADVISORY_LOCK_KEY = 742913723;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL eksik.");
  process.exit(1);
}

const migrationsFolder = path.resolve(process.cwd(), "drizzle");

async function main() {
  const pool = new Pool({ connectionString: url });
  // Advisory lock, migration'ın kullanmadığı ayrı bir bağlantıda tutulur ki
  // kilit işlem boyunca oturuma sabit kalsın.
  const lockClient = await pool.connect();
  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    console.log("[migrate] advisory lock alındı");

    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] migration'lar tamamlandı");
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

main().catch((error) => {
  // Hata mesajında bağlantı dizgisi / kimlik bilgisi yoktur (sadece mesaj).
  console.error("[migrate] başarısız:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});