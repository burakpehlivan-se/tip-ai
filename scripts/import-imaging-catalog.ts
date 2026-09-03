/**
 * Direct-source imaging catalogue importer. It never downloads data and it
 * refuses DB writes unless --apply is supplied. Run a --dry report first.
 *
 *   npx tsx scripts/import-imaging-catalog.ts --dry [--data-root=/app/data/raw]
 *   npx tsx scripts/import-imaging-catalog.ts --apply --dataset=cxr|ptbxl|all
 */
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import { imagingDatasetDocuments, imagingDatasets, imagingImportRuns, imagingRecordAssets, imagingRecordLabels, imagingRecords } from "../src/lib/auth/schema";
import { discoverCxrDataset, discoverPtbxlDataset, type DiscoveredDataset, type IndexedImagingRecord } from "../src/lib/imaging/catalogue-discovery";

function argument(name: string): string | undefined { return process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1); }
function has(flag: string): boolean { return process.argv.includes(flag); }
function rawRoot(): string { return argument("--data-root") ?? (process.platform === "linux" ? "/app/data/raw" : "data/raw"); }
function checksumCounts(dataset: DiscoveredDataset): Record<string, number> { return { parsed_valid_records: dataset.records.length, skipped_records: dataset.skipped, documents: dataset.documents.length }; }

type ImagingDb = ReturnType<typeof getDb>;

async function findOrCreateDataset(db: ImagingDb, dataset: DiscoveredDataset): Promise<string> {
  const rows = await db.insert(imagingDatasets).values({ datasetKey: dataset.datasetKey, version: dataset.version, displayName: dataset.datasetKey === "nih_chestxray14" ? "NIH ChestX-ray14" : "PTB-XL", modality: dataset.modality, sourceUri: dataset.datasetKey === "nih_chestxray14" ? "https://nihcc.app.box.com/v/ChestXray-NIHCC" : "https://physionet.org/content/ptb-xl/", attributionUri: dataset.datasetKey === "nih_chestxray14" ? "https://nihcc.app.box.com/v/ChestXray-NIHCC" : "https://physionet.org/content/ptb-xl/", publishedAt: new Date() }).onConflictDoUpdate({ target: [imagingDatasets.datasetKey, imagingDatasets.version], set: { updatedAt: new Date() } }).returning();
  const id = rows[0]?.id; if (!id) throw new Error("could not create imaging dataset"); return id;
}

async function writeRecord(db: ImagingDb, datasetId: string, runId: string, dataset: DiscoveredDataset, record: IndexedImagingRecord): Promise<void> {
  const isCxr = dataset.modality === "CXR";
  const rows = await db.insert(imagingRecords).values({ datasetId, importRunId: runId, sourceRecordId: record.sourceRecordId, sourceSubjectKey: record.sourceSubjectKey, modality: dataset.modality, sourceAge: record.sourceAge, sourceSex: record.sourceSex, viewPosition: record.viewPosition, protocol: record.protocol, metadataChecksum: record.metadataChecksum, availability: isCxr ? "display_ready" : "indexed", publishedAt: new Date() }).onConflictDoUpdate({ target: [imagingRecords.datasetId, imagingRecords.sourceRecordId], set: { importRunId: runId, sourceSubjectKey: record.sourceSubjectKey, sourceAge: record.sourceAge, sourceSex: record.sourceSex, viewPosition: record.viewPosition, protocol: record.protocol, metadataChecksum: record.metadataChecksum, availability: isCxr ? "display_ready" : "indexed", publishedAt: new Date(), updatedAt: new Date() } }).returning();
  const recordId = rows[0]?.id; if (!recordId) throw new Error("could not persist imaging record");
  const assetRole = isCxr ? "display_image" : "raw_signal";
  await db.insert(imagingRecordAssets).values({ recordId, assetRole, storageKey: record.storageKey, mimeType: isCxr ? "image/png" : "application/octet-stream", checksumSha256: record.assetChecksumSha256, sizeBytes: record.assetBytes, width: record.width, height: record.height, samplingRateHz: record.samplingRateHz, rendererVersion: isCxr ? "source-original-v1" : "source-signal-v1", renderProfile: isCxr ? "nih-png" : "wfdb-16le", publishedAt: isCxr ? new Date() : null }).onConflictDoUpdate({ target: [imagingRecordAssets.recordId, imagingRecordAssets.assetRole, imagingRecordAssets.rendererVersion, imagingRecordAssets.renderProfile], set: { storageKey: record.storageKey, checksumSha256: record.assetChecksumSha256, sizeBytes: record.assetBytes, width: record.width, height: record.height, samplingRateHz: record.samplingRateHz, publishedAt: isCxr ? new Date() : null } });
  for (const [index, label] of record.labels.entries()) await db.insert(imagingRecordLabels).values({ recordId, sourceLabelKey: label.key, sourceLabelCode: label.code, sourceLabelName: label.name, category: label.category, isPrimary: index === 0, provenance: label.provenance, sourceValue: {} }).onConflictDoNothing();
}

