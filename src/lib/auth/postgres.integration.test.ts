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
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "./migrate";
import { checkCaseStoreMigrationReadiness } from "./migration-readiness";
import { importUsersFromFile } from "../../../scripts/import-users";
import { importCasesFromFile } from "../../../scripts/import-cases";
import { verifyCaseStoreParity } from "../../../scripts/verify-case-store-parity";
import { hashPassword, verifyPassword, needsRehash, versionLegacyHash } from "./password";
import { getDb, resetDbForTests } from "./db";
import {
  authSessions,
  clinicalCaseAuditLogs,
  clinicalCases,
  cohorts,
  learningAttempts,
  publishedClinicalCaseVersions,
  users,
} from "./schema";
import { addCohortMember, createCohortCaseAssignment, listAssignmentsForStudent } from "@/lib/learning/cohort-store";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { loadCasesStore } from "@/lib/admin/store";
import {
  getRuntimeCaseById,
  getRuntimePublishedCaseVersion,
  listRuntimeCasesGrouped,
  loadRuntimeCasesStore,
  recordRuntimeCaseMutation,
} from "@/lib/admin/runtime-case-store";
import { answerPostgresAttempt } from "@/lib/student/postgres-attempt-store";
import { authenticateUser, createUser, findUserByUsername, updateUser } from "./user-store";
import {
  createAuthSession,
  isAuthSessionActive,
  listActiveAuthSessionsForUser,
  revokeAuthSession,
  revokeAuthSessionForUser,
} from "./session-store";
import { and, eq } from "drizzle-orm";
import { refundRateLimit, takeRateLimit } from "@/lib/security/rate-limit";

const TEST_URL = process.env.TEST_DATABASE_URL;

/** Eski JSON deposuyla aynı format: saltHex:hashHex (scrypt, keylen 64). */
function legacyScryptHash(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, "hex");
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

const describePg = TEST_URL ? describe : describe.skip;

/**
 * 0018 is additionally exercised in an in-process disposable PostgreSQL.  This
 * keeps the independent imaging catalogue's DDL covered when contributors do
 * not have a local TEST_DATABASE_URL, while the full migration runner remains
 * covered by the PostgreSQL-only tests below.
 */
async function applyImagingMigrationToPGlite(client: PGlite): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY)`);
  await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__pglite_migrations (tag text PRIMARY KEY)`);
  const { rows: applied } = await client.query<{ tag: string }>(
    `SELECT tag FROM drizzle.__pglite_migrations WHERE tag = '0018_imaging_catalog'`
  );
  if (applied.length > 0) return;
  const migration = fs.readFileSync(
    path.resolve(process.cwd(), "drizzle/0018_imaging_catalog.sql"),
    "utf8"
  );
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) await client.query(statement);
  }
  await client.query(`INSERT INTO drizzle.__pglite_migrations (tag) VALUES ('0018_imaging_catalog')`);
}

