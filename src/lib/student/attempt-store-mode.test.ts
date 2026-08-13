import { describe, expect, it } from "vitest";
import { assertSupportedAttemptStore, attemptStoreMode, shouldUsePostgresAttemptStore } from "./attempt-store-mode";

describe("attempt store mode", () => {
  it("defaults to JSON", () => {
    expect(attemptStoreMode("")).toBe("json");
    expect(attemptStoreMode("json")).toBe("json");
  });

  it("rejects unsupported values", () => {
    expect(() => attemptStoreMode("sqlite")).toThrow("ATTEMPT_STORE");
  });

  it("keeps guest attempts out of the PostgreSQL path", () => {
    expect(shouldUsePostgresAttemptStore("guest:opaque-id")).toBe(false);
  });

  it("rejects an enabled PostgreSQL store until its runtime adapter is present", () => {
    const oldAuth = process.env.AUTH_USER_STORE;
    const oldAttempts = process.env.ATTEMPT_STORE;
    process.env.AUTH_USER_STORE = "postgres";
    process.env.ATTEMPT_STORE = "postgres";
    expect(() => assertSupportedAttemptStore("ogrenci")).toThrow("adapter");
    if (oldAuth === undefined) delete process.env.AUTH_USER_STORE;
    else process.env.AUTH_USER_STORE = oldAuth;
    if (oldAttempts === undefined) delete process.env.ATTEMPT_STORE;
    else process.env.ATTEMPT_STORE = oldAttempts;
  });
});
