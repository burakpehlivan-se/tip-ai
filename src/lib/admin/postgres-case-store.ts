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
import {
  clinicalCaseAuditLogs,
  clinicalCases,
  publishedClinicalCaseVersions,
} from "@/lib/auth/schema";
import type { AdminVaka, AuditLog, AuditPatch, CasesStore, PublishedCaseVersion } from "./types";
import { seedCasesFromTemplates } from "./seed";
import { normalizeAdminVaka } from "./types";

type ClinicalCaseRow = typeof clinicalCases.$inferSelect;
type PublishedVersionRow = typeof publishedClinicalCaseVersions.$inferSelect;

/** Saklanan JSONB gövdesi ile indekslenmiş kolonlar çeliştiğinde fail closed olur. */
export class PostgresCaseDataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresCaseDataIntegrityError";
  }
}

/** Vaka mutasyonu, yayın sürümü değişmezliği veya yarış kuralını ihlal etti. */
export class PostgresCaseMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresCaseMutationError";
  }
}

/** İstemcinin gördüğü vaka sürümü transaction başladığında artık güncel değil. */
export class PostgresCaseMutationConflictError extends PostgresCaseMutationError {
  constructor() {
    super("Vaka başka bir kullanıcı tarafından güncellendi.");
    this.name = "PostgresCaseMutationConflictError";
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

function storeFromRows(caseRows: ClinicalCaseRow[], versionRows: PublishedVersionRow[]): CasesStore {
  const cases = caseRows.map(caseFromRow);
  const timestamps = caseRows.flatMap((row) => [row.createdAt.getTime(), row.updatedAt.getTime()]);
  return {
    version: 1,
    seededAt: timestamps.length ? Math.min(...timestamps) : 0,
    updatedAt: timestamps.length ? Math.max(...timestamps) : 0,
    // JSON'un otomatik yedekleme sayacı PostgreSQL kaynağına taşınmaz. DB
    // yedekleme politikası ayrı altyapı sorumluluğudur.
    changeCount: 0,
    cases,
    publishedVersions: versionRows.map(publishedVersionFromRow),
  };
}

/**
 * PostgreSQL'den tüm vaka kaydını legacy `CasesStore` sözleşmesine dönüştürür.
 * `changeCount` yalnızca eski JSON yedekleme sayacıdır; PostgreSQL kaynakta
 * kullanılmaz ve bilinçli olarak sıfır döner.
 */
export async function loadPostgresCasesStore(): Promise<CasesStore> {
  const db = getDb();
  let [caseRows, versionRows] = await Promise.all([
    db.select().from(clinicalCases).orderBy(asc(clinicalCases.caseId)),
    db
      .select()
      .from(publishedClinicalCaseVersions)
      .orderBy(asc(publishedClinicalCaseVersions.caseId), desc(publishedClinicalCaseVersions.version)),
  ]);
  // Synthea importu kardiyoloji/KVC şablonlarını ezmişse eksik şablonlar yetim
  // kalır ve ekg_sources boş görünür. Tablo boşken tümü, doluyken yalnızca
  // eksik şablonlar idempotent eklenir — prod'da 535 synthea + 60 şablon olur.
  {
    const seeded = seedCasesFromTemplates().map((c) => normalizeAdminVaka(c));
    const existingIds = new Set(caseRows.map((row) => row.caseId));
    const missing = seeded.filter((vaka) => !existingIds.has(vaka.id));
    const shouldSeed = caseRows.length === 0 ? seeded : missing;
    if (shouldSeed.length > 0) {
      // Tek INSERT + ON CONFLICT: satır satır try/catch akış kontrolü yerine.
      await db
        .insert(clinicalCases)
        .values(shouldSeed.map((vaka) => caseInsertValues(vaka)))
        .onConflictDoNothing();
      [caseRows, versionRows] = await Promise.all([
        db.select().from(clinicalCases).orderBy(asc(clinicalCases.caseId)),
        db
          .select()
          .from(publishedClinicalCaseVersions)
          .orderBy(asc(publishedClinicalCaseVersions.caseId), desc(publishedClinicalCaseVersions.version)),
      ]);
    }
  }
  return storeFromRows(caseRows, versionRows);
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

/** Audit tablosuna vaka gövdesi taşımadan yazılabilecek yapısal patch özeti. */
function auditPatchSummary(patches: AuditPatch[]) {
  return patches.map((patch) => ({
    path: patch.path,
    caseId: patch.caseId,
    field: patch.field,
    testKey: patch.testKey,
  }));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function caseInsertValues(vaka: AdminVaka) {
  return {
    caseId: vaka.id,
    poliklinikKey: vaka.poliklinikKey,
    status: vaka.durum,
    reviewStatus: vaka.incelemeDurumu || (vaka.uzmanOnayi ? "onayli" : "legacy"),
    version: vaka.surum,
    contentChecksum: vaka.contentChecksum || null,
    content: vaka,
    createdAt: new Date(vaka.createdAt),
    updatedAt: new Date(vaka.updatedAt),
  };
}

function caseUpdateValues(vaka: AdminVaka) {
  const { caseId: _caseId, createdAt: _createdAt, ...values } = caseInsertValues(vaka);
  return values;
}

/**
 * Tek bir PostgreSQL transaction'ında vaka değişikliğini uygular. Tüm mevcut
 * vaka/sürüm satırları transaction bitene kadar kilitlidir; böylece legacy
 * callback biçimindeki read-modify-write işlemleri birbirini ezmez.
 *
 * Yayınlanan sürümler append-only'dir: silme veya içerik değiştirme reddedilir.
 * Vaka silme de reddedilir; cutover sonrası geri çekme "arsiv" durumuyla
 * yapılmalıdır ki geçmiş deneme ve audit kanıtı korunabilsin.
 */
export async function recordPostgresCaseMutation(input: {
  actor: string;
  action: AuditLog["action"];
  message: string;
  patches: AuditPatch[];
  /** PATCH/review gibi optimistic-lock destekleyen çağrılarda zorunlu sürüm damgası. */
  expectedUpdatedAt?: Record<string, number>;
  mutate: (store: CasesStore) => void;
}): Promise<{ store: CasesStore; log: AuditLog; backup: null }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [caseRows, versionRows] = await Promise.all([
      tx.select().from(clinicalCases).orderBy(asc(clinicalCases.caseId)).for("update"),
      tx
        .select()
        .from(publishedClinicalCaseVersions)
        .orderBy(asc(publishedClinicalCaseVersions.caseId), desc(publishedClinicalCaseVersions.version))
        .for("update"),
    ]);
    const store = storeFromRows(caseRows, versionRows);
    const beforeCases = new Map(caseRows.map((row) => [row.caseId, row]));
    const beforeVersions = new Map(versionRows.map((row) => [`${row.caseId}\u0000${row.version}`, row]));
    for (const [caseId, expectedUpdatedAt] of Object.entries(input.expectedUpdatedAt || {})) {
      const current = beforeCases.get(caseId);
      if (!current || caseFromRow(current).updatedAt !== expectedUpdatedAt) {
        throw new PostgresCaseMutationConflictError();
      }
    }
    input.mutate(store);

    const afterCases = new Map(store.cases.map((vaka) => [vaka.id, vaka]));
    if (afterCases.size !== store.cases.length) {
      throw new PostgresCaseMutationError("Aynı vaka kimliği birden fazla kez kaydedilemez.");
    }
    for (const caseId of beforeCases.keys()) {
      if (!afterCases.has(caseId)) {
        throw new PostgresCaseMutationError("Vaka silme PostgreSQL kaynakta desteklenmez; vakayı arşivleyin.");
      }
    }
    for (const [caseId, vaka] of afterCases) {
      if (!isAdminVaka(vaka)) throw new PostgresCaseMutationError("Kaydedilecek vaka geçersiz.");
      const previous = beforeCases.get(caseId);
      if (!previous) {
        await tx.insert(clinicalCases).values(caseInsertValues(vaka));
        continue;
      }
      if (!sameJson(previous.content, vaka)) {
        // Bazı legacy toplu araçlar gövdeyi değiştirirken updatedAt'i
        // güncellemez. PostgreSQL kaynağında optimistic lock için her gerçek
        // gövde değişikliğine monoton zaman damgası verilir.
        vaka.updatedAt = Math.max(Date.now(), previous.updatedAt.getTime() + 1, vaka.updatedAt);
        await tx.update(clinicalCases).set(caseUpdateValues(vaka)).where(eq(clinicalCases.caseId, caseId));
      }
    }

    const afterVersions = new Map(
      store.publishedVersions.map((version) => [`${version.caseId}\u0000${version.version}`, version])
    );
    if (afterVersions.size !== store.publishedVersions.length) {
      throw new PostgresCaseMutationError("Aynı vaka sürümü ikinci kez yayınlanamaz.");
    }
    for (const [key, previous] of beforeVersions) {
      const current = afterVersions.get(key);
      if (!current || !sameJson(previous.content, current.content)) {
        throw new PostgresCaseMutationError("Yayınlanmış vaka sürümleri değiştirilemez veya silinemez.");
      }
    }
    for (const [key, version] of afterVersions) {
      if (beforeVersions.has(key)) continue;
      if (!isAdminVaka(version.content) || version.content.id !== version.caseId || version.content.surum !== version.version) {
        throw new PostgresCaseMutationError("Yayınlanacak vaka sürümü geçersiz.");
      }
      await tx.insert(publishedClinicalCaseVersions).values({
        caseId: version.caseId,
        version: version.version,
        contentChecksum: version.contentChecksum,
        approvedBy: version.approvedBy,
        approvedAt: new Date(version.approvedAt),
        content: version.content,
      });
    }

    const [audit] = await tx
      .insert(clinicalCaseAuditLogs)
      .values({
        caseId: input.patches.find((patch) => patch.caseId)?.caseId || "system",
        event: input.action,
        actor: input.actor,
        summary: input.message,
        meta: { patches: auditPatchSummary(input.patches) },
      })
      .returning();
    const timestamp = audit.createdAt.getTime();
    return {
      store,
      log: {
        id: audit.id,
        timestamp,
        actor: input.actor,
        action: input.action,
        message: input.message,
        patches: [],
        metadata: audit.meta as Record<string, unknown> | undefined,
        undone: false,
      },
      backup: null,
    };
  });
}