async function importDataset(dataset: DiscoveredDataset, apply: boolean): Promise<Record<string, unknown>> {
  const report = { dataset: dataset.datasetKey, version: dataset.version, manifestChecksum: dataset.manifestChecksum, ...checksumCounts(dataset), mode: apply ? "apply" : "dry" };
  if (!apply) return report;
  const db = getDb();
  try { return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tip-ai-imaging-import:${dataset.datasetKey}:${dataset.version}`}, 0))`);
    const transactionalDb = tx as ImagingDb;
    const datasetId = await findOrCreateDataset(transactionalDb, dataset);
    const successful = await tx.select({ manifest: imagingImportRuns.manifestChecksum }).from(imagingImportRuns).where(and(eq(imagingImportRuns.datasetId, datasetId), eq(imagingImportRuns.status, "succeeded"))).limit(1);
    if (successful[0]?.manifest === dataset.manifestChecksum) return { ...report, alreadyCurrent: true };
    const priorRecords = successful.length > 0 ? await tx.select({ sourceRecordId: imagingRecords.sourceRecordId, metadataChecksum: imagingRecords.metadataChecksum }).from(imagingRecords).where(eq(imagingRecords.datasetId, datasetId)) : [];
    const priorById = new Map(priorRecords.map((record) => [record.sourceRecordId, record.metadataChecksum]));
    // A simple disappearance of otherwise identical source files is stale data,
    // not a silent overwrite. Label/metadata changes still require review.
    const absenceOnly = successful.length > 0 && priorRecords.length > dataset.records.length && dataset.records.every((record) => priorById.get(record.sourceRecordId) === record.metadataChecksum);
    const runRows = await tx.insert(imagingImportRuns).values({ datasetId, status: successful.length > 0 && !absenceOnly ? "review_required" : "running", manifestChecksum: dataset.manifestChecksum, metadataChecksum: dataset.metadataChecksum, hmacKeyVersion: dataset.datasetKey === "nih_chestxray14" ? process.env.IMAGING_SUBJECT_HMAC_KEY_VERSION : null, discoveredCounts: checksumCounts(dataset), importedCounts: {} }).returning();
    const runId = runRows[0]?.id; if (!runId) throw new Error("could not create import run");
    if (successful.length > 0 && !absenceOnly) { await tx.update(imagingImportRuns).set({ completedAt: new Date(), errorSummary: { reason: "manifest_drift_requires_review" } }).where(eq(imagingImportRuns.id, runId)); return { ...report, reviewRequired: true }; }
    try {
      for (const document of dataset.documents) await tx.insert(imagingDatasetDocuments).values({ datasetId, documentKind: document.documentKind, storageKey: document.storageKey, checksumSha256: document.checksumSha256, mimeType: document.mimeType, title: document.title, attribution: document.attribution }).onConflictDoUpdate({ target: [imagingDatasetDocuments.datasetId, imagingDatasetDocuments.storageKey], set: { checksumSha256: document.checksumSha256, mimeType: document.mimeType, title: document.title, attribution: document.attribution } });
      for (const record of dataset.records) await writeRecord(transactionalDb, datasetId, runId, dataset, record);
      const identifiers = dataset.records.map((record) => record.sourceRecordId);
      if (identifiers.length > 0) await tx.update(imagingRecords).set({ availability: "stale", publishedAt: null, updatedAt: new Date() }).where(and(eq(imagingRecords.datasetId, datasetId), notInArray(imagingRecords.sourceRecordId, identifiers)));
      await tx.update(imagingImportRuns).set({ status: "succeeded", completedAt: new Date(), importedCounts: { imported_records: dataset.records.length, stale_candidates: 0 } }).where(eq(imagingImportRuns.id, runId));
      return { ...report, imported: dataset.records.length };
    } catch (error) { throw error; }
  }); } catch (error) {
    // The transaction above rolled back every catalogue mutation. Persist only
    // a new audit run outside it, so a failed import never changes publishing.
    const datasetId = await findOrCreateDataset(db, dataset);
    await db.insert(imagingImportRuns).values({ datasetId, status: "failed", manifestChecksum: dataset.manifestChecksum, metadataChecksum: dataset.metadataChecksum, hmacKeyVersion: dataset.datasetKey === "nih_chestxray14" ? process.env.IMAGING_SUBJECT_HMAC_KEY_VERSION : null, discoveredCounts: checksumCounts(dataset), importedCounts: {}, completedAt: new Date(), errorSummary: { reason: error instanceof Error ? error.message.slice(0, 500) : "unknown" } });
    throw error;
  }
}

export async function runImport(args: { readonly dataRoot: string; readonly dataset: "cxr" | "ptbxl" | "all"; readonly apply: boolean }): Promise<readonly Record<string, unknown>[]> {
  const discovered: DiscoveredDataset[] = [];
  if (args.dataset === "cxr" || args.dataset === "all") {
    const secret = process.env.IMAGING_SUBJECT_HMAC_KEY; const version = process.env.IMAGING_SUBJECT_HMAC_KEY_VERSION;
    if (!secret || !version) throw new Error("CXR import requires IMAGING_SUBJECT_HMAC_KEY and IMAGING_SUBJECT_HMAC_KEY_VERSION");
    discovered.push(discoverCxrDataset({ rawRoot: args.dataRoot, version: "v2020", subjectKeySecret: secret, subjectKeyVersion: version }));
  }
  if (args.dataset === "ptbxl" || args.dataset === "all") discovered.push(discoverPtbxlDataset({ rawRoot: args.dataRoot, version: "1.0.3" }));
  return Promise.all(discovered.map((dataset) => importDataset(dataset, args.apply)));
}

async function main(): Promise<void> {
  const apply = has("--apply"); const dry = has("--dry"); if (apply === dry) throw new Error("choose exactly one of --dry or --apply");
  const dataset = (argument("--dataset") ?? "all") as "cxr" | "ptbxl" | "all"; if (!["cxr", "ptbxl", "all"].includes(dataset)) throw new Error("--dataset must be cxr, ptbxl, or all");
  console.log(JSON.stringify(await runImport({ dataRoot: rawRoot(), dataset, apply }), null, 2));
}
if (process.argv[1]?.endsWith("import-imaging-catalog.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : "imaging import failed"); process.exitCode = 1; });
