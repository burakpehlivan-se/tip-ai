import type { TestVisibility, TestTier } from "../pipeline/types";
import { testKatalogu as kalpKatalog } from "./kalp-001";
import { ekTestKatalogu } from "./ek-vakalar";
import { labKatalogListesi } from "./lab-test-definitions";

function katalogBirlestir(
  ...listeler: { key: string; ad: string; kategori: string }[][]
): { key: string; ad: string; kategori: string }[] {
  const map = new Map<string, { key: string; ad: string; kategori: string }>();
  for (const liste of listeler) {
    for (const item of liste) {
      if (!map.has(item.key)) map.set(item.key, item);
    }
  }
  return Array.from(map.values());
}

const ekEksikTestKatalogu: { key: string; ad: string; kategori: string }[] = [
  { key: "KARACIGER_ENZIM", ad: "Karaciğer Enzimleri (AST/ALT)", kategori: "Laboratuvar" },
  { key: "BT_ABDOMEN", ad: "BT Batın", kategori: "Radyoloji" },
  { key: "PELVIK_USG", ad: "Pelvik USG", kategori: "Radyoloji" },
  { key: "BT_KRANIYAL", ad: "BT Kraniyal", kategori: "Radyoloji" },
  { key: "USG_ABDOMEN", ad: "Batın USG", kategori: "Radyoloji" },
  { key: "GOZ_BASINCI", ad: "Göz İçi Basıncı", kategori: "Göz" },
  { key: "KREATININ_KINAZ", ad: "CK (Kreatin Kinaz)", kategori: "Laboratuvar" },
  { key: "BHCG", ad: "Beta-hCG", kategori: "Laboratuvar" },
];

export const birlesikTestKatalogu: { key: string; ad: string; kategori: string }[] =
  katalogBirlestir(kalpKatalog, ekTestKatalogu, labKatalogListesi(), ekEksikTestKatalogu);

// ─── visibility + tier ataması (MASTER_TEST_CATALOGUE ile senkron) ───
const _vis = (v: TestVisibility, t: TestTier) => ({ visibility: v, tier: t });
const _def = (t: TestTier = "core") => _vis("visible_default", t);
const _adv = (t: TestTier = "advanced") => _vis("visible_advanced", t);
const _hid = _vis("hidden", "advanced");

export const TEST_VISIBILITY_MAP: Record<string, { visibility: TestVisibility; tier: TestTier }> = {
  // Çekirdek — her zaman görünür
  CBC: _def(), WBC: _def(), HGB: _def(), PLT: _def(), HCT: _def(), MCV: _def(), RBC: _def(),
  GLUKOZ: _def(), HBA1C: _def(),
  KREATININ: _def(), BUN: _def(), URE: _def(),
  NA: _def(), K: _def(), GFR: _def(),
  ALT: _def(), AST: _def(), TBIL: _def(),
  CRP: _def(), ESR: _def(),
  TSH: _def(), FT4: _def(),
  TROPONIN: _def(), BNP: _def(),
  EKG: _def(), AKCIGER_GRAFISI: _def(),
  IDRAR: _def(), ABG: _def(),
  KOLESTEROL: _def(), ELEKTROLIT: _def(),
  KARACIGER_ENZIM: _def(),
  // Branş — gelişmiş modda görünür
  ALP: _adv("branch"), GGT: _adv("branch"), ALBUMIN: _adv("branch"),
  DBIL: _adv("branch"), AMILAZ: _adv("branch"), LIPAZ: _adv("branch"),
  LACTATE: _adv("branch"), PT: _adv("branch"), PTT: _adv("branch"),
  INR: _adv("branch"), FIBRINOGEN: _adv("branch"), DDIMER: _adv("branch"),
  CKMB: _adv("branch"), MYOGLOBIN: _adv("branch"),
  FT3: _adv("branch"), CA: _adv("branch"), MG: _adv("branch"),
  PHOS: _adv("branch"), CL: _adv("branch"),
  URIC_ACID: _adv("branch"), AMMONIA: _adv("branch"),
  PH: _adv("branch"), PCO2: _adv("branch"), PO2: _adv("branch"),
  HCO3: _adv("branch"), PROCT: _adv("branch"), FERITIN: _adv("branch"),
  DEMIR: _adv("branch"), U_PH: _adv("branch"), U_SG: _adv("branch"),
  U_PROTEIN: _adv("branch"), U_GLUKOZ: _adv("branch"),
  BHCG: _adv("branch"), KREATININ_KINAZ: _adv("branch"),
  NEUT: _adv("branch"), LYMPH: _adv("branch"), EOS: _adv("branch"),
  T4: _adv("branch"), GOZ_BASINCI: _adv("branch"),
  CHOL: _adv("branch"), LDL: _adv("branch"), HDL: _adv("branch"),
  TRIG: _adv("branch"),
  // Gelişmiş / gizli
  BT_TORAKS: _hid, BT_ABDOMEN: _hid, BT_KRANIYAL: _hid,
  USG_ABDOMEN: _hid, PELVIK_USG: _hid,
  MAMOGRAFI: _hid, MEME_USG: _hid, BIYOPSI: _hid,
};

export type TestCatalogItem = {
  key: string;
  ad: string;
  kategori: string;
  visibility: TestVisibility;
  tier: TestTier;
  hasData?: boolean;
};

/** Tüm kataloğu visibility + tier ile döndür (default: hasData core'lar için true) */
export function testCatalogueWithMeta(hasDataKeys?: Set<string>): TestCatalogItem[] {
  return birlesikTestKatalogu.map((t) => {
    const meta = TEST_VISIBILITY_MAP[t.key] || { visibility: "visible_default" as TestVisibility, tier: "core" as TestTier };
    return {
      ...t,
      visibility: meta.visibility,
      tier: meta.tier,
      hasData: hasDataKeys ? hasDataKeys.has(t.key) : meta.tier === "core",
    };
  });
}

/** Lab motorunun güvenilir değer üretebildiği test key'leri (istemci tarafı hasData hesaplama) */
export const MOTOR_CAPABLE_KEYS = new Set<string>([
  "CBC", "WBC", "RBC", "HGB", "HCT", "MCV", "PLT", "NEUT", "LYMPH", "EOS",
  "PT", "PTT", "INR", "FIBRINOGEN", "DDIMER",
  "TROPONIN", "CKMB", "BNP", "MYOGLOBIN",
  "ALT", "AST", "ALP", "GGT", "TBIL", "DBIL", "ALBUMIN",
  "KREATININ", "BUN", "GFR", "URIC_ACID",
  "NA", "K", "CL", "CA", "MG", "PHOS",
  "GLUKOZ", "HBA1C", "LACTATE", "AMMONIA",
  "CHOL", "LDL", "HDL", "TRIG",
  "CRP", "ESR", "PROCT", "FERITIN",
  "AMILAZ", "LIPAZ", "TSH", "FT4", "FT3",
  "PH", "PCO2", "PO2", "HCO3", "ABG",
  "U_PH", "U_SG", "U_PROTEIN", "U_GLUKOZ",
  "IDRAR", "ELEKTROLIT", "KOLESTEROL", "DEMIR",
  "KARACIGER_ENZIM", "KREATININ_KINAZ", "BHCG", "T4", "URE",
  "GOZ_BASINCI",
]);
