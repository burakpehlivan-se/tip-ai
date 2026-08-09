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
  });
});
