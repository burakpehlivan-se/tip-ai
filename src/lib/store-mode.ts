/**
 * Vaka verileri üretimde yalnızca PostgreSQL üzerinden servis edilir.
 * JSON modu üretimde kaldırıldı; test izolasyonu için NODE_ENV=test'te
 * geçici olarak korunur (tmpDir dosya deposu). Üretimde json env'i
 * postgres'e fallback eder ve warn verir.
 */

export type StoreMode = "json" | "postgres";

let warnedJsonDeprecation = false;

/** Tek bir ortak bayrakla tüm mağazaların çalışma zamanını seçer. */
export function storeMode(value = process.env.STORE_MODE): StoreMode {
  if (value === "postgres") return "postgres";
  if (value === "json") {
    if (process.env.NODE_ENV === "test") return "json";
    if (!warnedJsonDeprecation) {
      warnedJsonDeprecation = true;
      console.warn("[store-mode] STORE_MODE=json üretimde desteklenmiyor; postgres kullanılıyor. Lütfen env'i postgres yapın.");
    }
    return "postgres";
  }
  if (value === "" || value === undefined) {
    return process.env.NODE_ENV === "test" ? "json" : "postgres";
  }
  throw new Error("STORE_MODE yalnızca json veya postgres olabilir.");
}

/** JSON canlı kaynakken PostgreSQL eşini yalnızca gözlem amacıyla okur. */
export function isShadowReadEnabled(value = process.env.STORE_SHADOW_READ): boolean {
  if (value === undefined || value === "" || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  throw new Error("STORE_SHADOW_READ yalnızca 0 veya 1 olabilir.");
}

/**
 * Misafir oturumları her zaman JSON'de kalır; merkezi kullanıcı kimliği
 * gerektirmez. Diğer tüm aktörler STORE_MODE bayrağına göre yönlendirilir.
 */
export function shouldUsePostgresStore(actor: string): boolean {
  return !actor.startsWith("guest:") && storeMode() === "postgres";
}
