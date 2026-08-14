import { describe, expect, it } from "vitest";
import { caseStoreMode } from "./postgres-case-store-mode";

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
