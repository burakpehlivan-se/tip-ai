import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("API origin proxy", () => {
  it("cross-site mutation isteğini route'a ulaşmadan reddeder", async () => {
    const response = proxy(
      new NextRequest("https://tip-ai.example.test/api/admin/users", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    await expect(response.json()).resolves.toEqual({ error: "Geçersiz istek kaynağı." });
  });

  it("aynı-origin mutation isteğini geçirir", () => {
    const response = proxy(
      new NextRequest("https://tip-ai.example.test/api/admin/users", {
        method: "POST",
        headers: { origin: "https://tip-ai.example.test" },
      })
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sınırı aşan bildirilen API mutation gövdesini reddeder", async () => {
    const response = proxy(
      new NextRequest("https://tip-ai.example.test/api/admin/users", {
        method: "POST",
        headers: { "content-length": String(1024 * 1024 + 1) },
      })
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    await expect(response.json()).resolves.toEqual({ error: "İstek gövdesi izin verilen boyutu aşıyor." });
  });

  it("geçerli request id'yi route'a ve yanıta taşır; serbest metni kabul etmez", () => {
    const forwarded = proxy(
      new NextRequest("https://tip-ai.example.test/api/health", {
        headers: { "x-request-id": "release-42.trace" },
      })
    );
    expect(forwarded.headers.get("x-request-id")).toBe("release-42.trace");

    const replaced = proxy(
      new NextRequest("https://tip-ai.example.test/api/health", {
        headers: { "x-request-id": "a".repeat(129) },
      })
    );
    expect(replaced.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
