/**
 * Vaka deposu runtime sınırı. Çağıranlar JSON dosyasına doğrudan erişmek
 * yerine bu async API'yi kullanır; böylece CASE_STORE cutover'ı tek bir
 * feature flag ile, çift yazma olmadan yapılabilir.
 *
 * Eski mutasyon API'leri henüz bu sınıra taşınmadığı için PostgreSQL modu
 * yalnızca tüm yazma çağrı noktaları geçirildiğinde etkinleştirilmelidir.
 */

import * as jsonCases from "./store";
import {
  getPostgresCaseById,
  getPostgresPublishedCaseVersion,
  listPostgresCasesGrouped,
  listPostgresPublishedCaseVersions,
  loadPostgresCasesStore,
} from "./postgres-case-store";
import { caseStoreMode } from "./postgres-case-store-mode";
import type { AdminVaka, CasesStore, PublishedCaseVersion } from "./types";

export async function loadRuntimeCasesStore(): Promise<CasesStore> {
  return caseStoreMode() === "postgres" ? loadPostgresCasesStore() : jsonCases.loadCasesStore();
}

export async function getRuntimeCaseById(caseId: string): Promise<AdminVaka | undefined> {
  return caseStoreMode() === "postgres" ? getPostgresCaseById(caseId) : jsonCases.getCaseById(caseId);
}

export async function listRuntimePublishedCaseVersions(caseId: string): Promise<PublishedCaseVersion[]> {
  return caseStoreMode() === "postgres"
    ? listPostgresPublishedCaseVersions(caseId)
    : jsonCases.listPublishedCaseVersions(caseId);
}

export async function getRuntimePublishedCaseVersion(
  caseId: string,
  version: number
): Promise<PublishedCaseVersion | undefined> {
  return caseStoreMode() === "postgres"
    ? getPostgresPublishedCaseVersion(caseId, version)
    : jsonCases.getPublishedCaseVersion(caseId, version);
}

export async function listRuntimeCasesGrouped(): Promise<
  { poliklinikKey: string; poliklinikAd: string; poliklinikIcon: string; cases: AdminVaka[] }[]
> {
  return caseStoreMode() === "postgres" ? listPostgresCasesGrouped() : jsonCases.listCasesGrouped();
}
