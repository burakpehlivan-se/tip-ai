import { AdminVaka } from "./types";
import { Vaka, Hasta, Cinsiyet } from "../types";
import { birlestirTestler, buildClinicalProfile } from "../data/lab-katalog";
import { enrichHastaYanitlari } from "../data/hasta-yanit-enrich";
import { vakaChipleriniUret } from "../data/vaka-chip-uretici";
import { caseVersionStamp } from "./case-integrity";

function rastgeleInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ERKEK = ["Ahmet", "Mehmet", "Ali", "Mustafa", "Hüseyin"];
const KADIN = ["Ayşe", "Fatma", "Zeynep", "Elif", "Merve"];
const SOY = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin"];

/**
 * Synthea rubrik anahtarları (rubric-templates.ts) ile CHIP_HAVUZU aksiyon
 * anahtarları farklı kelime dağarcıklarındadır (örn. CHIEF_COMPLAINT ↔ SIKAYET).
 * Bu eşleme olmadan relevantAksiyonlar hiçbir chip ile kesişmez; debug yeşil
 * vurgusu ve anamnez puanlaması Synthea vakalarında çalışmaz.
 */
const RUBRIK_TO_CHIP: Record<string, string[]> = {
  // Varsayılan şablon soruları
  CHIEF_COMPLAINT: ["SIKAYET"],
  HISTORY_OF_PRESENT: ["SIKAYET_SURE", "ESLIK_EDEN"],
  PAST_MEDICAL: ["HT_OYKUSU", "DIYABET", "KOAH_OYKUSU"],
  MEDICATIONS: ["ILAC", "ILAC_OYKUSU"],
  FAMILY_HISTORY: ["AILE_OYKUSU"],
  SOCIAL_HISTORY: ["SIGARA", "ALKOL"],
  // Hastalığa özgü semptom soruları
  CHEST_PAIN_CHARACTER: ["GOGUS_AGRISI"],
  RADIATION: ["AGRI_YAYILIM"],
  ONSET: ["SIKAYET_SURE"],
  DYSPNEA: ["NEFES_DARLIGI"],
  CARDIAC_RISK: ["HT_OYKUSU", "DIYABET", "SIGARA", "KAH_OYKUSU"],
  CHEST_PAIN: ["GOGUS_AGRISI"],
  EDEMA: ["ODEM"],
  FATIGUE: ["HALSIZLIK"],
  CARDIAC_HISTORY: ["KAH_OYKUSU"],
  PALPITATIONS: ["CARPINTI_OYKU"],
  STROKE_RISK: ["HT_OYKUSU", "DIYABET"],
  HEADACHE: ["BAS_AGRISI"],
  VISION: ["GORME"],
  LIFESTYLE: ["BESLENME", "ALKOL", "YASAM_TARZI"],
  COMORBIDITIES: ["DIYABET", "BÖBREK_OYKUSU"],
  POLYURIA: ["POLIURI"],
  POLYDIPSIA: ["POLIDIPSI"],
  WEIGHT_CHANGE: ["KILO_KAYBI", "KILO_ALIM"],
  DIABETES_HISTORY: ["DIYABET"],
  FOOT_SYMPTOMS: ["UYUSMA", "YARA"],
  HTN_HISTORY: ["HT_OYKUSU"],
  DIABETES: ["DIYABET"],
  URINARY: ["IDRAR_AZALMA", "IDRAR_RENK"],
  COUGH: ["OKSURUK"],
  FEVER: ["ATES_SORGU", "ATES_SURE"],
  SMOKING: ["SIGARA", "SIGARA_OYKUSU"],
  EXACERBATIONS: ["BALGAM"],
  WHEEZE: ["FIZIK_AKCIGER"],
  NIGHT_SYMPTOMS: ["GECE_ARTIS"],
  TRIGGERS: ["ALERJI"],
  DYSURIA: ["DIZURI"],
  FREQUENCY: ["POLLAKURI"],
  URINARY_HISTORY: ["IDRAR_RENK"],
  PREGNANCY: ["MENSTRUASYON"],
  BLEEDING: ["KOLAY_MORARMA", "KANLI_DISKI", "MENSTRUASYON"],
  DIET: ["BESLENME"],
  CHRONIC_DISEASE: ["BÖBREK_OYKUSU", "KARACIGER_OYKUSU"],
  NASAL: ["GENIZ_AKINTISI"],
  FACIAL_PAIN: ["BAS_AGRISI"],
  DURATION: ["SIKAYET_SURE"],
  ALLERGIES: ["ALERJI"],
  // Red flag anahtarları → karşılık gelen sorgu/vital çipleri
  HEMODYNAMIC: ["VITAL_TANSIYON", "VITAL_NABIZ"],
  ONGOING_CHEST_PAIN: ["GOGUS_AGRISI"],
  ACS: ["GOGUS_AGRISI"],
  HYPOXIA: ["VITAL_SPO2"],
  HYPERTENSIVE_CRISIS: ["VITAL_TANSIYON", "BAS_AGRISI", "GORME"],
  DKA: ["KUSMA", "KONFUZYON"],
  HYPOGLYCEMIA: ["TITREME", "TERLEME"],
  HYPERKALEMIA: ["HIPERKALEMI_SEMPTOM"],
  PYELONEPHRITIS: ["ATES_SORGU", "SIRT_AGRISI"],
  RESPIRATORY_FAILURE: ["VITAL_SPO2", "NEFES_DARLIGI"],
  SEPSIS: ["VITAL_TANSIYON", "ATES_SORGU"],
  ORBITAL: ["GOZ_AGRISI", "GORME"],
  ACTIVE_BLEEDING: ["KANLI_KUSMA", "KANLI_DISKI", "KOLAY_MORARMA"],
};

