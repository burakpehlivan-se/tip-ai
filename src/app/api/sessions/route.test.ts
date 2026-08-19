import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { registerStudent } from "@/lib/admin/users";
import { createStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/student/auth";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-sessions-route-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldAuthStore = process.env.STORE_MODE;

function request(method: "GET" | "POST", token: string): NextRequest {
  return new NextRequest("http://localhost/api/sessions", {
    method,
    headers: { cookie: `${STUDENT_SESSION_COOKIE}=${token}` },
  });
}

describe("merkezi oturum uçları JSON geri dönüş modunda", () => {
  let token = "";

  beforeAll(async () => {
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    delete process.env.STORE_MODE;
    const student = registerStudent({ username: "oturum.api", password: "sifre123" });
    token = await createStudentSessionToken(student.username, student.id);
  });

  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldAuthStore === undefined) delete process.env.STORE_MODE;
    else process.env.STORE_MODE = oldAuthStore;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("JSON modunda sahte cihaz listesi döndürmez", async () => {
    const response = await GET(request("GET", token));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: false, sessions: [] });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("JSON modunda tüm oturumları iptal etme isteğini açıkça reddeder", async () => {
    const response = await POST(request("POST", token));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining("PostgreSQL") })
    );
  });
});
