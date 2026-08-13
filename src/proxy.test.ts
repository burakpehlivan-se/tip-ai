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
  });
});
