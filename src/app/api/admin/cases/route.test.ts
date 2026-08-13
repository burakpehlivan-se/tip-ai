import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { PATCH } from "./[id]/route";
import { POST as reviewCase } from "./[id]/review/route";
import { createSessionToken } from "@/lib/admin/auth";
import { getCaseById, getPublishedCaseVersion, loadCasesStore, recordMutation } from "@/lib/admin/store";
import { createUser } from "@/lib/admin/users";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-admin-cases-route-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldUsername = process.env.ADMIN_USERNAME;

const caseId = "test-poliklinik::guvenli-taslak";

function caseVersion(id: string): number {
  const updatedAt = getCaseById(id)?.updatedAt;
  if (updatedAt === undefined) throw new Error(`Fixture vaka bulunamadı: ${id}`);
  return updatedAt;
}

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

function doctorToken() {
  const user = createUser({ username: "reviewer", password: "sifre123", role: "doktor", createdBy: "admin" });
  return createSessionToken(user.username, user.role, user.id);
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
        { yasAraligi: "30,70", expectedUpdatedAt: caseVersion(caseId) },
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

  it("rejects direct publication so the independent review flow is mandatory", async () => {
    await createDraft();

    const response = await PATCH(
      request(
        `/api/admin/cases/${encodeURIComponent(caseId)}`,
        "PATCH",
        { durum: "aktif", expectedUpdatedAt: caseVersion(caseId) },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Vaka doğrudan yayınlanamaz; önce incelemeye gönderilmelidir.",
    });
    expect(getCaseById(caseId)?.durum).toBe("taslak");
  });

  it("rejects client-controlled version and approval fields", async () => {
    await createDraft();
    const response = await PATCH(
      request(
        `/api/admin/cases/${encodeURIComponent(caseId)}`,
        "PATCH",
        { surum: 999, uzmanOnayi: true, expectedUpdatedAt: caseVersion(caseId) },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );
    expect(response.status).toBe(400);
    expect(getCaseById(caseId)?.surum).toBe(1);
    expect(getCaseById(caseId)?.uzmanOnayi).toBe(false);
  });

  it("prevents the author from reviewing their own case", async () => {
    await createDraft();
    const submitted = await reviewCase(
      request(
        `/api/admin/cases/${encodeURIComponent(caseId)}/review`,
        "POST",
        { action: "submit", expectedUpdatedAt: caseVersion(caseId) },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );
    const submittedBody = await submitted.json();
    expect(submittedBody).toMatchObject({ ok: true });
    expect(submittedBody.case.incelemeDurumu).toBe("incelemede");
    expect(getCaseById(caseId)?.incelemeDurumu).toBe("incelemede");

    const response = await reviewCase(
      request(
        `/api/admin/cases/${encodeURIComponent(caseId)}/review`,
        "POST",
        { action: "request_changes", expectedUpdatedAt: submittedBody.case.updatedAt },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );
    expect(await response.json()).toMatchObject({ error: "Vaka yazarı kendi vakasını onaylayamaz veya değişiklik talebi veremez." });
  });

  it("allows a different doctor to request changes on a submitted case", async () => {
    const target = loadCasesStore().cases[0];
    recordMutation("system", "update_case", "fixture review state", [], (store) => {
      const index = store.cases.findIndex((item) => item.id === target.id);
      store.cases[index] = {
        ...store.cases[index],
        durum: "taslak",
        incelemeDurumu: "incelemede",
        olusturan: "author",
      };
    });
    const response = await reviewCase(
      request(
        `/api/admin/cases/${encodeURIComponent(target.id)}/review`,
        "POST",
        { action: "request_changes", note: "Klinik kaynak ekleyin.", expectedUpdatedAt: caseVersion(target.id) },
        doctorToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(target.id) }) }
    );
    expect(await response.json()).toMatchObject({ ok: true });
    expect(getCaseById(target.id)).toMatchObject({
      durum: "taslak",
      incelemeDurumu: "degisiklik_istendi",
      uzmanOnaylayan: "reviewer",
    });
  });

  it("records an immutable approved version before future edits create a new draft", async () => {
    const target = loadCasesStore().cases[0];
    recordMutation("system", "update_case", "fixture approved version state", [], (store) => {
      const index = store.cases.findIndex((item) => item.id === target.id);
      store.cases[index] = {
        ...store.cases[index],
        durum: "taslak",
        incelemeDurumu: "incelemede",
        olusturan: "author",
        klinikKaynak: "Klinik rehber",
        klinikKaynakTarihi: "2026-08-01",
        egitimHedefleri: ["Kritik klinik bulguları tanır."],
      };
    });
    expect(getCaseById(target.id)).toMatchObject({
      durum: "taslak",
      incelemeDurumu: "incelemede",
      klinikKaynak: "Klinik rehber",
    });

    const approved = await reviewCase(
      request(
        `/api/admin/cases/${encodeURIComponent(target.id)}/review`,
        "POST",
        { action: "approve", expectedUpdatedAt: caseVersion(target.id) },
        doctorToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(target.id) }) }
    );
    expect(approved.status, JSON.stringify(await approved.clone().json())).toBe(200);
    const approvedBody = await approved.json();
    const published = getPublishedCaseVersion(target.id, approvedBody.case.surum);
    expect(published).toMatchObject({
      caseId: target.id,
      version: approvedBody.case.surum,
      contentChecksum: approvedBody.case.contentChecksum,
      approvedBy: "reviewer",
      content: { durum: "aktif", incelemeDurumu: "onayli" },
    });

    const edited = await PATCH(
      request(
        `/api/admin/cases/${encodeURIComponent(target.id)}`,
        "PATCH",
        { anaSikayet: "Sonraki taslak değişikliği", expectedUpdatedAt: approvedBody.case.updatedAt },
        adminToken()
      ),
      { params: Promise.resolve({ id: encodeURIComponent(target.id) }) }
    );
    expect(edited.status).toBe(200);
    expect(getCaseById(target.id)).toMatchObject({ durum: "taslak", surum: approvedBody.case.surum + 1 });
    expect(getPublishedCaseVersion(target.id, approvedBody.case.surum)?.content.anaSikayet).toBe(
      published?.content.anaSikayet
    );
  });

  it("rejects a stale editor save without overwriting the newer case", async () => {
    await createDraft();
    const staleVersion = caseVersion(caseId);
    const first = await PATCH(
      request(`/api/admin/cases/${encodeURIComponent(caseId)}`, "PATCH", { hastalikAdi: "Yeni başlık", expectedUpdatedAt: staleVersion }, adminToken()),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );
    expect(first.status).toBe(200);

    const stale = await PATCH(
      request(`/api/admin/cases/${encodeURIComponent(caseId)}`, "PATCH", { hastalikAdi: "Eski ekran başlığı", expectedUpdatedAt: staleVersion }, adminToken()),
      { params: Promise.resolve({ id: encodeURIComponent(caseId) }) }
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toContain("Vaka başka bir kullanıcı tarafından güncellendi.");
    expect(getCaseById(caseId)?.hastalikAdi).toBe("Yeni başlık");
  });
});
