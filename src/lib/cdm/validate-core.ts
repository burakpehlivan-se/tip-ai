/**
 * Paylaşılan CDM çekirdek doğrulaması — tek kaynak.
 * Import (validate.ts) ve Publication (validate-report.ts) politikaları
 * buradaki ortak kural kümesini kullanır, kendi sertlikleriyle haritalar.
 * Yeni klinik alan eklenirken yalnızca burası güncellenir.
 */
import { TipAiCdmDocument } from "./types";
import { isCdmGender, isCdmLevel, isCdmRecord, isCdmStatus } from "./validation-rules";

export type CoreLevel = "error" | "warn" | "info";
export interface CoreIssue {
  code: string;
  field: string;
  message: string;
  level: CoreLevel;
}

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function add(issues: CoreIssue[], field: string, message: string, code = "MISSING_FIELD", level: CoreLevel = "error") {
  issues.push({ code, field, message, level });
}

function validateActionList(value: unknown, field: string, issues: CoreIssue[]) {
  if (!Array.isArray(value)) {
    add(issues, field, "Aksiyon listesi olmalı.", "INVALID_VALUE");
    return;
  }
  value.forEach((action, index) => {
    if (!isCdmRecord(action) || !hasText(action.key) || !hasText(action.etiket)) {
      add(issues, `${field}[${index}]`, "Aksiyon key ve etiket içermeli.", "INVALID_VALUE");
    }
  });
}

/**
 * Ortak CDM şekil kuralları — her iki politika için de geçerli.
 * - Hata = yapısal eksik, import/publication ikisinde de engel
 * - Uyarı = klinik olarak önerilen ama yapısal olarak tolere edilebilir
 */
