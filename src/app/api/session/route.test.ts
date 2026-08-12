import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { POST } from "./logout/route";

describe("session API", () => {
  it("anonim istek için sır içermeyen boş oturum özeti döndürür", async () => {
    const response = await GET(new NextRequest("http://localhost/api/session"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ student: null, admin: null });
  });

  it("ortak çıkış iki oturum cookie'sini de sonlandırır", async () => {
    const response = await POST();
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("tip_ai_admin_session=");
    expect(cookie).toContain("tip_ai_student_session=");
    expect(cookie).toContain("Max-Age=0");
  });
});
