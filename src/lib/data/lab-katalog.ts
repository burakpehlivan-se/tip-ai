/**
 * Lab Data Fusion — dataset örnekleme (aralıktan değer üretmez)
 *
 * Dataset 1: vaka şablonu → patoloji testleri (source: "original")
 * Dataset 2: Synthea sample CSV lab-pool → profil eşleşmeli satırlar
 *            (source: "dataset")
 *
 * Join anahtarı: ClinicalProfile (age, sex, diagnoses)
 * Politika: Değerler SADECE lab-pool.json satırlarından gelir.
 *           Referans aralıkları yalnızca etiket/filtre için extract script’te kullanıldı.
 */

import {
  ClinicalProfile,
  LabTestDefinition,
  TestSonucu,
  Cinsiyet,
  TestKaynak,
} from "../types";
import labPool from "./lab-pool.json";

// ─── Tipler (pool satırı) ───

interface PoolRow {
  patientId: string;
  encounterId?: string;
  age: number;
  sex: "F" | "M";
  loinc?: string;
  description?: string;
  unit?: string;
  date?: string;
  source?: string;
  value?: number;
  valueText?: string;
  flag?: string;
  components?: Record<
    string,
    {
      value?: number;
      valueText?: string;
      unit?: string;
      loinc?: string;
      description?: string;
      flag?: string;
    }
  >;
}

interface LabPoolFile {
  meta: Record<string, unknown>;
  analytes: Record<string, PoolRow[]>;
  panels: Record<string, PoolRow[]>;
}

const POOL = labPool as unknown as LabPoolFile;

// ─── Hastalık → patoloji testleri (normal örneklenmez) ───

export const PATOLOJI_TEST_HARITASI: Record<string, string[]> = {
  stemi: ["EKG", "TROPONIN"],
  nstemi: ["EKG", "TROPONIN"],
  "kalp-yetmezligi": ["BNP", "EKG", "AKCIGER_GRAFISI"],
  "atriyal-fibrilasyon": ["EKG"],
  "stabil-angina": ["EKG"],
  "tip-2-diyabet": ["GLUKOZ", "HBA1C", "IDRAR"],
  hipotiroidi: ["TSH", "T4"],
  hipertiroidi: ["TSH", "T4"],
  hipoglisemi: ["GLUKOZ"],
  "diyabetik-noropati": ["GLUKOZ", "HBA1C"],
  pnomoni: ["CBC", "CRP", "AKCIGER_GRAFISI"],
  koah: ["AKCIGER_GRAFISI", "ABG"],
  astim: ["AKCIGER_GRAFISI", "ABG"],
  tbc: ["AKCIGER_GRAFISI", "CRP"],
  "akut-bronsit": ["AKCIGER_GRAFISI", "CRP"],
  kbh: ["KREATININ", "URE", "ELEKTROLIT", "IDRAR"],
  abh: ["KREATININ", "URE", "ELEKTROLIT", "IDRAR"],
  "nefrotik-sendrom": ["IDRAR", "KREATININ", "ELEKTROLIT"],
  "ckd-ev3": ["KREATININ", "ELEKTROLIT", "IDRAR"],
  "meme-kanseri": ["MAMOGRAFI", "MEME_USG", "BIYOPSI"],
  "akciger-kanseri": ["AKCIGER_GRAFISI", "BT_TORAKS"],
  "kolon-kanseri": ["CBC"],
  "demir-eksikligi-anemisi": ["CBC", "FERITIN", "DEMIR"],
  trombositopeni: ["CBC"],
  "hemofili-a": ["PTT"],
  iye: ["IDRAR", "CRP"],
  gastroenterit: ["ELEKTROLIT"],
  "hepatit-b": ["AST", "ALT"],
};

