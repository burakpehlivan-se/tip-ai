/**
 * PTB-XL eşleştirme — sentetik vaka tanısı (SCP kodu) + yaş + cinsiyet ile
 * gerçek 12-derivasyonlu EKG kaydını deterministik olarak seçer.
 *
 * Saf modül: dosya/DB erişimi yoktur; çağıran PtbxlRow[] dizisini verir.
 */

/** PTB-XL'de bilinmeyen yaşın temsil biçimi. */
export const PTBXL_UNKNOWN_AGE = 300;

export interface PtbxlRow {
  ecgId: number;
  /** Kayıttaki SCP kodları (aktif olanlar: değer > 0). */
  codes: Record<string, number>;
  /** Yıllar; bilinmiyorsa null. */
  age: number | null;
  gender: "M" | "F";
  /** CSV'deki filename_lr (örn. "records100/00000/00001_lr"). */
  filename: string;
}

export interface EkgMatchRule {
  /** Kayıtta bulunması gereken SCP kodları (hepsi). */
  requiredCodes: string[];
  /** Kayıtta bulunması gereken SCP kodları (en az biri). */
  anyOfCodes?: string[];
  /** Kayıtta bulunmaması gereken SCP kodları (ör. kalp pili artefaktı). */
  excludeCodes: string[];
  /** Bulgu etiketi — yorum metninde gösterilir. */
  findingLabel: string;
}

/** Vaka → EKG kuralı. Tanı birebir uyumlu kayıt garantiler. */
export const CASE_TO_EKG_RULE: Record<string, EkgMatchRule> = {
  "kardiyoloji::stemi": {
    requiredCodes: ["IMI"],
    excludeCodes: ["PACE", "CLBBB"],
    findingLabel: "İnferior miyokard infarktüsü (ST elevasyon)",
  },
  "kardiyoloji::nstemi": {
    requiredCodes: [],
    anyOfCodes: ["ISC_", "ISCAL", "ISCIN", "ISCIL", "ISCAS", "NST_"],
    excludeCodes: ["PACE", "CLBBB", "IMI", "ASMI", "ILMI", "AMI", "ALMI"],
    findingLabel: "Non-ST elevasyonlu MI (iskemi)",
  },
  "kardiyoloji::kalp-yetmezligi": {
    requiredCodes: ["LVH", "ASMI"],
    excludeCodes: ["PACE", "CLBBB"],
    findingLabel: "Sol ventrikül hipertrofisi + eski anteroseptal MI",
  },
  "kardiyoloji::atriyal-fibrilasyon": {
    requiredCodes: ["AFIB"],
    excludeCodes: [],
    findingLabel: "Atriyal fibrilasyon",
  },
  "kardiyoloji::stabil-angina": {
    requiredCodes: ["NORM"],
    excludeCodes: [
      "IMI", "ASMI", "ILMI", "AMI", "ALMI", "ISC_", "ISCAL", "ISCIN", "ISCIL",
      "ISCAS", "NST_", "NDT", "LVH", "RVH", "AFIB", "FLUT", "STACH", "SBRAD",
      "1AVB", "CRBBB", "CLBBB", "IRBBB", "LAFB", "IVCD", "WPW", "LNGQT", "PACE", "PVC",
    ],
    findingLabel: "Normal sinüs ritmi",
  },
  "ortopedi::kalca-kirigi": {
    requiredCodes: ["NORM"],
    excludeCodes: [
      "IMI", "ASMI", "ILMI", "AMI", "ALMI", "ISC_", "ISCAL", "ISCIN", "ISCIL",
      "ISCAS", "NST_", "NDT", "LVH", "RVH", "AFIB", "FLUT", "STACH", "SBRAD",
      "1AVB", "CRBBB", "CLBBB", "IRBBB", "LAFB", "IVCD", "WPW", "LNGQT", "PACE", "PVC",
    ],
    findingLabel: "Normal sinüs ritmi",
  },
  "kvc::aort-anevrizmasi": {
    requiredCodes: ["NORM"],
    excludeCodes: [
      "IMI", "ASMI", "ILMI", "AMI", "ALMI", "ISC_", "ISCAL", "ISCIN", "ISCIL",
      "ISCAS", "NST_", "NDT", "LVH", "RVH", "AFIB", "FLUT", "STACH", "SBRAD",
      "1AVB", "CRBBB", "CLBBB", "IRBBB", "LAFB", "IVCD", "WPW", "LNGQT", "PACE", "PVC",
    ],
    findingLabel: "Normal sinüs ritmi",
  },
  "kvc::periferik-arter": {
    requiredCodes: ["NORM"],
    excludeCodes: [
      "IMI", "ASMI", "ILMI", "AMI", "ALMI", "ISC_", "ISCAL", "ISCIN", "ISCIL",
      "ISCAS", "NST_", "NDT", "LVH", "RVH", "AFIB", "FLUT", "STACH", "SBRAD",
      "1AVB", "CRBBB", "CLBBB", "IRBBB", "LAFB", "IVCD", "WPW", "LNGQT", "PACE", "PVC",
    ],
    findingLabel: "Normal sinüs ritmi",
  },
};

