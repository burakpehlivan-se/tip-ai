/**
 * Eski düz AdminVaka kayıtlarını TIP-AI CDM v1 şekline yükseltir.
 * - cdmVersion set
 * - conditions doldur (kabulEdilenTani / hastalikAdi)
 * - lab key alias → kanonik
 * - vitals hastaYanitlari VITAL_* alanlarından
 * - hastaYanitlari OZEL fallback
 */

import { AdminVaka, normalizeAdminVaka } from "../admin/types";
import { TestSonucu } from "../types";
import { adminVakaToCdm, cdmToAdminVaka } from "./convert";
import { DEFAULT_CDM_PUANLAMA, TIP_AI_CDM_VERSION } from "./types";
import { canonicalizeTestKey, testAdiForKey } from "./vocabulary";

function vitalsFromYanitlar(
  yanitlar: Record<string, string> | undefined
): AdminVaka["vitals"] | undefined {
  if (!yanitlar) return undefined;
  const v: NonNullable<AdminVaka["vitals"]> = {};
  if (yanitlar.VITAL_TANSIYON) v.tansiyon = yanitlar.VITAL_TANSIYON;
  if (yanitlar.VITAL_NABIZ) {
    const n = Number(String(yanitlar.VITAL_NABIZ).replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n)) v.nabiz = n;
    else v.nabiz = undefined;
  }
  if (yanitlar.VITAL_ATES) {
    const n = Number(String(yanitlar.VITAL_ATES).replace(",", "."));
    if (!Number.isNaN(n)) v.ates = n;
  }
  if (yanitlar.VITAL_SPO2) {
    const n = Number(String(yanitlar.VITAL_SPO2).replace(/[^\d.]/g, ""));
    if (!Number.isNaN(n)) v.spo2 = n;
  }
  if (Object.keys(v).length === 0) return undefined;
  return v;
}

function canonicalizeLabs(
  labs: Record<string, TestSonucu> | undefined
): { labs: Record<string, TestSonucu>; remapped: boolean } {
  const out: Record<string, TestSonucu> = {};
  let remapped = false;
  for (const [k, t] of Object.entries(labs || {})) {
    const canon = canonicalizeTestKey(k);
    if (canon !== k) remapped = true;
    const existing = out[canon];
    const next: TestSonucu = {
      ...t,
      testKey: canon,
      testAdi: t.testAdi || testAdiForKey(canon) || canon,
      source: t.source || "original",
    };
    // Aynı kanonik key çakışırsa original/patoloji olanı koru
    if (!existing || next.source === "original") {
      out[canon] = next;
    }
  }
  return { labs: out, remapped };
}

/** Vaka CDM yükseltmesi gerekiyor mu? */
export function needsCdmUpgrade(c: AdminVaka): boolean {
  if (c.cdmVersion !== TIP_AI_CDM_VERSION) return true;
  for (const k of Object.keys(c.statikTestler || {})) {
    if (canonicalizeTestKey(k) !== k) return true;
  }
  if ((!c.conditions || c.conditions.length === 0) && (c.rubric?.kabulEdilenTani?.length || c.hastalikAdi)) {
    return true;
  }
  if (!c.hastaYanitlari || c.hastaYanitlari.OZEL === undefined) return true;
  // vitals eksik veya eksik alan
  if (
    !c.vitals ||
    !c.vitals.tansiyon ||
    typeof c.vitals.nabiz !== "number" ||
    typeof c.vitals.ates !== "number" ||
    typeof c.vitals.spo2 !== "number"
  ) {
    return true;
  }
  // puanlama eksik skor
  const p = c.rubric?.puanlama || {};
  for (const key of Object.keys(DEFAULT_CDM_PUANLAMA)) {
    if (typeof (p as Record<string, unknown>)[key] !== "number") return true;
  }
  return false;
}

/**
 * Tek vakayı CDM v1 şekline getir (idempotent).
 * İçerik kaybı olmadan yapısal alanları doldurur.
 */
