import type { CasesStore } from "./types";

export type CaseStoreShadowSummary = {
  sourceCases: number;
  replicaCases: number;
  sourcePublishedVersions: number;
  replicaPublishedVersions: number;
  casesMissingFromReplica: number;
  unexpectedCasesInReplica: number;
  caseVersionMismatches: number;
  caseChecksumMismatches: number;
  publishedVersionsMissingFromReplica: number;
  unexpectedPublishedVersionsInReplica: number;
  publishedVersionChecksumMismatches: number;
  matches: boolean;
};

function versionKey(caseId: string, version: number): string {
  return `${caseId}\u0000${version}`;
}

/**
 * İki store'un yalnızca güvenli içerik-kimliği metadatasını karşılaştırır.
 * Vaka gövdesi, hasta alanları ve kullanıcı bilgisi hiçbir zaman sonuçta
 * bulunmaz; bu özet doğrudan yapılandırılmış log için tasarlanmıştır.
 */
export function compareCaseStoreShadow(source: CasesStore, replica: CasesStore): CaseStoreShadowSummary {
  const sourceCases = new Map(source.cases.map((item) => [item.id, item]));
  const replicaCases = new Map(replica.cases.map((item) => [item.id, item]));
  let casesMissingFromReplica = 0;
  let caseVersionMismatches = 0;
  let caseChecksumMismatches = 0;
  for (const [caseId, sourceCase] of sourceCases) {
    const replicaCase = replicaCases.get(caseId);
    if (!replicaCase) {
      casesMissingFromReplica += 1;
      continue;
    }
    if (sourceCase.surum !== replicaCase.surum) caseVersionMismatches += 1;
    if ((sourceCase.contentChecksum || null) !== (replicaCase.contentChecksum || null)) {
      caseChecksumMismatches += 1;
    }
  }
  const sourceVersions = new Map(
    source.publishedVersions.map((item) => [versionKey(item.caseId, item.version), item])
  );
  const replicaVersions = new Map(
    replica.publishedVersions.map((item) => [versionKey(item.caseId, item.version), item])
  );
  let publishedVersionsMissingFromReplica = 0;
  let publishedVersionChecksumMismatches = 0;
  for (const [key, sourceVersion] of sourceVersions) {
    const replicaVersion = replicaVersions.get(key);
    if (!replicaVersion) {
      publishedVersionsMissingFromReplica += 1;
      continue;
    }
    if (sourceVersion.contentChecksum !== replicaVersion.contentChecksum) {
      publishedVersionChecksumMismatches += 1;
    }
  }
  const result: CaseStoreShadowSummary = {
    sourceCases: sourceCases.size,
    replicaCases: replicaCases.size,
    sourcePublishedVersions: sourceVersions.size,
    replicaPublishedVersions: replicaVersions.size,
    casesMissingFromReplica,
    unexpectedCasesInReplica: [...replicaCases.keys()].filter((id) => !sourceCases.has(id)).length,
    caseVersionMismatches,
    caseChecksumMismatches,
    publishedVersionsMissingFromReplica,
    unexpectedPublishedVersionsInReplica: [...replicaVersions.keys()].filter((key) => !sourceVersions.has(key)).length,
    publishedVersionChecksumMismatches,
    matches: false,
  };
  result.matches =
    result.sourceCases === result.replicaCases &&
    result.sourcePublishedVersions === result.replicaPublishedVersions &&
    result.casesMissingFromReplica === 0 &&
    result.unexpectedCasesInReplica === 0 &&
    result.caseVersionMismatches === 0 &&
    result.caseChecksumMismatches === 0 &&
    result.publishedVersionsMissingFromReplica === 0 &&
    result.unexpectedPublishedVersionsInReplica === 0 &&
    result.publishedVersionChecksumMismatches === 0;
  return result;
}
