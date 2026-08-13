import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSessionToken } from "@/lib/admin/auth";
import { loadCasesStore } from "@/lib/admin/store";
import { EXAMPLE_CDM_KBH } from "@/lib/cdm/example-kbh";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-cdm-import-route-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldSecret = process.env.ADMIN_SESSION_SECRET;
const oldUsername = process.env.ADMIN_USERNAME;

function importDocument() {
  return {
    ...structuredClone(EXAMPLE_CDM_KBH),
    id: "import-test::kbh",
    meta: {
      ...EXAMPLE_CDM_KBH.meta,
      poliklinikKey: "import-test",
      hastalikKey: "kbh",
    },
  };
}

function request(query: string, body: unknown) {
  const token = createSessionToken("admin", "admin");
  return new NextRequest(`http://localhost/api/admin/cases/import-cdm${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `tip_ai_admin_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("CDM import confirmation route", () => {
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

  it("requires a fresh dry-run confirmation before writing", async () => {
    const document = importDocument();
    const direct = await POST(request("", document));
    expect(direct.status).toBe(428);
    expect(loadCasesStore().cases.some((item) => item.id === document.id)).toBe(false);

    const preview = await POST(request("?dryRun=1", document));
    expect(preview.status).toBe(200);
    const previewBody = await preview.json();
    expect(previewBody.plan).toEqual(expect.arrayContaining([expect.objectContaining({ id: document.id, action: "create" })]));
    expect(previewBody.confirmation.token).toEqual(expect.any(String));

    const confirmed = await POST(
      request(`?confirmation=${encodeURIComponent(previewBody.confirmation.token)}`, document)
    );
    expect(confirmed.status).toBe(200);
    expect(loadCasesStore().cases.some((item) => item.id === document.id)).toBe(true);
  });
});
