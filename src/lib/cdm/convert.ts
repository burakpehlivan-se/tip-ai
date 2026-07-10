import {
  AdminVaka,
  normalizeAdminVaka,
  VakaDurum,
} from "../admin/types";
import { Rubric, TestSonucu } from "../types";
import {
  CdmLabResult,
  DEFAULT_CDM_PUANLAMA,
  TipAiCdmDocument,
  TIP_AI_CDM_VERSION,
  TipAiCdmBundle,
} from "./types";
import { canonicalizeTestKey, CONDITION_VOCAB, testAdiForKey } from "./vocabulary";

function normalizeLabEntry(key: string, raw: CdmLabResult | TestSonucu | Record<string, unknown>): TestSonucu {
  const canon = canonicalizeTestKey(key);
  const r = raw as Record<string, unknown>;
  const tip = (r.tip as TestSonucu["tip"]) || "text";
  return {
    testKey: String(r.testKey || canon),
    testAdi: String(r.testAdi || testAdiForKey(canon) || canon),
    tip,
    sonuc: (r.sonuc as TestSonucu["sonuc"]) ?? {},
    referans: r.referans != null ? String(r.referans) : undefined,
    yorum: r.yorum != null ? String(r.yorum) : undefined,
    source: (r.source as TestSonucu["source"]) || "original",
  };
}

function mapRubricActions(
  list: Array<{ key: string; etiket: string; aciklama?: string; kategori?: string }> | undefined
): Rubric["beklenenSorular"] {
  if (!Array.isArray(list)) return [];
  return list.map((a) => ({
    key: String(a.key),
    etiket: String(a.etiket || a.key),
    aciklama: String(a.aciklama || a.etiket || ""),
  }));
}