export function upgradeAdminVakaToCdm(c: AdminVaka): { vaka: AdminVaka; changed: boolean } {
  const before = JSON.stringify(normalizeAdminVaka(c));

  // 1) Lab key canonicalize
  const { labs } = canonicalizeLabs(c.statikTestler);

  // 2) Vitals — eksik alanları klinik varsayılanla tamamla (doğrulama için tam set)
  const fromYanit = vitalsFromYanitlar(c.hastaYanitlari);
  const vitalsMerged: NonNullable<AdminVaka["vitals"]> = {
    ...(fromYanit || {}),
    ...(c.vitals || {}),
  };
  // En azından bir vital varsa veya hiç yoksa (legacy) tam set üret
  const hasAnyVital =
    !!vitalsMerged.tansiyon ||
    vitalsMerged.nabiz != null ||
    vitalsMerged.ates != null ||
    vitalsMerged.spo2 != null ||
    vitalsMerged.solunum != null;
  // Legacy vakalarda vitals yoksa klinik varsayılan set (yazar sonra düzenler)
  void hasAnyVital;
  const vitals: AdminVaka["vitals"] = {
    tansiyon: vitalsMerged.tansiyon || "120/80",
    nabiz: vitalsMerged.nabiz ?? 78,
    ates: vitalsMerged.ates ?? 36.6,
    spo2: vitalsMerged.spo2 ?? 98,
    solunum: vitalsMerged.solunum,
  };

  // 3) Yanıtlar
  const hastaYanitlari = { ...(c.hastaYanitlari || {}) };
  if (!hastaYanitlari.OZEL) hastaYanitlari.OZEL = "Anlamadım";
  if (vitals?.tansiyon && !hastaYanitlari.VITAL_TANSIYON) {
    hastaYanitlari.VITAL_TANSIYON = String(vitals.tansiyon);
  }
  if (vitals?.nabiz != null && !hastaYanitlari.VITAL_NABIZ) {
    hastaYanitlari.VITAL_NABIZ = String(vitals.nabiz);
  }
  if (vitals?.ates != null && !hastaYanitlari.VITAL_ATES) {
    hastaYanitlari.VITAL_ATES = String(vitals.ates);
  }
  if (vitals?.spo2 != null && !hastaYanitlari.VITAL_SPO2) {
    hastaYanitlari.VITAL_SPO2 = String(vitals.spo2);
  }

  // 4) Conditions
  let conditions = c.conditions?.length
    ? c.conditions
    : undefined;
  if (!conditions || conditions.length === 0) {
    const tanilar = c.rubric?.kabulEdilenTani?.length
      ? c.rubric.kabulEdilenTani
      : c.hastalikAdi
        ? [c.hastalikAdi]
        : [];
    conditions = tanilar.map((ad, i) => ({
      code: ad
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 32) || `COND_${i + 1}`,
      ad,
      system: "local" as const,
      primary: i === 0,
    }));
  }

  // 5) Rubrik test key canonicalize + puanlama defaults
  const rubric = c.rubric
    ? {
        ...c.rubric,
        beklenenTestler: (c.rubric.beklenenTestler || []).map((t) => ({
          ...t,
          key: canonicalizeTestKey(t.key),
        })),
        gereksizTestler: (c.rubric.gereksizTestler || []).map((t) => ({
          ...t,
          key: canonicalizeTestKey(t.key),
        })),
        puanlama: {
          ...DEFAULT_CDM_PUANLAMA,
          ...(c.rubric.puanlama || {}),
        },
      }
    : c.rubric;

  const partial: AdminVaka = normalizeAdminVaka({
    ...c,
    statikTestler: labs,
    hastaYanitlari,
    vitals,
    conditions,
    rubric,
    cdmVersion: TIP_AI_CDM_VERSION,
    patientProfil: c.patientProfil,
    tedavi: c.tedavi,
  });

  // Round-trip ile CDM belge tutarlılığını garantile (boş alanlar dolar)
  const cdm = adminVakaToCdm(partial);
  if (!cdm.vitals && vitals) cdm.vitals = vitals;
  if (partial.patientProfil) cdm.patient.profil = partial.patientProfil;
  if (partial.tedavi) {
    cdm.management.tedavi = {
      ilaclar: partial.tedavi.ilaclar,
      prosedurler: partial.tedavi.prosedurler,
      onemliNotlar: partial.tedavi.onemliNotlar,
      aciklama: partial.tedavi.aciklama,
    };
  }

  const vaka = cdmToAdminVaka(cdm);
  // kimlik / zaman / poli meta koru
  vaka.id = c.id;
  vaka.createdAt = c.createdAt;
  vaka.updatedAt = c.updatedAt;
  vaka.poliklinikKey = c.poliklinikKey;
  vaka.poliklinikAd = c.poliklinikAd;
  vaka.poliklinikIcon = c.poliklinikIcon;
  vaka.poliklinikAciklama = c.poliklinikAciklama;
  vaka.hastalikKey = c.hastalikKey;

  const after = JSON.stringify(normalizeAdminVaka(vaka));
  return { vaka, changed: before !== after };
}

/** Liste yükseltmesi — kaç vaka değişti */
export function upgradeAllCasesToCdm(cases: AdminVaka[]): {
  cases: AdminVaka[];
  upgradedCount: number;
  upgradedIds: string[];
} {
  const upgradedIds: string[] = [];
  const out = cases.map((c) => {
    if (!needsCdmUpgrade(c) && c.cdmVersion === TIP_AI_CDM_VERSION) {
      // Yine de canonicalize kontrolü
      const { vaka, changed } = upgradeAdminVakaToCdm(c);
      if (changed) upgradedIds.push(c.id);
      return vaka;
    }
    const { vaka, changed } = upgradeAdminVakaToCdm(c);
    if (changed || c.cdmVersion !== TIP_AI_CDM_VERSION) upgradedIds.push(c.id);
    return vaka;
  });
  return {
    cases: out,
    upgradedCount: upgradedIds.length,
    upgradedIds,
  };
}
