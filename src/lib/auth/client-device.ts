/**
 * Gizlilik varsayılanı: tam user-agent veya IP saklamadan kullanıcının ayırt
 * edebileceği kısa cihaz etiketi üretir. Tanınmayan değerler ham halde geri
 * dönmez.
 */
export function deviceLabelFromUserAgent(userAgent: string | null): string {
  const value = (userAgent || "").toLowerCase();
  const browser = value.includes("edg/")
    ? "Edge"
    : value.includes("firefox/")
      ? "Firefox"
      : value.includes("chrome/") || value.includes("crios/")
        ? "Chrome"
        : value.includes("safari/")
          ? "Safari"
          : "Bilinmeyen tarayıcı";
  const device = value.includes("iphone") || value.includes("ipad")
    ? "iOS"
    : value.includes("android")
      ? "Android"
      : value.includes("windows")
        ? "Windows"
        : value.includes("mac os") || value.includes("macintosh")
          ? "macOS"
          : value.includes("linux")
            ? "Linux"
            : "Bilinmeyen cihaz";

  return `${browser} · ${device}`;
}
