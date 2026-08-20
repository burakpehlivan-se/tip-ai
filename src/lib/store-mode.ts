/**
 * Vaka verileri artık yalnızca PostgreSQL üzerinden servis edilir.
 * JSON modu kaldırıldı — geriye uyum için `STORE_MODE=json` açıkça hata verir.
 * Tüm vaka okuma/yazma `clinical_cases` tablosuna gider; çift yazma yoktur.
 */

export type StoreMode = "postgres";

let warnedJsonDeprecation = false;

/** Tek bir ortak bayrakla tüm mağazaların çalışma zamanını seçer — artık sadece postgres. */
export function storeMode(value = process.env.STORE_MODE): StoreMode {
  if (value === "postgres" || value === "" || value === undefined) return "postgres";
  if (value === "json") {
    if (!warnedJsonDeprecation) {
      warnedJsonDeprecation = true;
      console.warn("[store-mode] STORE_MODE=json artık desteklenmiyor; postgres kullanılıyor. Lütfen env'i postgres yapın ve JSON dosyalarını silin.");
    }
    // Geçiş dönemi: json istense bile postgres döndür, ama logla
    return "postgres";
  }
  throw new Error("STORE_MODE yalnızca postgres olabilir (json modu kaldırıldı).");
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
