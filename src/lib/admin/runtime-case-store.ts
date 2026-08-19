/**
 * Vaka deposu runtime sınırı. Çağıranlar JSON dosyasına doğrudan erişmek
 * yerine bu async API'yi kullanır; böylece STORE_MODE cutover'ı tek bir
 * feature flag ile, çift yazma olmadan yapılabilir.
 *
 * Eski mutasyon API'leri henüz bu sınıra taşınmadığı için PostgreSQL modu
 * yalnızca tüm yazma çağrı noktaları geçirildiğinde etkinleştirilmelidir.
 */

import * as jsonCases from "./store";
import { compareCaseStoreShadow } from "./case-store-shadow";
import {
  getPostgresCaseById,
  getPostgresPublishedCaseVersion,
  listPostgresCasesGrouped,
  listPostgresPublishedCaseVersions,
  loadPostgresCasesStore,
  recordPostgresCaseMutation,
} from "./postgres-case-store";
import { isShadowReadEnabled, storeMode } from "@/lib/store-mode";
import type { AdminVaka, AuditLog, AuditPatch, CasesStore, PublishedCaseVersion } from "./types";
import { logger } from "@/lib/logger";

async function observeJsonCaseStore(primary: CasesStore): Promise<void> {
  if (!isShadowReadEnabled()) return;
  try {
    const replica = await loadPostgresCasesStore();
    const summary = compareCaseStoreShadow(primary, replica);
    logger.info("Vaka deposu shadow-read tamamlandı", {
      component: "case-store",
      event: "shadow-read",
      outcome: summary.matches ? "match" : "mismatch",
      ...summary,
    });
  } catch {
    // Shadow kaynak hatası JSON canlı akışını asla engellemez. Hata detayı
    // sorgu/bağlantı bilgisi taşıyabileceği için loglanmaz.
    logger.warn("Vaka deposu shadow-read kullanılamıyor", {
      component: "case-store",
      event: "shadow-read",
      outcome: "unavailable",
    });
  }
}

export async function loadRuntimeCasesStore(): Promise<CasesStore> {
  if (storeMode() === "postgres") return loadPostgresCasesStore();
  const primary = jsonCases.loadCasesStore();
  await observeJsonCaseStore(primary);
  return primary;
}

export async function getRuntimeCaseById(caseId: string): Promise<AdminVaka | undefined> {
  if (storeMode() === "postgres") return getPostgresCaseById(caseId);
  const primary = jsonCases.getCaseById(caseId);
  if (isShadowReadEnabled()) await observeJsonCaseStore(jsonCases.loadCasesStore());
  return primary;
}

export async function listRuntimePublishedCaseVersions(caseId: string): Promise<PublishedCaseVersion[]> {
  if (storeMode() === "postgres") return listPostgresPublishedCaseVersions(caseId);
  const primary = jsonCases.listPublishedCaseVersions(caseId);
  if (isShadowReadEnabled()) await observeJsonCaseStore(jsonCases.loadCasesStore());
  return primary;
}

export async function getRuntimePublishedCaseVersion(
  caseId: string,
  version: number
): Promise<PublishedCaseVersion | undefined> {
  if (storeMode() === "postgres") return getPostgresPublishedCaseVersion(caseId, version);
  const primary = jsonCases.getPublishedCaseVersion(caseId, version);
  if (isShadowReadEnabled()) await observeJsonCaseStore(jsonCases.loadCasesStore());
  return primary;
}

export async function listRuntimeCasesGrouped(): Promise<
  { poliklinikKey: string; poliklinikAd: string; poliklinikIcon: string; cases: AdminVaka[] }[]
> {
  if (storeMode() === "postgres") return listPostgresCasesGrouped();
  const primary = jsonCases.loadCasesStore();
  await observeJsonCaseStore(primary);
  const groups = new Map<
    string,
    { poliklinikKey: string; poliklinikAd: string; poliklinikIcon: string; cases: AdminVaka[] }
  >();
  for (const vaka of primary.cases) {
    const current = groups.get(vaka.poliklinikKey);
    if (current) current.cases.push(vaka);
    else {
      groups.set(vaka.poliklinikKey, {
        poliklinikKey: vaka.poliklinikKey,
        poliklinikAd: vaka.poliklinikAd,
        poliklinikIcon: vaka.poliklinikIcon,
        cases: [vaka],
      });
    }
  }
  return [...groups.values()].sort((left, right) => left.poliklinikAd.localeCompare(right.poliklinikAd, "tr"));
}

/**
 * JSON ve PostgreSQL modları için tek mutation sınırı. PostgreSQL modunda
 * transaction + immutable published-version koruması uygulanır; JSON modunda
 * mevcut audit/yedek davranışı korunur. Çağıranlar bu fonksiyona geçmeden
 * STORE_MODE=postgres etkinleştirilmemelidir.
 */
export async function recordRuntimeCaseMutation(input: {
  actor: string;
  action: AuditLog["action"];
  message: string;
  patches: AuditPatch[];
  expectedUpdatedAt?: Record<string, number>;
  mutate: (store: CasesStore) => void;
}): Promise<{ store: CasesStore; log: AuditLog; backup: ReturnType<typeof jsonCases.recordMutation>["backup"] | null }> {
  if (storeMode() === "postgres") return recordPostgresCaseMutation(input);
  const result = jsonCases.recordMutation(input.actor, input.action, input.message, input.patches, input.mutate);
  await observeJsonCaseStore(result.store);
  return result;
}
