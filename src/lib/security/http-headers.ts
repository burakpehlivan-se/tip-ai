/**
 * Güvenlik header setinin çalışma zamanı sözleşmesi. Next config aynı
 * değerleri tüm route'lara uygular; bu sabitler test ve operasyon runbook'ı
 * için tek isimli kaynak sağlar.
 */
export const REQUIRED_SECURITY_HEADERS = [
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
  "permissions-policy",
  "cross-origin-opener-policy",
  "x-dns-prefetch-control",
  "content-security-policy",
] as const;

export function hasRequiredSecurityHeaders(headers: Headers): boolean {
  return REQUIRED_SECURITY_HEADERS.every((header) => headers.has(header));
}
