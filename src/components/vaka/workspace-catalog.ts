import { birlesikTestKatalogu, TEST_VISIBILITY_MAP, MOTOR_CAPABLE_KEYS } from "@/lib/data/test-catalogue";
import { humanizeKey, type TestSonucu, type Vaka } from "@/lib/types";

export interface DebugTestEnvanterItem {
  key: string;
  ad: string;
  kategori: string;
  sonuc: TestSonucu | undefined;
  hasSonuc: boolean;
  beklenen: boolean;
  gereksiz: boolean;
  source: TestSonucu["source"];
}

export interface DebugTestEnvanteri {
  items: DebugTestEnvanterItem[];
  sonucuVar: number;
  sonucuYok: number;
}

/** Workspace: hangi testlerin tetkik kataloğunda gösterileceği — saf. */
export function hasDataKeys(vaka: Vaka, onTestRequest: unknown): Set<string> {
  const s = new Set(Object.keys(vaka.statikTestler || {}));
  if (onTestRequest) {
    for (const k of Array.from(MOTOR_CAPABLE_KEYS)) s.add(k);
  }
  return s;
}

export function visibleAllNonHidden(): typeof birlesikTestKatalogu {
  return birlesikTestKatalogu.filter((t) => {
    const v = TEST_VISIBILITY_MAP[t.key];
    return !v || v.visibility !== "hidden";
  });
}

export function visibleAllWithData(keys: Set<string>): typeof birlesikTestKatalogu {
  return visibleAllNonHidden().filter((t) => keys.has(t.key));
}

/** Debug: tanı/vaka için sonucu olan + olmayan tüm testler — saf, sıralı. */
export function buildDebugTestEnvanteri(vaka: Vaka): DebugTestEnvanteri {
  const beklenenKeys = new Set((vaka.rubric?.beklenenTestler || []).map((t) => t.key));
  const gereksizKeys = new Set((vaka.rubric?.gereksizTestler || []).map((t) => t.key));
  const keys = new Set<string>();
  for (const t of birlesikTestKatalogu) keys.add(t.key);
  for (const k of Object.keys(vaka.statikTestler || {})) keys.add(k);
  for (const t of vaka.rubric?.beklenenTestler || []) keys.add(t.key);
  for (const t of vaka.rubric?.gereksizTestler || []) keys.add(t.key);

  const items = Array.from(keys).map((key) => {
    const kat = birlesikTestKatalogu.find((t) => t.key === key);
    const sonuc = vaka.statikTestler?.[key];
    const rubrikEtiket =
      (vaka.rubric?.beklenenTestler || []).find((t) => t.key === key)?.etiket ||
      (vaka.rubric?.gereksizTestler || []).find((t) => t.key === key)?.etiket;
    return {
      key,
      ad: sonuc?.testAdi || rubrikEtiket || kat?.ad || humanizeKey(key),
      kategori: kat?.kategori || "Diğer",
      sonuc: sonuc as TestSonucu | undefined,
      hasSonuc: !!sonuc,
      beklenen: beklenenKeys.has(key),
      gereksiz: gereksizKeys.has(key),
      source: sonuc?.source,
    };
  });

  items.sort((a, b) => {
    if (a.hasSonuc !== b.hasSonuc) return a.hasSonuc ? -1 : 1;
    if (a.beklenen !== b.beklenen) return a.beklenen ? -1 : 1;
    return a.ad.localeCompare(b.ad, "tr");
  });

  const sonucuVar = items.filter((i) => i.hasSonuc).length;
  const sonucuYok = items.length - sonucuVar;
  return { items, sonucuVar, sonucuYok };
}
