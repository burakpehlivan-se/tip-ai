/**
 * Synthea DB okuma katmanı — PostgreSQL `synthea_*` tablolarından tek hastanın
 * epizod demetini bir araya getirir. Ham hasta verisi bu modülün dışına yalnızca
 * tip güvenli `SyntheaEpisodeBundle` olarak çıkar.
 */

import { eq, sql } from "drizzle-orm";
import { getDb, AuthDb } from "../../auth/db";
import {
  syntheaConditions,
  syntheaEncounters,
  syntheaImagingStudies,
  syntheaMedications,
  syntheaObservations,
  syntheaPatients,
  syntheaProcedures,
} from "../../auth/schema";
import { SyntheaEpisodeBundle } from "./types";

export async function listSyntheaPatientIds(db: AuthDb = getDb()): Promise<string[]> {
  const rows = await db.select({ id: syntheaPatients.id }).from(syntheaPatients);
  return rows.map((r) => r.id);
}

/**
 * Her farklı kaynak tanı kodu için en zengin epizodlu temsilî hasta seçer.
 *
 * Skorlama (ilk gelen hastayı almak yerine):
 *   - observation sayısı (lab/vital kapsamı) ×2
 *   - medication + procedure satırı (yönetim verisi)
 *   - imaging kaydı (görüntüleme testleri)
 * Böylece beklenen testlerin büyük kısmı kaynakta bulunan hasta tercih edilir
 * ve vaka ↔ DB eşleştirme doğruluğu artar.
 */
export async function listSyntheaConditionRepresentatives(
  db: AuthDb = getDb()
): Promise<Array<{ patientId: string; code: string }>> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (code)
      code,
      patient_id AS "patientId"
    FROM (
      SELECT
        c.code,
        c.patient_id,
        (SELECT COUNT(*) FROM synthea_observations o WHERE o.patient_id = c.patient_id) * 2
          + (SELECT COUNT(*) FROM synthea_medications m WHERE m.patient_id = c.patient_id)
          + (SELECT COUNT(*) FROM synthea_procedures p WHERE p.patient_id = c.patient_id)
          + (SELECT COUNT(*) FROM synthea_imaging_studies i WHERE i.patient_id = c.patient_id) AS score
      FROM synthea_conditions c
      WHERE c.code IS NOT NULL AND c.code <> ''
    ) ranked
    ORDER BY code, score DESC, patient_id
  `);

  return (result.rows as Array<{ patientId?: string; code?: string }>)
    .flatMap((row) => {
      const patientId = String(row.patientId || "").trim();
      const code = String(row.code || "").trim();
      return patientId && code ? [{ patientId, code }] : [];
    });
}

export async function loadSyntheaPatient(
  patientId: string,
  db: AuthDb = getDb()
): Promise<SyntheaEpisodeBundle | null> {
  const [patient] = await db
    .select()
    .from(syntheaPatients)
    .where(eq(syntheaPatients.id, patientId));
  if (!patient) return null;

  const [conditions, observations, medications, procedures, encounters, imagingStudies] =
    await Promise.all([
      db.select().from(syntheaConditions).where(eq(syntheaConditions.patientId, patientId)),
      db.select().from(syntheaObservations).where(eq(syntheaObservations.patientId, patientId)),
      db.select().from(syntheaMedications).where(eq(syntheaMedications.patientId, patientId)),
      db.select().from(syntheaProcedures).where(eq(syntheaProcedures.patientId, patientId)),
      db.select().from(syntheaEncounters).where(eq(syntheaEncounters.patientId, patientId)),
      db.select().from(syntheaImagingStudies).where(eq(syntheaImagingStudies.patientId, patientId)),
    ]);

  return {
    source: "synthea",
    patient,
    conditions,
    observations,
    medications,
    procedures,
    encounters,
    imagingStudies,
  };
}
