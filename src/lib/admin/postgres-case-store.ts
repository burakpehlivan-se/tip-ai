/**
 * PostgreSQL vaka deposu okuma adaptörü.
 *
 * Bu modül tek başına runtime cutover yapmaz. `clinical_cases` ile
 * `published_clinical_case_versions` tablosu JSON kaynağıyla eşitlendikten
 * sonra, çağrı sınırındaki feature flag bu adaptöre yönlendirecektir. JSON
 * dosyasına geri yazmaz ve çift yazma yapmaz.
 */

import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import { clinicalCases, publishedClinicalCaseVersions } from "@/lib/auth/schema";
import type { AdminVaka, CasesStore, PublishedCaseVersion } from "./types";

type ClinicalCaseRow = typeof clinicalCases.$inferSelect;
type PublishedVersionRow = typeof publishedClinicalCaseVersions.$inferSelect;

/** Saklanan JSONB gövdesi ile indekslenmiş kolonlar çeliştiğinde fail closed olur. */
export class PostgresCaseDataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresCaseDataIntegrityError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isAdminVaka(value: unknown): value is AdminVaka {
  if (!value || typeof value !== "object") return false;
  const vaka = value as Partial<AdminVaka>;
  return (
    typeof vaka.id === "string" &&
    vaka.id.length > 0 &&
    typeof vaka.poliklinikKey === "string" &&
    vaka.poliklinikKey.length > 0 &&
    (vaka.durum === "taslak" || vaka.durum === "aktif" || vaka.durum === "arsiv") &&
    typeof vaka.surum === "number" &&
    Number.isInteger(vaka.surum) &&
    vaka.surum >= 1
  );
}

function caseFromRow(row: ClinicalCaseRow): AdminVaka {
  if (!isAdminVaka(row.content)) {
    throw new PostgresCaseDataIntegrityError("PostgreSQL vaka gövdesi geçersiz.");
  }
  const vaka = clone(row.content);
  if (
    vaka.id !== row.caseId ||
    vaka.poliklinikKey !== row.poliklinikKey ||
    vaka.durum !== row.status ||
    vaka.surum !== row.version ||
    (vaka.contentChecksum || null) !== (row.contentChecksum || null)
  ) {
    throw new PostgresCaseDataIntegrityError("PostgreSQL vaka metadatası ile gövdesi uyuşmuyor.");
  }
  return vaka;
}

function publishedVersionFromRow(row: PublishedVersionRow): PublishedCaseVersion {
  if (!isAdminVaka(row.content)) {
    throw new PostgresCaseDataIntegrityError("PostgreSQL yayınlanmış vaka gövdesi geçersiz.");
  }
  const content = clone(row.content);
  if (
    content.id !== row.caseId ||
    content.surum !== row.version ||
    (content.contentChecksum || null) !== row.contentChecksum
  ) {
    throw new PostgresCaseDataIntegrityError("PostgreSQL yayınlanmış vaka metadatası ile gövdesi uyuşmuyor.");
  }
  return {
    id: `${row.caseId}@${row.version}`,
    caseId: row.caseId,
    version: row.version,
    contentChecksum: row.contentChecksum,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt.getTime(),
    content,
  };
}

/**
 * PostgreSQL'den tüm vaka kaydını legacy `CasesStore` sözleşmesine dönüştürür.
 * `changeCount` yalnızca eski JSON yedekleme sayacıdır; PostgreSQL kaynakta
 * kullanılmaz ve bilinçli olarak sıfır döner.
 */
export async function loadPostgresCasesStore(): Promise<CasesStore> {
  const db = getDb();
  const [caseRows, versionRows] = await Promise.all([
    db.select().from(clinicalCases).orderBy(asc(clinicalCases.caseId)),
    db
      .select()
      .from(publishedClinicalCaseVersions)
      .orderBy(asc(publishedClinicalCaseVersions.caseId), desc(publishedClinicalCaseVersions.version)),
  ]);
  const cases = caseRows.map(caseFromRow);
  const timestamps = caseRows.flatMap((row) => [row.createdAt.getTime(), row.updatedAt.getTime()]);
  return {
    version: 1,
    seededAt: timestamps.length ? Math.min(...timestamps) : 0,
    updatedAt: timestamps.length ? Math.max(...timestamps) : 0,
    changeCount: 0,
    cases,
    publishedVersions: versionRows.map(publishedVersionFromRow),
  };
}

export async function getPostgresCaseById(caseId: string): Promise<AdminVaka | undefined> {
  const [row] = await getDb().select().from(clinicalCases).where(eq(clinicalCases.caseId, caseId)).limit(1);
  return row ? caseFromRow(row) : undefined;
}

export async function listPostgresPublishedCaseVersions(caseId: string): Promise<PublishedCaseVersion[]> {
  const rows = await getDb()
    .select()
    .from(publishedClinicalCaseVersions)
    .where(eq(publishedClinicalCaseVersions.caseId, caseId))
    .orderBy(desc(publishedClinicalCaseVersions.version));
  return rows.map(publishedVersionFromRow);
}

export async function getPostgresPublishedCaseVersion(
  caseId: string,
  version: number
): Promise<PublishedCaseVersion | undefined> {
  const rows = await listPostgresPublishedCaseVersions(caseId);
  return rows.find((item) => item.version === version);
}

export async function listPostgresCasesGrouped(): Promise<
  {
    poliklinikKey: string;
    poliklinikAd: string;
    poliklinikIcon: string;
    cases: AdminVaka[];
  }[]
> {
  const store = await loadPostgresCasesStore();
  const groups = new Map<
    string,
    { poliklinikKey: string; poliklinikAd: string; poliklinikIcon: string; cases: AdminVaka[] }
  >();
  for (const vaka of store.cases) {
    const current = groups.get(vaka.poliklinikKey);
    if (current) {
      current.cases.push(vaka);
      continue;
    }
    groups.set(vaka.poliklinikKey, {
      poliklinikKey: vaka.poliklinikKey,
      poliklinikAd: vaka.poliklinikAd,
      poliklinikIcon: vaka.poliklinikIcon,
      cases: [vaka],
    });
  }
  return [...groups.values()].sort((left, right) => left.poliklinikAd.localeCompare(right.poliklinikAd, "tr"));
}
