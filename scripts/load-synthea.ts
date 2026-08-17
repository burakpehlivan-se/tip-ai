/**
 * Synthea / SyntheticMass CSV → PostgreSQL loader.
 *
 * `data/raw/synthea/*.csv` (veya `.csv.gz`) dosyalarını okuyup `synthea_*`
 * tablolarına yazar. SyntheticMass gibi büyük arşivler için akış (streaming)
 * okur ve isteğe bağlı deterministik örnekleme yapar.
 *
 * İdempotent: çalıştırmadan önce tüm `synthea_*` tabloları TRUNCATE edilir,
 * sonra veri yeniden yüklenir. Synthea verisi tamamen sentetiktir; gerçek
 * kişi/PHI içermez.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/load-synthea.ts \
 *     [--dir data/raw/synthea] [--dry] [--sample 5000]
 *
 * --sample N : yalnızca N hastayı deterministik biçimde örnekler (1M SyntheticMass için önerilir).
 * --dry      : yazmadan sayıları raporlar.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { sql } from "drizzle-orm";
import { getDb, AuthDb } from "../src/lib/auth/db";
import {
  syntheaConditions,
  syntheaEncounters,
  syntheaImagingStudies,
  syntheaMedications,
  syntheaObservations,
  syntheaPatients,
  syntheaProcedures,
} from "../src/lib/auth/schema";

const DEFAULT_DIR = "data/raw/synthea";
const INSERT_CHUNK = 2000;

// ── Dosya ────────────────────────────────────────────────────────────────────

function csvPath(dir: string, name: string): string {
  for (const fileName of [`${name}.csv.gz`, `${name}.csv`]) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`CSV bulunamadı: ${dir}/${name}.csv[.gz]`);
}

/** Tek satırlık CSV parçalayıcı — alıntılı virgül ve çift tırnak kaçışını destekler. */
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cols.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  cols.push(field);
  return cols;
}

/**
 * CSV (veya gzip'li CSV) dosyasını satır satır akışla okur; her satırı
 * başlık→değer kaydına çevirir. Tüm dosyayı belleğe almaz.
 */
async function* streamRecords(file: string): AsyncGenerator<Record<string, string>> {
  const isGz = file.endsWith(".gz");
  const input = createReadStream(file);
  const source = isGz ? input.pipe(createGunzip()) : input;

  let header: string[] | null = null;
  let buffer = "";
  for await (const chunk of source) {
    buffer += chunk.toString("utf8");
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      const cols = parseCsvLine(line);
      if (header === null) {
        header = cols;
      } else if (cols.length === header.length) {
        const record: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) {
          record[header[i]] = cols[i] ?? "";
        }
        yield record;
      }
      nl = buffer.indexOf("\n");
    }
  }
  if (buffer.length > 0) {
    const cols = parseCsvLine(buffer.replace(/\r$/, ""));
    if (header && cols.length === header.length) {
      const record: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) {
        record[header[i]] = cols[i] ?? "";
      }
      yield record;
    }
  }
}

// ── Değer dönüşümleri ────────────────────────────────────────────────────────

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: string | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── Örnekleme ────────────────────────────────────────────────────────────────

/** FNV-1a — deterministik örnekleme için kararlı hash. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** İlk N hastayı deterministik (hash sıralı) biçimde seçer. */
export function samplePatientIds(ids: string[], sample?: number): Set<string> {
  if (sample == null || sample <= 0 || sample >= ids.length) return new Set(ids);
  const indexed = ids.map((id) => ({ id, h: hashString(id) }));
  indexed.sort((a, b) => a.h - b.h || a.id.localeCompare(b.id));
  return new Set(indexed.slice(0, sample).map((item) => item.id));
}

// ── Yükleme ──────────────────────────────────────────────────────────────────

export interface LoadResult {
  patients: number;
  conditions: number;
  observations: number;
  medications: number;
  procedures: number;
  encounters: number;
  imagingStudies: number;
}

export interface LoadArgs {
  dir: string;
  dry: boolean;
  sample?: number;
}