export function validateCoreCommon(raw: unknown): CoreIssue[] {
  const issues: CoreIssue[] = [];
  if (!isCdmRecord(raw)) {
    return [{ code: "MISSING_FIELD", field: "", message: "Kök nesne gerekli.", level: "error" }];
  }
  const doc = raw as Partial<TipAiCdmDocument> & Record<string, unknown>;

  // id
  if (!hasText(doc.id)) add(issues, "id", "id zorunlu (örn. poliklinik::hastalik).");

  // cdmVersion — her iki politikada da uyarı/bilgi, hata değil
  if (doc.cdmVersion && doc.cdmVersion !== "tip-ai-cdm-v1") {
    add(issues, "cdmVersion", `Beklenen tip-ai-cdm-v1, gelen: ${doc.cdmVersion}`, "CDM_VERSION_MISMATCH", "warn");
  }
  if (!doc.cdmVersion) {
    add(issues, "cdmVersion", "cdmVersion yok; tip-ai-cdm-v1 varsayılacak.", "LEGACY_CASE", "warn");
  }

  // meta
  const meta = doc.meta as Record<string, unknown> | undefined;
  if (!isCdmRecord(meta)) {
    add(issues, "meta", "meta bloğu zorunlu.");
  } else {
    for (const f of ["poliklinikKey", "poliklinikAd", "hastalikKey", "hastalikAdi"] as const) {
      if (!hasText(meta[f])) add(issues, `meta.${f}`, `${f} zorunlu.`);
    }
    if (!hasText(meta.seviye)) add(issues, "meta.seviye", "Seviye (baslangic/orta/ileri) eksik");
    else if (!isCdmLevel(meta.seviye)) add(issues, "meta.seviye", `Geçersiz seviye: ${meta.seviye}`, "INVALID_VALUE");
    if (!hasText(meta.durum)) add(issues, "meta.durum", "Durum (taslak/aktif/arsiv) eksik");
    else if (!isCdmStatus(meta.durum)) add(issues, "meta.durum", `Geçersiz durum: ${meta.durum}`, "INVALID_VALUE");
  }

  // patient
  const patient = doc.patient as Record<string, unknown> | undefined;
  if (!isCdmRecord(patient)) {
    add(issues, "patient", "patient bloğu zorunlu.");
  } else {
    const ya = patient.yasAraligi as unknown;
    if (!Array.isArray(ya) || ya.length !== 2 || typeof ya[0] !== "number" || typeof ya[1] !== "number") {
      add(issues, "patient.yasAraligi", "Yaş aralığı [min,max] formatında tanımlı değil");
    } else {
      const [min, max] = ya as [number, number];
      if (typeof min !== "number" || typeof max !== "number" || min <= 0 || max <= 0 || min > max || max > 120) {
        add(issues, "patient.yasAraligi", `Yaş aralığı geçersiz: [${min}, ${max}]`, "INVALID_VALUE");
      }
    }
    if (!hasText(patient.cinsiyetTercih)) add(issues, "patient.cinsiyetTercih", "Cinsiyet tercihi eksik");
    else if (!isCdmGender(patient.cinsiyetTercih)) add(issues, "patient.cinsiyetTercih", `Geçersiz cinsiyet: ${patient.cinsiyetTercih}`, "INVALID_VALUE");
  }

  // presentation
  const presentation = doc.presentation as Record<string, unknown> | undefined;
  if (!isCdmRecord(presentation)) {
    add(issues, "presentation", "presentation bloğu zorunlu.");
  } else {
    if (!hasText(presentation.anaSikayet)) add(issues, "presentation.anaSikayet", "Ana şikayet eksik");
    if (!Array.isArray(presentation.ozetBilgiler) || (presentation.ozetBilgiler.length < 3 || presentation.ozetBilgiler.length > 4)) {
      add(issues, "presentation.ozetBilgiler", "Özet bilgiler 3–4 madde olmalı", "SHORT_SUMMARY", "warn");
    }
    if (!hasText(presentation.semptomSablon)) add(issues, "presentation.semptomSablon", "Semptom şablonu eksik");
  }

  // rubric
  const rubric = doc.rubric as Record<string, unknown> | undefined;
  if (!isCdmRecord(rubric)) {
    add(issues, "rubric", "Rubrik eksik");
  } else {
    if (!Array.isArray(rubric.beklenenSorular) || rubric.beklenenSorular.length < 3) {
      add(issues, "rubric.beklenenSorular", "Beklenen sorular 3'ten az", "FEW_EXPECTED_QUESTIONS", "warn");
    } else {
      validateActionList(rubric.beklenenSorular, "rubric.beklenenSorular", issues);
    }
    if (!Array.isArray(rubric.beklenenTestler) || rubric.beklenenTestler.length === 0) {
      add(issues, "rubric.beklenenTestler", "Beklenen testler tanımlı değil", "NO_EXPECTED_TESTS");
    } else {
      // sadece key varlığı burada, kanonik/katalog kontrolü politikaya özel
      (rubric.beklenenTestler as unknown[]).forEach((t, i) => {
        const rec = t as Record<string, unknown>;
        if (!hasText(rec?.key)) add(issues, `rubric.beklenenTestler[${i}].key`, "Test key eksik");
      });
    }
    if (!Array.isArray(rubric.kabulEdilenTani) || rubric.kabulEdilenTani.length === 0) {
      add(issues, "rubric.kabulEdilenTani", "Kabul edilen tanı listesi boş", "NO_ACCEPTED_DIAGNOSIS");
    }
    const p = rubric.puanlama as Record<string, unknown> | undefined;
    if (!p || typeof p !== "object") {
      add(issues, "rubric.puanlama", "Puanlama alanı eksik");
    } else {
      for (const key of ["dogru_kritik_soru", "dogru_test", "tani_dogru"] as const) {
        if (typeof p[key] !== "number") add(issues, `rubric.puanlama.${key}`, `Puanlama alanı eksik veya sayı değil: ${key}`);
      }
    }
  }

  // conditions — ortak: en az bir code/ad önerilir
  const conditions = (doc as { conditions?: unknown }).conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    add(issues, "conditions", "conditions listesi boş — OMOP condition önerilir", "NO_CONDITIONS", "warn");
  } else {
    (conditions as unknown[]).forEach((c, i) => {
      const rec = c as Record<string, unknown>;
      if (!hasText(rec?.code)) add(issues, `conditions[${i}].code`, "Condition code eksik");
      if (!hasText(rec?.ad)) add(issues, `conditions[${i}].ad`, "Condition adı eksik");
    });
  }

  // labs — temel varlık
  const labs = (doc as { labs?: unknown }).labs as Record<string, unknown> | undefined;
  const labMap = (labs?.statikTestler || (labs as Record<string, unknown>)?.statikTestler) as Record<string, unknown> | undefined;
  // labs.statikTestler yoksa hata değil uyarı (import toleransı), publication'da hata olacak — core'da warn
  if (!isCdmRecord(labs) || !isCdmRecord(labMap)) {
    add(issues, "labs.statikTestler", "Statik test sonuçları tanımlı değil", "NO_LABS", "warn");
  } else {
    const keys = Object.keys(labMap);
    if (keys.length === 0) add(issues, "labs.statikTestler", "Statik test sonuçları tanımlı değil", "NO_LABS", "warn");
    else {
      for (const [k, v] of Object.entries(labMap)) {
        if (!isCdmRecord(v) || (v as Record<string, unknown>).sonuc === undefined) {
          add(issues, `labs.statikTestler.${k}`, "Test sonucu nesne olmalı ve sonuc alanı zorunlu.", "INVALID_LAB");
        }
      }
    }
  }

  // hastaYanitlari — varlık
  const yanitlar = (doc as { hastaYanitlari?: unknown }).hastaYanitlari;
  if (!isCdmRecord(yanitlar)) {
    add(issues, "hastaYanitlari", "hastaYanitlari nesnesi zorunlu.", "NO_PATIENT_ANSWERS", "warn");
  } else if (Object.keys(yanitlar as object).length === 0) {
    add(issues, "hastaYanitlari", "Hasta yanıtları boş", "NO_PATIENT_ANSWERS", "warn");
  }

  return issues;
}
