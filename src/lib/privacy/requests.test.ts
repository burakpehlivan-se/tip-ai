import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listPrivacyRequests, resolvePrivacyRequest, submitPrivacyRequest } from "./requests";

const oldCwd = process.cwd();
const oldAuthStore = process.env.STORE_MODE;
let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-privacy-request-test-"));
  process.chdir(tmpDir);
  delete process.env.STORE_MODE;
});

afterEach(() => {
  process.chdir(oldCwd);
  if (oldAuthStore === undefined) delete process.env.STORE_MODE;
  else process.env.STORE_MODE = oldAuthStore;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("privacy request workflow", () => {
  it("serbest metin saklamadan açık talebi kaydeder ve yineleneni önler", async () => {
    const first = await submitPrivacyRequest({ username: "ogrenci.ayse", type: "erasure" });
    const duplicate = await submitPrivacyRequest({ username: "ogrenci.ayse", type: "erasure" });

    expect(first.created).toBe(true);
    expect(duplicate).toEqual({ request: first.request, created: false });
    await expect(listPrivacyRequests({ username: "ogrenci.ayse" })).resolves.toEqual([
      expect.objectContaining({ id: first.request.id, type: "erasure", status: "pending" }),
    ]);
  });

  it("yetkili çözüm kaydını talebin kendisine bağlar", async () => {
    const { request } = await submitPrivacyRequest({ username: "ogrenci.ayse", type: "correction" });
    const resolved = await resolvePrivacyRequest(request.id, "admin");

    expect(resolved).toEqual(
      expect.objectContaining({ id: request.id, status: "resolved", resolvedBy: "admin" })
    );
    await expect(listPrivacyRequests({ username: "ogrenci.ayse" })).resolves.toEqual([
      expect.objectContaining({ id: request.id, status: "resolved", resolvedBy: "admin" }),
    ]);
  });
});
