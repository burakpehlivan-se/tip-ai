/**
 * Lab data fusion — resmi kaynak kaydı
 *
 * Bu liste UI (Vaka Kaynakları, Hakkında) ve extract meta ile senkron tutulur.
 * Değerler aralıktan üretilmez; import edilmiş satırlardan örneklenir.
 */

export type LabKaynakDurum = "aktif" | "planlanan" | "referans";

export interface LabKaynak {
  id: string;
  ad: string;
  kisaAd: string;
  durum: LabKaynakDurum;
  rol: string;
  url: string;
  /** Ek dokümantasyon / ilgili linkler */
  ekUrl?: { etiket: string; url: string }[];
  lisans: string;
  tablolar?: string[];
  not: string;
}

/** Sistemde kayıtlı lab / EHR veri kaynakları */
export const LAB_KAYNAKLARI: LabKaynak[] = [
  {
    id: "synthea-sample-csv",
    ad: "Synthea Sample CSV (Synthetic EHR)",
    kisaAd: "Synthea",
    durum: "aktif",
    rol: "Birincil lab havuzu — patients + observations; normal ve anormal tüm sipariş edilen lab satırları",
    url: "https://synthetichealth.github.io/synthea-sample-data/downloads/latest/synthea_sample_data_csv_latest.zip",
    ekUrl: [
      { etiket: "Synthea proje", url: "https://synthetichealth.github.io/synthea/" },
      { etiket: "GitHub", url: "https://github.com/synthetichealth/synthea" },
    ],
    lisans: "Açık sentetik veri (gerçek PHI yok) — MITRE Synthea",
    tablolar: ["patients.csv", "observations.csv"],
    not: "Profil (yaş/cinsiyet) eşleşmesi ile normal bazal panel buradan örneklenir. Aralıktan değer üretilmez.",
  },
  {
    id: "gomask-lab-test-results",
    ad: "GoMask — Lab Test Results (Synthetic)",
    kisaAd: "GoMask",
    durum: "referans",
    rol: "Sentetik tam lab paneli şeması (test tipi, sonuç, ref aralık, normal/abnormal flag, timestamp)",
    url: "https://gomask.ai/marketplace/datasets/lab-test-results",
    lisans: "Marketplace / hesap gerekir (tam export)",
    not: "Şema eşlemesi için referans. Bulk import hesap açılınca lab-pool’a eklenebilir.",
  },
  {
    id: "mimic-iv-labevents",
    ad: "MIMIC-IV — labevents (+ d_labitems)",
    kisaAd: "MIMIC-IV",
    durum: "planlanan",
    rol: "EHR iskeleti: demografi, ICD tanılar, labevents, vitals, ilaç, prosedür → TIP-AI CDM v1 ETL",
    url: "https://physionet.org/content/mimiciv/",
    ekUrl: [
      { etiket: "PhysioNet", url: "https://physionet.org/" },
      { etiket: "MIMIC-IV docs", url: "https://mimic.mit.edu/docs/iv/" },
      {
        etiket: "ETL kodu",
        url: "src/lib/etl/mimic/pipeline.ts",
      },
    ],
    lisans: "PhysioNet Credentialed Health Data — CITI + başvuru gerekir",
    tablolar: [
      "hosp.patients",
      "hosp.admissions",
      "hosp.diagnoses_icd",
      "hosp.labevents",
      "hosp.d_labitems",
      "hosp.prescriptions",
      "hosp.procedures_icd",
      "icu.chartevents (vitals)",
    ],
    not:
      "Doğrudan JSON’a kopyalanmaz. subject_id+hadm_id epizodu ETL ile CDM v1 iskeletine map edilir " +
      "(src/lib/etl/mimic). Rubrik/presentation AI+uzman post-process. Fixture demo: npm run etl:mimic-demo",
  },
  {
    id: "ai-readi-lab-docs",
    ad: "AI-READI — Clinical Lab Tests (diyabet odaklı OMOP)",
    kisaAd: "AI-READI",
    durum: "referans",
    rol: "Diyabet ağırlıklı lab pattern / OMOP measurement referansı (HbA1c, glukoz aralıkları)",
    url: "https://docs.aireadi.org/docs/3/dataset/clinical-data/clinical-lab-tests/",
    lisans: "Dokümantasyon / dataset erişim koşullarına bağlı",
    not:
      "T2DM vaka fixture ve lab yorumları için pattern kaynağı. Değer aralıktan üretilmez; " +
      "gerçek/import satır veya onaylı şablon kullanılır.",
  },
];

export const LAB_FUSION_POLITIKA =
  "Lab fusion: şablon testleri (patoloji, source=original) + dataset satırları (source=dataset). " +
  "Değerler yalnızca import edilmiş lab-pool satırlarından örneklenir; referans aralıkları sadece etiket/filtre içindir.";

/** Vaka sol paneli / kaynaklar listesi için metin satırları */
export function labKaynakSatirlari(opts?: {
  originalSayisi?: number;
  datasetSayisi?: number;
}): string[] {
  const aktif = LAB_KAYNAKLARI.filter((k) => k.durum === "aktif");
  const planlanan = LAB_KAYNAKLARI.filter((k) => k.durum === "planlanan");
  const referans = LAB_KAYNAKLARI.filter((k) => k.durum === "referans");

  const lines: string[] = [
    LAB_FUSION_POLITIKA,
  ];

  if (opts?.originalSayisi != null || opts?.datasetSayisi != null) {
    lines.push(
      `🔬 Bu vakada · ${opts.originalSayisi ?? 0} şablon (patoloji) + ${opts.datasetSayisi ?? 0} dataset lab satırı · aynı episode`
    );
  }

  for (const k of aktif) {
    lines.push(
      `📦 Aktif kaynak · ${k.ad} · ${k.rol} · ${k.url}`
    );
    if (k.tablolar?.length) {
      lines.push(`   Tablolar: ${k.tablolar.join(", ")} · ${k.lisans}`);
    }
    lines.push(`   ${k.not}`);
  }

  for (const k of planlanan) {
    lines.push(`⏳ Planlanan · ${k.ad} · ${k.url}`);
    lines.push(`   ${k.not}`);
  }

  for (const k of referans) {
    lines.push(`📘 Referans · ${k.ad} · ${k.url}`);
  }

  return lines;
}

export function labKaynakById(id: string): LabKaynak | undefined {
  return LAB_KAYNAKLARI.find((k) => k.id === id);
}
