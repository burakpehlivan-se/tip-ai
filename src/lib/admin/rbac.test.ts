import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { GET as listCases } from "@/app/api/admin/cases/route";
import { POST as adminLogin } from "@/app/api/admin/login/route";
import { POST as fillPipeline } from "@/app/api/admin/pipeline/fill/route";
import { createSessionToken } from "./auth";
import { loadLogsStore } from "./store";
import { createUser, registerStudent, updateUser } from "./users";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-rbac-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldAuthStore = process.env.STORE_MODE;

function adminRequest(
  pathname: string,
  token?: string,
  init?: { method?: string; headers?: HeadersInit; body?: BodyInit | null }
): NextRequest {
  const headers = new Headers(init?.headers);
  if (token) headers.set("cookie", `tip_ai_admin_session=${token}`);
  return new NextRequest(`http://localhost${pathname}`, {
    method: init?.method,
    headers,
    body: init?.body,
  });
}

describe("admin RBAC", () => {
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

  it("öğrenci hesabı admin oturumu alamaz", async () => {
    registerStudent({ username: "ogrenci.login", password: "sifre123" });

    const response = await adminLogin(
      adminRequest("/api/admin/login", undefined, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "ogrenci.login", password: "sifre123" }),
      })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("başarılı yönetici girişi denetim günlüğüne yazılır", async () => {
    const response = await adminLogin(
      adminRequest("/api/admin/login", undefined, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "test-admin-password" }),
      })
    );

    expect(response.status).toBe(200);
    expect(loadLogsStore().logs[0]).toMatchObject({
      action: "user_login",
      actor: "admin",
      metadata: { role: "admin" },
    });
  });

  it("öğrenci imzalı token ile admin vaka verisine erişemez", async () => {
    const user = registerStudent({ username: "ogrenci.api", password: "sifre123" });
    const token = createSessionToken(user.username, user.role, user.id);

    const response = await listCases(adminRequest("/api/admin/cases", token));

    expect(response.status).toBe(401);
  });

  it("doktor vakaları okuyabilir ama yönetici pipeline'ını çalıştıramaz", async () => {
    const user = createUser({
      username: "doktor.api",
      password: "sifre123",
      role: "doktor",
      createdBy: "test",
    });
    const token = createSessionToken(user.username, user.role, user.id);

    expect((await listCases(adminRequest("/api/admin/cases", token))).status).toBe(200);
    expect(
      (
        await fillPipeline(
          adminRequest("/api/admin/pipeline/fill", token, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          })
        )
      ).status
    ).toBe(403);
  });

  it("rol düşürme mevcut admin token'ını anında geçersiz kılar", async () => {
    const user = createUser({
      username: "doktor.dusur",
      password: "sifre123",
      role: "doktor",
      createdBy: "test",
    });
    const token = createSessionToken(user.username, user.role, user.id);

    updateUser(user.id, { role: "ogrenci" }, { username: "admin" });

    expect((await listCases(adminRequest("/api/admin/cases", token))).status).toBe(401);
  });
});
