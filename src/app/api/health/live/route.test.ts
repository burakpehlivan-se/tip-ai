import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("liveness endpoint", () => {
  it("dış bağımlılık kontrol etmeden process canlılığını döndürür", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