const TANI_ANAHTAR_ESLEME: { match: RegExp; keys: string[] }[] = [
  { match: /diyabet|dm|diabetes/i, keys: ["GLUKOZ", "HBA1C"] },
  { match: /stemi|nstemi|mi\b|enfarkt|acs|koroner/i, keys: ["EKG", "TROPONIN"] },
  { match: /kalp yetmez|ky\b|hf\b|bnp/i, keys: ["BNP", "AKCIGER_GRAFISI"] },
  { match: /hipotiroid/i, keys: ["TSH", "T4"] },
  { match: /hipertiroid|graves/i, keys: ["TSH", "T4"] },
  { match: /pnömoni|pnomoni|pneumonia/i, keys: ["AKCIGER_GRAFISI", "CRP", "CBC"] },
  { match: /koah|copd/i, keys: ["ABG", "AKCIGER_GRAFISI"] },
  { match: /kbh|ckd|böbrek|bobrek|renal/i, keys: ["KREATININ", "URE", "ELEKTROLIT", "IDRAR"] },
  { match: /anemi|demir/i, keys: ["CBC", "FERITIN", "DEMIR"] },
  { match: /hepatit|karaciğer|karaciger/i, keys: ["AST", "ALT"] },
];

/** UI / katalog tanımı — ref aralıkları sadece gösterim; değer üretmez */
export const LAB_TEST_DEFINITIONS: LabTestDefinition[] = [
  { code: "CBC", name: "Hemogram (Tam Kan Sayımı)", unit: "—", kategori: "Laboratuvar", refRangeMale: [13.5, 17.5], refRangeFemale: [12.0, 15.5], tip: "json", sonucSablonu: "cbc" },
  { code: "GLUKOZ", name: "Açlık Kan Şekeri", unit: "mg/dL", kategori: "Endokrin", refRangeMale: [70, 99], refRangeFemale: [70, 99], pathologyDiagnoses: ["tip-2-diyabet", "hipoglisemi", "diyabetik-noropati"], tip: "numeric" },
  { code: "HBA1C", name: "HbA1c (Glikozile Hemoglobin)", unit: "%", kategori: "Endokrin", refRangeMale: [4.0, 5.6], refRangeFemale: [4.0, 5.6], pathologyDiagnoses: ["tip-2-diyabet", "diyabetik-noropati"], tip: "numeric" },
  { code: "KREATININ", name: "Serum Kreatinin", unit: "mg/dL", kategori: "Böbrek", refRangeMale: [0.7, 1.3], refRangeFemale: [0.6, 1.1], pathologyDiagnoses: ["kbh", "abh", "nefrotik-sendrom", "ckd-ev3", "kalp-yetmezligi"], tip: "numeric" },
  { code: "URE", name: "Kan Üre Azotu (BUN)", unit: "mg/dL", kategori: "Böbrek", refRangeMale: [7, 20], refRangeFemale: [7, 20], pathologyDiagnoses: ["kbh", "abh", "ckd-ev3"], tip: "numeric" },
  { code: "ELEKTROLIT", name: "Serum Elektrolitleri (Na/K)", unit: "mmol/L", kategori: "Böbrek", refRangeMale: [135, 145], refRangeFemale: [135, 145], pathologyDiagnoses: ["kbh", "abh", "nefrotik-sendrom", "ckd-ev3"], tip: "json", sonucSablonu: "elektrolit" },
  { code: "AST", name: "AST (SGOT)", unit: "U/L", kategori: "Karaciğer", refRangeMale: [10, 40], refRangeFemale: [10, 35], pathologyDiagnoses: ["hepatit-b"], tip: "numeric" },
  { code: "ALT", name: "ALT (SGPT)", unit: "U/L", kategori: "Karaciğer", refRangeMale: [10, 41], refRangeFemale: [7, 35], pathologyDiagnoses: ["hepatit-b"], tip: "numeric" },
  { code: "TSH", name: "TSH (Tiroid Stimülan Hormon)", unit: "mIU/L", kategori: "Endokrin", refRangeMale: [0.4, 4.0], refRangeFemale: [0.4, 4.0], pathologyDiagnoses: ["hipotiroidi", "hipertiroidi"], tip: "numeric" },
  { code: "T4", name: "Serbest T4", unit: "ng/dL", kategori: "Endokrin", refRangeMale: [0.8, 1.8], refRangeFemale: [0.8, 1.8], pathologyDiagnoses: ["hipotiroidi", "hipertiroidi"], tip: "numeric" },
  { code: "CRP", name: "C-Reaktif Protein (CRP)", unit: "mg/L", kategori: "Enflamasyon", refRangeMale: [0.1, 4.5], refRangeFemale: [0.1, 4.5], pathologyDiagnoses: ["pnomoni", "koah", "tbc", "akut-bronsit", "iye"], tip: "numeric" },
  { code: "TROPONIN", name: "Troponin I", unit: "ng/mL", kategori: "Kardiyak", refRangeMale: [0.0, 0.04], refRangeFemale: [0.0, 0.04], pathologyDiagnoses: ["stemi", "nstemi", "stabil-angina"], tip: "numeric" },
  { code: "BNP", name: "BNP (Beyin Natriüretik Peptid)", unit: "pg/mL", kategori: "Kardiyak", refRangeMale: [5, 90], refRangeFemale: [5, 90], pathologyDiagnoses: ["kalp-yetmezligi"], tip: "numeric" },
  { code: "KOLESTEROL", name: "Lipid Panel", unit: "mg/dL", kategori: "Laboratuvar", refRangeMale: [120, 199], refRangeFemale: [120, 199], pathologyDiagnoses: ["tip-2-diyabet"], tip: "json", sonucSablonu: "lipid" },
  { code: "IDRAR", name: "Tam İdrar Tetkiki", unit: "—", kategori: "Laboratuvar", refRangeMale: [1, 1], refRangeFemale: [1, 1], pathologyDiagnoses: ["tip-2-diyabet", "kbh", "abh", "nefrotik-sendrom", "iye", "ckd-ev3"], tip: "json", sonucSablonu: "idrar" },
  { code: "FERITIN", name: "Ferritin", unit: "ng/mL", kategori: "Hematoloji", refRangeMale: [30, 300], refRangeFemale: [15, 150], pathologyDiagnoses: ["demir-eksikligi-anemisi"], tip: "numeric" },
  { code: "DEMIR", name: "Serum Demir + TDBK", unit: "µg/dL", kategori: "Hematoloji", refRangeMale: [65, 175], refRangeFemale: [50, 170], pathologyDiagnoses: ["demir-eksikligi-anemisi"], tip: "json", sonucSablonu: "text-normal" },
  { code: "D_DIMER", name: "D-Dimer", unit: "ng/mL", kategori: "Hematoloji", refRangeMale: [50, 450], refRangeFemale: [50, 450], tip: "numeric" },
  { code: "PT", name: "PT / INR", unit: "sn", kategori: "Hematoloji", refRangeMale: [11, 13.5], refRangeFemale: [11, 13.5], tip: "json", sonucSablonu: "text-normal" },
  { code: "PTT", name: "aPTT", unit: "sn", kategori: "Hematoloji", refRangeMale: [25, 35], refRangeFemale: [25, 35], pathologyDiagnoses: ["hemofili-a"], tip: "numeric" },
  { code: "ABG", name: "Arteriyel Kan Gazı", unit: "—", kategori: "Solunum", refRangeMale: [7.35, 7.45], refRangeFemale: [7.35, 7.45], pathologyDiagnoses: ["koah", "astim", "pnomoni"], tip: "json", sonucSablonu: "abg" },
];

