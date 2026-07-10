/**
 * MIMIC episode → TIP-AI CDM v1 ETL pipeline
 *
 * Adımlar:
 * 1) Demografi → patient
 * 2) Tanılar → meta + conditions + kabulEdilenTani
 * 3) Labs → labs.statikTestler
 * 4) Vitals → vitals
 * 5) Meds/procedures → management.tedavi
 * 6) Rubrik şablonu + presentation stub (AI/uzman post-process)
 * 7) validateVakaDocument
 */

import {
  CdmCondition,
  CdmLabResult,
  DEFAULT_CDM_PUANLAMA,
  TipAiCdmDocument,
  TIP_AI_CDM_VERSION,
} from "../../cdm/types";
import { validateVakaDocument, VakaValidationResult } from "../../cdm/validate-report";
import {
  ageToRange,
  computeAgeYears,
  genderToCinsiyet,
  labDisplayName,
  mapLoincOrLabelToTestKey,
  resolveDiseaseFromIcd,
} from "./mappings";
import { getRubricTemplate } from "./rubric-templates";
import {
  MimicEpisodeBundle,
  MimicLabEvent,
  MimicVital,
  DiseaseMapping,
} from "./types";

export interface EtlOptions {
  /** true: rubrik/presentation şablonlarını doldur (varsayılan true) */
  applyTemplates?: boolean;
  /** seviye */
  seviye?: "baslangic" | "orta" | "ileri";
  /** durum — ETL çıktısı genelde taslak */
  durum?: "taslak" | "aktif" | "arsiv";
  /** lab seçimi: first | last | max */
  labPick?: "first" | "last" | "max";
}

export interface EtlResult {
  vaka: TipAiCdmDocument;
  validation: VakaValidationResult;
  meta: {
    source: string;
    subject_id: string;
    hadm_id: string;
    diseaseMapping: DiseaseMapping | null;
    labMapped: number;
    labUnmapped: number;
    steps: string[];
  };
}

function pickLabValue(
  events: MimicLabEvent[],
  mode: "first" | "last" | "max"
): MimicLabEvent {
  if (mode === "first") return events[0];
  if (mode === "last") return events[events.length - 1];
  // max numeric
  let best = events[0];
  let bestV = Number.NEGATIVE_INFINITY;
  for (const e of events) {
    const v = e.valuenum;
    if (typeof v === "number" && v > bestV) {
      bestV = v;
      best = e;
    }
  }
  return best;
}

function flagFromLab(e: MimicLabEvent): CdmLabResult["flag"] {
  if (e.flag && /abnormal|high|low/i.test(e.flag)) {
    if (/high/i.test(e.flag)) return "high";
    if (/low/i.test(e.flag)) return "low";
    return "abnormal";
  }
  if (
    typeof e.valuenum === "number" &&
    e.ref_range_lower != null &&
    e.ref_range_upper != null
  ) {
    if (e.valuenum > e.ref_range_upper) return "high";
    if (e.valuenum < e.ref_range_lower) return "low";
    return "normal";
  }
  return "unknown";
}

