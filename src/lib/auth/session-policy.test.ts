import { describe, expect, it } from "vitest";
import { SESSION_ACTIVITY_TOUCH_INTERVAL_MS, sessionPolicyForRole } from "./session-policy";

describe("rol tabanlı oturum politikası", () => {
  it("admin ve doktor için daha kısa idle/absolute süre uygular", () => {
    expect(sessionPolicyForRole("admin")).toEqual(sessionPolicyForRole("doktor"));
    expect(sessionPolicyForRole("admin").idleTtlMs).toBe(30 * 60 * 1000);
    expect(sessionPolicyForRole("admin").absoluteTtlMs).toBe(8 * 60 * 60 * 1000);
  });

  it("öğrenci politikasını daha uzun çalışma oturumuna ayırır", () => {
    expect(sessionPolicyForRole("ogrenci").idleTtlMs).toBe(2 * 60 * 60 * 1000);
    expect(sessionPolicyForRole("ogrenci").absoluteTtlMs).toBe(12 * 60 * 60 * 1000);
    expect(SESSION_ACTIVITY_TOUCH_INTERVAL_MS).toBeLessThan(sessionPolicyForRole("admin").idleTtlMs);
  });
});
