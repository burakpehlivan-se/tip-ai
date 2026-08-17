import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";
import {
  syntheaAllergies,
  syntheaCarePlans,
  syntheaCaseSources,
  syntheaConditions,
  syntheaDiagnosticReports,
  syntheaEncounters,
  syntheaHistoryAccessAudit,
  syntheaImmunizations,
  syntheaMedications,
  syntheaObservations,
  syntheaProcedures,
  radiologySources,
} from "@/lib/auth/schema";
import type { ClinicalHistory, ClinicalHistoryEvent, ClinicalHistoryItem, ClinicalHistoryLabTrend } from "./types";

const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });

function displayDate(value: Date | null): string | null {
  return value ? DATE_FORMATTER.format(value) : null;
}

function present(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

/** Kod sistemi URL'sini kısa bir etikete indirger (bilinmeyen sistemde rozet gizlenir). */
function codeSystemLabel(system: string | null | undefined): string | undefined {
  if (!system) return undefined;
  const s = system.toLowerCase();
  if (s.includes("snomed")) return "SNOMED";
  if (s.includes("loinc")) return "LOINC";
  if (s.includes("rxnorm") || s.includes("umls")) return "RxNorm";
  return undefined;
}

function timelineSort(a: ClinicalHistoryEvent, b: ClinicalHistoryEvent): number {
  const sortable = (date: string | null) => date ? date.split(".").reverse().join("") : "";
  return sortable(b.date).localeCompare(sortable(a.date));
}

/** Vaka şablonu üzerinden hastanın kimliksiz uzunlamasına klinik özetini üretir. */
export async function getSyntheaClinicalHistory(caseId: string): Promise<ClinicalHistory | null> {
  const db = getDb();
  const [source] = await db
    .select({ patientId: syntheaCaseSources.patientId })
    .from(syntheaCaseSources)
    .where(eq(syntheaCaseSources.caseId, caseId))
    .limit(1);
  if (!source) return null;

  const patientId = source.patientId;
  const [conditions, medications, procedures, encounters, reports, carePlans, allergies, immunizations, observations] = await Promise.all([
    db.select({ start: syntheaConditions.start, stop: syntheaConditions.stop, description: syntheaConditions.description, code: syntheaConditions.code, codeSystem: syntheaConditions.codeSystem }).from(syntheaConditions).where(eq(syntheaConditions.patientId, patientId)).orderBy(desc(syntheaConditions.start)).limit(24),
    db.select({ start: syntheaMedications.start, stop: syntheaMedications.stop, description: syntheaMedications.description, reason: syntheaMedications.reasonDescription, code: syntheaMedications.code, codeSystem: syntheaMedications.codeSystem }).from(syntheaMedications).where(eq(syntheaMedications.patientId, patientId)).orderBy(desc(syntheaMedications.start)).limit(18),
    db.select({ start: syntheaProcedures.start, description: syntheaProcedures.description, code: syntheaProcedures.code, codeSystem: syntheaProcedures.codeSystem }).from(syntheaProcedures).where(eq(syntheaProcedures.patientId, patientId)).orderBy(desc(syntheaProcedures.start)).limit(18),
    db.select({ start: syntheaEncounters.start, description: syntheaEncounters.description, encounterClass: syntheaEncounters.encounterClass, code: syntheaEncounters.code, codeSystem: syntheaEncounters.codeSystem }).from(syntheaEncounters).where(eq(syntheaEncounters.patientId, patientId)).orderBy(desc(syntheaEncounters.start)).limit(18),
    db.select({ date: syntheaDiagnosticReports.date, description: syntheaDiagnosticReports.description, status: syntheaDiagnosticReports.status, code: syntheaDiagnosticReports.code, codeSystem: syntheaDiagnosticReports.codeSystem }).from(syntheaDiagnosticReports).where(eq(syntheaDiagnosticReports.patientId, patientId)).orderBy(desc(syntheaDiagnosticReports.date)).limit(12),
    db.select({ start: syntheaCarePlans.start, description: syntheaCarePlans.description, category: syntheaCarePlans.category, status: syntheaCarePlans.status, code: syntheaCarePlans.code, codeSystem: syntheaCarePlans.codeSystem }).from(syntheaCarePlans).where(eq(syntheaCarePlans.patientId, patientId)).orderBy(desc(syntheaCarePlans.start)).limit(12),
    db.select({ start: syntheaAllergies.start, description: syntheaAllergies.description, category: syntheaAllergies.category, clinicalStatus: syntheaAllergies.clinicalStatus, code: syntheaAllergies.code, codeSystem: syntheaAllergies.codeSystem }).from(syntheaAllergies).where(eq(syntheaAllergies.patientId, patientId)).orderBy(desc(syntheaAllergies.start)).limit(12),
    db.select({ date: syntheaImmunizations.date, description: syntheaImmunizations.description, status: syntheaImmunizations.status, code: syntheaImmunizations.code, codeSystem: syntheaImmunizations.codeSystem }).from(syntheaImmunizations).where(eq(syntheaImmunizations.patientId, patientId)).orderBy(desc(syntheaImmunizations.date)).limit(15),
    db.select({ date: syntheaObservations.date, description: syntheaObservations.description, value: syntheaObservations.value, valueNum: syntheaObservations.valueNum, units: syntheaObservations.units, code: syntheaObservations.code, codeSystem: syntheaObservations.codeSystem }).from(syntheaObservations).where(eq(syntheaObservations.patientId, patientId)).orderBy(desc(syntheaObservations.date)).limit(240),
  ]);

  const kod = (item: { code: string | null; codeSystem: string | null }) => ({
    code: item.code || undefined,
    codeSystem: codeSystemLabel(item.codeSystem),
  });

  const timeline: ClinicalHistoryEvent[] = [
    ...conditions.map((item) => ({ date: displayDate(item.start), kind: "Tanı" as const, title: present(item.description, "Tanı kaydı"), ...kod(item) })),
    ...medications.map((item) => ({ date: displayDate(item.start), kind: "İlaç" as const, title: present(item.description, "İlaç kaydı"), detail: item.reason || undefined, ...kod(item) })),
    ...procedures.map((item) => ({ date: displayDate(item.start), kind: "İşlem" as const, title: present(item.description, "İşlem kaydı"), ...kod(item) })),
    ...encounters.map((item) => ({ date: displayDate(item.start), kind: "Başvuru" as const, title: present(item.description, "Başvuru kaydı"), detail: item.encounterClass || undefined, ...kod(item) })),
    ...reports.map((item) => ({ date: displayDate(item.date), kind: "Tanısal rapor" as const, title: present(item.description, "Tanısal rapor"), detail: item.status || undefined, ...kod(item) })),
    ...carePlans.map((item) => ({ date: displayDate(item.start), kind: "Bakım planı" as const, title: present(item.description, item.category || "Bakım planı"), detail: item.status || undefined, ...kod(item) })),
  ].sort(timelineSort).slice(0, 60);

  const allergyItems: ClinicalHistoryItem[] = allergies.map((item) => ({
    date: displayDate(item.start),
    title: present(item.description, "Alerji kaydı"),
    detail: [item.category, item.clinicalStatus].filter(Boolean).join(" · ") || undefined,
    ...kod(item),
  }));
  const immunizationItems: ClinicalHistoryItem[] = immunizations.map((item) => ({
    date: displayDate(item.date),
    title: present(item.description, "Aşı kaydı"),
    detail: item.status || undefined,
    ...kod(item),
  }));

  const trendMap = new Map<string, ClinicalHistoryLabTrend>();
  for (const item of observations) {
    const value = item.valueNum != null ? String(item.valueNum) : item.value;
    if (!value) continue;
    const title = present(item.description, "Laboratuvar ölçümü");
    const key = `${title}\u0000${item.units || ""}`;
    const trend = trendMap.get(key) || { title, unit: item.units, values: [], ...kod(item) };
    if (trend.values.length < 6) trend.values.push({ date: displayDate(item.date), value });
    trendMap.set(key, trend);
  }

  const [radiology] = await db
    .select({ imageIndex: radiologySources.imageIndex, findingLabel: radiologySources.findingLabel })
    .from(radiologySources)
    .where(eq(radiologySources.caseId, caseId))
    .limit(1);

  return {
    timeline,
    allergies: allergyItems,
    immunizations: immunizationItems,
    labTrends: Array.from(trendMap.values()).slice(0, 12),
    radiology: radiology ? { imageIndex: radiology.imageIndex, findingLabel: radiology.findingLabel } : undefined,
  };
}

/** Audit kaydı vaka kimliği ve kullanıcıyla sınırlıdır; hasta kaynak kimliği yazılmaz. */
export async function auditSyntheaClinicalHistoryAccess(caseId: string, actor: string): Promise<void> {
  await getDb().insert(syntheaHistoryAccessAudit).values({ caseId, actor });
}