/** case-generator ile paralel: vital/öykü çipleri her vakada relevant sayılır. */
const HER_ZAMAN_RELEVANT = [
  "VITAL_TANSIYON", "VITAL_NABIZ", "VITAL_ATES", "VITAL_SPO2",
  "SIGARA", "SIGARA_OYKUSU", "DIYABET", "ILAC", "ILAC_OYKUSU", "ALERJI",
  "SIKAYET", "AILE_OYKUSU",
];

/** Rubrik anahtarlarını koruyarak chip aksiyonlarına eşler (skorlama uyumluluğu). */
function rubrikAksiyonlariniGenislet(rubrikAnahtarlari: string[]): string[] {
  const harcanan = rubrikAnahtarlari.flatMap((key) => RUBRIK_TO_CHIP[key] || []);
  return Array.from(new Set([...rubrikAnahtarlari, ...harcanan, ...HER_ZAMAN_RELEVANT]));
}

/** Admin deposundaki vaka şablonundan oynanabilir Vaka üretir */
export function adminVakaToPlayable(av: AdminVaka): Vaka {  const source = caseVersionStamp(av);
  const cinsiyet: Cinsiyet =
    av.cinsiyetTercih === "E"
      ? "E"
      : av.cinsiyetTercih === "K"
        ? "K"
        : Math.random() > 0.5
          ? "E"
          : "K";
  const yas = rastgeleInt(av.yasAraligi[0], av.yasAraligi[1]);
  const ad = `${cinsiyet === "E" ? ERKEK[rastgeleInt(0, ERKEK.length - 1)] : KADIN[rastgeleInt(0, KADIN.length - 1)]} ${SOY[rastgeleInt(0, SOY.length - 1)]}`;
  const tc = String(10000000000 + rastgeleInt(100000000, 899999999));
  const episodeZamani = Date.now();
  const vakaId = `admin-play-${av.id}-${episodeZamani}`;

  const hasta: Hasta = {
    ad,
    tamAd: ad,
    tc,
    yas,
    cinsiyet,
    anaSikayet: av.anaSikayet,
    ozetBilgiler: av.ozetBilgiler || [],
  };

  const taniListesi = [
    ...(av.rubric?.kabulEdilenTani || []),
    ...(av.conditions || []).map((c) => c.ad),
  ];
  const profile = buildClinicalProfile({
    yas,
    cinsiyet,
    hastalikKey: av.hastalikKey,
    taniListesi,
    poliklinikKey: av.poliklinikKey,
    comorbidities: av.patientProfil?.komorbiditeler,
  });
  if (av.patientProfil?.bmi != null) {
    profile.bmi = av.patientProfil.bmi;
  }

  const original = { ...(av.statikTestler || {}), ...(av.generatedTests || {}) };
  const statikTestler = birlestirTestler(original, profile, {
    patientId: tc,
    episodeId: vakaId,
    measuredAt: episodeZamani,
  });

  const relevantAksiyonlar = rubrikAksiyonlariniGenislet([
    ...(av.rubric?.beklenenSorular || []).map((s) => s.key),
    ...(av.rubric?.redFlagler || []).map((r) => r.key),
    ...(av.rubric?.beklenenTestler || []).map((t) => t.key),
  ]);

  // CDM vitals → ozetBilgiler / yanıt zenginleştirme
  const ozet = [...(av.ozetBilgiler || [])];
  if (av.vitals?.tansiyon && !ozet.some((x) => /tansiyon|kb/i.test(x))) {
    ozet.push(`KB: ${av.vitals.tansiyon}`);
  }
  if (av.patientProfil?.komorbiditeler?.length) {
    const kom = `Komorbidite: ${av.patientProfil.komorbiditeler.join(", ")}`;
    if (!ozet.includes(kom)) ozet.push(kom);
  }
  hasta.ozetBilgiler = ozet;

  const tedavi = av.tedavi
    ? {
        aciklama: av.tedavi.aciklama || av.egitimNotu || "",
        ilaclar: (av.tedavi.ilaclar || []).map((i) => ({
          ad: i.ad,
          doz: i.doz,
          yol: i.yol,
          siklik: i.siklik,
          sure: i.sure,
          endikasyon: i.endikasyon,
        })),
        prosedurler: av.tedavi.prosedurler || [],
        notlar: av.tedavi.onemliNotlar || [],
        kaynak: av.cdmVersion || "admin",
      }
    : undefined;

  // Chip havuzu vakanın kendi yanıtlarından türetilir (K1/K2 düzeltmesi):
  // global ~100'lük havuz yerine yalnızca cevabı olan + rubriğin beklediği
  // sorular listelenir; Synthea EN kodları Türkçe chip'e çevrilir.
  const soruChipleri = vakaChipleriniUret(av.hastaYanitlari, relevantAksiyonlar);

  return {
    id: vakaId,
    semptom: av.semptomSablon || av.hastalikAdi,
    hastalik: av.hastalikKey,
    alan: av.poliklinikAd,
    seviye: av.seviye,
    hasta,
    profile,
    episodeZamani,
    beklenenTani: av.rubric?.kabulEdilenTani || [],
    rubric: structuredClone(av.rubric),
    statikTestler,
    soruChipleri,
    hastaYanitlari: enrichHastaYanitlari(av.hastaYanitlari || {}, {
      chipHavuzu: soruChipleri,
      anaSikayet: av.anaSikayet,
      semptom: av.semptomSablon,
    }),
    relevantAksiyonlar,
    idealYol: [...av.idealYol],
    egitimNotu: av.egitimNotu,
    tedavi,
    kaynaklar: [
      `Admin play · ${av.id}`,
      `Durum: ${av.durum} · Sürüm: v${av.surum}`,
      av.cdmVersion ? `CDM: ${av.cdmVersion}` : "CDM: legacy-flat",
    ],
    sourceCaseVersion: source.version,
    sourceCaseChecksum: source.checksum,
    sourceCaseId: av.id,
  };
}
