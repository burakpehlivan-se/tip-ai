import { describe, expect, it, afterEach } from "vitest";
import {
  refundRateLimit,
  rateLimitStoreMode,
  resetRateLimitsForTests,
  takeRateLimit,
  usernameRateLimitKey,
} from "./rate-limit";

afterEach(resetRateLimitsForTests);

describe("rate limit", () => {
  const options = { namespace: "student-login:user", key: "ayse", limit: 2, windowMs: 60_000, now: 1_000 };

  it("limits a key inside its fixed window and reports a retry delay", async () => {
    await expect(takeRateLimit(options)).resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(takeRateLimit(options)).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(takeRateLimit(options)).resolves.toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  });

  it("opens a fresh bucket after the window ends", async () => {
    await takeRateLimit(options);
    await takeRateLimit(options);
    await expect(takeRateLimit({ ...options, now: 61_000 })).resolves.toMatchObject({ allowed: true, remaining: 1 });
  });

  it("refunds a successful login reservation", async () => {
    await takeRateLimit(options);
    await refundRateLimit(options, 1_001);
    await expect(takeRateLimit({ ...options, now: 1_002 })).resolves.toMatchObject({ allowed: true, remaining: 1 });
  });

  it("normalizes and bounds account keys", () => {
    expect(usernameRateLimitKey("  AYŞE  ")).toBe("ayşe");
    expect(usernameRateLimitKey("x".repeat(200))).toHaveLength(128);
    expect(usernameRateLimitKey("   ")).toBe("empty-username");
  });

  it("yalnızca açık store modlarını kabul eder", () => {
    expect(rateLimitStoreMode()).toBe("memory");
    expect(rateLimitStoreMode("postgres")).toBe("postgres");
    expect(() => rateLimitStoreMode("redis")).toThrow("RATE_LIMIT_STORE");
  });
});
