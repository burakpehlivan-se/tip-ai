/**
 * Synthea FHIR Bundle → PostgreSQL eğitim veri deposu.
 *
 * Bu yükleyici yalnızca vaka üretiminde kullanılan klinik projeksiyonu taşır:
 * Patient (kimlik/iletişim/adres olmadan), Condition, Observation,
 * MedicationRequest, Procedure, Encounter, AllergyIntolerance, Immunization,
 * CarePlan ve DiagnosticReport. Ham FHIR dosyası veya hasta kimliği loglanmaz.
 * Kaynak kimlikleri ile tekrar çalıştırma idempotenttir.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npm run db:load-synthea-fhir -- --dir reports/output_1/fhir
 *   DATABASE_URL=postgresql://... npm run db:load-synthea-fhir -- --replace
 *   DATABASE_URL=postgresql://... npm run db:load-synthea-fhir:history
 *   npm run db:load-synthea-fhir:dry -- --dir reports/output_1/fhir
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { eq, sql } from "drizzle-orm";
import { getDb, type AuthDb } from "../src/lib/auth/db";
import {
  syntheaConditions,
  syntheaCarePlans,
  syntheaDiagnosticReports,
  syntheaEncounters,
  fhirImportRuns,
  fhirSourceArchives,
  syntheaAllergies,
  syntheaImmunizations,
  syntheaMedications,
  syntheaObservations,
  syntheaPatients,
  syntheaProcedures,
} from "../src/lib/auth/schema";

const DEFAULT_DIR = "reports/output_1/fhir";
const BATCH_SIZE = 2_000;

export type FhirResource = Record<string, unknown> & { resourceType?: string; id?: string };
type Counts = Record<
  "patients" | "conditions" | "observations" | "medications" | "procedures" | "encounters" | "allergies" | "immunizations" | "carePlans" | "diagnosticReports",
  number
>;

export interface LoadFhirArgs {
  dir: string;
  dry: boolean;
  /** Yalnızca açıkça seçilirse önce mevcut synthea_* eğitim verisini siler. */
  replace: boolean;
  /** Önceden yüklenmiş hasta temel verisi üzerinde yalnızca geçmiş kaynaklarını ekler. */
  historyOnly: boolean;
}

export interface FhirLoadResult extends Counts {
  files: number;
  invalidFiles: number;
  unsupported: Record<string, number>;
  resourceTypes: Record<string, number>;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseDate(value: unknown): Date | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resourceRef(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const reference = cleanText((value as Record<string, unknown>).reference);
  if (!reference) return null;
  const normalized = reference.replace(/^urn:uuid:/i, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) || null;
}

function concept(value: unknown): { code: string | null; description: string | null; system: string | null } {
  if (!value || typeof value !== "object") return { code: null, description: null, system: null };
  const c = value as Record<string, unknown>;
  const coding = Array.isArray(c.coding) ? c.coding.find((item) => item && typeof item === "object") : null;
  const code = coding && typeof coding === "object" ? cleanText((coding as Record<string, unknown>).code) : null;
  const display = coding && typeof coding === "object" ? cleanText((coding as Record<string, unknown>).display) : null;
  const system = coding && typeof coding === "object" ? cleanText((coding as Record<string, unknown>).system) : null;
  return { code, description: display || cleanText(c.text) || code, system };
}

function resourceSourceId(resource: FhirResource): string {
  const type = cleanText(resource.resourceType) || "Unknown";
  const id = cleanText(resource.id);
  if (id) return `${type}:${id}`;
  // Bazı Synthea MedicationRequest kaynaklarında id yoktur. Sabit özet,
  // ham klinik alanları saklamadan bu kayıtları tekrar yüklemede tekilleştirir.
  return `${type}:sha256:${createHash("sha256").update(JSON.stringify(resource)).digest("hex")}`;
}

function extensionConcept(resource: FhirResource, suffix: string): string | null {
  const extensions = Array.isArray(resource.extension) ? resource.extension : [];
  const ext = extensions.find((item) => {
    if (!item || typeof item !== "object") return false;
    return cleanText((item as Record<string, unknown>).url)?.endsWith(suffix);
  }) as Record<string, unknown> | undefined;
  return ext ? concept(ext.valueCodeableConcept).description : null;
}

function scalarObservationValue(resource: FhirResource): { value: string | null; valueNum: number | null; units: string | null; type: string | null } {
  const quantity = resource.valueQuantity;
  if (quantity && typeof quantity === "object") {
    const q = quantity as Record<string, unknown>;
    const numeric = typeof q.value === "number" && Number.isFinite(q.value) ? q.value : null;
    return {
      value: numeric === null ? cleanText(q.value) : String(numeric),
      valueNum: numeric,
      units: cleanText(q.unit) || cleanText(q.code),
      type: "numeric",
    };
  }
  if (typeof resource.valueInteger === "number" && Number.isFinite(resource.valueInteger)) {
    return { value: String(resource.valueInteger), valueNum: resource.valueInteger, units: null, type: "numeric" };
  }
  if (typeof resource.valueBoolean === "boolean") {
    return { value: String(resource.valueBoolean), valueNum: null, units: null, type: "boolean" };
  }
  const coded = concept(resource.valueCodeableConcept);
  if (coded.description) return { value: coded.description, valueNum: null, units: null, type: "coded" };
  const text = cleanText(resource.valueString) || cleanText(resource.valueDateTime);
  return { value: text, valueNum: null, units: null, type: text ? "text" : null };
}

export function resourcesFromBundle(document: unknown): FhirResource[] | null {
  if (!document || typeof document !== "object") return null;
  const bundle = document as Record<string, unknown>;
  if (bundle.resourceType !== "Bundle" || !Array.isArray(bundle.entry)) return null;
  return bundle.entry
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>).resource : null))
    .filter((resource): resource is FhirResource => Boolean(resource && typeof resource === "object"));
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(full);
    }
  }
  await visit(dir);
  return files;
}