/** Her vakada mümkün olduğunca dataset’ten doldurulan bazal panel */
export const BAZAL_PANEL: string[] = [
  "CBC",
  "GLUKOZ",
  "KREATININ",
  "URE",
  "ELEKTROLIT",
  "AST",
  "ALT",
  "CRP",
];

export const EK_PANEL_HAVUZU: string[] = [
  "HBA1C",
  "KOLESTEROL",
  "TROPONIN",
  "BNP",
  "IDRAR",
  "FERITIN",
  "DEMIR",
  "D_DIMER",
  "PT",
  "PTT",
];

// ─── Profil eşleştirme / örnekleme ───

export function patolojiTestAnahtarlari(profile: ClinicalProfile): Set<string> {
  const blocked = new Set<string>();
  if (profile.hastalikKey && PATOLOJI_TEST_HARITASI[profile.hastalikKey]) {
    for (const k of PATOLOJI_TEST_HARITASI[profile.hastalikKey]) blocked.add(k);
  }
  for (const dx of profile.diagnoses) {
    for (const rule of TANI_ANAHTAR_ESLEME) {
      if (rule.match.test(dx)) {
        for (const k of rule.keys) blocked.add(k);
      }
    }
  }
  for (const def of LAB_TEST_DEFINITIONS) {
    if (def.pathologyDiagnoses?.includes(profile.hastalikKey || "")) {
      blocked.add(def.code);
    }
  }
  return blocked;
}

