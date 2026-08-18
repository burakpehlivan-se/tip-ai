import { listRuntimeCasesGrouped } from "@/lib/admin/runtime-case-store";

/**
 * Vaka numarası sistemi.
 *
 * Format: 4 haneli sayı = poliklinik sırası (2 hane) + poliklinik içi vaka
 * sırası (2 hane). Örn. "0307" = 3. poliklinik, 7. vaka.
 *
 * Poliklinik sırası: `listRuntimeCasesGrouped` ile birebir aynı alfabetik
 * sıralamaya göre üretilir; böylece öğrenci ekranında 3. sırada görünen
 * poliklinik, vaka numarasında da 03 olur. Vaka sırası: vaka deposundaki
 * (cases.json / postgres) poliklinik içi görünüm sırasına göredir.
 */

export interface VakaNoAyrismasi {
  poliklinikSira: number;
  vakaSira: number;
}

export function parseVakaNo(vakaNo: string): VakaNoAyrismasi | null {
  if (!/^\d{4}$/.test(vakaNo)) return null;
  const poliklinikSira = Number(vakaNo.slice(0, 2));
  const vakaSira = Number(vakaNo.slice(2));
  if (poliklinikSira < 1 || vakaSira < 1) return null;
  return { poliklinikSira, vakaSira };
}

/** caseId → "0307" biçiminde vaka numarası. Vaka bulunamazsa null. */
export async function vakaNoFromCaseId(caseId: string): Promise<string | null> {
  const groups = await listRuntimeCasesGrouped();
  for (let i = 0; i < groups.length; i++) {
    const vakaIndex = groups[i].cases.findIndex((vaka) => vaka.id === caseId);
    if (vakaIndex >= 0) return `${String(i + 1).padStart(2, "0")}${String(vakaIndex + 1).padStart(2, "0")}`;
  }
  return null;
}

/** "0307" → vaka kimliği + poliklinik anahtarı. Geçersizse null. */
export async function caseIdFromVakaNo(
  vakaNo: string
): Promise<{ caseId: string; poliklinikKey: string } | null> {
  const parsed = parseVakaNo(vakaNo);
  if (!parsed) return null;
  const groups = await listRuntimeCasesGrouped();
  const group = groups[parsed.poliklinikSira - 1];
  if (!group) return null;
  const vaka = group.cases[parsed.vakaSira - 1];
  if (!vaka) return null;
  return { caseId: vaka.id, poliklinikKey: group.poliklinikKey };
}
