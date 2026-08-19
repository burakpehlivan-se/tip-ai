import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/admin/auth";
import { createUser, loadUsersStore } from "@/lib/admin/users";
import { recordSuccessfulLogin } from "@/lib/auth/runtime-user-store";
import { GET } from "./route";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-recent-logins-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldAuthStore = process.env.STORE_MODE;

function request(token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `tip_ai_admin_session=${token}`);
  return new NextRequest("http://localhost/api/admin/users/recent-logins?limit=20", { headers });
}

describe("recent login events API", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
    delete process.env.STORE_MODE;
  });

  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    if (oldAuthStore === undefined) delete process.env.STORE_MODE;
    else process.env.STORE_MODE = oldAuthStore;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("yalnızca admin'e son başarılı girişleri verir", async () => {
    const admin = loadUsersStore().users.find((user) => user.role === "admin")!;
    const student = createUser({
      username: "son.giris.ogrenci",
      password: "sifre123",
      role: "ogrenci",
      createdBy: admin.username,
    });
    await recordSuccessfulLogin(student);

    expect((await GET(request())).status).toBe(401);

    const token = createSessionToken(admin.username, admin.role, admin.id);
    const response = await GET(request(token));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.logins).toHaveLength(1);
    expect(body.logins[0]).toMatchObject({ username: student.username, role: "ogrenci" });
    expect(typeof body.logins[0].createdAt).toBe("number");
  });
});
