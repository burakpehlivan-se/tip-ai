/**
 * MIMIC-III v1.4 tablo satırlarını tek bir yatış epizoduna dönüştürür.
 *
 * Bu modül CSV indirme/parsing yapmaz: credentialed ham verinin disk konumu,
 * erişim yetkisi ve saklama süresi uygulama deposunun dışında kalır. Çağıran,
 * CSV'leri güvenli ortamda parse edip bu dar arayüze verir.
 */

import {
  MimicAdmission,
  MimicDiagnosis,
  MimicEpisodeBundle,
  MimicLabEvent,
  MimicPatient,
  MimicPrescription,
  MimicProcedure,
} from "./types";

export const MIMIC_III_VERSION = "1.4" as const;

export interface MimicIIIPatientRow {
  subject_id: string | number;
  gender: "M" | "F";
  dob: string;
}

export interface MimicIIIAdmissionRow {
  subject_id: string | number;
  hadm_id: string | number;
  admittime: string;
  dischtime?: string | null;
  admission_type?: string | null;
  admission_location?: string | null;
  discharge_location?: string | null;
}

export interface MimicIIIDiagnosisRow {
  subject_id: string | number;
  hadm_id: string | number;
  seq_num?: string | number | null;
  icd9_code: string;
}

export interface MimicIIIDiagnosisDictionaryRow {
  icd9_code: string;
  long_title?: string | null;
}

export interface MimicIIILabEventRow {
  subject_id: string | number;
  hadm_id?: string | number | null;
  itemid: string | number;
  charttime?: string | null;
  value?: string | null;
  valuenum?: string | number | null;
  valueuom?: string | null;
  flag?: string | null;
}

export interface MimicIIILabItemRow {
  itemid: string | number;
  label: string;
  fluid?: string | null;
  category?: string | null;
}

export interface MimicIIIPrescriptionRow {
  subject_id: string | number;
  hadm_id: string | number;
  drug: string;
  dose_val_rx?: string | null;
  dose_unit_rx?: string | null;
  route?: string | null;
  startdate?: string | null;
}

export interface MimicIIIProcedureRow {
  subject_id: string | number;
  hadm_id: string | number;
  seq_num?: string | number | null;
  icd9_code?: string | null;
}

export interface MimicIIITables {
  patients: MimicIIIPatientRow[];
  admissions: MimicIIIAdmissionRow[];
  diagnoses: MimicIIIDiagnosisRow[];
  diagnosisDictionary?: MimicIIIDiagnosisDictionaryRow[];
  labevents?: MimicIIILabEventRow[];
  labItems?: MimicIIILabItemRow[];
  prescriptions?: MimicIIIPrescriptionRow[];
  procedures?: MimicIIIProcedureRow[];
}

export interface MimicIIIEpisodeSelection {
  subjectId: string | number;
  hadmId: string | number;
}

export interface MimicIIIEpisodeQuality {
  source: "mimic-iii";
  datasetVersion: typeof MIMIC_III_VERSION;
  diagnoses: number;
  labsIncluded: number;
  labsExcludedOutsideAdmission: number;
  warnings: string[];
}

export interface MimicIIIEpisodeResult {
  bundle: MimicEpisodeBundle;
  quality: MimicIIIEpisodeQuality;
}

function id(value: string | number): string {
  return String(value).trim();
}

function optional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function numberOrUndefined(value: string | number | null | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveMimicIIIAge(dob: string, admittime: string): Pick<MimicPatient, "anchor_age" | "age_quality"> {
  const birth = new Date(dob);
  const admission = new Date(admittime);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(admission.getTime())) {
    return { age_quality: "unknown" };
  }
  let age = admission.getUTCFullYear() - birth.getUTCFullYear();
  const month = admission.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && admission.getUTCDate() < birth.getUTCDate())) age--;
  if (age < 0) return { age_quality: "unknown" };
  // MIMIC-III de-identification shifts the DOB for patients aged 89+, so the
  // calculated value must never be presented as an exact age.
  if (age >= 90) return { anchor_age: 89, age_quality: "capped_89_plus" };
  return { anchor_age: age, age_quality: "derived" };
}

/**
 * Yalnızca aynı SUBJECT_ID + HADM_ID'ye ait satırları kabul eder. HADM_ID'siz
 * outpatient labs bilinçli olarak dışarıda bırakılır; bunlar yatış-vaka
 * bağlamına güvenle atanamaz.
 */