function mapLabs(
  labs: MimicLabEvent[],
  pick: "first" | "last" | "max"
): { tests: Record<string, CdmLabResult>; mapped: number; unmapped: number } {
  const byKey = new Map<string, MimicLabEvent[]>();
  let unmapped = 0;
  for (const lab of labs) {
    const key = mapLoincOrLabelToTestKey({
      loinc: lab.loinc,
      label: lab.label,
      itemid: lab.itemid,
    });
    if (!key) {
      unmapped++;
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(lab);
  }

  const tests: Record<string, CdmLabResult> = {};
  Array.from(byKey.entries()).forEach(([testKey, events]) => {
    // sort by charttime
    events.sort((a: MimicLabEvent, b: MimicLabEvent) =>
      String(a.charttime || "").localeCompare(String(b.charttime || ""))
    );
    const e = pickLabValue(events, pick);
    const ref =
      e.ref_range_lower != null && e.ref_range_upper != null
        ? `${e.ref_range_lower}-${e.ref_range_upper}`
        : undefined;
    const tip =
      typeof e.valuenum === "number" && e.valueuom
        ? "numeric"
        : e.value && typeof e.value === "string" && e.value.length > 40
          ? "text"
          : typeof e.valuenum === "number"
            ? "numeric"
            : "text";

    const sonuc =
      tip === "numeric"
        ? {
            deger: e.valuenum,
            birim: e.valueuom || "",
            referansAralik: ref || "",
          }
        : String(e.value ?? e.valuenum ?? "—");

    const flag = flagFromLab(e);
    tests[testKey] = {
      testKey,
      testAdi: labDisplayName(testKey, e.label || undefined),
      tip,
      sonuc,
      referans: ref ? `Ref: ${ref}` : "MIMIC labevents",
      yorum:
        flag === "high"
          ? "Yüksek"
          : flag === "low"
            ? "Düşük"
            : flag === "abnormal"
              ? "Anormal"
              : flag === "normal"
                ? "Normal aralıkta"
                : "Klinik korelasyon önerilir",
      flag,
      source: "dataset",
    };
  });

  return { tests, mapped: Object.keys(tests).length, unmapped };
}

function mapVitals(vitals: MimicVital[]): TipAiCdmDocument["vitals"] {
  const last = (type: MimicVital["vital_type"]) => {
    const rows = vitals.filter((v) => v.vital_type === type);
    if (!rows.length) return undefined;
    rows.sort((a, b) =>
      String(a.charttime || "").localeCompare(String(b.charttime || ""))
    );
    return rows[rows.length - 1].valuenum;
  };
  const sbp = last("sbp");
  const dbp = last("dbp");
  const tansiyon =
    sbp != null && dbp != null
      ? `${Math.round(sbp)}/${Math.round(dbp)}`
      : sbp != null
        ? `${Math.round(sbp)}/?`
        : undefined;
  return {
    tansiyon: tansiyon || "120/80",
    nabiz: last("heart_rate") != null ? Math.round(last("heart_rate")!) : 78,
    ates: last("temp_c") != null ? Math.round(last("temp_c")! * 10) / 10 : 36.6,
    spo2: last("spo2") != null ? Math.round(last("spo2")!) : 98,
    solunum: last("resp") != null ? Math.round(last("resp")!) : undefined,
  };
}

function slugId(poliklinikKey: string, hastalikKey: string, subject: string, hadm: string): string {
  return `${poliklinikKey}::${hastalikKey}-mimic-${subject}-${hadm}`.toLowerCase();
}

/**
 * Ana ETL: MimicEpisodeBundle → TipAiCdmDocument (+ validation)
 */
export function etlMimicEpisodeToCdm(
  bundle: MimicEpisodeBundle,
  opts: EtlOptions = {}
): EtlResult {
  const steps: string[] = [];
  const applyTemplates = opts.applyTemplates !== false;
  const labPick = opts.labPick || "last";

  // ── Step 1–2: disease from ICD ──
  steps.push("select_episode");
  const icdCodes = bundle.diagnoses.map((d) => d.icd_code);
  const disease = resolveDiseaseFromIcd(icdCodes);
  steps.push(disease ? `map_dx:${disease.hastalikKey}` : "map_dx:unknown");

  const hastalikKey = disease?.hastalikKey || "genel-vaka";
  const hastalikAdi = disease?.hastalikAdi || bundle.diagnoses[0]?.long_title || "Genel klinik vaka";
  const poliklinikKey = disease?.poliklinikKey || "dahiliye";
  const poliklinikAd = disease?.poliklinikAd || "Dahiliye";
  const poliklinikIcon = disease?.poliklinikIcon || "🏥";

  // ── Step 2: demographics ──
  steps.push("map_demographics");
  const age = computeAgeYears({
    anchorAge: bundle.patient.anchor_age,
    dob: bundle.patient.dob,
    admittime: bundle.admission.admittime,
  });
  const cinsiyet = genderToCinsiyet(bundle.patient.gender);

  // ── Step 3: labs ──
  steps.push("map_labs");
  const { tests, mapped, unmapped } = mapLabs(bundle.labs, labPick);

  // ── Step 4: vitals ──
  steps.push("map_vitals");
  const vitals = mapVitals(bundle.vitals);

  // ── Step 5: meds + procedures ──
  steps.push("map_meds_procedures");
  const ilaclar = bundle.prescriptions.slice(0, 8).map((p) => ({
    ad: p.drug,
    doz: [p.dose_val_rx, p.dose_unit_rx].filter(Boolean).join(" ") || "—",
    yol: p.route || "PO",
    endikasyon: hastalikAdi,
  }));
  const prosedurler = bundle.procedures
    .slice(0, 6)
    .map((p) => p.label || p.icd_code || "Prosedür")
    .filter(Boolean);

  // conditions from diagnoses
  const conditions: CdmCondition[] = bundle.diagnoses
    .slice()
    .sort((a, b) => (a.seq_num ?? 99) - (b.seq_num ?? 99))
    .slice(0, 8)
    .map((d, i) => ({
      code: d.icd_code.toUpperCase().replace(/\s/g, ""),
      ad: d.long_title || d.icd_code,
      system: "icd10" as const,
      primary: i === 0,
    }));

  if (disease && !conditions.some((c) => c.primary)) {
    conditions.unshift({
      code: disease.hastalikKey.toUpperCase(),
      ad: disease.hastalikAdi,
      system: "local",
      primary: true,
    });
  }

  const template = applyTemplates ? getRubricTemplate(hastalikKey) : getRubricTemplate("__none__");

  // Prosedürden EKG / görüntüleme stub (sayı uydurmadan rapor metni)
  for (const p of bundle.procedures) {
    const lab = (p.label || "").toLowerCase();
    if (!tests.EKG && /ecg|ekg|electrocardiogram|12-lead/i.test(lab)) {
      tests.EKG = {
        testKey: "EKG",
        testAdi: labDisplayName("EKG", "EKG"),
        tip: "json",
        sonuc: {
          ritim: disease?.hastalikKey === "stemi" ? "Sinüs / ST elevasyonu" : "Sinüs",
          yorum:
            disease?.hastalikKey === "stemi"
              ? "ST elevasyonu — klinik korelasyon (ETL stub)"
              : "Prosedür kaydından EKG stub",
        },
        referans: "MIMIC procedure → EKG stub",
        yorum: "ETL: prosedürden türetilmiş iskelet; uzman doğrulamalı",
        flag: disease?.hastalikKey === "stemi" ? "abnormal" : "unknown",
        source: "dataset",
      };
    }
    if (
      !tests.AKCIGER_GRAFISI &&
      /chest x-?ray|akci[gğ]er graf|cxr/i.test(lab)
    ) {
      tests.AKCIGER_GRAFISI = {
        testKey: "AKCIGER_GRAFISI",
        testAdi: labDisplayName("AKCIGER_GRAFISI"),
        tip: "image",
        sonuc: "Görüntüleme stub — klinik korelasyon (ETL)",
        source: "dataset",
        flag: "unknown",
      };
    }
  }

  // Beklenen test yoksa ve prosedür/lab yoksa bilinçli bırak (validate yakalar)
  if (applyTemplates) {
    for (const t of template.beklenenTestler) {
      if (!tests[t.key] && t.key === "EKG" && !tests.EKG) {
        // STEMI şablonunda EKG zorunlu — minimal stub
        tests.EKG = {
          testKey: "EKG",
          testAdi: "EKG",
          tip: "json",
          sonuc: {
            ritim: "—",
            yorum: "ETL iskeleti: EKG kaydı epizotta yoktu; uzman doldurmalı",
          },
          source: "original",
          flag: "unknown",
          yorum: "Eksik kaynak — placeholder",
        };
      }
    }
  }

  const id = slugId(poliklinikKey, hastalikKey, bundle.subject_id, bundle.hadm_id);

  // Yanıt iskeleti
  const hastaYanitlari: Record<string, string> = {
    OZEL: "Anlamadım",
  };
  const v = vitals || {};
  if (v.tansiyon) hastaYanitlari.VITAL_TANSIYON = v.tansiyon;
  if (v.nabiz != null) hastaYanitlari.VITAL_NABIZ = String(v.nabiz);
  if (v.ates != null) hastaYanitlari.VITAL_ATES = String(v.ates);
  if (v.spo2 != null) hastaYanitlari.VITAL_SPO2 = String(v.spo2);

  for (const s of template.beklenenSorular) {
    if (!hastaYanitlari[s.key]) {
      hastaYanitlari[s.key] = "(ETL iskeleti — uzman/AI dolduracak)";
    }
  }

  const vaka: TipAiCdmDocument = {
    cdmVersion: TIP_AI_CDM_VERSION,
    id,
    meta: {
      poliklinikKey,
      poliklinikAd,
      poliklinikIcon,
      poliklinikAciklama: `MIMIC ETL · ${bundle.source} · subject ${bundle.subject_id} / hadm ${bundle.hadm_id}`,
      hastalikKey,
      hastalikAdi,
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
        komorbiditeler: conditions.slice(1, 4).map((c) => c.code),
      },
    },
    presentation: {
      anaSikayet: applyTemplates ? template.anaSikayetStub : "—",
      ozetBilgiler: applyTemplates
        ? [
            ...template.ozetStub,
            `Kaynak: ${bundle.source}`,
            `Epizod: ${bundle.admission.admission_type || "admission"}`,
          ]
        : [`MIMIC subject ${bundle.subject_id}`],
      semptomSablon: applyTemplates
        ? `{{yas}} yaş {{cinsiyet}}, ${template.anaSikayetStub.toLowerCase()}`
        : "{{yas}} yaş {{cinsiyet}}",
    },
    conditions,
    rubric: {
      beklenenSorular: template.beklenenSorular,
      beklenenTestler: template.beklenenTestler,
      gereksizTestler: template.gereksizTestler,
      redFlagler: template.redFlagler,
      kabulEdilenTani: disease?.kabulEdilenTani || [hastalikAdi],
      puanlama: { ...DEFAULT_CDM_PUANLAMA },
    },
    labs: { statikTestler: tests },
    vitals,
    hastaYanitlari,
    management: {
      idealYol: template.idealYol,
      egitimNotu: `${template.egitimNotu} · ETL: MIMIC→CDM v1 (lab/vital/dx iskeleti). Presentation/rubrik uzman onayı gerektirir.`,
      tedavi: {
        ilaclar,
        prosedurler,
        onemliNotlar: [
          "İlaç/prosedür listesi MIMIC epizodundan sadeleştirilmiştir.",
          "Eğitim amaçlıdır; gerçek hasta verisi değildir (fixture/demo) veya credentialed kullanım kurallarına tabidir.",
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
      source: bundle.source,
      subject_id: bundle.subject_id,
      hadm_id: bundle.hadm_id,
      diseaseMapping: disease,
      labMapped: mapped,
      labUnmapped: unmapped,
      steps,
    },
  };
}