describe("imaging catalogue migration (disposable PGlite)", () => {
  it("creates the standalone catalogue with its lifecycle, FK and unique guards", async () => {
    const client = new PGlite();
    try {
      await applyImagingMigrationToPGlite(client);
      await applyImagingMigrationToPGlite(client);
      const { rows: migrationRows } = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM drizzle.__pglite_migrations WHERE tag = '0018_imaging_catalog'`
      );
      expect(migrationRows).toEqual([{ count: 1 }]);

      const { rows: tableRows } = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'imaging_%' ORDER BY tablename`
      );
      expect(tableRows.map((row) => row.tablename)).toEqual([
        "imaging_answer_options",
        "imaging_answer_taxonomies",
        "imaging_attempts",
        "imaging_dataset_documents",
        "imaging_datasets",
        "imaging_import_runs",
        "imaging_interpretations",
        "imaging_record_assets",
        "imaging_record_labels",
        "imaging_records",
        "imaging_render_runs",
      ]);

      await expect(
        client.query(
          `INSERT INTO imaging_datasets (dataset_key, version, display_name, modality) VALUES ('nih-cxr14', '2020', 'NIH', 'CXR')`
        )
      ).resolves.toBeDefined();
      await expect(
        client.query(
          `INSERT INTO imaging_datasets (dataset_key, version, display_name, modality) VALUES ('nih-cxr14', '2020', 'NIH duplicate', 'CXR')`
        )
      ).rejects.toThrow();

      const { rows: datasetRows } = await client.query<{ id: string }>(
        `SELECT id FROM imaging_datasets WHERE dataset_key = 'nih-cxr14'`
      );
      const datasetId = datasetRows[0]!.id;
      const { rows: userRows } = await client.query<{ id: string }>(
        `INSERT INTO users (id) VALUES ('00000000-0000-0000-0000-000000000001') RETURNING id`
      );
      const studentId = userRows[0]!.id;
      const { rows: importRows } = await client.query<{ id: string }>(
        `INSERT INTO imaging_import_runs (dataset_id, status, manifest_checksum, metadata_checksum, hmac_key_version) VALUES ($1, 'succeeded', 'manifest-a', 'metadata-a', 'v1') RETURNING id`,
        [datasetId]
      );
      const importRunId = importRows[0]!.id;
      const { rows: recordRows } = await client.query<{ id: string }>(
        `INSERT INTO imaging_records (dataset_id, import_run_id, source_record_id, modality, metadata_checksum, availability, published_at) VALUES ($1, $2, 'record-1', 'CXR', 'record-a', 'display_ready', now()) RETURNING id`,
        [datasetId, importRunId]
      );
      const recordId = recordRows[0]!.id;

      await expect(
        client.query(
          `INSERT INTO imaging_records (dataset_id, import_run_id, source_record_id, modality, metadata_checksum, availability) VALUES ($1, $2, 'record-invalid', 'CXR', 'record-b', 'invalid')`,
          [datasetId, importRunId]
        )
      ).rejects.toThrow();

      await client.query(
        `INSERT INTO imaging_record_assets (record_id, asset_role, storage_key, mime_type, checksum_sha256, renderer_version, render_profile, published_at) VALUES ($1, 'display_image', 'safe/a.png', 'image/png', 'checksum-a', 'source', 'default', now())`,
        [recordId]
      );
      await expect(
        client.query(
          `INSERT INTO imaging_record_assets (record_id, asset_role, storage_key, mime_type, checksum_sha256, renderer_version, render_profile, published_at) VALUES ($1, 'display_image', 'safe/b.png', 'image/png', 'checksum-b', 'source-v2', 'default', now())`,
          [recordId]
        )
      ).rejects.toThrow();

      const { rows: taxonomyRows } = await client.query<{ id: string }>(
        `INSERT INTO imaging_answer_taxonomies (modality, version, status, display_name) VALUES ('CXR', 'v1', 'active', 'CXR v1') RETURNING id`
      );
      const taxonomyId = taxonomyRows[0]!.id;
      const { rows: attemptRows } = await client.query<{ id: string }>(
        `INSERT INTO imaging_attempts (student_id, record_id, taxonomy_id, status, record_snapshot) VALUES ($1, $2, $3, 'active', '{}'::jsonb) RETURNING id`,
        [studentId, recordId, taxonomyId]
      );
      const attemptId = attemptRows[0]!.id;
      await expect(
        client.query(
          `INSERT INTO imaging_attempts (student_id, record_id, taxonomy_id, status, record_snapshot) VALUES ($1, $2, $3, 'not-a-status', '{}'::jsonb)`,
          [studentId, recordId, taxonomyId]
        )
      ).rejects.toThrow();
      await client.query(
        `INSERT INTO imaging_interpretations (attempt_id, selected_option_keys, structured_observations, evaluation_version) VALUES ($1, '[]'::jsonb, '{}'::jsonb, 'v1')`,
        [attemptId]
      );
      await client.query(
        `UPDATE imaging_attempts SET evaluation_snapshot = '{"sourceLabels":[]}'::jsonb WHERE id = $1`,
        [attemptId]
      );
      await expect(
        client.query(
          `UPDATE imaging_attempts SET evaluation_snapshot = '{"sourceLabels":["changed"]}'::jsonb WHERE id = $1`,
          [attemptId]
        )
      ).rejects.toThrow("evaluation_snapshot is immutable once set");

      await expect(client.query(`DELETE FROM imaging_records WHERE id = $1`, [recordId])).rejects.toThrow();

      await expect(client.query(`DELETE FROM users WHERE id = $1`, [studentId])).resolves.toBeDefined();
      const { rows: surviving } = await client.query(
        `SELECT count(*)::int AS attempts FROM imaging_attempts WHERE id = $1`,
        [attemptId]
      );
      expect(surviving[0]).toMatchObject({ attempts: 0 });

      const { rows: forbiddenFkRows } = await client.query<{ table_name: string }>(
        `SELECT tc.table_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name LIKE 'imaging_%'
            AND ccu.table_name IN ('clinical_cases', 'learning_attempts', 'radiology_sources', 'ekg_sources')`
      );
      expect(forbiddenFkRows).toEqual([]);
    } finally {
      await client.close();
    }
  });
});

