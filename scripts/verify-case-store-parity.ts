/**
 * JSON vaka deposu ile PostgreSQL hazırlık tabloları arasındaki salt-okunur
 * eşitlik denetimi. Vaka gövdesi, kişisel veri, kullanıcı adı ve bağlantı
 * bilgisi yazdırmaz; yalnızca güvenli sayaçları raporlar.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/verify-case-store-parity.ts \
 *     --file /data/coolify/applications/<uuid>/data/admin/cases.json
 *
 * Çıkış kodu 0 yalnızca depolar eşitse verilir. Bu araç veri değiştirmez,
 * migration/import/cutover çalıştırmaz.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { getDb } from "../src/lib/auth/db";
import { clinicalCases, publishedClinicalCaseVersions } from "../src/lib/auth/schema";
import type { CasesStore } from "../src/lib/admin/types";

type CaseFingerprint = { caseId: string; version: number; checksum: string | null };
type VersionFingerprint = { caseId: string; version: number; checksum: string | null };
type LegacyCaseFingerprint = { id: string; surum: number; contentChecksum?: string };

export interface CaseStoreParityReport {
  sourceCases: number;
  postgresCases: number;
  sourcePublishedVersions: number;
  postgresPublishedVersions: number;
  invalidSourceCases: number;
  invalidSourcePublishedVersions: number;
  duplicateSourceCases: number;
  duplicateSourcePublishedVersions: number;
  casesMissingFromPostgres: number;
  unexpectedCasesInPostgres: number;
  caseVersionMismatches: number;
  caseChecksumMismatches: number;
  publishedVersionsMissingFromPostgres: number;
  unexpectedPublishedVersionsInPostgres: number;
  publishedVersionChecksumMismatches: number;
  equal: boolean;
}

function isCaseFingerprint(value: unknown): value is LegacyCaseFingerprint {
  if (!value || typeof value !== "object") return false;
  const item = value as { id?: unknown; surum?: unknown; contentChecksum?: unknown };
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.surum === "number" &&
    Number.isInteger(item.surum) &&
    item.surum >= 1 &&
    (typeof item.contentChecksum === "string" || item.contentChecksum === undefined)
  );
}

function isVersionFingerprint(value: unknown): value is VersionFingerprint {
  if (!value || typeof value !== "object") return false;
  const item = value as { caseId?: unknown; version?: unknown; contentChecksum?: unknown };
  return (
    typeof item.caseId === "string" &&
    item.caseId.length > 0 &&
    typeof item.version === "number" &&
    Number.isInteger(item.version) &&
    item.version >= 1 &&
    typeof item.contentChecksum === "string" &&
    item.contentChecksum.length > 0
  );
}

function versionKey(item: Pick<VersionFingerprint, "caseId" | "version">): string {
  return `${item.caseId}\u0000${item.version}`;
}

/** Kaynak dosyayı ve PostgreSQL özetini okur; hiçbir depoya yazmaz. */
export async function verifyCaseStoreParity(file: string): Promise<CaseStoreParityReport> {
  if (!fs.existsSync(file)) throw new Error(`Dosya bulunamadı: ${file}`);
  const store = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<CasesStore>;
  const rawCases = Array.isArray(store.cases) ? store.cases : [];
  const rawVersions = Array.isArray(store.publishedVersions) ? store.publishedVersions : [];

  const sourceCases = new Map<string, CaseFingerprint>();
  let invalidSourceCases = 0;
  let duplicateSourceCases = 0;
  for (const raw of rawCases) {
    if (!isCaseFingerprint(raw)) {
      invalidSourceCases += 1;
      continue;
    }
    if (sourceCases.has(raw.id)) {
      duplicateSourceCases += 1;
      continue;
    }
    sourceCases.set(raw.id, {
      caseId: raw.id,
      version: raw.surum,
      checksum: raw.contentChecksum || null,
    });
  }

  const sourceVersions = new Map<string, VersionFingerprint>();
  let invalidSourcePublishedVersions = 0;
  let duplicateSourcePublishedVersions = 0;
  for (const raw of rawVersions) {
    if (!isVersionFingerprint(raw)) {
      invalidSourcePublishedVersions += 1;
      continue;
    }
    const key = versionKey(raw);
    if (sourceVersions.has(key)) {
      duplicateSourcePublishedVersions += 1;
      continue;
    }
    sourceVersions.set(key, {
      caseId: raw.caseId,
      version: raw.version,
      checksum: raw.contentChecksum,
    });
  }

  const db = getDb();
  const postgresCases = await db
    .select({ caseId: clinicalCases.caseId, version: clinicalCases.version, checksum: clinicalCases.contentChecksum })
    .from(clinicalCases);
  const postgresVersions = await db
    .select({
      caseId: publishedClinicalCaseVersions.caseId,
      version: publishedClinicalCaseVersions.version,
      checksum: publishedClinicalCaseVersions.contentChecksum,
    })
    .from(publishedClinicalCaseVersions);

  const dbCases = new Map(postgresCases.map((item) => [item.caseId, item]));
  const dbVersions = new Map(postgresVersions.map((item) => [versionKey(item), item]));
  let casesMissingFromPostgres = 0;
  let caseVersionMismatches = 0;
  let caseChecksumMismatches = 0;
  for (const [caseId, source] of sourceCases) {
    const target = dbCases.get(caseId);
    if (!target) {
      casesMissingFromPostgres += 1;
      continue;
    }
    if (target.version !== source.version) caseVersionMismatches += 1;
    if ((target.checksum || null) !== source.checksum) caseChecksumMismatches += 1;
  }

  let publishedVersionsMissingFromPostgres = 0;
  let publishedVersionChecksumMismatches = 0;
  for (const [key, source] of sourceVersions) {
    const target = dbVersions.get(key);
    if (!target) {
      publishedVersionsMissingFromPostgres += 1;
      continue;
    }
    if ((target.checksum || null) !== source.checksum) publishedVersionChecksumMismatches += 1;
  }

  const report: CaseStoreParityReport = {
    sourceCases: sourceCases.size,
    postgresCases: dbCases.size,
    sourcePublishedVersions: sourceVersions.size,
    postgresPublishedVersions: dbVersions.size,
    invalidSourceCases,
    invalidSourcePublishedVersions,
    duplicateSourceCases,
    duplicateSourcePublishedVersions,
    casesMissingFromPostgres,
    unexpectedCasesInPostgres: [...dbCases.keys()].filter((caseId) => !sourceCases.has(caseId)).length,
    caseVersionMismatches,
    caseChecksumMismatches,
    publishedVersionsMissingFromPostgres,
    unexpectedPublishedVersionsInPostgres: [...dbVersions.keys()].filter((key) => !sourceVersions.has(key)).length,
    publishedVersionChecksumMismatches,
    equal: false,
  };
  report.equal =
    report.sourceCases === report.postgresCases &&
    report.sourcePublishedVersions === report.postgresPublishedVersions &&
    report.invalidSourceCases === 0 &&
    report.invalidSourcePublishedVersions === 0 &&
    report.duplicateSourceCases === 0 &&
    report.duplicateSourcePublishedVersions === 0 &&
    report.casesMissingFromPostgres === 0 &&
    report.unexpectedCasesInPostgres === 0 &&
    report.caseVersionMismatches === 0 &&
    report.caseChecksumMismatches === 0 &&
    report.publishedVersionsMissingFromPostgres === 0 &&
    report.unexpectedPublishedVersionsInPostgres === 0 &&
    report.publishedVersionChecksumMismatches === 0;
  return report;
}

async function main() {
  const index = process.argv.indexOf("--file");
  if (index === -1 || !process.argv[index + 1]) {
    console.error("Hata: --file <path> parametresi zorunludur.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Hata: DATABASE_URL ortam değişkeni eksik.");
    process.exit(1);
  }
  const report = await verifyCaseStoreParity(process.argv[index + 1]);
  console.log(JSON.stringify(report));
  if (!report.equal) process.exitCode = 1;
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  const resolved = path.resolve(entry);
  const thisFile = path.resolve(import.meta.url.replace(/^file:\/\//, ""));
  return resolved === thisFile || resolved === path.resolve("scripts/verify-case-store-parity.ts");
})();

if (isDirectRun) {
  main().catch((error) => {
    console.error("Vaka deposu eşitlik denetimi başarısız:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
