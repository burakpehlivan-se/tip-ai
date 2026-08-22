import { randomBytes, scryptSync } from "crypto";
import { describe, expect, it } from "vitest";
import {
  ARGON2ID_PREFIX,
  ARGON2_OPTIONS,
  SCRYPT_V1_PREFIX,
  digestForSeed,
  generateRandomPassword,
  hashPassword,
  needsRehash,
  versionLegacyHash,
  verifyPassword,
} from "./password";

/** Eski JSON deposu formatı: ham scrypt saltHex:hashHex. */
function hamScryptHash(password: string, salt = randomBytes(16)): string {
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

describe("hashPassword / verifyPassword", () => {
  it("argon2id üretir ve doğrular", async () => {
    const hash = await hashPassword("gizli-şifre-123");
    expect(hash.startsWith(ARGON2ID_PREFIX)).toBe(true);
    await expect(verifyPassword("gizli-şifre-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("yanlış", hash)).resolves.toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it("aynı şifreden farklı hash'ler üretir (tuz)", async () => {
    const a = await hashPassword("ayni-sifre");
    const b = await hashPassword("ayni-sifre");
    expect(a).not.toBe(b);
  });
});

describe("versionLegacyHash", () => {
  it("ham scrypt formatını sürümlü etikete çevirir", () => {
    const ham = hamScryptHash("eski-sifre");
    const surumlu = versionLegacyHash(ham);
    expect(surumlu).toBe(`${SCRYPT_V1_PREFIX}${ham}`);
  });

  it("argon2id ve zaten sürümlü hash'lere dokunmaz", () => {
    const argon = `${ARGON2ID_PREFIX}v=19$m=19456,t=2,p=1$xyz`;
    expect(versionLegacyHash(argon)).toBe(argon);
    const scryptV1 = `${SCRYPT_V1_PREFIX}ab:cd`;
    expect(versionLegacyHash(scryptV1)).toBe(scryptV1);
  });

  it("tanınmayan formatlar için null döner", () => {
    expect(versionLegacyHash("bcrypt$xyz")).toBeNull();
    expect(versionLegacyHash("")).toBeNull();
  });
});

describe("verifyPassword — legacy scrypt v1", () => {
  it("doğru şifreyi kabul eder, yanlışı reddeder", async () => {
    const surumlu = versionLegacyHash(hamScryptHash("eski-sifre"))!;
    await expect(verifyPassword("eski-sifre", surumlu)).resolves.toBe(true);
    await expect(verifyPassword("baskasi", surumlu)).resolves.toBe(false);
    expect(needsRehash(surumlu)).toBe(true);
  });

  it("bozuk scrypt v1 gövdesinde patlamadan false döner", async () => {
    await expect(verifyPassword("x", `${SCRYPT_V1_PREFIX}zzz`)).resolves.toBe(false);
    await expect(verifyPassword("x", `${SCRYPT_V1_PREFIX}not-hex:not-hex!`)).resolves.toBe(false);
  });
});

describe("yardımcılar", () => {
  it("generateRandomPassword istenen uzunlukta üretir", () => {
    const p = generateRandomPassword(24);
    expect(p).toHaveLength(24);
    expect(generateRandomPassword(10)).toHaveLength(10);
    expect(p).not.toBe(generateRandomPassword(24));
  });

  it("digestForSeed deterministiktir", () => {
    expect(digestForSeed("ali", "tuz")).toBe(digestForSeed("ali", "tuz"));
    expect(digestForSeed("ali", "tuz")).toHaveLength(12);
    expect(digestForSeed("ali", "baska")).not.toBe(digestForSeed("ali", "tuz"));
  });

  it("argon2 parametreleri OWASP değerleriyle uyumlu", () => {
    expect(ARGON2_OPTIONS.memoryCost).toBeGreaterThanOrEqual(19 * 1024);
    expect(ARGON2_OPTIONS.timeCost).toBeGreaterThanOrEqual(2);
    expect(ARGON2_OPTIONS.parallelism).toBeGreaterThanOrEqual(1);
  });
});
