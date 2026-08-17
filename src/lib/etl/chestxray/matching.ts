/**
 * NIH ChestX-ray14 eşleştirme — sentetik tanı (SNOMED) + yaş + cinsiyet ile
 * gerçek göğüs röntgeni görüntüsünü deterministik olarak seçer.
 *
 * Saf modül: dosya/DB erişimi yoktur; çağıran CxrRow[] dizisini verir.
 */

export const SNOMED_TO_CXR_LABEL: Record<string, string> = {
  "233604007": "Pneumonia",
  "87433001": "Emphysema",
  "185086009": "Emphysema", // kronik obstrüktif bronşit
  "254637007": "Mass", // NSCLC
  "254632001": "Mass", // SCLC
  "162573006": "Mass", // şüpheli akciğer CA
  "424132000": "Mass",
  "425048006": "Mass",
  "422968005": "Mass",
  "423121009": "Mass",
  "67811000119102": "Mass",
  "67821000119109": "Mass",
  "67831000119107": "Mass",
  "67841000119103": "Mass",
};

export interface CxrRow {
  imageIndex: string;
  labels: string[];
  gender: "M" | "F";
  age: number;
}

export function cxrLabelForSnomed(snomed: string): string | null {
  return SNOMED_TO_CXR_LABEL[snomed] ?? null;
}

/** Etiket + cinsiyet + yaş (±aralık) filtresiyle aday görüntüleri döndürür. */
export function matchCandidates(
  rows: CxrRow[],
  label: string,
  gender: "M" | "F",
  age: number,
  ageRange = 10
): CxrRow[] {
  return rows.filter(
    (r) => r.labels.includes(label) && r.gender === gender && Math.abs(r.age - age) <= ageRange
  );
}

/** FNV-1a — kararlı seçim için deterministik hash (load-synthea.ts ile aynı). */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Kararlı seçim: aynı tohum her zaman aynı görüntüyü verir. */
export function pickDeterministic(rows: CxrRow[], seed: string): CxrRow | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.imageIndex.localeCompare(b.imageIndex));
  return sorted[fnv1a(seed) % sorted.length];
}

export interface CxrMatch {
  imageIndex: string;
  label: string;
}

/**
 * SNOMED tanı kodlarını sırayla dener; ilk eşleşen etiket için (yaş + cinsiyet
 * filtreli) deterministik bir görüntü seçer.
 */
export function matchChestXray(
  rows: CxrRow[],
  snomedCodes: string[],
  age: number,
  gender: "M" | "F",
  seed: string,
  ageRange = 10
): CxrMatch | null {
  for (const code of snomedCodes) {
    const label = cxrLabelForSnomed(code);
    if (!label) continue;
    const candidates = matchCandidates(rows, label, gender, age, ageRange);
    const picked = pickDeterministic(candidates, seed);
    if (picked) return { imageIndex: picked.imageIndex, label };
  }
  return null;
}
