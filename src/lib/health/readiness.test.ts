import { afterEach, describe, expect, it } from "vitest";
import { getReadiness } from "./readiness";

const oldStore = process.env.STORE_MODE;
const oldRateLimitStore = process.env.RATE_LIMIT_STORE;

afterEach(() => {
  if (oldStore === undefined) delete process.env.STORE_MODE;
  else process.env.STORE_MODE = oldStore;
  if (oldRateLimitStore === undefined) delete process.env.RATE_LIMIT_STORE;
  else process.env.RATE_LIMIT_STORE = oldRateLimitStore;
});

describe("health readiness", () => {
  it("JSON kullanıcı deposunda dış bağımlılığa gerek duymadan hazırdır", async () => {
    process.env.STORE_MODE = "json";

    await expect(getReadiness()).resolves.toMatchObject({
      ready: true,
      payload: {
        status: "ok",
        auth: { store: "json", migration: "not_required" },
        attempts: { store: "json", runtime: "ready" },
        rateLimit: { store: "memory", runtime: "ready" },
        cases: { store: "json", runtime: "ready", migration: "not_required", shadowRead: false },
      },
    });
  });

  it("geçersiz runtime store yapılandırmasını hazır kabul etmez", async () => {
    process.env.STORE_MODE = "unsupported";
    await expect(getReadiness()).resolves.toMatchObject({
      ready: false,
      payload: { status: "not_ready", auth: { store: "invalid", migration: "not_checked" } },
    });
  });

  it("geçersiz rate limit yapılandırmasını hazır kabul etmez", async () => {
    process.env.STORE_MODE = "json";
    process.env.RATE_LIMIT_STORE = "unsupported";
    await expect(getReadiness()).resolves.toMatchObject({
      ready: false,
      payload: { status: "not_ready", rateLimit: { store: "invalid", runtime: "not_ready" } },
    });
  });

  it("geçersiz store yapılandırmasını hazır kabul etmez", async () => {
    process.env.STORE_MODE = "unsupported";
    await expect(getReadiness()).resolves.toMatchObject({
      ready: false,
      payload: { status: "not_ready", auth: { store: "invalid" } },
    });
  });
});
