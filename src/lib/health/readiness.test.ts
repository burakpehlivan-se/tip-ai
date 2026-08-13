import { afterEach, describe, expect, it } from "vitest";
import { getReadiness } from "./readiness";

const oldAuthStore = process.env.AUTH_USER_STORE;
const oldAttemptStore = process.env.ATTEMPT_STORE;

afterEach(() => {
  if (oldAuthStore === undefined) delete process.env.AUTH_USER_STORE;
  else process.env.AUTH_USER_STORE = oldAuthStore;
  if (oldAttemptStore === undefined) delete process.env.ATTEMPT_STORE;
  else process.env.ATTEMPT_STORE = oldAttemptStore;
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
});
