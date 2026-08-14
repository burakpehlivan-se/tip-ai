import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { GET as getTip, PATCH, DELETE } from "./[id]/route";
import { createSessionToken } from "@/lib/admin/auth";
import { loadHastaTipleriStore } from "@/lib/admin/store";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-hasta-tipleri-route-test-"));
const oldCwd = process.cwd();
const oldUsername = process.env.ADMIN_USERNAME;
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;

function request(pathname: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown, token?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("cookie", `tip_ai_admin_session=${token}`);
  return new NextRequest(`http://localhost${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function adminToken() {
  return createSessionToken("admin", "admin");
}

describe("admin hasta tipi routes", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
  });

  beforeEach(() => {
    fs.rmSync(path.join(tmpDir, "data"), { recursive: true, force: true });
  });

  afterAll(() => {
    if (oldUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = oldUsername;
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("yetkisiz oluşturmayı reddeder", async () => {
    const response = await POST(request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }));
    expect(response.status).toBe(401);
  });

  it("oluşturur, Türkçe ad'dan ASCII slug üretir", async () => {
    const response = await POST(
      request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken())
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tip).toMatchObject({ id: "diyabetik-kadin", ad: "Diyabetik Kadın" });
  });

  it("aynı adla ikinci oluşturmayı reddeder", async () => {
    await POST(request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken()));
    const response = await POST(
      request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken())
    );
    expect(response.status).toBe(409);
  });

  it("listeler ve tekini getirir", async () => {
    await POST(request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken()));
    const list = await GET(request("/api/admin/hasta-tipleri", "GET", undefined, adminToken()));
    expect((await list.json()).tipler).toHaveLength(1);

    const one = await getTip(
      request("/api/admin/hasta-tipleri/diyabetik-kadin", "GET", undefined, adminToken()),
      { params: Promise.resolve({ id: "diyabetik-kadin" }) }
    );
    expect((await one.json()).tip.ad).toBe("Diyabetik Kadın");
  });

  it("günceller; ad değişince slug'ı da taşır", async () => {
    await POST(request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken()));
    const response = await PATCH(
      request(
        "/api/admin/hasta-tipleri/diyabetik-kadin",
        "PATCH",
        { ad: "Şeker Hastası", yasAraligi: [40, 60], cinsiyetTercih: "K", komorbiditeler: ["T2DM"] },
        adminToken()
      ),
      { params: Promise.resolve({ id: "diyabetik-kadin" }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tip).toMatchObject({ id: "seker-hastasi", ad: "Şeker Hastası", cinsiyetTercih: "K" });
    expect(body.tip.komorbiditeler).toEqual(["T2DM"]);
  });

  it("geçersiz alanları reddeder", async () => {
    await POST(request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken()));
    const response = await PATCH(
      request("/api/admin/hasta-tipleri/diyabetik-kadin", "PATCH", { cinsiyetTercih: "X" }, adminToken()),
      { params: Promise.resolve({ id: "diyabetik-kadin" }) }
    );
    expect(response.status).toBe(400);
  });

  it("siler", async () => {
    await POST(request("/api/admin/hasta-tipleri", "POST", { ad: "Diyabetik Kadın" }, adminToken()));
    const response = await DELETE(
      request("/api/admin/hasta-tipleri/diyabetik-kadin", "DELETE", undefined, adminToken()),
      { params: Promise.resolve({ id: "diyabetik-kadin" }) }
    );
    expect(response.status).toBe(200);
    expect(loadHastaTipleriStore().tipler).toHaveLength(0);
  });
});