async function dropAll(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_URL! });
  try {
    await pool.query(`DROP TABLE IF EXISTS imaging_interpretations CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_attempts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_answer_options CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_answer_taxonomies CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_record_labels CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_record_assets CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_records CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_render_runs CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_import_runs CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_dataset_documents CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS imaging_datasets CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS clinical_case_audit_logs CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS published_clinical_case_versions CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS clinical_cases CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS auth_sessions CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS cohort_case_assignments CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS cohort_memberships CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS cohorts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS learning_attempts CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS rate_limit_buckets CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS auth_audit_logs CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS user_role CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS learning_attempt_status CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS clinical_case_status CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS imaging_attempt_status CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS imaging_taxonomy_status CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS imaging_record_availability CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS imaging_render_run_status CASCADE`);
    await pool.query(`DROP TYPE IF EXISTS imaging_import_run_status CASCADE`);
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
      expect(names).toContain("rate_limit_buckets");
      expect(names).toContain("clinical_cases");
      expect(names).toContain("published_clinical_case_versions");
      expect(names).toContain("clinical_case_audit_logs");
      expect(names).toContain("imaging_datasets");
      expect(names).toContain("imaging_dataset_documents");
      expect(names).toContain("imaging_import_runs");
      expect(names).toContain("imaging_render_runs");
      expect(names).toContain("imaging_records");
      expect(names).toContain("imaging_record_assets");
      expect(names).toContain("imaging_record_labels");
      expect(names).toContain("imaging_answer_taxonomies");
      expect(names).toContain("imaging_answer_options");
      expect(names).toContain("imaging_attempts");
      expect(names).toContain("imaging_interpretations");

      const { rows: enumRows } = await pool.query(
        `SELECT typname FROM pg_type WHERE typname = 'user_role'`
      );
      expect(enumRows.length).toBe(1);
      const { rows: imagingEnumRows } = await pool.query(
        `SELECT typname FROM pg_type
          WHERE typname IN (
            'imaging_import_run_status', 'imaging_render_run_status',
            'imaging_record_availability', 'imaging_taxonomy_status',
            'imaging_attempt_status'
          )`
      );
      expect(imagingEnumRows).toHaveLength(5);
    } finally {
      await pool.end();
    }
  });

  it("ikinci migration koşusu no-op'tur (idempotent)", async () => {
    await runMigrations({ connectionString: TEST_URL! });
    const pool = new Pool({ connectionString: TEST_URL! });
    try {
      const { rows: beforeRows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`
      );
      await runMigrations({ connectionString: TEST_URL! });
      const { rows: afterRows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`
      );
      expect(afterRows[0].n).toBe(beforeRows[0].n);
      expect(afterRows[0].n).toBe(19);
    } finally {
      await pool.end();
    }
  });

  it("PostgreSQL vaka deposu için migration readiness kontrolü geçer", async () => {
    await expect(checkCaseStoreMigrationReadiness()).resolves.toMatchObject({
      ok: true,
      checks: {
        migrationJournal: true,
        migrationApplied: true,
        casesTable: true,
        publishedVersionsTable: true,
        auditLogTable: true,
      },
    });
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

  it("P2 vaka JSON deposunu sürümler korunarak idempotent aktarır", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-case-import-test-"));
    const casesFile = path.join(tmpDir, "cases.json");
    const now = Date.now();
    const content = {
      id: "acil::import-fixture",
      poliklinikKey: "acil",
      poliklinikAd: "Acil",
      hastalikKey: "import-fixture",
      hastalikAdi: "İçe aktarma vakası",
      durum: "aktif",
      surum: 2,
      contentChecksum: "case-checksum-v2",
      createdAt: now - 1_000,
      updatedAt: now,
    };
    fs.writeFileSync(
      casesFile,
      JSON.stringify({
        version: 1,
        cases: [content],
        publishedVersions: [
          {
            id: "acil::import-fixture@1",
            caseId: content.id,
            version: 1,
            contentChecksum: "published-checksum-v1",
            approvedBy: "reviewer",
            approvedAt: now - 500,
            content: { ...content, surum: 1, contentChecksum: "published-checksum-v1" },
          },
        ],
      }),
      "utf8"
    );

    const first = await importCasesFromFile(casesFile);
    expect(first).toMatchObject({
      importedCases: 1,
      skippedCases: 0,
      conflictingCases: 0,
      importedVersions: 1,
      skippedVersions: 0,
      conflictingVersions: 0,
    });
    expect(fs.existsSync(first.backupFile)).toBe(true);

    const second = await importCasesFromFile(casesFile);
    expect(second).toMatchObject({
      importedCases: 0,
      skippedCases: 1,
      conflictingCases: 0,
      importedVersions: 0,
      skippedVersions: 1,
      conflictingVersions: 0,
    });
    await expect(verifyCaseStoreParity(casesFile)).resolves.toMatchObject({
      equal: true,
      sourceCases: 1,
      postgresCases: 1,
      sourcePublishedVersions: 1,
      postgresPublishedVersions: 1,
    });

    const previousCaseStoreForMutation = process.env.STORE_MODE;
    process.env.STORE_MODE = "postgres";
    try {
      await expect(loadRuntimeCasesStore()).resolves.toMatchObject({
        cases: [expect.objectContaining({ id: content.id, surum: 2 })],
        publishedVersions: [expect.objectContaining({ caseId: content.id, version: 1 })],
      });
      await expect(getRuntimeCaseById(content.id)).resolves.toMatchObject({
        id: content.id,
        durum: "aktif",
        surum: 2,
      });
      await expect(getRuntimePublishedCaseVersion(content.id, 1)).resolves.toMatchObject({
        caseId: content.id,
        version: 1,
        approvedBy: "reviewer",
      });
      await expect(listRuntimeCasesGrouped()).resolves.toEqual([
        expect.objectContaining({ poliklinikKey: "acil", cases: [expect.objectContaining({ id: content.id })] }),
      ]);
    } finally {
      if (previousCaseStoreForMutation === undefined) delete process.env.STORE_MODE;
      else process.env.STORE_MODE = previousCaseStoreForMutation;
    }

    fs.writeFileSync(
      casesFile,
      JSON.stringify({ version: 1, cases: [{ ...content, surum: 3 }], publishedVersions: [] }),
      "utf8"
    );
    await expect(verifyCaseStoreParity(casesFile)).resolves.toMatchObject({
      equal: false,
      caseVersionMismatches: 1,
      unexpectedPublishedVersionsInPostgres: 1,
    });

    const db = getDb();
    const [caseRow] = await db.select().from(clinicalCases).where(eq(clinicalCases.caseId, content.id));
    expect(caseRow).toMatchObject({
      caseId: content.id,
      status: "aktif",
      version: 2,
      contentChecksum: "case-checksum-v2",
    });
    const [versionRow] = await db
      .select()
      .from(publishedClinicalCaseVersions)
      .where(
        and(
          eq(publishedClinicalCaseVersions.caseId, content.id),
          eq(publishedClinicalCaseVersions.version, 1)
        )
      );
    expect(versionRow).toMatchObject({
      caseId: content.id,
      version: 1,
      contentChecksum: "published-checksum-v1",
    });

    const previousCaseStore = process.env.STORE_MODE;
    process.env.STORE_MODE = "postgres";
    try {
      const updatedAt = now + 1_000;
      const mutation = await recordRuntimeCaseMutation({
        actor: "reviewer",
        action: "update_case",
        message: "Vaka metadata güncellendi.",
        patches: [
          {
            path: `cases.${content.id}.hastalikAdi`,
            caseId: content.id,
            field: "hastalikAdi",
            before: content.hastalikAdi,
            after: "Güncellenmiş vaka",
          },
        ],
        mutate: (store) => {
          store.cases = store.cases.map((item) =>
            item.id === content.id
              ? { ...item, hastalikAdi: "Güncellenmiş vaka", contentChecksum: "case-checksum-v3", updatedAt }
              : item
          );
        },
      });
      expect(mutation.backup).toBeNull();
      expect(mutation.store.cases).toEqual([
        expect.objectContaining({ id: content.id, hastalikAdi: "Güncellenmiş vaka", updatedAt }),
      ]);

      const [mutatedRow] = await db.select().from(clinicalCases).where(eq(clinicalCases.caseId, content.id));
      expect(mutatedRow).toMatchObject({
        caseId: content.id,
        contentChecksum: "case-checksum-v3",
        content: expect.objectContaining({ hastalikAdi: "Güncellenmiş vaka", updatedAt }),
      });
      const auditRows = await db.select().from(clinicalCaseAuditLogs).where(eq(clinicalCaseAuditLogs.caseId, content.id));
      expect(auditRows).toEqual([
        expect.objectContaining({
          event: "update_case",
          actor: "reviewer",
          summary: "Vaka metadata güncellendi.",
          meta: { patches: [{ path: `cases.${content.id}.hastalikAdi`, caseId: content.id, field: "hastalikAdi" }] },
        }),
      ]);

      await expect(
        recordRuntimeCaseMutation({
          actor: "reviewer",
          action: "update_case",
          message: "Eski editör kaydı",
          patches: [],
          expectedUpdatedAt: { [content.id]: now },
          mutate: () => undefined,
        })
      ).rejects.toThrow("Vaka başka bir kullanıcı tarafından güncellendi");

      await expect(
        recordRuntimeCaseMutation({
          actor: "reviewer",
          action: "delete_case",
          message: "Silme denemesi",
          patches: [{ path: `__case_delete__:${content.id}`, caseId: content.id, before: content, after: null }],
          mutate: (store) => {
            store.cases = [];
          },
        })
      ).rejects.toThrow("Vaka silme PostgreSQL kaynakta desteklenmez");
    } finally {
      if (previousCaseStore === undefined) delete process.env.STORE_MODE;
      else process.env.STORE_MODE = previousCaseStore;
    }

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
      deviceLabel: "Firefox · Linux",
    });

    const db = getDb();
    const [stored] = await db.select().from(authSessions).where(eq(authSessions.id, session.id));
    expect(stored.userId).toBe(user.id);
    expect(stored.deviceLabel).toBe("Firefox · Linux");
    expect(stored.lastSeenAt).toBeInstanceOf(Date);
    expect(await isAuthSessionActive({ id: session.id, userId: user.id, role: user.role })).toBe(true);

    await revokeAuthSession(session.id);
    expect(await isAuthSessionActive({ id: session.id, userId: user.id, role: user.role })).toBe(false);
  });

  it("PostgreSQL rate limit kotası processler arasında ortak ve iade edilebilirdir", async () => {
    const previous = process.env.RATE_LIMIT_STORE;
    process.env.RATE_LIMIT_STORE = "postgres";
    try {
      const options = {
        namespace: "integration-login:account",
        key: "rate-limit-fixture",
        limit: 2,
        windowMs: 60_000,
        now: 1_000,
      };
      await expect(takeRateLimit(options)).resolves.toMatchObject({ allowed: true, remaining: 1 });
      await expect(takeRateLimit(options)).resolves.toMatchObject({ allowed: true, remaining: 0 });
      await refundRateLimit(options, 1_001);
      await expect(takeRateLimit({ ...options, now: 1_002 })).resolves.toMatchObject({ allowed: true, remaining: 0 });
      await expect(takeRateLimit({ ...options, now: 1_003 })).resolves.toMatchObject({ allowed: false, remaining: 0 });
    } finally {
      if (previous === undefined) delete process.env.RATE_LIMIT_STORE;
      else process.env.RATE_LIMIT_STORE = previous;
    }
  });

  it("kullanıcı yalnızca kendi aktif oturumunu listeleyip iptal edebilir", async () => {
    const first = await createUser({
      username: "oturum.sahibi",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const other = await createUser({
      username: "oturum.diger",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const ownSession = await createAuthSession({ userId: first.id, role: "ogrenci", ttlMs: 60_000 });
    const otherSession = await createAuthSession({ userId: other.id, role: "ogrenci", ttlMs: 60_000 });

    await expect(listActiveAuthSessionsForUser(first.id)).resolves.toEqual([
      expect.objectContaining({ id: ownSession.id, role: "ogrenci" }),
    ]);
    expect(await revokeAuthSessionForUser({ id: otherSession.id, userId: first.id })).toBe(false);
    expect(await revokeAuthSessionForUser({ id: ownSession.id, userId: first.id })).toBe(true);
    expect(await isAuthSessionActive({ id: ownSession.id, userId: first.id, role: "ogrenci" })).toBe(false);
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

  it("P2 eşzamanlı deneme güncellemelerinde iki aksiyonu da korur", async () => {
    const user = await createUser({
      username: "deneme.eszamanli",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    const template = loadCasesStore().cases.find((item) => item.durum === "aktif");
    expect(template).toBeDefined();
    const snapshot = adminVakaToPlayable(template!);
    const db = getDb();
    const [attempt] = await db
      .insert(learningAttempts)
      .values({
        studentId: user.id,
        assignmentId: null,
        caseId: template!.id,
        caseVersion: String(template!.surum),
        poliklinikKey: template!.poliklinikKey,
        status: "active",
        caseSnapshot: snapshot,
        askedActions: [],
        requestedTests: [],
      })
      .returning();

    await Promise.all([
      answerPostgresAttempt(attempt.id, user.id, "VITAL_TANSIYON"),
      answerPostgresAttempt(attempt.id, user.id, "VITAL_NABIZ"),
    ]);

    const [stored] = await db.select().from(learningAttempts).where(eq(learningAttempts.id, attempt.id));
    expect(stored.askedActions).toEqual(expect.arrayContaining(["VITAL_TANSIYON", "VITAL_NABIZ"]));
    expect(stored.askedActions).toHaveLength(2);
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
