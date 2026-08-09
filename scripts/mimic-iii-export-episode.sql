-- MIMIC-III v1.4: one admission, minimal structured export for TIP-AI.
-- Run only in a credentialed, access-controlled PostgreSQL environment.
-- Example: psql ... -v subject_id=123 -v hadm_id=456 -tA -f scripts/mimic-iii-export-episode.sql > /secure/episode.json
\set ON_ERROR_STOP on

WITH selected_admission AS (
  SELECT subject_id, hadm_id, admittime, dischtime, admission_type,
         admission_location, discharge_location
  FROM admissions
  WHERE subject_id = :subject_id::integer AND hadm_id = :hadm_id::integer
)
SELECT jsonb_build_object(
  'selection', jsonb_build_object('subjectId', sa.subject_id, 'hadmId', sa.hadm_id),
  'patients', (
    SELECT jsonb_agg(jsonb_build_object('subject_id', p.subject_id, 'gender', p.gender, 'dob', p.dob))
    FROM patients p WHERE p.subject_id = sa.subject_id
  ),
  'admissions', jsonb_build_array(jsonb_build_object(
    'subject_id', sa.subject_id, 'hadm_id', sa.hadm_id, 'admittime', sa.admittime,
    'dischtime', sa.dischtime, 'admission_type', sa.admission_type,
    'admission_location', sa.admission_location, 'discharge_location', sa.discharge_location
  )),
  'diagnoses', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'subject_id', d.subject_id, 'hadm_id', d.hadm_id, 'seq_num', d.seq_num, 'icd9_code', d.icd9_code
    ) ORDER BY d.seq_num), '[]'::jsonb)
    FROM diagnoses_icd d WHERE d.subject_id = sa.subject_id AND d.hadm_id = sa.hadm_id
  ),
  'diagnosisDictionary', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('icd9_code', dictionary.icd9_code, 'long_title', dictionary.long_title)), '[]'::jsonb)
    FROM d_icd_diagnoses dictionary
    JOIN diagnoses_icd d ON d.icd9_code = dictionary.icd9_code
    WHERE d.subject_id = sa.subject_id AND d.hadm_id = sa.hadm_id
  ),
  'labevents', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'subject_id', lab.subject_id, 'hadm_id', lab.hadm_id, 'itemid', lab.itemid,
      'charttime', lab.charttime, 'value', lab.value, 'valuenum', lab.valuenum,
      'valueuom', lab.valueuom, 'flag', lab.flag
    ) ORDER BY lab.charttime), '[]'::jsonb)
    FROM labevents lab WHERE lab.subject_id = sa.subject_id AND lab.hadm_id = sa.hadm_id
  ),
  'labItems', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('itemid', item.itemid, 'label', item.label, 'fluid', item.fluid, 'category', item.category)), '[]'::jsonb)
    FROM d_labitems item
    JOIN labevents lab ON lab.itemid = item.itemid
    WHERE lab.subject_id = sa.subject_id AND lab.hadm_id = sa.hadm_id
  ),
  'prescriptions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'subject_id', rx.subject_id, 'hadm_id', rx.hadm_id, 'drug', rx.drug,
      'dose_val_rx', rx.dose_val_rx, 'dose_unit_rx', rx.dose_unit_rx,
      'route', rx.route, 'startdate', rx.startdate
    )), '[]'::jsonb)
    FROM prescriptions rx WHERE rx.subject_id = sa.subject_id AND rx.hadm_id = sa.hadm_id
  ),
  'procedures', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'subject_id', procedure.subject_id, 'hadm_id', procedure.hadm_id,
      'seq_num', procedure.seq_num, 'icd9_code', procedure.icd9_code
    ) ORDER BY procedure.seq_num), '[]'::jsonb)
    FROM procedures_icd procedure WHERE procedure.subject_id = sa.subject_id AND procedure.hadm_id = sa.hadm_id
  )
) AS episode
FROM selected_admission sa;
