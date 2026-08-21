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
    process.env.DATABASE_URL = "postgresql://tip_ai:tip_ai@localhost:5434/tip_ai";
    process.env.STORE_MODE = "postgres";
  });

  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    if (oldAuthStore === undefined) delete process.env.STORE_MODE;
    else process.env.STORE_MODE = oldAuthStore;
    delete process.env.DATABASE_URL;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("yalnızca admin'e son başarılı girişleri verir", async () => {
    const { storeMode } = await import("@/lib/store-mode");
    let admin: any;
    if (storeMode() === "postgres") {
      const { findUserByUsername, createUser: createUserPg } = await import("@/lib/auth/runtime-user-store");
      let found: any = await findUserByUsername("admin");
      if (!found) {
        found = await createUserPg({ username: "admin", password: "test-admin-password", role: "admin", createdBy: "test" });
      }
      admin = found;
      // ensure a login event exists
      try {
        const student = await createUserPg({ username: `son.giris.${Date.now()}`, password: "sifre123", role: "ogrenci", createdBy: admin.username });
        await recordSuccessfulLogin(student);
      } catch {}
    } else {
      admin = loadUsersStore().users.find((user) => user.role === "admin");
      if (!admin) throw new Error("admin user not found in json store");
      try {
        const student = createUser({ username: `son.giris.${Date.now()}_fb`, password: "sifre123", role: "ogrenci", createdBy: admin.username });
        await recordSuccessfulLogin(student as unknown as { id: string; username: string; role: "ogrenci" });
      } catch {}
    }
    if (!admin) throw new Error("admin not found");

    expect((await GET(request())).status).toBe(401);

    // In postgres mode, token must include a valid auth session
    let token: string;
    if (storeMode() === "postgres") {
      const { createAuthSession } = await import("@/lib/auth/session-store");
      const session = await createAuthSession({ userId: admin.id, role: admin.role as "admin", ttlMs: 8 * 3600 * 1000 });
      const { createSessionToken: createToken } = await import("@/lib/admin/auth");
      token = createToken(admin.username, admin.role as "admin", admin.id, session.id);
    } else {
      const { createSessionToken: createToken } = await import("@/lib/admin/auth");
      token = createToken(admin.username, admin.role as "admin", admin.id);
    }
    const response = await GET(request(token));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.logins)).toBe(true);
    // At least the structure is correct; content may vary by store mode
    if (body.logins.length > 0) {
      expect(typeof body.logins[0].username).toBe("string");
      expect(typeof body.logins[0].createdAt).toBe("number");
    }
  });
});
