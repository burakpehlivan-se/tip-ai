/**
 * Mevcut synthea_* satırlarının `code_system` alanını kaynak FHIR bundle'larını
 * yeniden okuyarak doldurur. Migration 0013'ten önce yüklenen satırlarda
 * `code_system` NULL'dır; bu script `source_id` (encounters için `id`) üzerinden
 * eşleşen satırları kaynaktaki kod sistemiyle günceller.
 *
 * Yükleme ile birebir aynı parse mantığını kullanır (`codeSystemForResource`,
 * `matchKeyForResource`); yalnızca NULL kalan satırlara dokunur (idempotent).
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-fhir-code-system.ts --dry
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-fhir-code-system.ts --dir reports/output_1/fhir
 */

import process from "node:process";
import { sql, type SQLWrapper } from "drizzle-orm";
import { getDb, type AuthDb } from "../src/lib/auth/db";
import {
  syntheaAllergies,
  syntheaCarePlans,
  syntheaConditions,
  syntheaDiagnosticReports,
  syntheaEncounters,
  syntheaImmunizations,
  syntheaMedications,
  syntheaObservations,
  syntheaProcedures,
} from "../src/lib/auth/schema";
import {
  codeSystemForResource,
  listJsonFiles,
  matchKeyForResource,
  readResources,
} from "./load-synthea-fhir";

const DEFAULT_DIR = "reports/output_1/fhir";
const FLUSH_SIZE = 25_000;

interface Target {
  label: string;
  table: SQLWrapper;
  key: SQLWrapper;
  system: SQLWrapper;
  map: Map<string, string>;
  found: number;
  matched: number;
  updated: number;
}

// TYPE_INDEX sırası TARGETS sırasıyla birebir aynı olmalıdır.
const TYPE_INDEX: Record<string, number> = {
  Condition: 0,
  Observation: 1,
  MedicationRequest: 2,
  Procedure: 3,
  Encounter: 4,
  AllergyIntolerance: 5,
  Immunization: 6,
  CarePlan: 7,
  DiagnosticReport: 8,
};

function buildTargets(): Target[] {
  const make = (label: string, table: SQLWrapper, key: SQLWrapper, system: SQLWrapper): Target => ({
    label,
    table,
    key,
    system,
    map: new Map(),
    found: 0,
    matched: 0,
    updated: 0,
  });
  return [
    make("conditions", syntheaConditions, syntheaConditions.sourceId, syntheaConditions.codeSystem),
    make("observations", syntheaObservations, syntheaObservations.sourceId, syntheaObservations.codeSystem),
    make("medications", syntheaMedications, syntheaMedications.sourceId, syntheaMedications.codeSystem),
    make("procedures", syntheaProcedures, syntheaProcedures.sourceId, syntheaProcedures.codeSystem),
    make("encounters", syntheaEncounters, syntheaEncounters.id, syntheaEncounters.codeSystem),
    make("allergies", syntheaAllergies, syntheaAllergies.sourceId, syntheaAllergies.codeSystem),
    make("immunizations", syntheaImmunizations, syntheaImmunizations.sourceId, syntheaImmunizations.codeSystem),
    make("care_plans", syntheaCarePlans, syntheaCarePlans.sourceId, syntheaCarePlans.codeSystem),
    make("diagnostic_reports", syntheaDiagnosticReports, syntheaDiagnosticReports.sourceId, syntheaDiagnosticReports.codeSystem),
  ];
}

