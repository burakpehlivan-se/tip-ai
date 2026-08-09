import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { POST } from "./route";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-play-session-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;

describe("student play session API", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-at-least-32-chars";
  });

  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = oldSecret;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("doğrudan puan/eylem beyanı yapan eski endpoint'i kapatır", async () => {
    const req = new NextRequest("http://localhost/api/student/play-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseId: "sahte-istemdci-id",
        poliklinikKey: "kardiyoloji",
        hastalikKey: "stemi",
        sorulanAksiyonlar: [],
        istenenTestler: [],
        taniGirildi: "yanlış tanı",
        toplamPuan: 999999,
        maxPuan: 999999,
        taniDogru: true,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.error).toContain("kaldırıldı");
  });
});