interface CsvSource {
  name: string;
  patientColumn: "Id" | "PATIENT";
  map: (rec: Record<string, string>) => Record<string, unknown>;
  insert: (db: AuthDb, rows: Record<string, unknown>[]) => Promise<unknown>;
}

const SOURCES: CsvSource[] = [
  {
    name: "patients",
    patientColumn: "Id",
    map: (rec) => ({
      id: rec.Id,
      birthdate: parseDate(rec.BIRTHDATE),
      deathdate: parseDate(rec.DEATHDATE),
      first: blankToNull(rec.FIRST),
      last: blankToNull(rec.LAST),
      gender: rec.GENDER,
      race: blankToNull(rec.RACE),
      ethnicity: blankToNull(rec.ETHNICITY),
      marital: blankToNull(rec.MARITAL),
      city: blankToNull(rec.CITY),
      state: blankToNull(rec.STATE),
      zip: blankToNull(rec.ZIP),
    }),
    insert: (db, rows) => db.insert(syntheaPatients).values(rows as typeof syntheaPatients.$inferInsert[]),
  },
  {
    name: "conditions",
    patientColumn: "PATIENT",
    map: (rec) => ({
      patientId: rec.PATIENT,
      encounterId: blankToNull(rec.ENCOUNTER),
      start: parseDate(rec.START),
      stop: parseDate(rec.STOP),
      code: rec.CODE,
      description: rec.DESCRIPTION,
    }),
    insert: (db, rows) => db.insert(syntheaConditions).values(rows as typeof syntheaConditions.$inferInsert[]),
  },
  {
    name: "observations",
    patientColumn: "PATIENT",
    map: (rec) => ({
      patientId: rec.PATIENT,
      encounterId: blankToNull(rec.ENCOUNTER),
      date: parseDate(rec.DATE),
      category: blankToNull(rec.CATEGORY),
      code: rec.CODE,
      description: blankToNull(rec.DESCRIPTION),
      value: blankToNull(rec.VALUE),
      valueNum: parseNumber(rec.VALUE),
      units: blankToNull(rec.UNITS),
      type: blankToNull(rec.TYPE),
    }),
    insert: (db, rows) => db.insert(syntheaObservations).values(rows as typeof syntheaObservations.$inferInsert[]),
  },
  {
    name: "medications",
    patientColumn: "PATIENT",
    map: (rec) => ({
      patientId: rec.PATIENT,
      encounterId: blankToNull(rec.ENCOUNTER),
      start: parseDate(rec.START),
      stop: parseDate(rec.STOP),
      code: blankToNull(rec.CODE),
      description: blankToNull(rec.DESCRIPTION),
      reasonCode: blankToNull(rec.REASONCODE),
      reasonDescription: blankToNull(rec.REASONDESCRIPTION),
    }),
    insert: (db, rows) => db.insert(syntheaMedications).values(rows as typeof syntheaMedications.$inferInsert[]),
  },
  {
    name: "procedures",
    patientColumn: "PATIENT",
    map: (rec) => ({
      patientId: rec.PATIENT,
      encounterId: blankToNull(rec.ENCOUNTER),
      start: parseDate(rec.START),
      stop: parseDate(rec.STOP),
      code: blankToNull(rec.CODE),
      description: blankToNull(rec.DESCRIPTION),
      reasonCode: blankToNull(rec.REASONCODE),
      reasonDescription: blankToNull(rec.REASONDESCRIPTION),
    }),
    insert: (db, rows) => db.insert(syntheaProcedures).values(rows as typeof syntheaProcedures.$inferInsert[]),
  },
  {
    name: "encounters",
    patientColumn: "PATIENT",
    map: (rec) => ({
      id: rec.Id,
      patientId: rec.PATIENT,
      start: parseDate(rec.START),
      stop: parseDate(rec.STOP),
      encounterClass: blankToNull(rec.ENCOUNTERCLASS),
      code: blankToNull(rec.CODE),
      description: blankToNull(rec.DESCRIPTION),
      reasonCode: blankToNull(rec.REASONCODE),
      reasonDescription: blankToNull(rec.REASONDESCRIPTION),
    }),
    insert: (db, rows) => db.insert(syntheaEncounters).values(rows as typeof syntheaEncounters.$inferInsert[]),
  },
  {
    name: "imaging_studies",
    patientColumn: "PATIENT",
    map: (rec) => ({
      patientId: rec.PATIENT,
      encounterId: blankToNull(rec.ENCOUNTER),
      date: parseDate(rec.DATE),
      bodySiteCode: blankToNull(rec.BODYSITE_CODE),
      bodySiteDescription: blankToNull(rec.BODYSITE_DESCRIPTION),
      modalityCode: blankToNull(rec.MODALITY_CODE),
      modalityDescription: blankToNull(rec.MODALITY_DESCRIPTION),
      procedureCode: blankToNull(rec.PROCEDURE_CODE),
    }),
    insert: (db, rows) => db.insert(syntheaImagingStudies).values(rows as typeof syntheaImagingStudies.$inferInsert[]),
  },
];

