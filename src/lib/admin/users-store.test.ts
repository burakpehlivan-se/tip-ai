import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { JsonStoreReadError } from "./json-store";
import { loadUsersStore } from "./users";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-users-store-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;

describe("admin users store", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
  });

  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("quarantines a corrupt user store instead of bootstrapping a replacement", () => {
    const usersFile = path.join(tmpDir, "data", "admin", "users.json");
    fs.mkdirSync(path.dirname(usersFile), { recursive: true });
    fs.writeFileSync(usersFile, "{ malformed", "utf8");
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => loadUsersStore()).toThrow(JsonStoreReadError);
    expect(fs.existsSync(usersFile)).toBe(false);
    expect(
      fs.readdirSync(path.dirname(usersFile)).some((file) => file.startsWith("users.json.corrupt-"))
    ).toBe(true);

    logSpy.mockRestore();
  });
});
