import { afterEach, describe, expect, it } from "vitest";
import { allowedMutationOrigins, validateMutationOrigin } from "./request-origin";

const previousAppUrl = process.env.APP_URL;

afterEach(() => {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
});

describe("mutation origin doğrulaması", () => {
  it("kanonik APP_URL origin'ini kabul eder", () => {
    process.env.APP_URL = "https://tip-ai.example.test";
    const headers = new Headers({ origin: "https://tip-ai.example.test" });
    expect(
      validateMutationOrigin({ method: "POST", url: "http://internal:3000/api/admin/users", headers, appUrl: process.env.APP_URL })
    ).toBe("allow");
  });

  it("reverse proxy üzerinden gelen aynı public origin'i kabul eder", () => {
    const headers = new Headers({
      origin: "https://tip-ai.example.test",
      "x-forwarded-host": "tip-ai.example.test",
      "x-forwarded-proto": "https",
    });
    expect(
      validateMutationOrigin({ method: "PATCH", url: "http://internal:3000/api/admin/users/1", headers })
    ).toBe("allow");
    expect(allowedMutationOrigins({ url: "http://internal:3000", headers }).has("https://tip-ai.example.test")).toBe(true);
  });

  it("cross-site origin taşıyan mutation isteğini reddeder", () => {
    const headers = new Headers({ origin: "https://attacker.example" });
    expect(
      validateMutationOrigin({ method: "DELETE", url: "https://tip-ai.example.test/api/admin/users/1", headers })
    ).toBe("reject");
  });

  it("Origin header'ı yoksa açık cross-site fetch sinyalini reddeder", () => {
    const headers = new Headers({ "sec-fetch-site": "cross-site" });
    expect(
      validateMutationOrigin({ method: "POST", url: "https://tip-ai.example.test/api/student/attempts", headers })
    ).toBe("reject");
  });

  it("safe method'ları origin denetimine sokmaz", () => {
    const headers = new Headers({ origin: "https://attacker.example" });
    expect(
      validateMutationOrigin({ method: "GET", url: "https://tip-ai.example.test/api/health", headers })
    ).toBe("allow");
  });
});
