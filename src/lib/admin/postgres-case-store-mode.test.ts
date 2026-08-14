import { describe, expect, it } from "vitest";
import { caseShadowReadEnabled, caseStoreMode } from "./postgres-case-store-mode";

describe("caseStoreMode", () => {
  it("varsayılan olarak JSON deposunu seçer", () => {
    expect(caseStoreMode(undefined)).toBe("json");
    expect(caseStoreMode("")).toBe("json");
    expect(caseStoreMode("json")).toBe("json");
  });

  it("PostgreSQL deposunu açıkça seçer", () => {
    expect(caseStoreMode("postgres")).toBe("postgres");
  });

  it("desteklenmeyen değeri fail closed reddeder", () => {
    expect(() => caseStoreMode("sqlite")).toThrow("CASE_STORE");
  });
});

describe("caseShadowReadEnabled", () => {
  it("varsayılan olarak kapalıdır ve açık değerini doğrular", () => {
    expect(caseShadowReadEnabled(undefined)).toBe(false);
    expect(caseShadowReadEnabled("0")).toBe(false);
    expect(caseShadowReadEnabled("1")).toBe(true);
  });

  it("geçersiz değerleri fail closed reddeder", () => {
    expect(() => caseShadowReadEnabled("enabled")).toThrow("CASE_SHADOW_READ");
  });
});
