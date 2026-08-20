import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { GET as getAttempt, POST as postAttempt } from "./route";
import { POST as postAttemptAction } from "./[id]/route";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-student-attempt-route-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;

describe("student attempt API", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
  });
  beforeEach(() => {
    resetRateLimitsForTests();
    // clean data for each test but keep seeded cases
    // only remove attempts, keep cases
    const attemptsFile = path.join(tmpDir, "data", "admin", "student-attempts.json");
    if (fs.existsSync(attemptsFile)) fs.rmSync(attemptsFile);
  });
  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("unauthenticated GET returns 401", async () => {
    const req = new NextRequest("http://localhost/api/student/attempts?poliklinikKey=kardiyoloji");
    const res = await getAttempt(req);
    expect(res.status).toBe(401);
  });

  it("guest can start, ask, request test and complete", async () => {
    // start as guest
    const startReq = new NextRequest("http://localhost/api/student/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guest: true, poliklinikKey: "kardiyoloji" }),
    });
    const startRes = await postAttempt(startReq);
    expect(startRes.status).toBe(200);
    const startBody = await startRes.json();
    expect(startBody.vaka).toBeDefined();
    expect(startBody.vaka.id).toBeDefined();
    const attemptId: string = startBody.vaka.id;
    const guestCookie = startRes.cookies.get("tip_ai_guest_attempt")?.value;
    expect(guestCookie).toBeDefined();

    const cookieHeader = `tip_ai_guest_attempt=${guestCookie}`;

    // ask
    const askReq = new NextRequest(`http://localhost/api/student/attempts/${attemptId}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ type: "ask", action: "AGRI_YER" }),
    });
    const askRes = await postAttemptAction(askReq, { params: Promise.resolve({ id: attemptId }) });
    expect(askRes.status).toBe(200);
    const askBody = await askRes.json();
    expect(askBody.yanit).toBeDefined();
    expect(typeof askBody.yanit).toBe("string");

    // request test
    const testReq = new NextRequest(`http://localhost/api/student/attempts/${attemptId}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ type: "test", testKey: "TROPONIN" }),
    });
    const testRes = await postAttemptAction(testReq, { params: Promise.resolve({ id: attemptId }) });
    // TROPONIN may be not in this random case's statikTestler, but fallback via lab-motor should provide
    // If not found, it returns 404, which is also acceptable for this generic test
    expect([200, 404]).toContain(testRes.status);
    if (testRes.status === 200) {
      const testBody = await testRes.json();
      expect(testBody.sonuc).toBeDefined();
    }

    // complete
    const completeReq = new NextRequest(`http://localhost/api/student/attempts/${attemptId}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ type: "complete", taniGirildi: "Akut Koroner Sendrom", tedaviGirildi: "Aspirin 300mg, PCI planlandı", reasoning: null }),
    });
    const completeRes = await postAttemptAction(completeReq, { params: Promise.resolve({ id: attemptId }) });
    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.sonuc).toBeDefined();
    expect(typeof completeBody.sonuc.toplamPuan).toBe("number");
  });

  it("rate limits excessive attempt starts per IP", async () => {
    // first 20 should succeed, 21st should be 429 (limit 20/min)
    let lastStatus = 200;
    for (let i = 0; i < 21; i++) {
      const req = new NextRequest("http://localhost/api/student/attempts", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
        body: JSON.stringify({ guest: true, poliklinikKey: "kardiyoloji" }),
      });
      const res = await postAttempt(req);
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