function defByCode(code: string): LabTestDefinition | undefined {
  return LAB_TEST_DEFINITIONS.find((d) => d.code === code);
}

/** Yaş ± pencere, aynı cinsiyet, tercihen normal flag */
function scoreRow(row: PoolRow, profile: ClinicalProfile, preferNormal: boolean): number {
  let score = 0;
  if (row.sex === profile.sex) score += 100;
  else score -= 50;

  const ageDiff = Math.abs((row.age ?? 50) - profile.age);
  score += Math.max(0, 40 - ageDiff); // 0 yaş farkı → +40

  if (preferNormal) {
    if (row.flag === "normal") score += 80;
    else if (row.flag === "mixed") score += 10;
    else score -= 30; // abnormal / unknown
  }

  return score;
}

function pickFromPool(
  rows: PoolRow[] | undefined,
  profile: ClinicalProfile,
  preferNormal = true
): PoolRow | null {
  if (!rows || rows.length === 0) return null;

  // 1) aynı cinsiyet + yaş ±15 + normal
  // 2) aynı cinsiyet + yaş ±25
  // 3) en iyi skor (hiç uydurma yok — dataset satırı şart)
  const scored = rows
    .map((r) => ({ r, s: scoreRow(r, profile, preferNormal) }))
    .sort((a, b) => b.s - a.s);

  const topScore = scored[0].s;
  // Eşit en iyi adaylar arasından rastgele (deterministik dağılım için)
  const top = scored.filter((x) => x.s >= topScore - 5).map((x) => x.r);
  if (top.length === 0) return null;
  return top[Math.floor(Math.random() * top.length)];
}

function formatRef(def: LabTestDefinition | undefined, sex: "F" | "M"): string {
  if (!def) return "";
  const [lo, hi] = sex === "F" ? def.refRangeFemale : def.refRangeMale;
  return def.unit && def.unit !== "—" ? `${lo}-${hi} ${def.unit}` : `${lo}-${hi}`;
}

function rowToNumericTest(
  code: string,
  name: string,
  row: PoolRow,
  meta: { patientId: string; episodeId: string; measuredAt: number },
  profile: ClinicalProfile
): TestSonucu | null {
  if (row.value === undefined || row.value === null) return null;
  const def = defByCode(code);
  const unit = row.unit || def?.unit || "";
  const refStr = formatRef(def, profile.sex);

  // hs-Troponin ng/L → kullanıcıya tanıdık birim notu
  let deger = row.value;
  let birim = unit;
  if (code === "TROPONIN" && /ng\/l/i.test(unit)) {
    // ng/L değerini olduğu gibi göster, birimi koru (dataset’ten)
    birim = "ng/L (hs)";
  }

  return {
    testKey: code,
    testAdi: name,
    tip: "numeric",
    sonuc: {
      deger,
      birim,
      referansAralik: refStr || undefined,
      datasetPatientId: row.patientId,
      loinc: row.loinc,
      datasetDate: row.date,
      datasetFlag: row.flag,
    },
    referans: `Synthea lab-pool · LOINC ${row.loinc || "—"} · pt ${row.patientId.slice(0, 8)}… · age=${row.age} sex=${row.sex}`,
    yorum:
      row.flag === "normal"
        ? "Dataset satırı (normal flag) — profil eşleşmeli örnekleme."
        : `Dataset satırı (flag=${row.flag}) — havuzda uygun normal yoksa en yakın satır.`,
    source: "dataset" as TestKaynak,
    patientId: meta.patientId,
    episodeId: meta.episodeId,
    measuredAt: meta.measuredAt,
  };
}

