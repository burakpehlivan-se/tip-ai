import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("student logout API", () => {
  it("öğrenci cookie'sini güvenli özellikleriyle sonlandırır", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/student/logout", {
        method: "POST",
        headers: { cookie: "tip_ai_student_session=invalid-token" },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("tip_ai_student_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
