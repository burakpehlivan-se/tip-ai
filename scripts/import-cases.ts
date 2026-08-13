/**
 * Tek seferlik geçiş: JSON vaka deposu → PostgreSQL hazırlık tabloları.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-cases.ts \
 *     --file /data/coolify/applications/<uuid>/data/admin/cases.json
 *
 * Güvenlik ve idempotence kuralları:
 *   - Kaynak dosya değiştirilmeden önce zaman damgalı `.bak.*` kopyası alınır.
 *   - Aynı vaka/sürüm zaten DB'de varsa dokunulmaz; farklı gövde checksum'ı
 *     sessizce ezilmez, conflict olarak raporlanır.
 *   - Düz hasta verisi, vaka gövdesi veya bağlantı dizgisi loglanmaz.
 *   - Bu script runtime cutover yapmaz. JSON, kontrollü geri dönüş artefaktı
 *     olarak korunur; PostgreSQL yalnızca eşitlik denetimine hazırlanır.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { and, eq } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import { clinicalCases, publishedClinicalCaseVersions } from "../src/lib/auth/schema";
import type { AdminVaka, CasesStore, PublishedCaseVersion } from "../src/lib/admin/types";

export interface ImportCasesResult {
  importedCases: number;
  skippedCases: number;
  conflictingCases: number;
  invalidCases: number;
  importedVersions: number;
  skippedVersions: number;
  conflictingVersions: number;
  invalidVersions: number;
  backupFile: string;
}

export function timestampNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function backupCasesFile(file: string): string {
  if (!fs.existsSync(file)) throw new Error(`Dosya bulunamadı: ${file}`);
  const backup = `${file}.bak.${timestampNow()}`;
  fs.copyFileSync(file, backup);
  return backup;
}

function toDate(value: unknown, fallback: Date): Date {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : fallback;
}

function isValidCase(value: unknown): value is AdminVaka {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AdminVaka>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.poliklinikKey === "string" &&
    item.poliklinikKey.length > 0 &&
    (item.durum === "taslak" || item.durum === "aktif" || item.durum === "arsiv") &&
    typeof item.surum === "number" &&
    Number.isInteger(item.surum) &&
    item.surum >= 1
  );
}

function isValidPublishedVersion(value: unknown): value is PublishedCaseVersion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PublishedCaseVersion>;
  return (
    typeof item.caseId === "string" &&
    item.caseId.length > 0 &&
    typeof item.version === "number" &&
    Number.isInteger(item.version) &&
    item.version >= 1 &&
    typeof item.contentChecksum === "string" &&
    item.contentChecksum.length > 0 &&
    typeof item.approvedBy === "string" &&
    item.approvedBy.length > 0 &&
    typeof item.approvedAt === "number" &&
    item.content !== undefined
  );
}

/** Kaynağı değiştirmeden vaka ve yayın sürümlerini idempotent biçimde aktarır. */
export async function importCasesFromFile(file: string): Promise<ImportCasesResult> {
  const backupFile = backupCasesFile(file);
  const store = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<CasesStore>;
  const cases = Array.isArray(store.cases) ? store.cases : [];
  const publishedVersions = Array.isArray(store.publishedVersions) ? store.publishedVersions : [];
  const db = getDb();
  const now = new Date();

  const result: ImportCasesResult = {
    importedCases: 0,
    skippedCases: 0,
    conflictingCases: 0,
    invalidCases: 0,
    importedVersions: 0,
    skippedVersions: 0,
    conflictingVersions: 0,
    invalidVersions: 0,
    backupFile,
  };

  for (const item of cases) {
    if (!isValidCase(item)) {
      result.invalidCases += 1;
      continue;
    }
    const [existing] = await db
      .select({ version: clinicalCases.version, contentChecksum: clinicalCases.contentChecksum })
      .from(clinicalCases)
      .where(eq(clinicalCases.caseId, item.id))
      .limit(1);
    if (existing) {
      if (existing.version !== item.surum || (existing.contentChecksum || null) !== (item.contentChecksum || null)) {
        result.conflictingCases += 1;
      } else {
        result.skippedCases += 1;
      }
      continue;
    }
    await db.insert(clinicalCases).values({
      caseId: item.id,
      poliklinikKey: item.poliklinikKey,
      status: item.durum,
      reviewStatus: item.incelemeDurumu || (item.uzmanOnayi ? "onayli" : "legacy"),
      version: item.surum,
      contentChecksum: item.contentChecksum || null,
      content: item,
      createdAt: toDate(item.createdAt, now),
      updatedAt: toDate(item.updatedAt, now),
    });
    result.importedCases += 1;
  }

  for (const item of publishedVersions) {
    if (!isValidPublishedVersion(item)) {
      result.invalidVersions += 1;
      continue;
    }
    const [existing] = await db
      .select({ contentChecksum: publishedClinicalCaseVersions.contentChecksum })
      .from(publishedClinicalCaseVersions)
      .where(
        and(
          eq(publishedClinicalCaseVersions.caseId, item.caseId),
          eq(publishedClinicalCaseVersions.version, item.version)
        )
      )
      .limit(1);
    if (existing) {
      if (existing.contentChecksum !== item.contentChecksum) result.conflictingVersions += 1;
      else result.skippedVersions += 1;
      continue;
    }
    await db.insert(publishedClinicalCaseVersions).values({
      caseId: item.caseId,
      version: item.version,
      contentChecksum: item.contentChecksum,
      approvedBy: item.approvedBy,
      approvedAt: toDate(item.approvedAt, now),
      content: item.content,
    });
    result.importedVersions += 1;
  }

  return result;
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
  const result = await importCasesFromFile(process.argv[index + 1]);
  console.log(`Yedek alındı: ${path.basename(result.backupFile)}`);
  console.log(
    `Vaka: ${result.importedCases} aktarıldı, ${result.skippedCases} mevcut, ${result.conflictingCases} çakışma, ${result.invalidCases} geçersiz.`
  );
  console.log(
    `Yayın sürümü: ${result.importedVersions} aktarıldı, ${result.skippedVersions} mevcut, ${result.conflictingVersions} çakışma, ${result.invalidVersions} geçersiz.`
  );
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  const resolved = path.resolve(entry);
  const thisFile = path.resolve(import.meta.url.replace(/^file:\/\//, ""));
  return resolved === thisFile || resolved === path.resolve("scripts/import-cases.ts");
})();

if (isDirectRun) {
  main().catch((error) => {
    console.error("Vaka içe aktarma başarısız:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