function panelToTest(
  code: string,
  name: string,
  row: PoolRow,
  meta: { patientId: string; episodeId: string; measuredAt: number }
): TestSonucu | null {
  const c = row.components;
  if (!c) return null;

  if (code === "CBC") {
    const sonuc: Record<string, string> = {};
    if (c.HB?.value != null) sonuc.hemoglobin = `${c.HB.value} ${c.HB.unit || "g/dL"}`;
    if (c.WBC?.value != null) sonuc.lokosit = `${c.WBC.value} ${c.WBC.unit || "K/uL"}`;
    if (c.PLT?.value != null) sonuc.trombosit = `${c.PLT.value} ${c.PLT.unit || "K/uL"}`;
    if (c.HCT?.value != null) sonuc.hematokrit = `${c.HCT.value}%`;
    if (c.MCV?.value != null) sonuc.MCV = `${c.MCV.value} fL`;
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "CBC",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea CBC paneli · encounter ${row.encounterId?.slice(0, 8) || "—"}… · age=${row.age} sex=${row.sex}`,
      yorum: "Aynı Synthea encounter’ından bileşik hemogram (dataset).",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  if (code === "ELEKTROLIT") {
    const sonuc: Record<string, string> = {};
    if (c.NA?.value != null) sonuc.sodyum = `${c.NA.value} mmol/L`;
    if (c.K?.value != null) sonuc.potasyum = `${c.K.value} mmol/L`;
    if (c.CL?.value != null) sonuc.klor = `${c.CL.value} mmol/L`;
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "ELEKTROLIT",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea elektrolit · age=${row.age} sex=${row.sex}`,
      yorum: "Dataset encounter paneli.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  if (code === "KOLESTEROL") {
    const sonuc: Record<string, string> = {};
    if (c.KOLESTEROL_TOTAL?.value != null)
      sonuc.totalKolesterol = `${c.KOLESTEROL_TOTAL.value} mg/dL`;
    if (c.LDL?.value != null) sonuc.ldl = `${c.LDL.value} mg/dL`;
    if (c.HDL?.value != null) sonuc.hdl = `${c.HDL.value} mg/dL`;
    if (c.TRIG?.value != null) sonuc.trigliserit = `${c.TRIG.value} mg/dL`;
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "KOLESTEROL",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea lipid paneli · age=${row.age} sex=${row.sex}`,
      yorum: "Dataset encounter paneli.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  if (code === "DEMIR") {
    const sonuc: Record<string, string> = {};
    if (c.DEMIR_SERUM?.value != null)
      sonuc.serumDemir = `${c.DEMIR_SERUM.value} ${c.DEMIR_SERUM.unit || "µg/dL"}`;
    if (c.TDBK?.value != null) sonuc.tdbk = `${c.TDBK.value} ${c.TDBK.unit || "µg/dL"}`;
    if (c.TRANSFERRIN_SAT?.value != null)
      sonuc.transferrinSaturasyonu = `${c.TRANSFERRIN_SAT.value}%`;
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "DEMIR",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea demir paneli · age=${row.age} sex=${row.sex}`,
      yorum: "Dataset encounter paneli.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  if (code === "ABG") {
    const sonuc: Record<string, string> = {};
    if (c.ABG_PH?.value != null) sonuc.pH = String(c.ABG_PH.value);
    if (c.ABG_PCO2?.value != null) sonuc.pCO2 = `${c.ABG_PCO2.value} mmHg`;
    if (c.ABG_PO2?.value != null) sonuc.pO2 = `${c.ABG_PO2.value} mmHg`;
    if (c.ABG_HCO3?.value != null) sonuc.HCO3 = `${c.ABG_HCO3.value} mmol/L`;
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "ABG",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea ABG · age=${row.age} sex=${row.sex}`,
      yorum: "Dataset encounter paneli.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  if (code === "IDRAR") {
    const sonuc: Record<string, string | number> = {};
    if (c.IDRAR_SG?.value != null) sonuc.dansite = String(c.IDRAR_SG.value);
    if (c.IDRAR_PH?.value != null) sonuc.ph = c.IDRAR_PH.value;
    if (c.IDRAR_PROTEIN) sonuc.protein = c.IDRAR_PROTEIN.valueText || String(c.IDRAR_PROTEIN.value ?? "—");
    if (c.IDRAR_GLUKOZ) sonuc.glukoz = c.IDRAR_GLUKOZ.valueText || String(c.IDRAR_GLUKOZ.value ?? "—");
    if (c.IDRAR_LEU) sonuc.lökosit = c.IDRAR_LEU.valueText || "—";
    if (c.IDRAR_NIT) sonuc.nitrit = c.IDRAR_NIT.valueText || "—";
    if (c.IDRAR_KAN) sonuc.kan = c.IDRAR_KAN.valueText || "—";
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "IDRAR",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea idrar · age=${row.age} sex=${row.sex}`,
      yorum: "Dataset encounter paneli.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  if (code === "PT") {
    const sonuc: Record<string, string> = {};
    // PT panel or single
    if (c.PT?.value != null) sonuc.PT = `${c.PT.value} sn`;
    if (c.INR?.value != null) sonuc.INR = String(c.INR.value);
    if (Object.keys(sonuc).length === 0) return null;
    return {
      testKey: "PT",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: `Synthea koagülasyon · age=${row.age} sex=${row.sex}`,
      yorum: "Dataset satırı/paneli.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  return null;
}

/** Tek test kodu için dataset’ten satır çek */
function sampleTest(
  code: string,
  profile: ClinicalProfile,
  meta: { patientId: string; episodeId: string; measuredAt: number }
): TestSonucu | null {
  const def = defByCode(code);
  const name = def?.name || code;

  // Panel testler
  if (code === "CBC" || code === "ELEKTROLIT" || code === "KOLESTEROL" || code === "DEMIR" || code === "ABG" || code === "IDRAR") {
    const panelKey = code;
    const row = pickFromPool(POOL.panels[panelKey], profile, true);
    if (row) {
      const t = panelToTest(code, name, row, meta);
      if (t) return t;
    }
    // CBC paneli yoksa bileşenlerden kurma — bileşenleri ayrı ayrı örnekle, uydurma
    if (code === "CBC") {
      const hb = pickFromPool(POOL.analytes.HB, profile, true);
      const wbc = pickFromPool(POOL.analytes.WBC, profile, true);
      const plt = pickFromPool(POOL.analytes.PLT, profile, true);
      if (!hb && !wbc && !plt) return null;
      const sonuc: Record<string, string> = {};
      if (hb?.value != null) sonuc.hemoglobin = `${hb.value} ${hb.unit || "g/dL"}`;
      if (wbc?.value != null) sonuc.lokosit = `${wbc.value} ${wbc.unit || "K/uL"}`;
      if (plt?.value != null) sonuc.trombosit = `${plt.value} ${plt.unit || "K/uL"}`;
      return {
        testKey: "CBC",
        testAdi: name,
        tip: "json",
        sonuc,
        referans: "Synthea lab-pool · bileşen bazlı örnekleme (aynı panel encounter yok)",
        yorum: "Dataset analit satırlarından birleştirildi (değerler uydurulmadı).",
        source: "dataset",
        patientId: meta.patientId,
        episodeId: meta.episodeId,
        measuredAt: meta.measuredAt,
      };
    }
    return null;
  }

  if (code === "PT") {
    const panel = pickFromPool(POOL.panels.PT_PANEL, profile, true);
    if (panel) {
      const t = panelToTest("PT", name, panel, meta);
      if (t) return t;
    }
    const pt = pickFromPool(POOL.analytes.PT, profile, true);
    const inr = pickFromPool(POOL.analytes.INR, profile, true);
    if (!pt && !inr) return null;
    const sonuc: Record<string, string> = {};
    if (pt?.value != null) sonuc.PT = `${pt.value} sn`;
    if (inr?.value != null) sonuc.INR = String(inr.value);
    return {
      testKey: "PT",
      testAdi: name,
      tip: "json",
      sonuc,
      referans: "Synthea lab-pool · PT/INR",
      yorum: "Dataset satırları.",
      source: "dataset",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  // Analit eşlemesi
  const analyteKey =
    code === "KOLESTEROL"
      ? "KOLESTEROL_TOTAL"
      : code;

  const row = pickFromPool(POOL.analytes[analyteKey], profile, true);
  if (!row) return null;
  return rowToNumericTest(code, name, row, meta, profile);
}

export interface GenerateNormalLabsOptions {
  patientId: string;
  episodeId: string;
  measuredAt?: number;
  existingKeys?: string[];
  ekPanelSayisi?: number;
  onlyCodes?: string[];
}

/**
 * Profille uyumlu NORMAL (veya en yakın) lab satırlarını dataset’ten örnekler.
 * Değer üretmez; pool’da yoksa o testi atlar.
 */
export function generateNormalLabs(
  profile: ClinicalProfile,
  options: GenerateNormalLabsOptions
): Record<string, TestSonucu> {
  const measuredAt = options.measuredAt ?? Date.now();
  const existing = new Set(options.existingKeys || []);
  const blocked = patolojiTestAnahtarlari(profile);
  const out: Record<string, TestSonucu> = {};

  let codes: string[];
  if (options.onlyCodes) {
    codes = options.onlyCodes;
  } else {
    const ekSayi = options.ekPanelSayisi ?? 2 + Math.floor(Math.random() * 3);
    const karisik = [...EK_PANEL_HAVUZU].sort(() => Math.random() - 0.5);
    const ek = karisik.slice(0, ekSayi);
    codes = Array.from(new Set([...BAZAL_PANEL, ...ek]));
  }

  const meta = {
    patientId: options.patientId,
    episodeId: options.episodeId,
    measuredAt,
  };

  for (const code of codes) {
    if (existing.has(code)) continue;
    if (blocked.has(code)) continue;
    // TSH/T4 Synthea sample’da yok → atla (uydurma)
    const sampled = sampleTest(code, profile, meta);
    if (sampled) out[code] = sampled;
  }

  return out;
}

/**
 * Şablon (original) + dataset normal paneli birleştir.
 * Original her zaman kazanır.
 */
export function birlestirTestler(
  original: Record<string, TestSonucu>,
  profile: ClinicalProfile,
  meta: { patientId: string; episodeId: string; measuredAt: number }
): Record<string, TestSonucu> {
  const taggedOriginal: Record<string, TestSonucu> = {};
  for (const [key, test] of Object.entries(original)) {
    taggedOriginal[key] = {
      ...test,
      source: test.source || "original",
      patientId: meta.patientId,
      episodeId: meta.episodeId,
      measuredAt: meta.measuredAt,
    };
  }

  const fromDataset = generateNormalLabs(profile, {
    patientId: meta.patientId,
    episodeId: meta.episodeId,
    measuredAt: meta.measuredAt,
    existingKeys: Object.keys(taggedOriginal),
  });

  return { ...fromDataset, ...taggedOriginal };
}

export function labKatalogListesi(): { key: string; ad: string; kategori: string }[] {
  return LAB_TEST_DEFINITIONS.map((d) => ({
    key: d.code,
    ad: d.name,
    kategori: d.kategori,
  }));
}

export function cinsiyetToSex(c: Cinsiyet): "F" | "M" {
  return c === "K" ? "F" : "M";
}

export function buildClinicalProfile(input: {
  yas: number;
  cinsiyet: Cinsiyet;
  hastalikKey: string;
  taniListesi: string[];
  poliklinikKey?: string;
  comorbidities?: string[];
}): ClinicalProfile {
  return {
    age: input.yas,
    sex: cinsiyetToSex(input.cinsiyet),
    diagnoses: input.taniListesi,
    hastalikKey: input.hastalikKey,
    poliklinikKey: input.poliklinikKey,
    comorbidities: input.comorbidities,
  };
}

/** Debug / UI: pool meta */
export function labPoolMeta(): Record<string, unknown> {
  return POOL.meta || {};
}
