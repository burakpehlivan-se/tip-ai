import { logger } from "@/lib/logger";
import { findUserByUsername } from "./user-store";
import { isShadowReadEnabled } from "@/lib/store-mode";

export type ShadowUser = {
  username: string;
  role: "admin" | "doktor" | "ogrenci";
  active: boolean;
  superAdmin?: boolean;
  displayName?: string | null;
};

export type ShadowParity =
  | { outcome: "disabled" }
  | { outcome: "match" }
  | { outcome: "mismatch"; fields: string[] }
  | { outcome: "postgres_missing" }
  | { outcome: "postgres_unavailable" };


/**
 * Kimlik için güvenlik açısından anlamlı alanları karşılaştırır. Parola,
 * password hash, e-posta ve görüntülenen kullanıcı adı hiçbir zaman loglanmaz.
 */
export function userParity(expected: ShadowUser, actual: ShadowUser | null): ShadowParity {
  if (!actual) return { outcome: "postgres_missing" };

  const fields: string[] = [];
  if (expected.role !== actual.role) fields.push("role");
  if (expected.active !== actual.active) fields.push("active");
  if (expected.superAdmin !== undefined && expected.superAdmin !== actual.superAdmin) {
    fields.push("superAdmin");
  }
  if (expected.displayName !== undefined && expected.displayName !== actual.displayName) {
    fields.push("displayName");
  }
  return fields.length > 0 ? { outcome: "mismatch", fields } : { outcome: "match" };
}

/**
 * JSON auth akışını değiştirmeden PostgreSQL kopyasıyla parity ölçer.
 * Bu fonksiyon hiçbir zaman çağıranı başarısız yapmaz; geçici bir gözlem
 * aracıdır ve runtime cutover tamamlandığında kaldırılmalıdır.
 */
export async function observeAuthShadowRead(
  expected: ShadowUser,
  context: { route: string; requestId?: string }
): Promise<ShadowParity> {
  if (!isShadowReadEnabled()) return { outcome: "disabled" };

  try {
    const row = await findUserByUsername(expected.username);
    const result = userParity(
      expected,
      row
        ? {
            username: row.username,
            role: row.role,
            active: row.active,
            superAdmin: row.superAdmin,
            displayName: row.displayName,
          }
        : null
    );

    const log = result.outcome === "match" ? logger.info : logger.warn;
    log("Auth shadow-read sonucu", {
      event: "auth_shadow_read",
      route: context.route,
      requestId: context.requestId,
      outcome: result.outcome,
      ...(result.outcome === "mismatch" ? { fields: result.fields } : {}),
    });
    return result;
  } catch {
    // Bağlantı veya şema ayrıntısı loglanmaz; JSON giriş yolu kesintisiz kalır.
    const result: ShadowParity = { outcome: "postgres_unavailable" };
    logger.warn("Auth shadow-read kullanılamıyor", {
      event: "auth_shadow_read",
      route: context.route,
      requestId: context.requestId,
      outcome: result.outcome,
    });
    return result;
  }
}
