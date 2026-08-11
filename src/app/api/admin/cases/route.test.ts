import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { PATCH } from "./[id]/route";
import { createSessionToken } from "@/lib/admin/auth";
import { getCaseById, loadCasesStore } from "@/lib/admin/store";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-admin-cases-route-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldUsername = process.env.ADMIN_USERNAME;

const caseId = "test-poliklinik::guvenli-taslak";

function request(pathname: string, method: "POST" | "PATCH", body: unknown, token?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("cookie", `tip_ai_admin_session=${token}`);
  return new NextRequest(`http://localhost${pathname}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function adminToken() {
  return createSessionToken("admin", "admin");
}

async function createDraft() {
  const response = await POST(
    request(
      "/api/admin/cases",
      "POST",
      {
        poliklinikKey: "test-poliklinik",
        hastalikKey: "guvenli-taslak",
        hastalikAdi: "Güvenli Taslak Vaka",
      },
      adminToken()
    )
  );
  expect(response.status).toBe(200);
}

describe("admin case write routes", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
  });

  beforeEach(() => {
    fs.rmSync(path.join(tmpDir, "data"), { recursive: true, force: true });
    loadCasesStore();
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

  it("rejects an unauthenticated case write before reading the request body", async () => {
    const response = await POST(
      request("/api/admin/cases", "POST", {
        poliklinikKey: "test-poliklinik",
        hastalikKey: "yetkisiz-vaka",
        hastalikAdi: "Yetkisiz Vaka",
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Yetkisiz" });
  });

  it("returns field issues instead of storing a malformed privileged patch", async () => {
    await createDraft();

    const response = await PATCH(
      request(
        `/api/admin/cases/${encodeURIComponent(caseId)}`,
        "PATCH",
        { yasAraligi: "30,70" },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Geçersiz vaka verisi.",
      issues: [{ field: "yasAraligi" }],
    });
    expect(getCaseById(caseId)?.yasAraligi).toEqual([30, 70]);
  });

  it("creates a minimally specified case as a draft", async () => {
    await createDraft();

    expect(getCaseById(caseId)).toMatchObject({
      id: caseId,
      hastalikAdi: "Güvenli Taslak Vaka",
      durum: "taslak",
    });
  });

  it("rejects publication of an incomplete draft without changing its status", async () => {
    await createDraft();

    const response = await PATCH(
      request(
        `/api/admin/cases/${encodeURIComponent(caseId)}`,
        "PATCH",
        { durum: "aktif" },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "Vaka aktif olarak yayınlanamaz. Zorunlu klinik alanları tamamlayın.",
      validation: { errors: expect.any(Array) },
    });
    expect(getCaseById(caseId)?.durum).toBe("taslak");
  });
});
