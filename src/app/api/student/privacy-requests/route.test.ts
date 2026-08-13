import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/admin/auth";
import { createUser, loadUsersStore } from "@/lib/admin/users";
import { createStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/student/auth";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { GET, POST } from "./route";
import { GET as listAdminRequests } from "@/app/api/admin/privacy-requests/route";
import { PATCH as resolveAdminRequest } from "@/app/api/admin/privacy-requests/[id]/route";

const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldAuthStore = process.env.AUTH_USER_STORE;
let tmpDir = "";

function studentRequest(method: "GET" | "POST", token?: string, body?: unknown) {
  const headers = new Headers();
  if (token) headers.set("cookie", `${STUDENT_SESSION_COOKIE}=${token}`);
  if (body) headers.set("content-type", "application/json");
  return new NextRequest("http://localhost/api/student/privacy-requests", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function adminRequest(token: string, url = "http://localhost/api/admin/privacy-requests") {
  return new NextRequest(url, { headers: { cookie: `tip_ai_admin_session=${token}`, "content-type": "application/json" } });
}

describe("student privacy request API", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-privacy-route-test-"));
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
    delete process.env.AUTH_USER_STORE;
    resetRateLimitsForTests();
  });

  afterEach(() => {
    resetRateLimitsForTests();
    process.chdir(oldCwd);
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    if (oldAuthStore === undefined) delete process.env.AUTH_USER_STORE;
    else process.env.AUTH_USER_STORE = oldAuthStore;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("öğrencinin talebini kaydeder, yöneticiye gösterir ve çözümlenme izini korur", async () => {
    const admin = loadUsersStore().users.find((user) => user.role === "admin")!;
    const student = createUser({
      username: "gizlilik.ogrenci",
      password: "sifre123",
      role: "ogrenci",
      createdBy: admin.username,
    });
    const studentToken = await createStudentSessionToken(student.username, student.id);

    expect((await POST(studentRequest("POST"))).status).toBe(401);
    const submitted = await POST(studentRequest("POST", studentToken, { type: "erasure", ignoredNote: "gizli serbest metin" }));
    expect(submitted.status).toBe(201);
    const submitBody = await submitted.json();
    expect(submitBody.request).toMatchObject({ username: student.username, type: "erasure", status: "pending" });

    const ownHistory = await GET(studentRequest("GET", studentToken));
    expect(ownHistory.status).toBe(200);
    expect((await ownHistory.json()).requests).toEqual([
      expect.objectContaining({ id: submitBody.request.id, status: "pending" }),
    ]);

    const adminToken = createSessionToken(admin.username, admin.role, admin.id);
    const listed = await listAdminRequests(adminRequest(adminToken));
    expect(listed.status).toBe(200);
    expect((await listed.json()).requests).toEqual([
      expect.objectContaining({ id: submitBody.request.id, username: student.username, type: "erasure" }),
    ]);

    const resolved = await resolveAdminRequest(
      new NextRequest(`http://localhost/api/admin/privacy-requests/${submitBody.request.id}`, {
        method: "PATCH",
        headers: { cookie: `tip_ai_admin_session=${adminToken}`, "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      }),
      { params: Promise.resolve({ id: submitBody.request.id }) }
    );
    expect(resolved.status).toBe(200);
    expect((await resolved.json()).request).toMatchObject({ status: "resolved", resolvedBy: admin.username });
  });
});
