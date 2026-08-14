import { afterEach, describe, expect, it } from "vitest";
import { getReadiness } from "./readiness";

const oldAuthStore = process.env.AUTH_USER_STORE;
const oldAttemptStore = process.env.ATTEMPT_STORE;
const oldRateLimitStore = process.env.RATE_LIMIT_STORE;
const oldCaseStore = process.env.CASE_STORE;

afterEach(() => {
  if (oldAuthStore === undefined) delete process.env.AUTH_USER_STORE;
  else process.env.AUTH_USER_STORE = oldAuthStore;
  if (oldAttemptStore === undefined) delete process.env.ATTEMPT_STORE;
  else process.env.ATTEMPT_STORE = oldAttemptStore;
  if (oldRateLimitStore === undefined) delete process.env.RATE_LIMIT_STORE;
  else process.env.RATE_LIMIT_STORE = oldRateLimitStore;
  if (oldCaseStore === undefined) delete process.env.CASE_STORE;
  else process.env.CASE_STORE = oldCaseStore;
});

describe("health readiness", () => {
  it("JSON kullanıcı deposunda dış bağımlılığa gerek duymadan hazırdır", async () => {
    process.env.AUTH_USER_STORE = "json";
    process.env.ATTEMPT_STORE = "json";

    await expect(getReadiness()).resolves.toMatchObject({
      ready: true,
      payload: {
        status: "ok",
        auth: { store: "json", migration: "not_required" },
        attempts: { store: "json", runtime: "ready" },
        rateLimit: { store: "memory", runtime: "ready" },
        cases: { store: "json", runtime: "ready", migration: "not_required" },
      },
    });
  });

  it("geçersiz runtime store yapılandırmasını hazır kabul etmez", async () => {
    process.env.AUTH_USER_STORE = "unsupported";
    await expect(getReadiness()).resolves.toMatchObject({
      ready: false,
      payload: { status: "not_ready", auth: { store: "invalid", migration: "not_checked" } },
    });
  });

  it("geçersiz rate limit yapılandırmasını hazır kabul etmez", async () => {
    process.env.AUTH_USER_STORE = "json";
    process.env.RATE_LIMIT_STORE = "unsupported";
    await expect(getReadiness()).resolves.toMatchObject({
      ready: false,
      payload: { status: "not_ready", rateLimit: { store: "invalid", runtime: "not_ready" } },
    });
  });

  it("geçersiz vaka deposu yapılandırmasını hazır kabul etmez", async () => {
    process.env.AUTH_USER_STORE = "json";
    process.env.CASE_STORE = "unsupported";
    await expect(getReadiness()).resolves.toMatchObject({
      ready: false,
      payload: { status: "not_ready", auth: { store: "invalid" } },
    });
  });
});