export function buildMimicIIIEpisode(
  tables: MimicIIITables,
  selection: MimicIIIEpisodeSelection
): MimicIIIEpisodeResult {
  const subjectId = id(selection.subjectId);
  const hadmId = id(selection.hadmId);
  const admission = tables.admissions.find(
    (row) => id(row.subject_id) === subjectId && id(row.hadm_id) === hadmId
  );
  if (!admission) throw new Error("Selected MIMIC-III admission was not found");

  const patient = tables.patients.find((row) => id(row.subject_id) === subjectId);
  if (!patient) throw new Error("Selected MIMIC-III patient was not found");

  const diagnoses = tables.diagnoses
    .filter((row) => id(row.subject_id) === subjectId && id(row.hadm_id) === hadmId)
    .map((row): MimicDiagnosis => ({
      subject_id: subjectId,
      hadm_id: hadmId,
      icd_code: row.icd9_code,
      icd_version: 9,
      seq_num: numberOrUndefined(row.seq_num),
      long_title: tables.diagnosisDictionary?.find(
        (dictionary) => dictionary.icd9_code.replace(".", "") === row.icd9_code.replace(".", "")
      )?.long_title || undefined,
    }));
  if (!diagnoses.length) throw new Error("Selected MIMIC-III admission has no diagnosis rows");

  const labItems = new Map((tables.labItems || []).map((row) => [id(row.itemid), row]));
  const episodeLabs = (tables.labevents || []).filter(
    (row) => id(row.subject_id) === subjectId && id(row.hadm_id || "") === hadmId
  );
  const labs: MimicLabEvent[] = episodeLabs.map((row) => ({
    subject_id: subjectId,
    hadm_id: hadmId,
    itemid: id(row.itemid),
    label: labItems.get(id(row.itemid))?.label,
    charttime: optional(row.charttime),
    value: optional(row.value) || null,
    valuenum: numberOrUndefined(row.valuenum) ?? null,
    valueuom: optional(row.valueuom) || null,
    flag: optional(row.flag) || null,
  }));

  const prescriptions: MimicPrescription[] = (tables.prescriptions || [])
    .filter((row) => id(row.subject_id) === subjectId && id(row.hadm_id) === hadmId)
    .map((row) => ({
      subject_id: subjectId,
      hadm_id: hadmId,
      drug: row.drug,
      dose_val_rx: optional(row.dose_val_rx),
      dose_unit_rx: optional(row.dose_unit_rx),
      route: optional(row.route),
      starttime: optional(row.startdate),
    }));
  const procedures: MimicProcedure[] = (tables.procedures || [])
    .filter((row) => id(row.subject_id) === subjectId && id(row.hadm_id) === hadmId)
    .map((row) => ({
      subject_id: subjectId,
      hadm_id: hadmId,
      icd_code: optional(row.icd9_code),
      seq_num: numberOrUndefined(row.seq_num),
    }));

  const mimicPatient: MimicPatient = {
    subject_id: subjectId,
    gender: patient.gender,
    ...deriveMimicIIIAge(patient.dob, admission.admittime),
  };
  const mimicAdmission: MimicAdmission = {
    subject_id: subjectId,
    hadm_id: hadmId,
    admittime: admission.admittime,
    dischtime: optional(admission.dischtime),
    admission_type: optional(admission.admission_type),
    admission_location: optional(admission.admission_location),
    discharge_location: optional(admission.discharge_location),
  };
  const labsForSubject = (tables.labevents || []).filter((row) => id(row.subject_id) === subjectId);
  const quality: MimicIIIEpisodeQuality = {
    source: "mimic-iii",
    datasetVersion: MIMIC_III_VERSION,
    diagnoses: diagnoses.length,
    labsIncluded: labs.length,
    labsExcludedOutsideAdmission: labsForSubject.length - labs.length,
    warnings: [
      "ICD-9 tanılar hastane yatışı sonunda faturalama amacıyla atanır; klinik doğrulama gerekir.",
      "HADM_ID olmayan veya başka yatışa ait laboratuvar satırları dışarıda bırakıldı.",
      ...(mimicPatient.age_quality === "capped_89_plus"
        ? ["89+ yaş MIMIC-III de-identification kuralı nedeniyle 89+ olarak temsil edilir."]
        : []),
    ],
  };

  return {
    bundle: {
      source: "mimic-iii",
      subject_id: subjectId,
      hadm_id: hadmId,
      patient: mimicPatient,
      admission: mimicAdmission,
      diagnoses,
      labs,
      vitals: [],
      prescriptions,
      procedures,
    },
    quality,
  };
}
