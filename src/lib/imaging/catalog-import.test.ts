import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { importCatalogue, type CatalogueRepository, type CatalogueSource } from "./catalog-import";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function root(): string { const value = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-imaging-import-")); dirs.push(value); return value; }
function sha(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }

class MemoryCatalogue implements CatalogueRepository {
  public writes = 0;
  public records = new Map<string, { checksum: string; published: boolean; stale: boolean }>();
  public manifests = new Map<string, string>();
  public runs: Array<{ status: string; manifest: string }> = [];
  async transaction<T>(work: () => Promise<T>): Promise<T> { return work(); }
  async existingManifest(datasetKey: string): Promise<string | null> { return this.manifests.get(datasetKey) ?? null; }
  async createRun(input: { datasetKey: string; manifestChecksum: string }): Promise<string> { this.writes++; this.runs.push({ status: "running", manifest: input.manifestChecksum }); return `run-${this.runs.length}`; }
  async finishRun(_runId: string, status: "succeeded" | "failed" | "review_required"): Promise<void> { this.writes++; this.runs.at(-1)!.status = status; }
  async publish(source: CatalogueSource, _runId: string): Promise<void> { this.writes++; this.records.set(source.sourceRecordId, { checksum: source.metadataChecksum, published: true, stale: false }); this.manifests.set(source.datasetKey, source.manifestChecksum); }
  async markAbsentStale(datasetKey: string, present: readonly string[]): Promise<void> { this.writes++; for (const [id, record] of this.records) if (!present.includes(id) && datasetKey) record.stale = true; }
}

class DisposablePgCatalogue implements CatalogueRepository {
  private readonly datasetId = "00000000-0000-4000-8000-000000000001";
  constructor(private readonly db: PGlite) {}
  async prepare(): Promise<void> {
    await this.db.query("CREATE TABLE users (id uuid PRIMARY KEY)");
    const migration = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0018_imaging_catalog.sql"), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) if (statement.trim()) await this.db.query(statement);
    await this.db.query("INSERT INTO imaging_datasets (id, dataset_key, version, display_name, modality) VALUES ($1, 'nih_chestxray14', '2020', 'NIH ChestX-ray14', 'CXR')", [this.datasetId]);
  }
  async transaction<T>(work: () => Promise<T>): Promise<T> { return work(); }
  async existingManifest(): Promise<string | null> { const result = await this.db.query<{ manifest_checksum: string }>("SELECT manifest_checksum FROM imaging_import_runs WHERE dataset_id = $1 AND status = 'succeeded' LIMIT 1", [this.datasetId]); return result.rows[0]?.manifest_checksum ?? null; }
  async createRun(input: { manifestChecksum: string }): Promise<string> { const id = randomUUID(); await this.db.query("INSERT INTO imaging_import_runs (id, dataset_id, status, manifest_checksum, metadata_checksum) VALUES ($1, $2, 'running', $3, 'fixture-metadata')", [id, this.datasetId, input.manifestChecksum]); return id; }
  async finishRun(runId: string, status: "succeeded" | "failed" | "review_required"): Promise<void> { await this.db.query("UPDATE imaging_import_runs SET status = $1, completed_at = now() WHERE id = $2", [status, runId]); }
  async publish(input: CatalogueSource, runId: string): Promise<void> { await this.db.query("INSERT INTO imaging_records (id, dataset_id, import_run_id, source_record_id, modality, metadata_checksum, availability) VALUES ($1, $2, $3, $4, 'CXR', $5, 'indexed')", [randomUUID(), this.datasetId, runId, input.sourceRecordId, input.metadataChecksum]); }
  async markAbsentStale(_datasetKey: string, present: readonly string[]): Promise<void> { const rows = await this.db.query<{ id: string; source_record_id: string }>("SELECT id, source_record_id FROM imaging_records WHERE dataset_id = $1", [this.datasetId]); for (const row of rows.rows) if (!present.includes(row.source_record_id)) await this.db.query("UPDATE imaging_records SET availability = 'stale' WHERE id = $1", [row.id]); }
}

function source(overrides: Partial<CatalogueSource> = {}): CatalogueSource {
  return { datasetKey: "nih_chestxray14", datasetVersion: "2020", modality: "CXR", sourceRecordId: "00000001_000.png", metadataChecksum: sha("record-a"), manifestChecksum: sha("manifest-a"), storageKey: "images/00000001_000.png", labels: ["Mass"], ...overrides };
}

describe("catalogue importer", () => {
  it("dry mode writes neither run nor catalogue data", async () => {
    const repo = new MemoryCatalogue();
    const report = await importCatalogue(repo, [source()], { dry: true });
    expect(report.dryRun).toBe(true); expect(report.imported).toBe(1); expect(repo.writes).toBe(0);
  });

  it("is idempotent for the same source manifest", async () => {
    const repo = new MemoryCatalogue();
    await importCatalogue(repo, [source()]);
    const second = await importCatalogue(repo, [source()]);
    expect(second.alreadyCurrent).toBe(true); expect(repo.records.size).toBe(1); expect(repo.runs).toHaveLength(1);
  });

  it("marks a different manifest review_required and leaves published records untouched", async () => {
    const repo = new MemoryCatalogue();
    await importCatalogue(repo, [source()]);
    const changed = source({ metadataChecksum: sha("changed"), manifestChecksum: sha("manifest-b") });
    const report = await importCatalogue(repo, [changed]);
    expect(report.reviewRequired).toBe(true); expect(repo.runs.at(-1)).toMatchObject({ status: "review_required" }); expect(repo.records.get(changed.sourceRecordId)?.checksum).toBe(sha("record-a"));
  });

  it("stales records missing from a current import without deleting them", async () => {
    const repo = new MemoryCatalogue();
    await importCatalogue(repo, [source(), source({ sourceRecordId: "00000002_000.png", metadataChecksum: sha("b") })]);
    repo.manifests.delete("nih_chestxray14");
    await importCatalogue(repo, [source({ manifestChecksum: sha("manifest-c") })]);
    expect(repo.records.get("00000002_000.png")?.stale).toBe(true);
  });

  it("uses only a disposable PGlite database for an idempotent run", async () => {
    const databaseRoot = root(); const db = new PGlite(path.join(databaseRoot, "pg")); const repo = new DisposablePgCatalogue(db);
    try {
      await repo.prepare(); await importCatalogue(repo, [source()]); await importCatalogue(repo, [source()]);
      const runs = await db.query<{ status: string }>("SELECT status FROM imaging_import_runs"); const records = await db.query("SELECT id FROM imaging_records");
      expect(runs.rows).toEqual([{ status: "succeeded" }]); expect(records.rows).toHaveLength(1);
    } finally { await db.close(); }
  });
});
