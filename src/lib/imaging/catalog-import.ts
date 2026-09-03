/**
 * Transaction-agnostic import policy for the independent imaging catalogue.
 * The operational script supplies the PostgreSQL adapter; tests use an
 * in-memory adapter so this policy can never point at a production database.
 */
export type CatalogueSource = {
  readonly datasetKey: string;
  readonly datasetVersion: string;
  readonly modality: "CXR" | "ECG";
  readonly sourceRecordId: string;
  readonly metadataChecksum: string;
  readonly manifestChecksum: string;
  readonly storageKey: string;
  readonly labels: readonly string[];
};

export type CatalogueRepository = {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  existingManifest(datasetKey: string): Promise<string | null>;
  createRun(input: { readonly datasetKey: string; readonly manifestChecksum: string }): Promise<string>;
  finishRun(runId: string, status: "succeeded" | "failed" | "review_required"): Promise<void>;
  publish(source: CatalogueSource, runId: string): Promise<void>;
  markAbsentStale(datasetKey: string, presentSourceRecordIds: readonly string[]): Promise<void>;
};

export type CatalogueImportReport = {
  readonly dryRun: boolean;
  readonly imported: number;
  readonly alreadyCurrent: boolean;
  readonly reviewRequired: boolean;
};

function oneDataset(sources: readonly CatalogueSource[]): { readonly datasetKey: string; readonly manifestChecksum: string } {
  if (sources.length === 0) throw new Error("catalogue import requires at least one valid source record");
  const first = sources[0]!;
  if (sources.some((source) => source.datasetKey !== first.datasetKey || source.datasetVersion !== first.datasetVersion || source.manifestChecksum !== first.manifestChecksum)) {
    throw new Error("each import batch must contain exactly one dataset/version/manifest");
  }
  return { datasetKey: first.datasetKey, manifestChecksum: first.manifestChecksum };
}

/**
 * A matching successful manifest is a no-op. A different successful manifest
 * is deliberately review-only: it cannot mutate a published source record.
 */
export async function importCatalogue(
  repository: CatalogueRepository,
  sources: readonly CatalogueSource[],
  options: { readonly dry?: boolean } = {}
): Promise<CatalogueImportReport> {
  const batch = oneDataset(sources);
  if (options.dry) return { dryRun: true, imported: sources.length, alreadyCurrent: false, reviewRequired: false };
  return repository.transaction(async () => {
    const existing = await repository.existingManifest(batch.datasetKey);
    if (existing === batch.manifestChecksum) return { dryRun: false, imported: 0, alreadyCurrent: true, reviewRequired: false };
    const runId = await repository.createRun(batch);
    if (existing !== null) {
      await repository.finishRun(runId, "review_required");
      return { dryRun: false, imported: 0, alreadyCurrent: false, reviewRequired: true };
    }
    try {
      for (const source of sources) await repository.publish(source, runId);
      await repository.markAbsentStale(batch.datasetKey, sources.map((source) => source.sourceRecordId));
      await repository.finishRun(runId, "succeeded");
      return { dryRun: false, imported: sources.length, alreadyCurrent: false, reviewRequired: false };
    } catch (error) {
      await repository.finishRun(runId, "failed");
      throw error;
    }
  });
}
