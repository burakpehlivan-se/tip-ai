/**
 * PostgreSQL 16 entegrasyon testleri.
 *
 * Gerçek bir PostgreSQL gerektirir; `TEST_DATABASE_URL` ortam değişkeni
 * tanımlıysa koşar, değilse sessizce atlanır (yerel geliştirme / DB'siz CI).
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/tip_ai_test \
 *     npm test -- --run src/lib/auth/postgres.integration.test.ts
 *
 * Not: Bu test, işaret ettiği veritabanındaki `users`, `auth_audit_logs`,
 * `user_role` tipini ve `drizzle` şemasını SİLER ve yeniden oluşturur.
 * Yalnızca boş/atılabilir bir test veritabanına yönlendirin.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scryptSync } from "node:crypto";
import { Pool } from "pg";
import { runMigrations } from "./migrate";
import { importUsersFromFile } from "../../../scripts/import-users";
import { hashPassword, verifyPassword, needsRehash, versionLegacyHash } from "./password";
import { getDb, resetDbForTests } from "./db";
import { authSessions, cohorts, learningAttempts, users } from "./schema";
import { addCohortMember, createCohortCaseAssignment, listAssignmentsForStudent } from "@/lib/learning/cohort-store";
import { authenticateUser, createUser, findUserByUsername, updateUser } from "./user-store";
import { createAuthSession, isAuthSessionActive, revokeAuthSession } from "./session-store";
import { eq } from "drizzle-orm";

const TEST_URL = process.env.TEST_DATABASE_URL;

/** Eski JSON deposuyla aynı format: saltHex:hashHex (scrypt, keylen 64). */
function legacyScryptHash(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, "hex");
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

const describePg = TEST_URL ? describe : describe.skip;

async function dropAll(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_URL! });
  try {
    await pool.query(`DROP TABLE IF EXISTS cohort_case_assignments CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS cohort_memberships CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS cohorts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS learning_attempts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS auth_audit_logs CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS user_role CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS learning_attempt_status CASCADE`);
    await pool.query(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  } finally {
    await pool.end();
  }
}

