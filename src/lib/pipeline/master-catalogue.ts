/**
 * Layer 1 — Master Catalogue (Test Sözlüğü Standardizasyonu)
 *
 * Tüm test key'lerini tek kaynakta toplar ve sınıflandırır:
 *   - rubric.beklenenTestler / gereksizTestler key'leri
 *   - statikTestler key'leri
 *   - Master Catalogue (LAB_TEST_DEFINITIONS + LAB_REFERANSLAR + birlesikTestKatalogu)
 *   - Alias'lar (TEST_KEY_ALIASES + birlesikTestSynonymleri)
 *
 * Bu katalogun dışındaki hiçbir test sisteme kabul edilmez.
 */

import { LAB_TEST_DEFINITIONS } from "../data/lab-katalog";
import { LAB_REFERANSLAR } from "../data/clinical-reference";
import { birlesikTestKatalogu } from "../data";
import { TEST_KEY_ALIASES, canonicalizeTestKey } from "../cdm/vocabulary";
import { birlesikTestSynonymleri } from "../data/index";
import { AdminVaka } from "../admin/types";
import {
  GenerationStrategy,
  TestCatalogueEntry,
  TestCategory,
  TestInventory,
  TestResultKind,
  TestVisibility,
  TestTier,
} from "./types";

// ─── Kategori eşlemesi ───
const IMAGING_KATEGORILER = new Set(["Radyoloji"]);
const PROCEDURE_KATEGORILER = new Set(["Patoloji"]);

function categoryForKategori(kategori: string): TestCategory {
  if (IMAGING_KATEGORILER.has(kategori)) return "imaging";
  if (PROCEDURE_KATEGORILER.has(kategori)) return "procedure";
  return "lab";
}

function resultKindFor(unit: string, tip: string): TestResultKind {
  if (unit === "rapor") return "report";
  if (unit === "panel" || tip === "json") return "panel";
  return "numeric";
}

/** Unit == rapor (görüntüleme/patoloji) → motor dokunmaz, yazar statik eklemeli */
function strategyFor(
  unit: string,
  tip: string,
  pathology: string[]
): GenerationStrategy {
  if (unit === "rapor") return "never_generate";
  if (pathology && pathology.length > 0) return "depends_on_profile";
  return "always_normal";
}

const PANEL_NAMELER: Record<string, string> = {
  CBC: "CBC",
  ELEKTROLIT: "BMP",
  KOLESTEROL: "LIPID",
  IDRAR: "UA",
  ABG: "ABG",
  DEMIR: "DEMIR",
  KARACIGER_ENZIM: "LFT",
  PT: "KOAG",
};

