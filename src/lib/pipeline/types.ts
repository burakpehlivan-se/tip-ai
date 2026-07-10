import { ClinicalProfile, TestSonucu } from "../types";

/**
 * TIP-AI Test Pipeline — paylaşılan tipler.
 *
 * 4 katmanlı veri boru hattı:
 *   1) Master Catalogue  (test envanteri + sınıflandırma)
 *   2) Case Scanner      (eksik / geçersiz test raporu)
 *   3) Lab Motoru        (profil-uyumlu sonuç üretimi)
 *   4) ETL               (generatedTests'i kaynağa yazma)
 *   5) Validation        (generatedTests hesaba katılır)
 */

export type TestCategory = "lab" | "imaging" | "procedure";
export type TestResultKind = "numeric" | "report" | "panel";

/**
 * Lab motorunun bir test için izleyeceği üretim stratejisi.
 *  - always_normal      : her zaman normal değer (genel bazal lablar)
 *  - mildly_abnormal   : hafif anormal (tutarlılık için ayrılanlar)
 *  - depends_on_profile : tanıya göre normal/abnormal (patoloji testleri)
 *  - never_generate     : motor dokunmaz; statik olmalı (görüntüleme/patoloji)
 */
export type GenerationStrategy =
  | "always_normal"
  | "mildly_abnormal"
  | "depends_on_profile"
  | "never_generate";

export interface TestCatalogueEntry {
  /** Kanonik test key (TEK kaynak) */
  key: string;
  name: string;
  unit: string;
  category: TestCategory;
  resultKind: TestResultKind;
  /** Panel testi ise hangi panel (CBC, BMP, LFT, UA ...) */
  panel: string | null;
  type: "numeric" | "json" | "text" | "image";
  refRangeMale: [number, number] | null;
  refRangeFemale: [number, number] | null;
  pathologyDiagnoses: string[];
  generationStrategy: GenerationStrategy;
}

export interface RawTestUsage {
  testKey: string;
  usedInRubric: boolean;
  usedInStatic: boolean;
  usedInCatalogue: boolean;
  vakaIds: string[];
}

export interface TestInventory {
  generatedAt: string;
  totalKeys: number;
  entries: Record<string, TestCatalogueEntry>;
  usage: RawTestUsage[];
  /** Katalogda hiç olmayan (alias dahil) key'ler */
  unknownKeys: { key: string; vakaIds: string[] }[];
}

export interface CaseScanResult {
  vakaId: string;
  hastalikAdi?: string;
  poliklinikKey?: string;
  durum?: string;
  /** Rubrik + statik (zaten sonuçlu) */
  okTests: string[];
  /** Rubrik + katalog var, statik yok → motor dolduracak */
  needsGenerated: string[];
  /** Rubrik + katalog var ama never_generate → yazar statik eklemeli */
  staticRequired: string[];
  /** Rubrikte var, katalogda yok → tasarım hatası */
  invalidKeys: string[];
}

export interface ScanReport {
  generatedAt: string;
  totalCases: number;
  totalOk: number;
  totalNeedsGenerated: number;
  totalStaticRequired: number;
  totalInvalid: number;
  cases: CaseScanResult[];
}

export type Tendency = "normal" | "yuksek" | "dusuk";

export interface FillResult {
  vakaId: string;
  filled: string[];
  skippedStaticRequired: string[];
  skippedInvalid: string[];
}

export type { ClinicalProfile, TestSonucu };
