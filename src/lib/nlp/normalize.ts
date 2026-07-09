import { birlesikSoruSynonymleri, birlesikTestSynonymleri } from "../data";

export function normalizeSoru(metin: string): string {
  const lower = metin.toLowerCase().trim();

  if (birlesikSoruSynonymleri[lower]) {
    return birlesikSoruSynonymleri[lower];
  }

  for (const [alias, action] of Object.entries(birlesikSoruSynonymleri) as [string, string][]) {
    if (lower.includes(alias)) {
      return action;
    }
  }

  return "OZEL";
}

export function normalizeTest(metin: string): string | null {
  const lower = metin.toLowerCase().trim();

  if (birlesikTestSynonymleri[lower]) {
    return birlesikTestSynonymleri[lower];
  }

  for (const [alias, testKey] of Object.entries(birlesikTestSynonymleri) as [string, string][]) {
    if (lower.includes(alias)) {
      return testKey;
    }
  }

  return null;
}
