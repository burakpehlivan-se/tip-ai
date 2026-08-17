/**
 * Synthea → TIP-AI ara tipleri (ETL girişi).
 * Kaynak: data/raw/synthea/*.csv (PostgreSQL `synthea_*` tablolarına yüklenir).
 * Synthea verisi tamamen sentetiktir; gerçek kişi/PHI içermez.
 */

import type {
  SyntheaCondition,
  SyntheaEncounter,
  SyntheaImagingStudy,
  SyntheaMedication,
  SyntheaObservation,
  SyntheaPatient,
  SyntheaProcedure,
} from "../../auth/schema";

/** Tek Synthea hastası — 1 TIP-AI vakası adayı */
export interface SyntheaEpisodeBundle {
  source: "synthea";
  patient: SyntheaPatient;
  /** sourceId yükleme tekilleştirmesidir; vaka üretiminin girdisi değildir. */
  conditions: Omit<SyntheaCondition, "sourceId" | "codeSystem">[];
  observations: Omit<SyntheaObservation, "sourceId" | "codeSystem">[];
  medications: Omit<SyntheaMedication, "sourceId" | "codeSystem">[];
  procedures: Omit<SyntheaProcedure, "sourceId" | "codeSystem">[];
  encounters: SyntheaEncounter[];
  imagingStudies: SyntheaImagingStudy[];
}

/** SNOMED-CT → TIP-AI hastalık/poliklinik eşleme kaydı */
export interface SyntheaDiseaseMapping {
  hastalikKey: string;
  /** Türkçe tanı adı. */
  hastalikAdi: string;
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  /** Eşleşen SNOMED-CT kodları (tam string) */
  snomedCodes: string[];
  kabulEdilenTani: string[];
  /** Öncelik: düşük sayı = daha spesifik / tercih */
  priority: number;
}