export async function readResources(file: string): Promise<FhirResource[] | null> {
  try {
    return resourcesFromBundle(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    return null;
  }
}

function emptyCounts(): Counts {
  return {
    patients: 0,
    conditions: 0,
    observations: 0,
    medications: 0,
    procedures: 0,
    encounters: 0,
    allergies: 0,
    immunizations: 0,
    carePlans: 0,
    diagnosticReports: 0,
  };
}

async function flush<T>(rows: T[], callback: (rows: T[]) => Promise<unknown>): Promise<void> {
  if (!rows.length) return;
  await callback(rows.splice(0, rows.length));
}

function patientRow(resource: FhirResource) {
  const marital = concept(resource.maritalStatus).description;
  return {
    id: cleanText(resource.id) || resourceSourceId(resource),
    birthdate: parseDate(resource.birthDate),
    deathdate: parseDate(resource.deceasedDateTime),
    // Veri minimizasyonu: ad, iletişim, adres, fotoğraf ve kimlik numaraları aktarılmaz.
    first: null,
    last: null,
    gender: cleanText(resource.gender) || "unknown",
    race: extensionConcept(resource, "us-core-race"),
    ethnicity: extensionConcept(resource, "us-core-ethnicity"),
    marital,
    city: null,
    state: null,
    zip: null,
  };
}

function patientIdFrom(resources: FhirResource[]): string | null {
  const patient = resources.find((resource) => resource.resourceType === "Patient");
  return patient ? cleanText(patient.id) || resourceSourceId(patient) : null;
}

function category(resource: FhirResource): string | null {
  const categories = Array.isArray(resource.category) ? resource.category : [];
  return concept(categories[0]).description;
}

function categoryList(resource: FhirResource): string | null {
  const categories = Array.isArray(resource.category) ? resource.category : [];
  const values = categories
    .map((item) => (typeof item === "string" ? cleanText(item) : concept(item).description))
    .filter((item): item is string => Boolean(item));
  return values.length ? values.join(", ") : null;
}

function carePlanDetail(resource: FhirResource): { code: string | null; description: string | null; system: string | null } {
  const activity = Array.isArray(resource.activity) ? resource.activity[0] : null;
  if (!activity || typeof activity !== "object") return { code: null, description: null, system: null };
  const detail = (activity as Record<string, unknown>).detail;
  if (!detail || typeof detail !== "object") return { code: null, description: null, system: null };
  const d = detail as Record<string, unknown>;
  const c = concept(d.code);
  return { code: c.code, description: c.description || cleanText(d.description), system: c.system };
}

/**
 * Kaynak FHIR kaynağının kod sistemi (SNOMED-CT / LOINC / RxNorm / ...).
 * Yükleme ve code_system backfill'i aynı değeri üretmek için bu tek fonksiyonu
 * kullanır; kaynak türüne göre hangi alandan okunacağını burada tanımlarız.
 */
export function codeSystemForResource(resource: FhirResource): string | null {
  const type = cleanText(resource.resourceType);
  switch (type) {
    case "Condition":
    case "Observation":
    case "Procedure":
    case "AllergyIntolerance":
    case "DiagnosticReport":
      return concept(resource.code).system;
    case "MedicationRequest":
      return concept(resource.medicationCodeableConcept).system;
    case "Encounter":
      return concept(Array.isArray(resource.type) ? resource.type[0] : null).system;
    case "Immunization":
      return concept(resource.vaccineCode).system;
    case "CarePlan":
      return carePlanDetail(resource).system;
    default:
      return null;
  }
}

/**
 * Backfill/tekilleştirme için satır eşleme anahtarı. Encounters tablosu kaynak
 * `id`yi birincil anahtar olarak taşır; diğer tablolar `source_id` kullanır.
 */
export function matchKeyForResource(resource: FhirResource): string | null {
  if (cleanText(resource.resourceType) === "Encounter") {
    return cleanText(resource.id) || resourceSourceId(resource);
  }
  return resourceSourceId(resource);
}

async function sourceManifest(dir: string, files: string[]): Promise<{ sourceUri: string; sizeBytes: number; manifestHash: string }> {
  const manifest = createHash("sha256");
  let sizeBytes = 0;
  for (const file of files) {
    const stat = await fs.stat(file);
    sizeBytes += stat.size;
    manifest.update(`${path.relative(dir, file)}\u0000${stat.size}\u0000${Math.trunc(stat.mtimeMs)}\n`);
  }
  const relative = path.relative(process.cwd(), dir);
  return {
    sourceUri: relative && !relative.startsWith("..") ? relative : path.basename(dir),
    sizeBytes,
    manifestHash: manifest.digest("hex"),
  };
}

async function recordImportRun(db: AuthDb, args: LoadFhirArgs, result: FhirLoadResult, manifest: Awaited<ReturnType<typeof sourceManifest>>): Promise<void> {
  await db.insert(fhirSourceArchives).values({
    sourceUri: manifest.sourceUri,
    sourceFormat: "FHIR Bundle JSON",
    fhirVersion: null,
    fileCount: result.files,
    sizeBytes: manifest.sizeBytes,
    manifestHash: manifest.manifestHash,
    rawPayloadRetainedInDb: false,
    lastVerifiedAt: new Date(),
  }).onConflictDoUpdate({
    target: fhirSourceArchives.manifestHash,
    set: { lastVerifiedAt: new Date() },
  });

  const [archive] = await db.select({ id: fhirSourceArchives.id })
    .from(fhirSourceArchives)
    .where(eq(fhirSourceArchives.manifestHash, manifest.manifestHash));

  if (!archive) return;
  await db.insert(fhirImportRuns).values({
    archiveId: archive.id,
    mode: args.historyOnly ? "history_only" : args.replace ? "replace" : "append",
    files: result.files,
    invalidFiles: result.invalidFiles,
    resourceTypes: result.resourceTypes,
    importedCounts: {
      patients: result.patients, conditions: result.conditions, observations: result.observations,
      medications: result.medications, procedures: result.procedures, encounters: result.encounters,
      allergies: result.allergies, immunizations: result.immunizations, carePlans: result.carePlans,
      diagnosticReports: result.diagnosticReports,
    },
    unsupported: result.unsupported,
  });
}

export async function loadSyntheaFhir(args: LoadFhirArgs, injectedDb?: AuthDb): Promise<FhirLoadResult> {
  const files = await listJsonFiles(args.dir);
  const db = args.dry ? null : injectedDb || getDb();
  const result: FhirLoadResult = { ...emptyCounts(), files: files.length, invalidFiles: 0, unsupported: {}, resourceTypes: {} };

  if (args.replace && db) {
    await db.execute(sql`TRUNCATE TABLE synthea_imaging_studies, synthea_encounters, synthea_procedures, synthea_medications, synthea_observations, synthea_conditions, synthea_patients CASCADE`);
  }

  // İlk geçiş hastaları ekler. Böylece ikinci geçişte yabancı anahtarlar her
  // koşulda hazırdır; 129 bin Bundle'ın bellekte tutulması da gerekmez.
  const patients: ReturnType<typeof patientRow>[] = [];
  if (!args.historyOnly) {
    for (let index = 0; index < files.length; index++) {
      const resources = await readResources(files[index]);
      if (!resources) { result.invalidFiles += 1; continue; }
      const patient = resources.find((resource) => resource.resourceType === "Patient");
      if (!patient) { result.invalidFiles += 1; continue; }
      patients.push(patientRow(patient));
      result.patients += 1;
      if (patients.length >= BATCH_SIZE && db) {
        await flush(patients, (rows) => db.insert(syntheaPatients).values(rows).onConflictDoNothing());
      }
      if ((index + 1) % 10000 === 0) process.stdout.write(`FHIR hasta geçişi: ${index + 1}/${files.length}\n`);
    }
    if (db) await flush(patients, (rows) => db.insert(syntheaPatients).values(rows).onConflictDoNothing());
  }

  const conditions: Record<string, unknown>[] = [];
  const observations: Record<string, unknown>[] = [];
  const medications: Record<string, unknown>[] = [];
  const procedures: Record<string, unknown>[] = [];
  const encounters: Record<string, unknown>[] = [];
  const allergies: Record<string, unknown>[] = [];
  const immunizations: Record<string, unknown>[] = [];
  const carePlans: Record<string, unknown>[] = [];
  const diagnosticReports: Record<string, unknown>[] = [];

  async function flushAll(): Promise<void> {
    if (!db) return;
    await Promise.all([
      flush(conditions, (rows) => db.insert(syntheaConditions).values(rows as typeof syntheaConditions.$inferInsert[]).onConflictDoNothing()),
      flush(observations, (rows) => db.insert(syntheaObservations).values(rows as typeof syntheaObservations.$inferInsert[]).onConflictDoNothing()),
      flush(medications, (rows) => db.insert(syntheaMedications).values(rows as typeof syntheaMedications.$inferInsert[]).onConflictDoNothing()),
      flush(procedures, (rows) => db.insert(syntheaProcedures).values(rows as typeof syntheaProcedures.$inferInsert[]).onConflictDoNothing()),
      flush(encounters, (rows) => db.insert(syntheaEncounters).values(rows as typeof syntheaEncounters.$inferInsert[]).onConflictDoNothing()),
      flush(allergies, (rows) => db.insert(syntheaAllergies).values(rows as typeof syntheaAllergies.$inferInsert[]).onConflictDoNothing()),
      flush(immunizations, (rows) => db.insert(syntheaImmunizations).values(rows as typeof syntheaImmunizations.$inferInsert[]).onConflictDoNothing()),
      flush(carePlans, (rows) => db.insert(syntheaCarePlans).values(rows as typeof syntheaCarePlans.$inferInsert[]).onConflictDoNothing()),
      flush(diagnosticReports, (rows) => db.insert(syntheaDiagnosticReports).values(rows as typeof syntheaDiagnosticReports.$inferInsert[]).onConflictDoNothing()),
    ]);
  }

  for (let index = 0; index < files.length; index++) {
    const resources = await readResources(files[index]);
    if (!resources) continue;
    const bundlePatientId = patientIdFrom(resources);
    if (!bundlePatientId) continue;
    for (const resource of resources) {
      const type = cleanText(resource.resourceType) || "Unknown";
      result.resourceTypes[type] = (result.resourceTypes[type] || 0) + 1;
      const patientId = resourceRef(resource.subject) || resourceRef(resource.patient) || bundlePatientId;
      if (type === "Patient") continue;
      if (args.historyOnly && !["AllergyIntolerance", "Immunization", "CarePlan", "DiagnosticReport"].includes(type)) continue;
      if (type === "Condition") {
        const c = concept(resource.code);
        if (!c.code) { result.unsupported["Condition_without_code"] = (result.unsupported["Condition_without_code"] || 0) + 1; continue; }
        conditions.push({ sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.context) || resourceRef(resource.encounter), start: parseDate(resource.onsetDateTime), stop: parseDate(resource.abatementDateTime), code: c.code, codeSystem: codeSystemForResource(resource), description: c.description || c.code });
        result.conditions += 1;
      } else if (type === "Observation") {
        const c = concept(resource.code);
        if (!c.code) { result.unsupported["Observation_without_code"] = (result.unsupported["Observation_without_code"] || 0) + 1; continue; }
        observations.push({ sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.encounter), date: parseDate(resource.effectiveDateTime) || parseDate(resource.issued), category: category(resource), code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, ...scalarObservationValue(resource) });
        result.observations += 1;
      } else if (type === "MedicationRequest") {
        const c = concept(resource.medicationCodeableConcept);
        medications.push({ sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.context) || resourceRef(resource.encounter), start: parseDate(resource.authoredOn) || parseDate(resource.dateWritten), stop: null, code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, reasonCode: null, reasonDescription: null });
        result.medications += 1;
      } else if (type === "Procedure") {
        const c = concept(resource.code);
        procedures.push({ sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.encounter) || resourceRef(resource.context), start: parseDate(resource.performedDateTime) || parseDate((resource.performedPeriod as Record<string, unknown> | undefined)?.start), stop: parseDate((resource.performedPeriod as Record<string, unknown> | undefined)?.end), code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, reasonCode: null, reasonDescription: null });
        result.procedures += 1;
      } else if (type === "Encounter") {
        const c = concept(Array.isArray(resource.type) ? resource.type[0] : null);
        const period = resource.period as Record<string, unknown> | undefined;
        encounters.push({ id: cleanText(resource.id) || resourceSourceId(resource), patientId, start: parseDate(period?.start), stop: parseDate(period?.end), encounterClass: concept(resource.class).description, code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, reasonCode: null, reasonDescription: null });
        result.encounters += 1;
      } else if (type === "AllergyIntolerance") {
        const c = concept(resource.code);
        allergies.push({
          sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.encounter),
          start: parseDate(resource.onsetDateTime) || parseDate(resource.recordedDate), stop: null,
          code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, category: categoryList(resource),
          clinicalStatus: concept(resource.clinicalStatus).description,
          verificationStatus: concept(resource.verificationStatus).description,
        });
        result.allergies += 1;
      } else if (type === "Immunization") {
        const c = concept(resource.vaccineCode);
        immunizations.push({
          sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.encounter),
          date: parseDate(resource.occurrenceDateTime) || parseDate(resource.recorded) || parseDate(resource.date),
          code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, status: cleanText(resource.status),
        });
        result.immunizations += 1;
      } else if (type === "CarePlan") {
        const period = resource.period as Record<string, unknown> | undefined;
        const detail = carePlanDetail(resource);
        carePlans.push({
          sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.encounter),
          start: parseDate(period?.start), stop: parseDate(period?.end), category: category(resource),
          code: detail.code, codeSystem: codeSystemForResource(resource), description: detail.description, status: cleanText(resource.status),
        });
        result.carePlans += 1;
      } else if (type === "DiagnosticReport") {
        const c = concept(resource.code);
        diagnosticReports.push({
          sourceId: resourceSourceId(resource), patientId, encounterId: resourceRef(resource.encounter),
          date: parseDate(resource.effectiveDateTime) || parseDate(resource.issued),
          code: c.code, codeSystem: codeSystemForResource(resource), description: c.description, status: cleanText(resource.status),
        });
        result.diagnosticReports += 1;
      } else {
        result.unsupported[type] = (result.unsupported[type] || 0) + 1;
      }
    }
    if ([conditions, observations, medications, procedures, encounters, allergies, immunizations, carePlans, diagnosticReports].some((rows) => rows.length >= BATCH_SIZE)) await flushAll();
    if ((index + 1) % 10000 === 0) process.stdout.write(`FHIR klinik geçişi: ${index + 1}/${files.length}\n`);
  }
  await flushAll();
  if (db) await recordImportRun(db, args, result, await sourceManifest(args.dir, files));
  return result;
}