async function insertChunked(db: AuthDb, source: CsvSource, rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await source.insert(db, rows.slice(i, i + INSERT_CHUNK));
  }
}

export async function loadSynthea(args: LoadArgs): Promise<LoadResult> {
  const { dir, dry, sample } = args;
  const db = dry ? null : getDb();

  const patientsSource = SOURCES[0];
  const patientsFile = csvPath(dir, "patients");

  // 1. Hasta kimliklerini topla (streaming).
  const patientIds: string[] = [];
  for await (const rec of streamRecords(patientsFile)) {
    patientIds.push(rec.Id);
  }
  const sampled = samplePatientIds(patientIds, sample);

  if (db) {
    await db.execute(
      sql`TRUNCATE TABLE synthea_imaging_studies, synthea_encounters, synthea_procedures, synthea_medications, synthea_observations, synthea_conditions, synthea_patients CASCADE`
    );
  }

  const counts: Record<string, number> = {};

  // 2. Her dosyayı akışla oku, örneklenen hastalara filtrele, yükle.
  for (const source of SOURCES) {
    const file = csvPath(dir, source.name);
    let count = 0;
    const batch: Record<string, unknown>[] = [];
    for await (const rec of streamRecords(file)) {
      const key = rec[source.patientColumn];
      if (!sampled.has(key)) continue;
      batch.push(source.map(rec));
      if (batch.length >= INSERT_CHUNK) {
        count += batch.length;
        if (db) await source.insert(db, batch);
        batch.length = 0;
      }
    }
    if (batch.length) {
      count += batch.length;
      if (db) await source.insert(db, batch);
    }
    counts[source.name] = count;
  }

  return {
    patients: counts.patients,
    conditions: counts.conditions,
    observations: counts.observations,
    medications: counts.medications,
    procedures: counts.procedures,
    encounters: counts.encounters,
    imagingStudies: counts.imaging_studies,
  };
}

function usage(): never {
  throw new Error(
    "Usage: npx tsx scripts/load-synthea.ts [--dir data/raw/synthea] [--dry] [--sample N]"
  );
}

function parseArgs(args: string[]): LoadArgs {
  let dir = DEFAULT_DIR;
  let dry = false;
  let sample: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry") {
      dry = true;
    } else if (args[i] === "--dir") {
      dir = args[++i];
      if (!dir || dir.startsWith("--")) usage();
    } else if (args[i] === "--sample") {
      const value = args[++i];
      if (!value || Number.isNaN(Number(value))) {
        throw new Error("--sample sayısal bir değer gerektirir.");
      }
      sample = Number(value);
    } else {
      usage();
    }
  }
  return { dir, dry, sample };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await loadSynthea(args);

  process.stdout.write(
    `${args.dry ? "[dry] " : ""}Synthea yüklendi: ${result.patients} hasta, ` +
      `${result.conditions} condition, ${result.observations} observation, ` +
      `${result.medications} medication, ${result.procedures} procedure, ` +
      `${result.encounters} encounter, ${result.imagingStudies} imaging study.` +
      (args.sample != null ? ` (örnek: ${args.sample})` : "") +
      "\n"
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