function buildMasterCatalogue(): Record<string, TestCatalogueEntry> {
  const map = new Map<string, TestCatalogueEntry>();

  // 1) LAB_TEST_DEFINITIONS (en zengin: ref aralık + patoloji + tip)
  for (const d of LAB_TEST_DEFINITIONS) {
    const refRangeMale: [number, number] | null = d.refRangeMale ?? null;
    const refRangeFemale: [number, number] | null = d.refRangeFemale ?? null;
    const unit = d.unit || "";
    const tip = d.tip || "text";
    const category = categoryForKategori(d.kategori);
    map.set(d.code, {
      key: d.code,
      name: d.name,
      unit,
      category,
      resultKind: resultKindFor(unit, tip),
      panel: PANEL_NAMELER[d.code] || null,
      type: tip as TestCatalogueEntry["type"],
      refRangeMale,
      refRangeFemale,
      pathologyDiagnoses: d.pathologyDiagnoses || [],
      generationStrategy: strategyFor(unit, tip, d.pathologyDiagnoses || []),
    });
  }

  // 2) LAB_REFERANSLAR (referans aralıklı, bazen katalogda olmayan key'ler)
  for (const r of LAB_REFERANSLAR) {
    const existing = map.get(r.testKey);
    const unit = r.birim || existing?.unit || "";
    const kategori =
      existing?.category || categoryForKategori(r.kategori);
    const refMale: [number, number] | null = r.kritikAlt != null
      ? [r.normalAlt, r.normalUst]
      : [r.normalAlt, r.normalUst];
    if (existing) {
      existing.refRangeMale = refMale;
      existing.refRangeFemale = refMale;
      existing.unit = unit || existing.unit;
      continue;
    }
    map.set(r.testKey, {
      key: r.testKey,
      name: r.testAdi,
      unit,
      category: kategori,
      resultKind: resultKindFor(unit, "text"),
      panel: PANEL_NAMELER[r.testKey] || null,
      type: "numeric",
      refRangeMale: refMale,
      refRangeFemale: refMale,
      pathologyDiagnoses: [],
      generationStrategy: strategyFor(unit, "text", []),
    });
  }

  // 3) birlesikTestKatalogu (UI katalogu; ad + kategori tamamlar)
  for (const k of birlesikTestKatalogu) {
    const existing = map.get(k.key);
    if (existing) {
      if (!existing.name || existing.name === existing.key) existing.name = k.ad;
      if (existing.category === "lab" && k.kategori && k.kategori !== "Laboratuvar") {
        existing.category = categoryForKategori(k.kategori);
        if (existing.category === "imaging" || existing.category === "procedure") {
          existing.generationStrategy = "never_generate";
          existing.resultKind = "report";
        }
      }
      continue;
    }
    const unit =
      LAB_REFERANSLAR.find((r) => r.testKey === k.key)?.birim || "";
    const category = categoryForKategori(k.kategori);
    map.set(k.key, {
      key: k.key,
      name: k.ad,
      unit,
      category,
      resultKind: category === "lab" ? "numeric" : "report",
      panel: PANEL_NAMELER[k.key] || null,
      type: category === "lab" ? "numeric" : "text",
      refRangeMale: null,
      refRangeFemale: null,
      pathologyDiagnoses: [],
      generationStrategy:
        category === "lab" ? "always_normal" : "never_generate",
    });
  }

  // 4) visibility + tier ata (klinik sınıflandırma)
  for (const [key, entry] of Array.from(map.entries())) {
    const v = TIER_MAP[key];
    if (v) {
      entry.visibility = v.visibility;
      entry.tier = v.tier;
    } else {
      // Varsayılanlar
      if (entry.category === "imaging" || entry.category === "procedure") {
        entry.visibility = "hidden";
        entry.tier = "advanced";
      } else if (entry.generationStrategy === "never_generate") {
        entry.visibility = "hidden";
        entry.tier = "advanced";
      } else if (entry.pathologyDiagnoses && entry.pathologyDiagnoses.length > 0) {
        entry.visibility = "visible_default";
        entry.tier = "branch";
      } else {
        entry.visibility = "visible_default";
        entry.tier = "core";
      }
    }
  }

  return Object.fromEntries(map.entries());
}

export const MASTER_TEST_CATALOGUE: Record<string, TestCatalogueEntry> =
  buildMasterCatalogue();

export function masterCatalogueKeySet(): Set<string> {
  return new Set(Object.keys(MASTER_TEST_CATALOGUE));
}

export function getCatalogueEntry(key: string): TestCatalogueEntry | undefined {
  return MASTER_TEST_CATALOGUE[canonicalizeTestKey(key)];
}

/** Tüm bilinen alias'lar (canonik → alias değil; alias → canonik) */
export function aliasMap(): Record<string, string> {
  return { ...TEST_KEY_ALIASES, ...invertSynonyms(birlesikTestSynonymleri) };
}

function invertSynonyms(syn: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [alias, canon] of Object.entries(syn)) {
    if (canonicalizeTestKey(alias) !== canon) out[canonicalizeTestKey(alias)] = canon;
  }
  return out;
}

// ─── visibility + tier klinik sınıflandırma ───
const _vis = (v: TestVisibility, t: TestTier) => ({ visibility: v, tier: t });
const _def = (t: TestTier = "core" as TestTier) => _vis("visible_default" as TestVisibility, t);
const _adv = (t: TestTier = "advanced" as TestTier) => _vis("visible_advanced" as TestVisibility, t);
const _hid = _vis("hidden" as TestVisibility, "advanced" as TestTier);

