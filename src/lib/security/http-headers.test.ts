import { describe, expect, it } from "vitest";
import { hasRequiredSecurityHeaders, REQUIRED_SECURITY_HEADERS } from "./http-headers";

describe("HTTP security headers contract", () => {
  it("tüm zorunlu header'lar varsa geçer", () => {
    const headers = new Headers();
    for (const header of REQUIRED_SECURITY_HEADERS) headers.set(header, "test");
    expect(hasRequiredSecurityHeaders(headers)).toBe(true);
  });

  it("tek bir header eksikse geçmez", () => {
    const headers = new Headers();
    for (const header of REQUIRED_SECURITY_HEADERS.slice(1)) headers.set(header, "test");
    expect(hasRequiredSecurityHeaders(headers)).toBe(false);
  });
});
