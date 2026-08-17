/**
 * Synthea hasta → TIP-AI CDM v1 ETL pipeline
 *
 * Adımlar:
 * 1) SNOMED tanı → hastalık/poliklinik
 * 2) Demografi (yaş, cinsiyet, profil)
 * 3) Observations → labs (LOINC → granüler testKey, son değer)
 * 4) Vitals (BP, nabız, solunum, ateş, SpO2, BMI)
 * 5) Imaging → görüntüleme testKey'leri
 * 6) Medications → management.tedavi
 * 7) Rubrik şablonu + presentation stub (AI/uzman post-process — Faz 3)
 * 8) validateVakaDocument
 *
 * Çıktı Türkçedir: tanı adları, rubrik, sigara durumu ve ilaç adları ETL
 * sırasında yerelleştirilir.
 */

import { createHash } from "crypto";
import { CdmCondition, CdmLabResult, TipAiCdmDocument, TIP_AI_CDM_VERSION } from "../../cdm/types";
import { validateVakaDocument, VakaValidationResult } from "../../cdm/validate-report";
import { LAB_REFERANSLAR } from "../../data/clinical-reference";
import { poliklinikAciklama } from "../../data/poliklinik-aciklamalari";
import {
  ageToRange,
  computeAgeYearsFromBirthdate,
  genderToCinsiyet,
  isMappedSnomed,
  localizeSmokingStatus,
  mapSyntheaLoincToTestKey,
  resolveDiseaseFromCondition,
  resolveDiseaseFromSnomed,
  syntheaLabDisplayName,
  turkishNameForSnomed,
} from "./mappings";
import { localizeMedicationName } from "./medications";
import { getSyntheaRubricTemplate, SyntheaRubricTemplate } from "./rubric-templates";
import { SyntheaDiseaseMapping, SyntheaEpisodeBundle } from "./types";

export interface SyntheaEtlOptions {
  seviye?: "baslangic" | "orta" | "ileri";
  durum?: "taslak" | "aktif" | "arsiv";
  /** Kod-bazlı katalog üretiminde bu kaynak tanı birincil kabul edilir. */
  primaryConditionCode?: string;
}

export interface SyntheaEtlResult {
  vaka: TipAiCdmDocument;
  validation: VakaValidationResult;
  meta: {
    source: "synthea";
    /** Kaynak UUID'yi ifşa etmeyen, tekrar üretilebilir opak hasta anahtarı. */
    patientToken: string;
    diseaseMapping: SyntheaDiseaseMapping;
    labMapped: number;
    labUnmapped: number;
    steps: string[];
  };
}

const IMAGING_PROCEDURE_TO_TESTKEY: Record<string, string> = {
  // SNOMED procedure code → kanonik testKey
  "399208008": "AKCIGER_GRAFISI", // Plain X-ray of chest
};

function patientToken(patientId: string): string {
  return createHash("sha256").update(`synthea:${patientId}`).digest("hex").slice(0, 16);
}

function slugId(poliklinikKey: string, hastalikKey: string, token: string): string {
  return `${poliklinikKey}::${hastalikKey}-synthea-${token}`.toLowerCase();
}

function latestObservation(
  observations: SyntheaEpisodeBundle["observations"],
  code: string
): SyntheaEpisodeBundle["observations"][number] | undefined {
  const rows = observations.filter((o) => o.code === code);
  if (!rows.length) return undefined;
  rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return rows[rows.length - 1];
}

function flagFromReference(testKey: string, valueNum: number | null): CdmLabResult["flag"] {
  if (valueNum == null) return "unknown";
  const ref = LAB_REFERANSLAR.find((r) => r.testKey === testKey);
  if (!ref || ref.normalUst <= 0) return "unknown";
  if (valueNum > ref.normalUst) return "high";
  if (valueNum < ref.normalAlt) return "low";
  return "normal";
}

function referenceRange(testKey: string): string | undefined {
  const ref = LAB_REFERANSLAR.find((r) => r.testKey === testKey);
  if (!ref || ref.normalUst <= 0) return undefined;
  return `${ref.normalAlt}-${ref.normalUst} ${ref.birim}`.trim();
}

