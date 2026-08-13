/**
 * Cookie ile yetkilendirilen mutation istekleri için origin doğrulaması.
 * APP_URL, production'da kanonik public origin'dir; reverse proxy arkasında
 * x-forwarded-host/proto da aynı-origin isteğini doğrulamak için kullanılır.
 */
export function allowedMutationOrigins(input: {
  url: string;
  headers: Headers;
  appUrl?: string;
}): Set<string> {
  const allowed = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    try {
      allowed.add(new URL(value).origin);
    } catch {
      // Hatalı ortam değeri uygulamayı açmaz; yalnızca ek bir güvenilir origin
      // sağlamaz. İstek host'u yine aşağıda kontrol edilir.
    }
  };

  add(input.url);
  add(input.appUrl);

  const forwardedHost = input.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || input.headers.get("host")?.trim();
  const forwardedProto = input.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host) add(`${forwardedProto === "https" ? "https" : "http"}://${host}`);

  return allowed;
}

export type MutationOriginDecision = "allow" | "reject";

/**
 * Tarayıcı kaynaklı cross-site mutation'ları fail-closed reddeder. Origin
 * header'ı olmayan script/CLI istekleri, `Sec-Fetch-Site: cross-site` değilse
 * geriye uyumluluk için kabul edilir; cookie SameSite politikası ikinci hattır.
 */
export function validateMutationOrigin(input: {
  method: string;
  url: string;
  headers: Headers;
  appUrl?: string;
}): MutationOriginDecision {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(input.method.toUpperCase())) {
    return "allow";
  }

  const origin = input.headers.get("origin");
  if (origin) {
    return allowedMutationOrigins(input).has(origin) ? "allow" : "reject";
  }

  return input.headers.get("sec-fetch-site") === "cross-site" ? "reject" : "allow";
}