const TIER_MAP: Record<string, { visibility: TestVisibility; tier: TestTier }> = {
  // ── Çekirdek (core) — her zaman görünür, tüm vakalarda temel ──
  CBC: _def("core"), WBC: _def("core"), HGB: _def("core"), PLT: _def("core"),
  HCT: _def("core"), MCV: _def("core"), RBC: _def("core"),
  GLUKOZ: _def("core"), HBA1C: _def("core"),
  KREATININ: _def("core"), BUN: _def("core"), URE: _def("core"),
  NA: _def("core"), K: _def("core"), GFR: _def("core"),
  ALT: _def("core"), AST: _def("core"), TBIL: _def("core"),
  CRP: _def("core"), ESR: _def("core"),
  TSH: _def("core"), FT4: _def("core"),
  TROPONIN: _def("core"), BNP: _def("core"),
  EKG: _def("core"), AKCIGER_GRAFISI: _def("core"),
  IDRAR: _def("core"), ABG: _def("core"),
  KOLESTEROL: _def("core"), ELEKTROLIT: _def("core"),
  KARACIGER_ENZIM: _def("core"),

  // ── Branş (branch) — poliklinik bağlamında, "gelişmiş mod"da görünür ──
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

  // ── Gelişmiş (advanced) — nadir/ileri, isteğe bağlı ──
  BT_TORAKS: _hid, BT_ABDOMEN: _hid, BT_KRANIYAL: _hid,
  USG_ABDOMEN: _hid, PELVIK_USG: _hid,
  MAMOGRAFI: _hid, MEME_USG: _hid, BIYOPSI: _hid,
};

/**
 * Layer 1.1 — Test envanteri üret.
 * rubric + statik + katalog kullanımlarını tarar.
 */
export function buildTestInventory(cases: AdminVaka[]): TestInventory {
  const known = masterCatalogueKeySet();
  const usage = new Map<
    string,
    {
      usedInRubric: boolean;
      usedInStatic: boolean;
      usedInCatalogue: boolean;
      vakaIds: Set<string>;
    }
  >();

  const bump = (key: string, field: "rubric" | "static") => {
    const canon = canonicalizeTestKey(key);
    if (!usage.has(canon)) {
      usage.set(canon, {
        usedInRubric: false,
        usedInStatic: false,
        usedInCatalogue: known.has(canon),
        vakaIds: new Set(),
      });
    }
    const u = usage.get(canon)!;
    if (field === "rubric") u.usedInRubric = true;
    else u.usedInStatic = true;
  };

  const unknownUsage = new Map<string, Set<string>>();
  const bumpUnknown = (key: string, vakaId: string) => {
    if (!unknownUsage.has(key)) unknownUsage.set(key, new Set());
    unknownUsage.get(key)!.add(vakaId);
  };

  for (const c of cases) {
    const rubric = c.rubric || ({} as AdminVaka["rubric"]);
    for (const t of [
      ...(rubric.beklenenTestler || []),
      ...(rubric.gereksizTestler || []),
    ]) {
      if (!t?.key) continue;
      const canon = canonicalizeTestKey(t.key);
      if (known.has(canon)) bump(t.key, "rubric");
      else bumpUnknown(t.key, c.id);
    }
    for (const k of Object.keys(c.statikTestler || {})) {
      const canon = canonicalizeTestKey(k);
      if (known.has(canon)) bump(k, "static");
      else bumpUnknown(k, c.id);
    }
  }

  const entries: TestInventory["usage"] = [];
  for (const [key, u] of Array.from(usage.entries())) {
    entries.push({
      testKey: key,
      usedInRubric: u.usedInRubric,
      usedInStatic: u.usedInStatic,
      usedInCatalogue: u.usedInCatalogue,
      vakaIds: Array.from(u.vakaIds),
    });
  }

  const unknownKeys = Array.from(unknownUsage.entries()).map(([key, set]) => ({
    key,
    vakaIds: Array.from(set),
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalKeys: Object.keys(MASTER_TEST_CATALOGUE).length,
    entries: MASTER_TEST_CATALOGUE,
    usage: entries,
    unknownKeys,
  };
}