/** CDM belge → depo AdminVaka (düz + CDM eklentileri) */
export function cdmToAdminVaka(doc: TipAiCdmDocument): AdminVaka {
  const meta = doc.meta;
  const id =
    doc.id ||
    `${meta.poliklinikKey}::${meta.hastalikKey}`.toLowerCase().replace(/\s+/g, "-");

  const labs: Record<string, TestSonucu> = {};
  for (const [k, v] of Object.entries(doc.labs?.statikTestler || {})) {
    const canon = canonicalizeTestKey(k);
    labs[canon] = normalizeLabEntry(canon, v);
  }

  // beklenen test key’lerini canonicalize
  const beklenenTestler = (doc.rubric?.beklenenTestler || []).map((t) => ({
    key: canonicalizeTestKey(t.key),
    etiket: t.etiket || testAdiForKey(canonicalizeTestKey(t.key)) || t.key,
    aciklama: t.aciklama || "",
  }));
  const gereksizTestler = (doc.rubric?.gereksizTestler || []).map((t) => ({
    key: canonicalizeTestKey(t.key),
    etiket: t.etiket || t.key,
    aciklama: t.aciklama || "",
  }));

  // vitals → hastaYanitlari (VITAL_*)
  const yanitlar: Record<string, string> = { ...(doc.hastaYanitlari || {}) };
  if (doc.vitals) {
    if (doc.vitals.tansiyon && !yanitlar.VITAL_TANSIYON) {
      yanitlar.VITAL_TANSIYON = String(doc.vitals.tansiyon);
    }
    if (doc.vitals.nabiz != null && !yanitlar.VITAL_NABIZ) {
      yanitlar.VITAL_NABIZ = String(doc.vitals.nabiz);
    }
    if (doc.vitals.ates != null && !yanitlar.VITAL_ATES) {
      yanitlar.VITAL_ATES = String(doc.vitals.ates);
    }
    if (doc.vitals.spo2 != null && !yanitlar.VITAL_SPO2) {
      yanitlar.VITAL_SPO2 = String(doc.vitals.spo2);
    }
  }
  if (!yanitlar.OZEL) yanitlar.OZEL = "Anlamadım";

  const conditions =
    doc.conditions?.map((c) => ({
      code: c.code,
      ad: c.ad || CONDITION_VOCAB[c.code]?.ad || c.code,
      system: c.system || "local",
      primary: c.primary,
    })) || [];

  // conditions yoksa kabulEdilenTani’den üret
  if (conditions.length === 0 && doc.rubric?.kabulEdilenTani?.length) {
    for (const ad of doc.rubric.kabulEdilenTani.slice(0, 3)) {
      conditions.push({
        code: ad
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 32),
        ad,
        system: "local" as const,
        primary: conditions.length === 0,
      });
    }
  }

  const tedavi = doc.management?.tedavi
    ? {
        ilaclar: (doc.management.tedavi.ilaclar || []).map((d) => ({
          code: d.code,
          ad: d.ad,
          doz: d.doz,
          yol: d.yol,
          endikasyon: d.endikasyon,
        })),
        prosedurler: doc.management.tedavi.prosedurler || [],
        onemliNotlar: doc.management.tedavi.onemliNotlar || [],
        aciklama: doc.management.tedavi.aciklama,
      }
    : undefined;

  const now = Date.now();
  return normalizeAdminVaka({
    id,
    poliklinikKey: meta.poliklinikKey,
    poliklinikAd: meta.poliklinikAd,
    poliklinikIcon: meta.poliklinikIcon || "🏥",
    poliklinikAciklama: meta.poliklinikAciklama || "",
    hastalikKey: meta.hastalikKey,
    hastalikAdi: meta.hastalikAdi,
    seviye: meta.seviye || "orta",
    yasAraligi: doc.patient.yasAraligi,
    cinsiyetTercih: doc.patient.cinsiyetTercih || "herhangi",
    anaSikayet: doc.presentation.anaSikayet,
    ozetBilgiler: doc.presentation.ozetBilgiler || [],
    semptomSablon: doc.presentation.semptomSablon || meta.hastalikAdi,
    rubric: {
      beklenenSorular: mapRubricActions(doc.rubric.beklenenSorular),
      beklenenTestler: mapRubricActions(beklenenTestler),
      gereksizTestler: mapRubricActions(gereksizTestler),
      redFlagler: mapRubricActions(doc.rubric.redFlagler),
      kabulEdilenTani: doc.rubric.kabulEdilenTani || [meta.hastalikAdi],
      puanlama: {
        ...DEFAULT_CDM_PUANLAMA,
        ...(doc.rubric.puanlama || {}),
      },
    },
    statikTestler: labs,
    generatedTests: doc.labs?.generatedTests,
    hastaYanitlari: yanitlar,
    idealYol: doc.management?.idealYol || [],
    egitimNotu: doc.management?.egitimNotu || "",
    durum: (meta.durum as VakaDurum) || "taslak",
    etiketler: (meta.etiketler as string[]) || ["Poliklinik"],
    surum: meta.surum ?? 1,
    uzmanOnayi: meta.uzmanOnayi ?? false,
    uzmanOnaylayan: meta.uzmanOnaylayan,
    uzmanOnayTarihi: meta.uzmanOnayTarihi,
    createdAt: meta.createdAt || now,
    updatedAt: meta.updatedAt || now,
    // CDM extensions
    cdmVersion: TIP_AI_CDM_VERSION,
    patientProfil: doc.patient.profil,
    vitals: doc.vitals,
    conditions,
    tedavi,
  });
}

