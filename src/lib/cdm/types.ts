/**
 * TIP-AI CDM v1 — eğitim vaka standardı
 *
 * OMOP CDM’den ilham (person / condition / measurement / procedure / drug)
 * + OSCE/VP case şablonları (presentation, rubric, management).
 *
 * Amaç: herkes aynı sözlük ve şema ile vaka yazsın.
 * Runtime depo hâlâ AdminVaka (düz) tutar; CDM import/export + yazar şablonudur.
 */

import { Seviye, TestSonucu, TestSonucTipi } from "../types";
import { VakaDurum, VakaEtiket } from "../admin/types";

export const TIP_AI_CDM_VERSION = "tip-ai-cdm-v1" as const;
export type TipAiCdmVersion = typeof TIP_AI_CDM_VERSION;

/** Soru / aksiyon kategorisi (OSCE HPI / PMH / meds …) */
export type CdmSoruKategori =
  | "Sikayet"
  | "HPI"
  | "Ozgecmis"
  | "Ilac"
  | "Aile"
  | "Sosyal"
  | "Sistem"
  | "Fizik"
  | "Vital"
  | "RedFlag"
  | "Diger";

export type CdmKodSistemi = "local" | "icd10" | "snomed" | "atc" | "loinc";

/** OMOP condition_occurrence benzeri */
export interface CdmCondition {
  /** Standart yerel kod (örn. T2DM, CKD_G3) veya ICD/SNOMED */
  code: string;
  ad: string;
  system?: CdmKodSistemi;
  /** Birincil tanı mı */
  primary?: boolean;
}

/** OMOP measurement — lab */
export interface CdmLabResult {
  testKey: string;
  testAdi: string;
  tip: TestSonucTipi;
  sonuc: Record<string, unknown> | string;
  referans?: string;
  yorum?: string;
  /** normal | high | low | abnormal | unknown */
  flag?: "normal" | "high" | "low" | "abnormal" | "unknown";
  source?: "original" | "dataset" | "synthetic";
}

/** OMOP drug_exposure benzeri */
export interface CdmDrug {
  /** ATC veya yerel kod (opsiyonel) */
  code?: string;
  ad: string;
  doz: string;
  yol: string;
  endikasyon: string;
}

export interface CdmRubrikAksiyon {
  key: string;
  etiket: string;
  aciklama: string;
  kategori?: CdmSoruKategori | string;
}

export interface CdmPuanlama {
  dogru_kritik_soru: number;
  dogru_yardimci_soru: number;
  dogru_test: number;
  gereksiz_test: number;
  red_flag_atlama: number;
  tehlikeli_eksik: number;
  tani_dogru: number;
  tani_yanlis: number;
}

export const DEFAULT_CDM_PUANLAMA: CdmPuanlama = {
  dogru_kritik_soru: 2,
  dogru_yardimci_soru: 1,
  dogru_test: 2,
  gereksiz_test: -1,
  red_flag_atlama: -3,
  tehlikeli_eksik: -5,
  tani_dogru: 5,
  tani_yanlis: -3,
};

/**
 * TIP-AI CDM v1 belge kökü.
 * Yazarlar / import JSON bu şemaya uyar.
 */
export interface TipAiCdmDocument {
  /** tip-ai-cdm-v1 */
  cdmVersion: TipAiCdmVersion;
  id: string;

  meta: {
    poliklinikKey: string;
    poliklinikAd: string;
    poliklinikIcon?: string;
    poliklinikAciklama?: string;
    hastalikKey: string;
    hastalikAdi: string;
    seviye: Seviye;
    durum: VakaDurum;
    etiketler?: VakaEtiket[] | string[];
    surum?: number;
    uzmanOnayi?: boolean;
    uzmanOnaylayan?: string;
    uzmanOnayTarihi?: number;
    createdAt?: number;
    updatedAt?: number;
  };

  /** OMOP person + profil */
  patient: {
    yasAraligi: [number, number];
    cinsiyetTercih: "E" | "K" | "herhangi";
    profil?: {
      bmi?: number;
      sigara?: string;
      komorbiditeler?: string[];
    };
  };

  /** OSCE presentation */
  presentation: {
    anaSikayet: string;
    ozetBilgiler: string[];
    semptomSablon?: string;
  };

  /** OMOP condition_occurrence listesi (1–3+ tanı) */
  conditions?: CdmCondition[];

  rubric: {
    beklenenSorular: CdmRubrikAksiyon[];
    beklenenTestler: CdmRubrikAksiyon[];
    gereksizTestler?: CdmRubrikAksiyon[];
    redFlagler?: CdmRubrikAksiyon[];
    kabulEdilenTani: string[];
    puanlama?: Partial<CdmPuanlama> | Record<string, number>;
  };

  /** OMOP measurement — standart testKey sözlüğü */
  labs: {
    statikTestler: Record<string, CdmLabResult | TestSonucu>;
    /** Pipeline (lab motoru) tarafından üretilip kalıcılaştırılan sonuçlar */
    generatedTests?: Record<string, CdmLabResult | TestSonucu>;
  };

  /** Vitals (measurement subset) */
  vitals?: {
    tansiyon?: string;
    nabiz?: number;
    ates?: number;
    spo2?: number;
    solunum?: number;
  };

  /** Aksiyon key → hasta cevabı (eğitim simülasyonu) */
  hastaYanitlari: Record<string, string>;

  /** Assessment & Plan + OSCE ideal path */
  management: {
    idealYol?: string[];
    egitimNotu?: string;
    tedavi?: {
      ilaclar?: CdmDrug[];
      prosedurler?: string[];
      onemliNotlar?: string[];
      aciklama?: string;
    };
  };
}

/** Toplu CDM export / import paket */
export interface TipAiCdmBundle {
  format: "tip_ai_cdm_bundle";
  cdmVersion: TipAiCdmVersion;
  exportedAt?: string;
  caseCount: number;
  cases: TipAiCdmDocument[];
}
