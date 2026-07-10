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
    rol: "Gerçek hastane LIS davranışı: tüm lab ölçümleri (normal+anormal), zaman damgası, birim",
    url: "https://physionet.org/content/mimiciv/",
    ekUrl: [
      { etiket: "PhysioNet", url: "https://physionet.org/" },
      { etiket: "MIMIC-IV docs", url: "https://mimic.mit.edu/docs/iv/" },
    ],
    lisans: "PhysioNet Credentialed Health Data — CITI + başvuru gerekir",
    tablolar: ["hosp.labevents", "hosp.d_labitems"],
    not: "Erişim açılınca aynı lab-pool şemasına ikinci kaynak olarak bağlanacak. ICU ağırlıklıdır.",
  },
  {
    id: "ai-readi-lab-docs",
    ad: "AI-READI — Clinical Lab Tests documentation",
    kisaAd: "AI-READI",
    durum: "referans",
    rol: "Lab test referans aralıkları ve OMOP measurement şeması (bilgi tabanı)",
    url: "https://docs.aireadi.org/docs/3/dataset/clinical-data/clinical-lab-tests/",
    lisans: "Dokümantasyon / dataset erişim koşullarına bağlı",
    not: "Değer üretmek için değil; normal/abnormal etiketleme ve test anlamlandırma referansı.",
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
