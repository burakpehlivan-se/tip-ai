import { describe, expect, it, vi } from "vitest";
import { getRequestId, logger } from "./logger";

describe("logger", () => {
  it("serializes Error details in structured logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.exception("İşlem başarısız", new Error("beklenen hata"), { route: "/api/test" });

    expect(JSON.parse(spy.mock.calls[0][0])).toMatchObject({
      level: "error",
      msg: "İşlem başarısız",
      route: "/api/test",
      error: { name: "Error", message: "beklenen hata" },
    });
    spy.mockRestore();
  });

  it("uses an incoming request id and creates one when absent", () => {
    expect(getRequestId(new Request("https://example.test", { headers: { "x-request-id": "request-42" } }))).toBe("request-42");
    expect(getRequestId(new Request("https://example.test"))).toMatch(/^[0-9a-f-]{36}$/);
    expect(getRequestId(new Request("https://example.test", { headers: { "x-request-id": "a".repeat(129) } }))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("secrets, connection URLs and sensitive metadata from logs are redacted", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logger.warn("Bağlantı hatası: postgresql://user:pass@db.example.test/tip_ai", {
      token: "token-value",
      nested: { password: "plain-text", route: "/api/test" },
      authorization: "Bearer another-token",
    });

    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(JSON.stringify(logged)).not.toContain("db.example.test");
    expect(JSON.stringify(logged)).not.toContain("plain-text");
    expect(JSON.stringify(logged)).not.toContain("token-value");
    expect(JSON.stringify(logged)).not.toContain("another-token");
    expect(logged).toMatchObject({ token: "[redacted]", nested: { password: "[redacted]", route: "/api/test" } });
    spy.mockRestore();
  });
});
