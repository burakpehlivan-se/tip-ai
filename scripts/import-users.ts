/**
 * Tek seferlik geçiş: eski JSON kullanıcı deposu → PostgreSQL.
 *
 * Kullanım:
 *   DATABASE_URL=postgres://... ADMIN_PASSWORD=... npx tsx scripts/import-users.ts \
 *     --file /data/coolify/applications/<uuid>/data/admin/users.json
 *
 * Güvenlik / idempotence kuralları:
 *   - İşlem başlamadan önce JSON deposunun ZAMAN DAMGALI bir yedeği alınır
 *     (`users.json.bak.<ISO-timestamp>`); orijinal dosya silinmez / değiştirilmez.
 *   - Idempotenttir: aynı kullanıcı adı zaten Postgres'te varsa atlanır.
 *   - Şifre hash'leri DOĞRUDAN taşınır (Argon2id ise olduğu gibi, eski scrypt
 *     `salt:hash` ise `scrypt$v1$salt:hash` sürüm etiketiyle). Düz şifre yoktur
 *     ve hiçbir hash / bağlantı dizgisi loga, çıktıya yazılmaz.
 *   - Bootstrap admin senkronize edilir ve kilitlenir.
 *   - Postgres şeması (tablolar) `standalone-migrate.mjs` / `drizzle-kit migrate`
 *     ile önceden oluşturulmuş olmalıdır; bu script yalnızca veri taşır.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import { users } from "../src/lib/auth/schema";
import { versionLegacyHash } from "../src/lib/auth/password";
import { ensureBootstrapAdmin, isSuperAdminRow, superAdminUsername } from "../src/lib/auth/user-store";

export interface LegacyUser {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "doktor" | "ogrenci";
  displayName?: string;
  active?: boolean;
  superAdmin?: boolean;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
}

export interface LegacyUsersStore {
  users?: LegacyUser[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  invalid: number;
  backupFile: string;
}

export function timestampNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** İçe aktarmadan önce JSON deposunun zaman damgalı kopyasını alır. */
export function backupUsersFile(file: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(`Dosya bulunamadı: ${file}`);
  }
  const backup = `${file}.bak.${timestampNow()}`;
  fs.copyFileSync(file, backup);
  return backup;
}

/** Dosyayı okuyup, idempotent biçimde Postgres'e aktarır. */
export async function importUsersFromFile(file: string): Promise<ImportResult> {
  const backupFile = backupUsersFile(file);
  const legacy = JSON.parse(fs.readFileSync(file, "utf8")) as LegacyUsersStore;
  const list = Array.isArray(legacy.users) ? legacy.users : [];

  // Önce legacy kullanıcıları aktar (bootstrap admin'i env'den ÖNCE oluşturmak,
  // aynı kullanıcı adındaki legacy hash'inin atlanmasına neden olur).
  const db = getDb();

  let imported = 0;
  let skipped = 0;
  let invalid = 0;

  for (const u of list) {
    const normalized = u.username.trim().toLowerCase();
    if (!normalized || typeof u.passwordHash !== "string" || u.passwordHash.length === 0) {
      invalid += 1;
      continue;
    }

    const versionedHash = versionLegacyHash(u.passwordHash);
    if (!versionedHash) {
      invalid += 1;
      continue;
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, normalized))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    const now = new Date();
    const createdBy = u.createdBy && ["system", "env", "self"].includes(u.createdBy) ? u.createdBy : "import";
    const superAdmin =
      u.superAdmin === true ||
      (u.createdBy === "system" && normalized === superAdminUsername().toLowerCase());

    await db.insert(users).values({
      username: normalized,
      passwordHash: versionedHash,
      role: ["admin", "doktor", "ogrenci"].includes(u.role) ? u.role : "ogrenci",
      displayName: u.displayName || u.username,
      active: u.active !== false,
      superAdmin,
      createdBy,
      createdAt: u.createdAt ? new Date(u.createdAt) : now,
      updatedAt: u.updatedAt ? new Date(u.updatedAt) : now,
    });

    imported += 1;
  }

  // Aktarımdan sonra bootstrap admin'i senkronize et/kitle; hash'i legacy'den
  // korunur (ensureBootstrapAdmin hash değiştirmez).
  await ensureBootstrapAdmin();

  // Süper admin güvenlik doğrulaması (hash ifşa etmeden)
  const boot = await db
    .select()
    .from(users)
    .where(eq(users.username, superAdminUsername().toLowerCase()))
    .limit(1);
  const bootUser = boot[0];
  if (bootUser && !isSuperAdminRow(bootUser)) {
    console.warn("Uyarı: bootstrap admin superAdmin bayrağı eksik görünüyor.");
  }

  return { imported, skipped, invalid, backupFile };
}

async function main() {
  const idx = process.argv.indexOf("--file");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("Hata: --file <path> parametresi zorunludur.");
    process.exit(1);
  }
  const file = process.argv[idx + 1];

  if (!process.env.DATABASE_URL) {
    console.error("Hata: DATABASE_URL ortam değişkeni eksik.");
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.error("Hata: ADMIN_PASSWORD ortam değişkeni gereklidir (bootstrap senkronizasyonu).");
    process.exit(1);
  }

  const result = await importUsersFromFile(file);
  console.log(`Yedek alındı: ${path.basename(result.backupFile)}`);
  console.log(
    `Tamam: ${result.imported} içe aktarıldı, ${result.skipped} atlandı (mevcut), ${result.invalid} atlandı (geçersiz/eksik hash).`
  );
}

// Yalnızca doğrudan çalıştırıldığında (import edildiğinde değil) main'i koştur.
const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  const resolved = path.resolve(entry);
  const thisFile = path.resolve(import.meta.url.replace(/^file:\/\//, ""));
  return resolved === thisFile || resolved === path.resolve("scripts/import-users.ts");
})();

if (isDirectRun) {
  main().catch((error) => {
    // Hata mesajında hash / bağlantı dizgisi yoktur.
    console.error("İçe aktarma başarısız:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}