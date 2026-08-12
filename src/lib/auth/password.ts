/**
 * Şifre hash'leme — Argon2id, eski scrypt için sürümlü uyumluluk.
 *
 * Hash formatları (açık algoritma/sürüm etiketi):
 *   - Yeni:        `$argon2id$v=19$m=19456,t=2,p=1$...` (kendi kendini tanımlar)
 *   - Eski scrypt: `scrypt$v1$<saltHex>:<hashHex>` (import edilen legacy hash)
 *
 * - Yeni hash'ler her zaman Argon2id üretir (`@node-rs/argon2`, prebuilt
 *   musl/glibc binary'leri ile alpine runtime'da çalışır).
 * - Import edilen eski scrypt hash'leri `scrypt$v1$` etiketiyle saklanır;
 *   `verifyPassword` onları tanır ve başarılı girişte hesabı Argon2id'e
 *   otomatik yükseltir (rehash-on-login). `needsRehash` bu geçişi işaretler.
 * - Düz şifre hiçbir yerde loglanmaz / döndürülmez / saklanmaz. Hash değerleri
 *   de loglara yazılmaz (yalnızca doğrulama içinde kullanılır).
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

export const ARGON2ID_PREFIX = "$argon2id$";
export const SCRYPT_V1_PREFIX = "scrypt$v1$";
export const SCRYPT_KEYLEN = 64;

/** Yeni şifreler için Argon2id varsayılan parametreleri (OWASP önerisi). */
export const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

function isArgon2idHash(stored: string): boolean {
  return stored.startsWith(ARGON2ID_PREFIX);
}

/** Eski JSON deposundaki ham scrypt `saltHex:hashHex` formatı. */
function isRawScryptFormat(stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  return Boolean(
    saltHex && hashHex &&
    /^[0-9a-f]+$/i.test(saltHex) &&
    /^[0-9a-f]+$/i.test(hashHex)
  );
}

/**
 * Legacy (JSON) hash'i sürümlü formata çevirir. Argon2id veya zaten sürümlü
 * olanları olduğu gibi bırakır; tanınamayan formatlar için `null` döner.
 */
export function versionLegacyHash(hash: string): string | null {
  if (isArgon2idHash(hash) || hash.startsWith(SCRYPT_V1_PREFIX)) return hash;
  if (isRawScryptFormat(hash)) return `${SCRYPT_V1_PREFIX}${hash}`;
  return null;
}

function parseScryptV1(stored: string): { salt: Buffer; expected: Buffer } | null {
  if (!stored.startsWith(SCRYPT_V1_PREFIX)) return null;
  const body = stored.slice(SCRYPT_V1_PREFIX.length);
  const [saltHex, hashHex] = body.split(":");
  if (!saltHex || !hashHex || !/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) {
    return null;
  }
  return { salt: Buffer.from(saltHex, "hex"), expected: Buffer.from(hashHex, "hex") };
}

async function verifyScryptV1(password: string, stored: string): Promise<boolean> {
  try {
    const parsed = parseScryptV1(stored);
    if (!parsed) return false;
    const actual = scryptSync(password, parsed.salt, parsed.expected.length);
    return (
      actual.length === parsed.expected.length &&
      timingSafeEqual(actual, parsed.expected)
    );
  } catch {
    return false;
  }
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (isArgon2idHash(stored)) {
    try {
      return await argon2Verify(stored, password, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }
  if (stored.startsWith(SCRYPT_V1_PREFIX)) {
    return verifyScryptV1(password, stored);
  }
  return false;
}

/** Şifre Argon2id değilse (eski scrypt v1) yeniden hash'lemek gerekir. */
export function needsRehash(stored: string): boolean {
  return !isArgon2idHash(stored);
}

/** Benzersiz, uzun ve rastgele bir parola üretir (yalnızca araçlar için). */
export function generateRandomPassword(length = 24): string {
  return randomBytes(length)
    .toString("base64url")
    .slice(0, length);
}

/** Deterministik kimlik üretici (eski JSON id'leriyle uyum için). */
export function digestForSeed(username: string, salt: string): string {
  return createHash("sha1").update(`${username}:${salt}`).digest("hex").slice(0, 12);
}