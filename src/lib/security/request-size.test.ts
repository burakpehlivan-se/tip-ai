import { describe, expect, it } from "vitest";
import { exceedsApiMutationBodyLimit, MAX_API_MUTATION_BODY_BYTES } from "./request-size";

describe("API mutation gövde boyutu", () => {
  it("sınırdaki gövdeyi kabul eder", () => {
    expect(exceedsApiMutationBodyLimit(String(MAX_API_MUTATION_BODY_BYTES))).toBe(false);
  });

  it("sınırı aşan bildirilen gövdeyi reddeder", () => {
    expect(exceedsApiMutationBodyLimit(String(MAX_API_MUTATION_BODY_BYTES + 1))).toBe(true);
  });

  it("geçersiz veya eksik Content-Length değerini erken reddetmez", () => {
    expect(exceedsApiMutationBodyLimit(null)).toBe(false);
    expect(exceedsApiMutationBodyLimit("-1")).toBe(false);
    expect(exceedsApiMutationBodyLimit("1.5")).toBe(false);
  });
});
