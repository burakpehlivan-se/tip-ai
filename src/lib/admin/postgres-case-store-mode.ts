export type CaseStoreMode = "json" | "postgres";

/**
 * Vaka deposu seçimi, auth/attempt cutover'larından bağımsızdır. Varsayılan
 * JSON'dur; PostgreSQL değeri ancak import + parity + runtime canary ardından
 * Coolify ortam değişkeninde kontrollü olarak etkinleştirilmelidir.
 */
export function caseStoreMode(value = process.env.CASE_STORE): CaseStoreMode {
  if (value === undefined || value === "" || value === "json") return "json";
  if (value === "postgres") return "postgres";
  throw new Error("CASE_STORE yalnızca json veya postgres olabilir.");
}

/** JSON canlı kaynakken PostgreSQL eşini yalnızca gözlem amacıyla okur. */
export function caseShadowReadEnabled(value = process.env.CASE_SHADOW_READ): boolean {
  if (value === undefined || value === "" || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  throw new Error("CASE_SHADOW_READ yalnızca 0 veya 1 olabilir.");
}