function mapLabs(bundle: SyntheaEpisodeBundle): {
  tests: Record<string, CdmLabResult>;
  mapped: number;
  unmapped: number;
} {
  const byKey = new Map<string, typeof bundle.observations>();
  let unmapped = 0;
  for (const obs of bundle.observations) {
    const key = mapSyntheaLoincToTestKey({ loinc: obs.code, description: obs.description });
    if (!key) {
      unmapped++;
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(obs);
  }

  const tests: Record<string, CdmLabResult> = {};
  for (const [testKey, rows] of byKey.entries()) {
    rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const latest = rows[rows.length - 1];
    const valueNum = latest.valueNum;
    const isNumeric = valueNum != null;
    const tip = isNumeric ? "numeric" : "text";

    const sonuc = isNumeric
      ? {
          deger: valueNum,
          birim: latest.units || "",
          referansAralik: referenceRange(testKey) || "",
        }
      : String(latest.value ?? "—");

    const flag = flagFromReference(testKey, valueNum);
    const ref = referenceRange(testKey);

    tests[testKey] = {
      testKey,
      testAdi: syntheaLabDisplayName(testKey, latest.description || undefined),
      tip,
      sonuc,
      birim: latest.units || undefined,
      referansAralik: ref,
      referans: ref ? `Ref: ${ref}` : "Synthea gözlemi",
      yorum:
        flag === "high"
          ? "Yüksek"
          : flag === "low"
            ? "Düşük"
            : flag === "normal"
              ? "Normal aralıkta"
              : "Klinik korelasyon önerilir",
      flag,
      source: "dataset",
    };
  }

  return { tests, mapped: Object.keys(tests).length, unmapped };
}

function mapVitals(
  bundle: SyntheaEpisodeBundle
): { vitals: NonNullable<TipAiCdmDocument["vitals"]>; bmi?: number; smoking?: string } {
  const numeric = (code: string): number | undefined => {
    const obs = latestObservation(bundle.observations, code);
    if (!obs) return undefined;
    const n = obs.valueNum ?? (obs.value != null ? Number(obs.value) : undefined);
    return Number.isFinite(n as number) ? (n as number) : undefined;
  };

  const sys = numeric("8480-6");
  const dia = numeric("8462-4");
  const tansiyon =
    sys != null && dia != null
      ? `${Math.round(sys)}/${Math.round(dia)}`
      : undefined;

  const ates = numeric("8310-5");
  const spo2 = numeric("2708-6");
  const bmi = numeric("39156-5");
  const smokingObs = latestObservation(bundle.observations, "72166-2");

  return {
    vitals: {
      tansiyon: tansiyon || "120/80",
      nabiz: Math.round(numeric("8867-4") ?? 78),
      ates: ates != null ? Math.round(ates * 10) / 10 : 36.6,
      spo2: spo2 != null ? Math.round(spo2) : 98,
      solunum: numeric("9279-1") != null ? Math.round(numeric("9279-1")!) : undefined,
    },
    bmi: bmi != null ? Math.round(bmi * 10) / 10 : undefined,
    smoking: localizeSmokingStatus(smokingObs?.value),
  };
}

function mapImaging(bundle: SyntheaEpisodeBundle, tests: Record<string, CdmLabResult>): void {
  for (const img of bundle.imagingStudies) {
    const testKey = img.procedureCode ? IMAGING_PROCEDURE_TO_TESTKEY[img.procedureCode] : undefined;
    if (!testKey || tests[testKey]) continue;
    tests[testKey] = {
      testKey,
      testAdi: syntheaLabDisplayName(testKey),
      tip: "image",
      sonuc: "Görüntüleme çalışması (Synthea) — klinik korelasyon gerekir",
      referans: "Synthea görüntüleme kaydı",
      yorum: "Radyoloji raporu sentezlenmedi; klinik korelasyon önerilir.",
      flag: "unknown",
      source: "dataset",
    };
  }
}

function ensureExpectedTestResults(
  template: SyntheaRubricTemplate,
  tests: Record<string, CdmLabResult>
): void {
  for (const t of template.beklenenTestler) {
    if (tests[t.key]) continue;
    tests[t.key] = {
      testKey: t.key,
      testAdi: syntheaLabDisplayName(t.key, t.etiket),
      tip: "text",
      sonuc: "Kaynak kaydında bulunmuyor",
      referans: "Synthea (eksik)",
      yorum: "Kaynak epizotta sonuç yok — uzman doğrulaması gerekir.",
      flag: "unknown",
      source: "dataset",
    };
  }
}

/**
 * Ana ETL: SyntheaEpisodeBundle → TipAiCdmDocument (+ validation).
 * Hasta eşleşen klinik bir tanıya sahip değilse (yalnızca dental/sosyal kayıt)
 * `null` döner; çağıran hasta için vaka üretmez.
 */
export function etlSyntheaPatientToCdm(
  bundle: SyntheaEpisodeBundle,
  opts: SyntheaEtlOptions = {}
): SyntheaEtlResult | null {
  const steps: string[] = [];

  // ── Step 1: SNOMED tanı → hastalık ──
  steps.push("select_patient");
  const requestedPrimary = opts.primaryConditionCode
    ? bundle.conditions.find((condition) => condition.code === opts.primaryConditionCode)
    : undefined;
  const disease = requestedPrimary
    ? resolveDiseaseFromCondition(requestedPrimary)
    : resolveDiseaseFromSnomed(bundle.conditions.map((c) => c.code));
  if (!disease) {
    return null;
  }
  steps.push(`map_dx:${disease.hastalikKey}`);

  // ── Step 2: demografi ──
  steps.push("map_demographics");
  const age = computeAgeYearsFromBirthdate(bundle.patient.birthdate, bundle.patient.deathdate);
  const cinsiyet = genderToCinsiyet(bundle.patient.gender === "M" ? "M" : "F");

  // ── Step 3: labs ──
  steps.push("map_labs");
  const { tests, mapped, unmapped } = mapLabs(bundle);

  // ── Step 4: vitals ──
  steps.push("map_vitals");
  const { vitals, bmi, smoking } = mapVitals(bundle);

  // ── Step 5: imaging ──
  steps.push("map_imaging");
  mapImaging(bundle, tests);

  // ── Step 6: meds ──
  steps.push("map_medications");
  const ilaclar = bundle.medications.slice(0, 8).map((m) => ({
    code: m.code || undefined,
    ad: localizeMedicationName(m.code, m.description),
    doz: "—",
    yol: "—",
    endikasyon: disease.hastalikAdi,
  }));

  // ── conditions (mapped; primary = eşleşen tanı) ──
  const conditions: CdmCondition[] = [];
  const seen = new Set<string>();
  const primaryCondition = requestedPrimary || bundle.conditions.find((c) => c.code === disease.snomedCodes[0])
    || bundle.conditions.find((c) =>
      disease.snomedCodes.some((code) => code === c.code)
    );
  const primaryCode = primaryCondition?.code || disease.snomedCodes[0];
  conditions.push({
    code: primaryCode,
    ad: disease.hastalikAdi,
    system: "snomed",
    primary: true,
  });
  seen.add(primaryCode);

  for (const c of bundle.conditions) {
    if (seen.has(c.code)) continue;
    if (!isMappedSnomed(c.code)) continue;
    conditions.push({
      code: c.code,
      ad: turkishNameForSnomed(c.code) || c.description || c.code,
      system: "snomed",
      primary: false,
    });
    seen.add(c.code);
    if (conditions.length >= 8) break;
  }

  // ── rubrik ──
  const template = getSyntheaRubricTemplate(disease.hastalikKey);
  ensureExpectedTestResults(template, tests);

  const token = patientToken(bundle.patient.id);
  const id = slugId(disease.poliklinikKey, disease.hastalikKey, token);

  const hastaYanitlari: Record<string, string> = { OZEL: "Anlamadım" };
  if (vitals.tansiyon) hastaYanitlari.VITAL_TANSIYON = vitals.tansiyon;
  if (vitals.nabiz != null) hastaYanitlari.VITAL_NABIZ = String(vitals.nabiz);
  if (vitals.ates != null) hastaYanitlari.VITAL_ATES = String(vitals.ates);
  if (vitals.spo2 != null) hastaYanitlari.VITAL_SPO2 = String(vitals.spo2);
  for (const s of template.beklenenSorular) {
    if (!hastaYanitlari[s.key]) {
      hastaYanitlari[s.key] = "(Synthea iskeleti — AI/uzman dolduracak)";
    }
  }

  const vaka: TipAiCdmDocument = {
    cdmVersion: TIP_AI_CDM_VERSION,
    id,
    meta: {
      poliklinikKey: disease.poliklinikKey,
      poliklinikAd: disease.poliklinikAd,
      poliklinikIcon: disease.poliklinikIcon,
      poliklinikAciklama: poliklinikAciklama(disease.poliklinikKey),
      hastalikKey: disease.hastalikKey,
      hastalikAdi: disease.hastalikAdi,
      seviye: opts.seviye || "orta",
      durum: opts.durum || "taslak",
      etiketler: ["Poliklinik", "Orta seviye"],
      surum: 1,
      uzmanOnayi: false,
    },
    patient: {
      yasAraligi: ageToRange(age),
      cinsiyetTercih: cinsiyet,
      profil: {
        bmi,
        sigara: smoking,
        komorbiditeler: conditions.slice(1, 4).map((c) => c.ad),
      },
    },
    presentation: {
      anaSikayet: template.anaSikayetStub,
      ozetBilgiler: [...template.ozetStub],
      semptomSablon: `{{yas}} yaş {{cinsiyet}}, ${template.anaSikayetStub.toLowerCase()}`,
    },
    conditions,
    rubric: {
      beklenenSorular: template.beklenenSorular,
      beklenenTestler: template.beklenenTestler,
      gereksizTestler: template.gereksizTestler,
      redFlagler: template.redFlagler,
      kabulEdilenTani: disease.kabulEdilenTani,
      puanlama: {
        dogru_kritik_soru: 2,
        dogru_yardimci_soru: 1,
        dogru_test: 2,
        gereksiz_test: -1,
        red_flag_atlama: -3,
        tehlikeli_eksik: -5,
        tani_dogru: 5,
        tani_yanlis: -3,
      },
    },
    labs: { statikTestler: tests },
    vitals,
    hastaYanitlari,
    management: {
      idealYol: template.idealYol,
      egitimNotu: `${template.egitimNotu} · Synthea ETL (lab/vital/dx iskeleti). Sunum/rubrik uzman onayı gerektirir.`,
      tedavi: {
        ilaclar,
        onemliNotlar: [
          "İlaç listesi Synthea kaydından sadeleştirilmiştir.",
          "Kaynak hasta kimlikleri dışa aktarılmaz.",
        ],
      },
    },
  };

  steps.push("build_cdm_document");
  steps.push("validate");
  const validation = validateVakaDocument(vaka);

  return {
    vaka,
    validation,
    meta: {
      source: "synthea",
      patientToken: token,
      diseaseMapping: disease,
      labMapped: mapped,
      labUnmapped: unmapped,
      steps,
    },
  };
}
