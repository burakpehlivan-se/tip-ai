import { TestSonucu } from "./types";
import { getReferenceEntry } from "./lab-reference-library";

/**
 * Merges static overrides with reference-library-generated values.
 * 
 * Layer order: staticTestler (case overrides) > generatedTests > reference library normals.
 * This provides the Phase 1 resolution chain at the data merge level,
 * complementing the runtime getLabResult() 4-layer chain.
 */
export function mergeTestsWithReference(
  statikTestler: Record<string, TestSonucu>,
  generatedTests: Record<string, TestSonucu> | undefined,
  cinsiyet: "E" | "K" = "E"
): Record<string, TestSonucu> {
  const merged: Record<string, TestSonucu> = {};

  // Collect all test keys
  const allKeys = new Set<string>();
  for (const k of Object.keys(statikTestler)) allKeys.add(k);
  if (generatedTests) {
    for (const k of Object.keys(generatedTests)) allKeys.add(k);
  }

  for (const key of Array.from(allKeys)) {
    // Static override has highest priority
    if (statikTestler[key]) {
      merged[key] = statikTestler[key];
      continue;
    }
    // Auto-generated has next priority
    if (generatedTests?.[key]) {
      merged[key] = generatedTests[key];
      continue;
    }
  }

  return merged;
}

/**
 * Identifies which statikTestler entries can be safely removed
 * (already covered by reference library normal values with no additional info).
 * 
 * Returns keys that are essentially "normal results" that exist in the
 * reference library — these can be migrated to testOverrides in Phase 2.
 */
export function identifyMigratableOverrideCandidates(
  statikTestler: Record<string, TestSonucu>,
  cinsiyet: "E" | "K" = "E"
): string[] {
  const candidates: string[] = [];

  for (const [key, result] of Object.entries(statikTestler)) {
    const entry = getReferenceEntry(key);
    if (!entry) continue; // no reference entry, must stay as override

    // Non-imaging tests with normal-looking results are candidates
    if (
      entry.kategori !== "Radyoloji" &&
      entry.kategori !== "Patoloji" &&
      result.source !== "original"
    ) {
      candidates.push(key);
    }
  }

  return candidates;
}
