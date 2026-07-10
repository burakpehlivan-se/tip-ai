import { TestSonucu } from "../types";
import { AdminVaka } from "../admin/types";
import { MASTER_TEST_CATALOGUE } from "./master-catalogue";
import { canonicalizeTestKey } from "../cdm/vocabulary";

/**
 * Tüm vakalar taranarak hangi test key'lerinin "hasData=true" olduğu hesaplanır.
 *
 * hasData = true kriteri:
 *   - En az bir vakanın statikTestler veya generatedTests alanında mevcut
 *   - VEYA master katalogda generationStrategy != "never_generate" ve
 *     referans aralığı tanımlı → lab motoru güvenilir değer üretebilir
 */
export interface CatalogueFlags {
  hasData: Set<string>;
  motorCapable: Set<string>;
  totalWithData: number;
  totalMotorCapable: number;
  totalVisibleDefault: number;
}

export function computeCatalogueFlags(cases: AdminVaka[]): CatalogueFlags {
  const hasData = new Set<string>();
  const motorCapable = new Set<string>();

  // 1) Lab motoru — güvenilir değer üretebilen testler
  for (const [key, entry] of Object.entries(MASTER_TEST_CATALOGUE)) {
    if (
      entry.generationStrategy !== "never_generate" &&
      (entry.refRangeMale || entry.refRangeFemale || entry.resultKind === "panel")
    ) {
      motorCapable.add(key);
    }
  }

  // 2) Vakalardaki statik + generated testler
  for (const c of cases) {
    for (const key of Object.keys(c.statikTestler || {})) {
      hasData.add(canonicalizeTestKey(key));
    }
    for (const key of Object.keys(c.generatedTests || {})) {
      hasData.add(canonicalizeTestKey(key));
    }
  }

  // 3) Lab motoru da güvenilir veri sayılır
  for (const key of Array.from(motorCapable)) {
    hasData.add(key);
  }

  let totalVisibleDefault = 0;
  for (const entry of Object.values(MASTER_TEST_CATALOGUE)) {
    if (entry.visibility === "visible_default") totalVisibleDefault++;
  }

  return {
    hasData,
    motorCapable,
    totalWithData: hasData.size,
    totalMotorCapable: motorCapable.size,
    totalVisibleDefault,
  };
}