/** AdminVaka → CDM belge (export / yazar görünümü) */
export function adminVakaToCdm(av: AdminVaka): TipAiCdmDocument {
  const conditions =
    av.conditions && av.conditions.length > 0
      ? av.conditions
      : (av.rubric?.kabulEdilenTani || []).map((ad, i) => ({
          code: ad
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .slice(0, 32),
          ad,
          system: "local" as const,
          primary: i === 0,
        }));

  const labs: Record<string, CdmLabResult> = {};
  for (const [k, t] of Object.entries(av.statikTestler || {})) {
    const canon = canonicalizeTestKey(k);
    labs[canon] = {
      testKey: t.testKey || canon,
      testAdi: t.testAdi,
      tip: t.tip,
      sonuc: t.sonuc,
      referans: t.referans,
      yorum: t.yorum,
      source: t.source || "original",
      flag: "unknown",
    };
  }
  // Pipeline tarafından üretilen (generatedTests) sonuçlar
  for (const [k, t] of Object.entries(av.generatedTests || {})) {
    const canon = canonicalizeTestKey(k);
    if (labs[canon]) continue; // statik kazanır
    labs[canon] = {
      testKey: t.testKey || canon,
      testAdi: t.testAdi,
      tip: t.tip,
      sonuc: t.sonuc,
      referans: t.referans,
      yorum: t.yorum,
      source: t.source || "synthetic",
      flag: "unknown",
    };
  }

  return {
    cdmVersion: TIP_AI_CDM_VERSION,
    id: av.id,
    meta: {
      poliklinikKey: av.poliklinikKey,
      poliklinikAd: av.poliklinikAd,
      poliklinikIcon: av.poliklinikIcon,
      poliklinikAciklama: av.poliklinikAciklama,
      hastalikKey: av.hastalikKey,
      hastalikAdi: av.hastalikAdi,
      seviye: av.seviye,
      durum: av.durum,
      etiketler: av.etiketler,
      surum: av.surum,
      uzmanOnayi: av.uzmanOnayi,
      uzmanOnaylayan: av.uzmanOnaylayan,
      uzmanOnayTarihi: av.uzmanOnayTarihi,
      createdAt: av.createdAt,
      updatedAt: av.updatedAt,
    },
    patient: {
      yasAraligi: av.yasAraligi,
      cinsiyetTercih: av.cinsiyetTercih,
      profil: av.patientProfil,
    },
    presentation: {
      anaSikayet: av.anaSikayet,
      ozetBilgiler: av.ozetBilgiler || [],
      semptomSablon: av.semptomSablon,
    },
    conditions,
    rubric: {
      beklenenSorular: (av.rubric?.beklenenSorular || []).map((s) => ({
        key: s.key,
        etiket: s.etiket,
        aciklama: s.aciklama,
      })),
      beklenenTestler: (av.rubric?.beklenenTestler || []).map((t) => ({
        key: canonicalizeTestKey(t.key),
        etiket: t.etiket,
        aciklama: t.aciklama,
      })),
      gereksizTestler: (av.rubric?.gereksizTestler || []).map((t) => ({
        key: canonicalizeTestKey(t.key),
        etiket: t.etiket,
        aciklama: t.aciklama,
      })),
      redFlagler: (av.rubric?.redFlagler || []).map((r) => ({
        key: r.key,
        etiket: r.etiket,
        aciklama: r.aciklama,
      })),
      kabulEdilenTani: av.rubric?.kabulEdilenTani || [],
      puanlama: { ...DEFAULT_CDM_PUANLAMA, ...(av.rubric?.puanlama || {}) },
    },
      labs: { statikTestler: labs, generatedTests: av.generatedTests },
    vitals: av.vitals,
    hastaYanitlari: av.hastaYanitlari || {},
    management: {
      idealYol: av.idealYol || [],
      egitimNotu: av.egitimNotu || "",
      tedavi: av.tedavi
        ? {
            ilaclar: av.tedavi.ilaclar,
            prosedurler: av.tedavi.prosedurler,
            onemliNotlar: av.tedavi.onemliNotlar,
            aciklama: av.tedavi.aciklama,
          }
        : undefined,
    },
  };
}

export function adminCasesToCdmBundle(cases: AdminVaka[]): TipAiCdmBundle {
  return {
    format: "tip_ai_cdm_bundle",
    cdmVersion: TIP_AI_CDM_VERSION,
    exportedAt: new Date().toISOString(),
    caseCount: cases.length,
    cases: cases.map(adminVakaToCdm),
  };
}

/** Ham JSON: tek belge veya bundle veya { cases: [...] } */
export function parseCdmInput(raw: unknown): TipAiCdmDocument[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Geçersiz JSON kökü.");
  }
  const o = raw as Record<string, unknown>;

  if (o.format === "tip_ai_cdm_bundle" && Array.isArray(o.cases)) {
    return o.cases as TipAiCdmDocument[];
  }
  if (Array.isArray(o.cases)) {
    return o.cases as TipAiCdmDocument[];
  }
  if (o.meta || o.presentation || o.labs) {
    return [o as unknown as TipAiCdmDocument];
  }
  throw new Error(
    "CDM girişi tanınmadı. tip-ai-cdm-v1 belge, bundle veya { cases: [...] } bekleniyor."
  );
}
