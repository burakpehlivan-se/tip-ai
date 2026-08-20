/**
 * Vaka deposu runtime sınırı — artık yalnızca PostgreSQL.
 * JSON modu kaldırıldı; tüm okuma/yazma `clinical_cases` tablosuna gider.
 * `storeMode()` her zaman postgres döner, bu dosya sadece postgres adaptörüne delege eder.
 */

import {
  getPostgresCaseById,
  getPostgresPublishedCaseVersion,
  listPostgresCasesGrouped,
  listPostgresPublishedCaseVersions,
  loadPostgresCasesStore,
  recordPostgresCaseMutation,
} from "./postgres-case-store";
import type { AdminVaka, AuditLog, AuditPatch, CasesStore, PublishedCaseVersion } from "./types";

export async function loadRuntimeCasesStore(): Promise<CasesStore> {
  return loadPostgresCasesStore();
}

export async function getRuntimeCaseById(caseId: string): Promise<AdminVaka | undefined> {
  return getPostgresCaseById(caseId);
}

export async function listRuntimePublishedCaseVersions(caseId: string): Promise<PublishedCaseVersion[]> {
  return listPostgresPublishedCaseVersions(caseId);
}

export async function getRuntimePublishedCaseVersion(
  caseId: string,
  version: number
): Promise<PublishedCaseVersion | undefined> {
  return getPostgresPublishedCaseVersion(caseId, version);
}

export async function listRuntimeCasesGrouped(): Promise<
  { poliklinikKey: string; poliklinikAd: string; poliklinikIcon: string; cases: AdminVaka[] }[]
> {
  return listPostgresCasesGrouped();
}

/**
 * Tek mutation sınırı — PostgreSQL transaction + immutable published-version koruması.
 */
export async function recordRuntimeCaseMutation(input: {
  actor: string;
  action: AuditLog["action"];
  message: string;
  patches: AuditPatch[];
  expectedUpdatedAt?: Record<string, number>;
  mutate: (store: CasesStore) => void;
}): Promise<{ store: CasesStore; log: AuditLog; backup: null }> {
  return recordPostgresCaseMutation(input);
}