function usage(): never {
  throw new Error("Usage: npx tsx scripts/load-synthea-fhir.ts [--dir reports/output_1/fhir] [--dry] [--replace] [--history-only]");
}

function parseArgs(argv: string[]): LoadFhirArgs {
  let dir = DEFAULT_DIR;
  let dry = false;
  let replace = false;
  let historyOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") { dir = argv[++i] || ""; if (!dir || dir.startsWith("--")) usage(); }
    else if (argv[i] === "--dry") dry = true;
    else if (argv[i] === "--replace") replace = true;
    else if (argv[i] === "--history-only") historyOnly = true;
    else usage();
  }
  if (replace && historyOnly) usage();
  return { dir, dry, replace, historyOnly };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await loadSyntheaFhir(args);
  process.stdout.write(`${args.dry ? "[dry] " : ""}FHIR yükleme tamamlandı: ${result.patients} hasta, ${result.conditions} condition, ${result.observations} observation, ${result.medications} medication, ${result.procedures} procedure, ${result.encounters} encounter, ${result.allergies} alerji, ${result.immunizations} aşı, ${result.carePlans} bakım planı, ${result.diagnosticReports} tanısal rapor. Geçersiz: ${result.invalidFiles}; kaynaklar: ${JSON.stringify(result.resourceTypes)}; desteklenmeyen: ${JSON.stringify(result.unsupported)}${args.replace ? " (mevcut eğitim verisi değiştirildi)" : ""}${args.historyOnly ? " (yalnızca geçmiş kaynakları)" : ""}\n`);
}

if (/^load-synthea-fhir\.(?:ts|js)$/.test(path.basename(process.argv[1] || ""))) {
  main().catch((error) => {
    // Drizzle/pg hata metni başarısız INSERT değerlerini içerebilir; klinik
    // kayıtların günlük dosyasına sızmaması için ayrıntıyı yazdırmayız.
    void error;
    process.stderr.write("FHIR yüklemesi başarısız; ayrıntılar klinik veri içermeden incelenmelidir.\n");
    process.exitCode = 1;
  });
}
