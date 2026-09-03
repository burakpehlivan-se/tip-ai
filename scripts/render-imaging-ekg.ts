/**
 * Creates the separate PTB-XL display-image cache. It never runs from HTTP.
 * Default is a non-writing dry report limited to ten records; bulk needs both
 * --apply and --bulk with an explicit --limit.
 */
import path from "node:path";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import { imagingDatasets, imagingImportRuns, imagingRecordAssets, imagingRecords, imagingRenderRuns } from "../src/lib/auth/schema";
import { renderPtbxlDisplayImage } from "../src/lib/imaging/ekg-render";

function argument(name: string): string | undefined { return process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1); }
function has(flag: string): boolean { return process.argv.includes(flag); }
function positiveInteger(value: string | undefined, fallback: number): number { const number = Number(value ?? fallback); if (!Number.isSafeInteger(number) || number < 1) throw new Error("--limit must be a positive integer"); return number; }
function rawRoot(): string { return argument("--data-root") ?? (process.platform === "linux" ? "/app/data/raw" : "data/raw"); }
function displayRoot(): string { return argument("--display-root") ?? (process.platform === "linux" ? "/app/data/imaging-display" : "data/imaging-display"); }

export async function runEkgRender(args: { readonly apply: boolean; readonly limit: number; readonly dataRoot: string; readonly outputRoot: string; readonly rendererVersion?: string; readonly renderProfile?: string }): Promise<Record<string, unknown>> {
  const db = getDb(); const rendererVersion = args.rendererVersion ?? "ptbxl-svg-sharp-v1"; const renderProfile = args.renderProfile ?? "standard-25mmps-10mmmv";
  const datasets = await db.select().from(imagingDatasets).where(and(eq(imagingDatasets.datasetKey, "ptbxl"), eq(imagingDatasets.version, "1.0.3"))).limit(1); const dataset = datasets[0]; if (!dataset) throw new Error("PTB-XL catalogue has not been imported");
  const imports = await db.select().from(imagingImportRuns).where(and(eq(imagingImportRuns.datasetId, dataset.id), eq(imagingImportRuns.status, "succeeded"))).orderBy(desc(imagingImportRuns.startedAt)).limit(1); const importRun = imports[0]; if (!importRun) throw new Error("PTB-XL has no successful import run");
  const oldRun = await db.select().from(imagingRenderRuns).where(and(eq(imagingRenderRuns.datasetId, dataset.id), eq(imagingRenderRuns.importRunId, importRun.id), eq(imagingRenderRuns.status, "running"), eq(imagingRenderRuns.rendererVersion, rendererVersion), eq(imagingRenderRuns.renderProfile, renderProfile))).limit(1);
  const candidates = await db.select({ record: imagingRecords, raw: imagingRecordAssets }).from(imagingRecords).innerJoin(imagingRecordAssets, and(eq(imagingRecordAssets.recordId, imagingRecords.id), eq(imagingRecordAssets.assetRole, "raw_signal"))).where(and(eq(imagingRecords.datasetId, dataset.id), eq(imagingRecords.modality, "ECG"))).orderBy(asc(imagingRecords.sourceRecordId));
  const published = await db.select({ recordId: imagingRecordAssets.recordId }).from(imagingRecordAssets).innerJoin(imagingRecords, eq(imagingRecords.id, imagingRecordAssets.recordId)).where(and(eq(imagingRecords.datasetId, dataset.id), eq(imagingRecordAssets.assetRole, "display_image"), isNotNull(imagingRecordAssets.publishedAt)));
  const publishedIds = new Set(published.map((asset) => asset.recordId)); const cursor = oldRun[0]?.cursor;
  const selected = candidates.filter((candidate) => !publishedIds.has(candidate.record.id) && (!cursor || candidate.record.sourceRecordId > cursor)).slice(0, args.limit);
  if (!args.apply) return { mode: "dry", limit: args.limit, candidates: selected.length, rendererVersion, renderProfile };
  const run = oldRun[0] ?? (await db.insert(imagingRenderRuns).values({ datasetId: dataset.id, importRunId: importRun.id, status: "running", rendererVersion, renderProfile, discoveredCount: selected.length }).returning())[0]; if (!run) throw new Error("could not create render run");
  let rendered = 0; let skipped = 0; let failed = 0;
  for (const candidate of selected) {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tip-ai-imaging-render:${candidate.record.id}:${rendererVersion}:${renderProfile}`}, 0))`);
        const existing = await tx.select({ id: imagingRecordAssets.id }).from(imagingRecordAssets).where(and(eq(imagingRecordAssets.recordId, candidate.record.id), eq(imagingRecordAssets.assetRole, "display_image"), eq(imagingRecordAssets.rendererVersion, rendererVersion), eq(imagingRecordAssets.renderProfile, renderProfile))).limit(1);
        if (existing.length > 0) { skipped += 1; return; }
        const filenameLr = candidate.raw.storageKey.replace(/^ptbxl\//, "").replace(/\.dat$/, "");
        const output = await renderPtbxlDisplayImage({ sourceRoot: path.join(args.dataRoot, "ptbxl"), outputRoot: args.outputRoot, filenameLr, sourceRecordId: candidate.record.sourceRecordId, rendererVersion, renderProfile });
        await tx.insert(imagingRecordAssets).values({ recordId: candidate.record.id, renderRunId: run.id, assetRole: "display_image", storageKey: output.storageKey, mimeType: "image/png", checksumSha256: output.checksumSha256, sizeBytes: output.sizeBytes, width: output.width, height: output.height, samplingRateHz: 100, rendererVersion, renderProfile, publishedAt: new Date() }).onConflictDoNothing();
        await tx.update(imagingRecords).set({ availability: "display_ready", publishedAt: new Date(), updatedAt: new Date() }).where(eq(imagingRecords.id, candidate.record.id));
        rendered += output.kind === "rendered" ? 1 : 0;
      });
      await db.update(imagingRenderRuns).set({ cursor: candidate.record.sourceRecordId, renderedCount: rendered, failedCount: failed }).where(eq(imagingRenderRuns.id, run.id));
    } catch { failed += 1; await db.update(imagingRenderRuns).set({ cursor: candidate.record.sourceRecordId, renderedCount: rendered, failedCount: failed }).where(eq(imagingRenderRuns.id, run.id)); }
  }
  await db.update(imagingRenderRuns).set({ status: failed > 0 ? "failed" : "succeeded", completedAt: new Date(), renderedCount: rendered, failedCount: failed, errorSummary: failed > 0 ? { failed_records: failed } : null }).where(eq(imagingRenderRuns.id, run.id));
  return { mode: "apply", renderRunId: run.id, candidates: selected.length, rendered, skipped, failed, rendererVersion, renderProfile };
}

async function main(): Promise<void> {
  const apply = has("--apply"); const dry = has("--dry"); if (apply === dry) throw new Error("choose exactly one of --dry or --apply");
  const limit = positiveInteger(argument("--limit"), 10); if (limit > 10 && !has("--bulk")) throw new Error("bulk render is out of scope: use explicit --bulk and --limit after operator approval"); if (has("--bulk") && !argument("--limit")) throw new Error("--bulk requires an explicit --limit");
  console.log(JSON.stringify(await runEkgRender({ apply, limit, dataRoot: rawRoot(), outputRoot: displayRoot() }), null, 2));
}
if (process.argv[1]?.endsWith("render-imaging-ekg.ts")) main().catch((error) => { console.error(error instanceof Error ? error.message : "EKG render failed"); process.exitCode = 1; });