/** Vaka için eşleşme kuralını döndürür; tanımsızsa null. */
export function ekgRuleForCase(caseId: string): EkgMatchRule | null {
  return CASE_TO_EKG_RULE[caseId] ?? null;
}

function hasActiveCode(codes: Record<string, number>, code: string): boolean {
  return (codes[code] ?? 0) > 0;
}

/** Kural + cinsiyet + yaş aralığı (+sınır payı) filtresiyle aday kayıtları döndürür. */
export function ekgCandidates(
  rows: PtbxlRow[],
  rule: EkgMatchRule,
  gender: "M" | "F" | null,
  ageRange: [number, number] | null
): PtbxlRow[] {
  return rows.filter((r) => {
    for (const code of rule.requiredCodes) if (!hasActiveCode(r.codes, code)) return false;
    if (rule.anyOfCodes?.length) {
      if (!rule.anyOfCodes.some((code) => hasActiveCode(r.codes, code))) return false;
    }
    for (const code of rule.excludeCodes) if (hasActiveCode(r.codes, code)) return false;
    if (gender && r.gender !== gender) return false;
    if (ageRange && r.age != null && r.age !== PTBXL_UNKNOWN_AGE) {
      const [lo, hi] = ageRange;
      if (r.age < lo - 5 || r.age > hi + 5) return false;
    }
    return true;
  });
}

/** FNV-1a — kararlı seçim için deterministik hash (chestxray ile aynı). */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Kararlı seçim: aynı tohum her zaman aynı kaydı verir. */
export function pickEkgDeterministic(rows: PtbxlRow[], seed: string): PtbxlRow | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.ecgId - b.ecgId);
  return sorted[fnv1a(seed) % sorted.length];
}

export interface EkgMatch {
  ecgId: number;
  label: string;
}

/**
 * Vaka için kuralı uygular; cinsiyet/yaş filtresiyle daraltılmış adaylardan
 * deterministik kayıt seçer. Aday kalmadığında önce cinsiyet, sonra yaş
 * filtresi gevşetilir (tek aday kalsa bile tanı uyumu korunur).
 */
export function matchEkg(
  rows: PtbxlRow[],
  rule: EkgMatchRule,
  gender: "M" | "F" | null,
  ageRange: [number, number] | null,
  seed: string
): EkgMatch | null {
  const exact = ekgCandidates(rows, rule, gender, ageRange);
  if (exact.length) {
    const picked = pickEkgDeterministic(exact, seed);
    return picked ? { ecgId: picked.ecgId, label: rule.findingLabel } : null;
  }
  const genderOnly = ekgCandidates(rows, rule, gender, null);
  if (genderOnly.length) {
    const picked = pickEkgDeterministic(genderOnly, seed);
    return picked ? { ecgId: picked.ecgId, label: rule.findingLabel } : null;
  }
  const any = ekgCandidates(rows, rule, null, null);
  if (!any.length) return null;
  const picked = pickEkgDeterministic(any, seed);
  return picked ? { ecgId: picked.ecgId, label: rule.findingLabel } : null;
}