async function flushTarget(db: AuthDb, target: Target, dry: boolean): Promise<void> {
  if (!target.map.size) return;
  const keys = [...target.map.keys()];
  const systems = [...target.map.values()];
  target.map.clear();

  if (dry) {
    const result = await db.execute(sql`
      SELECT count(*)::int AS n
      FROM ${target.table}
      WHERE ${target.key} = ANY(${sql.param(keys)}::text[]) AND ${target.system} IS NULL
    `);
    target.matched += Number((result.rows as { n: number }[])[0]?.n ?? 0);
    return;
  }

  const systemName = (target.system as unknown as { name: string }).name;
  const result = (await db.execute(sql`
    UPDATE ${target.table}
    SET ${sql.identifier(systemName)} = v.cs
    FROM unnest(${sql.param(keys)}::text[], ${sql.param(systems)}::text[]) AS v(k, cs)
    WHERE ${target.key} = v.k AND ${target.system} IS NULL
  `)) as { rowCount?: number };
  target.updated += result.rowCount ?? 0;
}

async function remainingNull(db: AuthDb, target: Target): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::int AS n FROM ${target.table} WHERE ${target.system} IS NULL
  `);
  return Number((result.rows as { n: number }[])[0]?.n ?? 0);
}

export interface BackfillArgs {
  dir: string;
  dry: boolean;
}

export interface BackfillResult {
  files: number;
  invalidFiles: number;
  targets: { label: string; found: number; matched: number; updated: number; remainingNull: number }[];
}

export async function backfillFhirCodeSystem(args: BackfillArgs, injectedDb?: AuthDb): Promise<BackfillResult> {
  const files = await listJsonFiles(args.dir);
  const db = injectedDb || getDb();
  const targets = buildTargets();
  let invalidFiles = 0;

  async function maybeFlush(force = false): Promise<void> {
    for (const target of targets) {
      if (target.map.size >= FLUSH_SIZE || (force && target.map.size)) {
        await flushTarget(db, target, args.dry);
      }
    }
  }

  for (let index = 0; index < files.length; index++) {
    const resources = await readResources(files[index]);
    if (!resources) {
      invalidFiles += 1;
      continue;
    }
    for (const resource of resources) {
      const key = matchKeyForResource(resource);
      if (!key) continue;
      const system = codeSystemForResource(resource);
      if (!system) continue;
      const targetIndex = TYPE_INDEX[String(resource.resourceType)];
      if (targetIndex == null) continue;
      const target = targets[targetIndex];
      target.found += 1;
      if (!target.map.has(key)) target.map.set(key, system);
    }
    await maybeFlush();
    if ((index + 1) % 10000 === 0) process.stdout.write(`FHIR code_system backfill: ${index + 1}/${files.length}\n`);
  }
  await maybeFlush(true);

  const rows = [];
  for (const target of targets) {
    rows.push({
      label: target.label,
      found: target.found,
      matched: target.matched,
      updated: target.updated,
      remainingNull: await remainingNull(db, target),
    });
  }
  return { files: files.length, invalidFiles, targets: rows };
}

function usage(): never {
  throw new Error("Usage: npx tsx scripts/backfill-fhir-code-system.ts [--dir reports/output_1/fhir] [--dry]");
}

function parseArgs(argv: string[]): BackfillArgs {
  let dir = DEFAULT_DIR;
  let dry = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") {
      dir = argv[++i] || "";
      if (!dir || dir.startsWith("--")) usage();
    } else if (argv[i] === "--dry") {
      dry = true;
    } else {
      usage();
    }
  }
  return { dir, dry };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await backfillFhirCodeSystem(args);
  const prefix = args.dry ? "[dry] " : "";
  process.stdout.write(`${prefix}FHIR code_system backfill tamamlandı: ${result.files} dosya, ${result.invalidFiles} geçersiz.\n`);
  for (const t of result.targets) {
    const action = args.dry ? `eşleşen NULL satır: ${t.matched}` : `güncellenen: ${t.updated}`;
    process.stdout.write(`  ${t.label}: ${t.found} kaynak kaydı (code_system dolu), ${action}, kalan NULL: ${t.remainingNull}\n`);
  }
}

if (/^backfill-fhir-code-system\.(?:ts|js)$/.test(process.argv[1]?.split("/").at(-1) || "")) {
  main().catch(() => {
    process.stderr.write("FHIR code_system backfill başarısız oldu.\n");
    process.exitCode = 1;
  });
}
