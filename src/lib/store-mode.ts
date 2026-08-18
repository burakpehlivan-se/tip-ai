/**
 * Tek bir STORE_MODE bayrağıyla tüm JSON → PostgreSQL geçişlerini kontrol eder.
 *
 * Eski üç ayrı bayrak (STORE_MODE, STORE_MODE, STORE_MODE) tek bir
 * STORE_MODE değere birlendirildi. Geçiş aşamasında shadow-read gözlem
 * mekanizması STORE_SHADOW_READ bayrağıyla açılır.
 *
 * Varsayılan JSON'dir; cutover için STORE_MODE=postgres ve migration'ların
 * uygulandığından emin olun. Çift yazma yapılmaz.
 */

export type StoreMode = "json" | "postgres";

/** Tek bir ortak bayrakla tüm mağazaların çalışma zamanını seçer. */
export function storeMode(value = process.env.STORE_MODE): StoreMode {
  if (value === undefined || value === "" || value === "json") return "json";
  if (value === "postgres") return "postgres";
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
