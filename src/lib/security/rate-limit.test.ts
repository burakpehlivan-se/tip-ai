import { describe, expect, it, afterEach } from "vitest";
import {
  refundRateLimit,
  resetRateLimitsForTests,
  takeRateLimit,
  usernameRateLimitKey,
} from "./rate-limit";

afterEach(resetRateLimitsForTests);

describe("rate limit", () => {
  const options = { namespace: "student-login:user", key: "ayse", limit: 2, windowMs: 60_000, now: 1_000 };

  it("limits a key inside its fixed window and reports a retry delay", () => {
    expect(takeRateLimit(options)).toMatchObject({ allowed: true, remaining: 1 });
    expect(takeRateLimit(options)).toMatchObject({ allowed: true, remaining: 0 });
    expect(takeRateLimit(options)).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  });

  it("opens a fresh bucket after the window ends", () => {
    takeRateLimit(options);
    takeRateLimit(options);
    expect(takeRateLimit({ ...options, now: 61_000 })).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("refunds a successful login reservation", () => {
    takeRateLimit(options);
    refundRateLimit(options, 1_001);
    expect(takeRateLimit({ ...options, now: 1_002 })).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("normalizes and bounds account keys", () => {
    expect(usernameRateLimitKey("  AYŞE  ")).toBe("ayşe");
    expect(usernameRateLimitKey("x".repeat(200))).toHaveLength(128);
    expect(usernameRateLimitKey("   ")).toBe("empty-username");
  });
});
