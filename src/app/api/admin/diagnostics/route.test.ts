import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/admin/auth";
import { createUser, loadUsersStore } from "@/lib/admin/users";
import { loadLogsStore } from "@/lib/admin/store";
import { GET } from "./route";

const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldStore = process.env.STORE_MODE;
const oldDatabaseUrl = process.env.DATABASE_URL;
let tmpDir = "";

function request(token?: string) {
  return new NextRequest("http://localhost/api/admin/diagnostics", {
    headers: token ? { cookie: `tip_ai_admin_session=${token}` } : undefined,
  });
}

describe("admin diagnostics API", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-diagnostics-route-test-"));
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
    process.env.STORE_MODE = "json";
    process.env.DATABASE_URL = "postgresql://hidden-user:hidden-password@db.example.test/tip_ai";
  });

  afterEach(() => {
    process.chdir(oldCwd);
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    if (oldStore === undefined) delete process.env.STORE_MODE;
    else process.env.STORE_MODE = oldStore;
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("yalnızca admin erişimine sır içermeyen operasyon özetini verir ve erişimi audit eder", async () => {
    expect((await GET(request())).status).toBe(401);

    const admin = loadUsersStore().users.find((user) => user.role === "admin")!;
    const doctor = createUser({
      username: "diagnostics.doktor",
      password: "sifre123",
      role: "doktor",
      createdBy: admin.username,
    });
    const doctorToken = createSessionToken(doctor.username, doctor.role, doctor.id);
    expect((await GET(request(doctorToken))).status).toBe(403);

    const adminToken = createSessionToken(admin.username, admin.role, admin.id);
    const response = await GET(request(adminToken));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    const body = await response.json();
    expect(body).toMatchObject({
      readiness: { status: "ok", auth: { store: "json" } },
      stores: { auth: "json", attempts: "json", rateLimit: "memory" },
      runtime: { node: expect.stringMatching(/^v\d+/), uptimeSeconds: expect.any(Number) },
      ai: { configured: expect.any(Boolean), model: expect.stringMatching(/^gemini|^$/) },
    });
    expect(JSON.stringify(body)).not.toContain("hidden-password");
    expect(JSON.stringify(body)).not.toContain("db.example.test");
    expect(loadLogsStore().logs[0]).toMatchObject({
      action: "admin_diagnostics_viewed",
      actor: admin.username,
      metadata: { readiness: "ok" },
    });
  });
});
