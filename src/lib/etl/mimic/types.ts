/**
 * MIMIC-IV benzeri ara tipler (ETL girişi).
 * Gerçek PhysioNet CSV/SQL’den veya fixture’tan doldurulur.
 * PHI taşınmaz — yalnızca eğitim iskeleti üretimi.
 */

export interface MimicPatient {
  subject_id: string;
  gender: "M" | "F";
  /** ISO date or year-only synthetic */
  dob?: string;
  anchor_age?: number;
}

export interface MimicAdmission {
  subject_id: string;
  hadm_id: string;
  admittime: string;
  dischtime?: string;
  admission_type?: string;
  admission_location?: string;
  discharge_location?: string;
}

export interface MimicDiagnosis {
  subject_id: string;
  hadm_id: string;
  /** ICD-9 or ICD-10 code */
  icd_code: string;
  icd_version?: 9 | 10;
  seq_num?: number;
  long_title?: string;
}

export interface MimicLabEvent {
  subject_id: string;
  hadm_id: string;
  itemid?: string;
  /** LOINC if available */
  loinc?: string;
  label?: string;
  charttime?: string;
  valuenum?: number | null;
  value?: string | null;
  valueuom?: string | null;
  flag?: string | null;
  ref_range_lower?: number | null;
  ref_range_upper?: number | null;
}

export interface MimicVital {
  subject_id: string;
  hadm_id: string;
  charttime?: string;
  /** heart_rate | sbp | dbp | temp_c | spo2 | resp */
  vital_type: "heart_rate" | "sbp" | "dbp" | "temp_c" | "spo2" | "resp";
  valuenum: number;
  valueuom?: string;
}

export interface MimicPrescription {
  subject_id: string;
  hadm_id: string;
  drug: string;
  dose_val_rx?: string;
  dose_unit_rx?: string;
  route?: string;
  starttime?: string;
}

export interface MimicProcedure {
  subject_id: string;
  hadm_id: string;
  icd_code?: string;
  label?: string;
  seq_num?: number;
}

/** Tek yatış/epizod — 1 TIP-AI vakası adayı */
export interface MimicEpisodeBundle {
  source: "mimic-iv" | "mimic-demo" | "fixture" | "omop-export";
  subject_id: string;
  hadm_id: string;
  patient: MimicPatient;
  admission: MimicAdmission;
  diagnoses: MimicDiagnosis[];
  labs: MimicLabEvent[];
  vitals: MimicVital[];
  prescriptions: MimicPrescription[];
  procedures: MimicProcedure[];
}

/** ICD / LOINC eşleme kaydı */
export interface DiseaseMapping {
  hastalikKey: string;
  hastalikAdi: string;
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  /** ICD-10 prefix veya tam kod (büyük harf) */
  icd10Prefixes: string[];
  kabulEdilenTani: string[];
  /** Öncelik: düşük sayı = daha spesifik / tercih */
  priority: number;
}