describePg("PostgreSQL 16 entegrasyon", () => {
  beforeAll(async () => {
    await dropAll();
    process.env.DATABASE_URL = TEST_URL!;
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    resetDbForTests();
  });

  afterAll(() => {
    resetDbForTests();
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  it("şema migration'ı uygular (tablolar ve enum oluşur)", async () => {
    await runMigrations({ connectionString: TEST_URL! });
    const pool = new Pool({ connectionString: TEST_URL! });
    try {
      const { rows } = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );
      const names = rows.map((r) => r.tablename);
      expect(names).toContain("users");
      expect(names).toContain("auth_audit_logs");
      expect(names).toContain("auth_sessions");
      expect(names).toContain("learning_attempts");
      expect(names).toContain("cohorts");
      expect(names).toContain("cohort_memberships");
      expect(names).toContain("cohort_case_assignments");

      const { rows: enumRows } = await pool.query(
        `SELECT typname FROM pg_type WHERE typname = 'user_role'`
      );
      expect(enumRows.length).toBe(1);
    } finally {
      await pool.end();
    }
  });

  it("ikinci migration koşusu no-op'tur (idempotent)", async () => {
    await runMigrations({ connectionString: TEST_URL! });
    const pool = new Pool({ connectionString: TEST_URL! });
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`
      );
      expect(rows[0].n).toBe(5);
    } finally {
      await pool.end();
    }
  });

  it("legacy JSON deposunu idempotent aktarır ve zaman damgalı yedek alır", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-import-test-"));
    // Gerçek legacy scrypt hash'leri (JSON deposuyla aynı: saltHex:hashHex, keylen 64)
    const adminHash = legacyScryptHash("secret123", "aabbccdd00112233445566778899aabb");
    const doktorHash = legacyScryptHash("sifre123", "112233445566778899aabbccddeeff00");
    const usersFile = path.join(tmpDir, "users.json");
    const legacy = {
      version: 1,
      updatedAt: Date.now(),
      users: [
        {
          id: "user_admin",
          username: "admin",
          passwordHash: adminHash,
          role: "admin",
          displayName: "Admin",
          active: true,
          superAdmin: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: "system",
        },
        {
          id: "user_doktor",
          username: "o1beo",
          passwordHash: doktorHash,
          role: "doktor",
          displayName: "O1 Beo",
          active: true,
          superAdmin: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: "import",
        },
      ],
    };
    fs.writeFileSync(usersFile, JSON.stringify(legacy, null, 2), "utf8");

    // İlk çalıştırma: 2 içe aktarılır
    const first = await importUsersFromFile(usersFile);
    expect(first.imported).toBe(2);
    expect(first.skipped).toBe(0);
    expect(fs.existsSync(first.backupFile)).toBe(true);
    expect(first.backupFile.startsWith(usersFile + ".bak.")).toBe(true);

    // Yedek, orijinal içeriği bozmaz
    const originalAfter = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    expect(originalAfter.users.length).toBe(2);

    // İkinci çalıştırma: idempotent, hepsi atlanır
    const second = await importUsersFromFile(usersFile);
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(2);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("aktarılan scrypt hash'i sürümlüdür ve girişte Argon2id'e yükseltilir", async () => {
    const admin = await findUserByUsername("admin");
    expect(admin).not.toBeNull();
    expect(admin!.passwordHash.startsWith("scrypt$v1$")).toBe(true);
    expect(needsRehash(admin!.passwordHash)).toBe(true);

    // Doğru parola ile kimlik doğrula (legacy scrypt v1)
    const auth = await authenticateUser("admin", "secret123");
    expect(auth?.user.username).toBe("admin");

    // Rehash-on-login: artık Argon2id
    const after = await findUserByUsername("admin");
    expect(after!.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(needsRehash(after!.passwordHash)).toBe(false);
  });

  it("rol bazlı yetkilendirme: doktor panel rolleri, öğrenci değil", async () => {
    const doktor = await findUserByUsername("o1beo");
    expect(doktor?.role).toBe("doktor");

    const student = await createUser({
      username: "ogrenci.tipi",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const db = getDb();
    const [stored] = await db.select().from(users).where(eq(users.username, "ogrenci.tipi"));
    expect(stored.role).toBe("ogrenci");

    const updated = await updateUser(student.id, { role: "doktor" }, { username: "admin" });
    expect(updated.role).toBe("doktor");
  });

  it("merkezi oturum sunucu tarafında iptal edilebilir", async () => {
    const user = await createUser({
      username: "oturum.ogrenci",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const session = await createAuthSession({
      userId: user.id,
      role: user.role,
      ttlMs: 60_000,
    });

    const db = getDb();
    const [stored] = await db.select().from(authSessions).where(eq(authSessions.id, session.id));
    expect(stored.userId).toBe(user.id);
    expect(await isAuthSessionActive({ id: session.id, userId: user.id, role: user.role })).toBe(true);

    await revokeAuthSession(session.id);
    expect(await isAuthSessionActive({ id: session.id, userId: user.id, role: user.role })).toBe(false);
  });

  it("P2 deneme tablosu sürüm-kilitli gövde ve durum alanlarını saklar", async () => {
    const user = await createUser({
      username: "deneme.ogrenci",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const db = getDb();
    const [attempt] = await db
      .insert(learningAttempts)
      .values({
        studentId: user.id,
        assignmentId: null,
        caseId: "acil::gogus-agrisi",
        caseVersion: "3",
        poliklinikKey: "acil",
        status: "active",
        caseSnapshot: { version: 3, checksum: "fixture" },
        askedActions: [],
        requestedTests: [],
      })
      .returning();
    expect(attempt.status).toBe("active");
    expect(attempt.caseSnapshot).toEqual({ version: 3, checksum: "fixture" });
  });

  it("P2 grup üyeliği ve sürüm-kilitli vaka ataması saklanır", async () => {
    const instructor = await createUser({
      username: "egitmen.doktor",
      password: "sifre123",
      role: "doktor",
      createdBy: "admin",
    });
    const student = await createUser({
      username: "grup.ogrenci",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const db = getDb();
    const [cohort] = await db
      .insert(cohorts)
      .values({ name: "Dönem 5 / A", createdBy: instructor.id })
      .returning();
    expect(await addCohortMember({ cohortId: cohort.id, studentId: student.id, actorId: instructor.id })).toEqual({ status: "added" });
    expect(await addCohortMember({ cohortId: cohort.id, studentId: student.id, actorId: instructor.id })).toEqual({ status: "already_member" });
    const assignment = await createCohortCaseAssignment({
      cohortId: cohort.id,
      caseId: "acil::gogus-agrisi",
      caseVersion: "3",
      actorId: instructor.id,
    });
    expect(assignment).not.toBeNull();
    expect(assignment!.caseVersion).toBe("3");
    await expect(listAssignmentsForStudent(student.id)).resolves.toEqual([
      expect.objectContaining({ cohortId: cohort.id, caseId: "acil::gogus-agrisi", caseVersion: "3" }),
    ]);
  });

  it("hash fonksiyonları uçtan uca çalışır (argon2 üret + doğrula)", async () => {
    const hash = await hashPassword("guclu-parola-123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("guclu-parola-123", hash)).toBe(true);
    expect(await verifyPassword("yanlis", hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it("versionLegacyHash sürümlü ve tanınmayan formatları ayıklar", () => {
    expect(
      versionLegacyHash("aabbccdd00112233445566778899aabb:5e884898da28047151d0e56f8dc6292773603d0d")
    ).toBe("scrypt$v1$aabbccdd00112233445566778899aabb:5e884898da28047151d0e56f8dc6292773603d0d");
    expect(versionLegacyHash("$argon2id$v=19$m=19456,t=2,p=1$...")).toBe("$argon2id$v=19$m=19456,t=2,p=1$...");
    expect(versionLegacyHash("gecersiz")).toBeNull();
    expect(versionLegacyHash("abc")).toBeNull();
  });
});
