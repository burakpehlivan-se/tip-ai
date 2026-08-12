import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-register-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;

import { createUser, registerStudent } from "./users";

describe("registerStudent + ogrenci rolü", () => {
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

  it("geçerli kaydı oluşturur (rol: ogrenci)", () => {
    const user = registerStudent({ username: "Ali.Veli", password: "sifre123" });
    expect(user.username).toBe("ali.veli"); // lowercase
    expect(user.role).toBe("ogrenci");
    expect(user.active).toBe(true);
    expect(user.passwordHash).not.toContain("sifre123");
    expect(user.createdBy).toBe("self");
  });

  it("geçersiz kullanıcı adlarını reddeder", () => {
    expect(() => registerStudent({ username: "a", password: "sifre123" })).toThrow();
    expect(() => registerStudent({ username: "ali veli", password: "sifre123" })).toThrow();
    expect(() => registerStudent({ username: "ali@veli", password: "sifre123" })).toThrow();
    expect(() => registerStudent({ username: "x".repeat(31), password: "sifre123" })).toThrow();
  });

  it("kısa şifreyi reddeder", () => {
    expect(() => registerStudent({ username: "ali.veli", password: "12345" })).toThrow();
  });

  it("aynı kullanıcı adını iki kez kabul etmez", () => {
    registerStudent({ username: "tekrar", password: "sifre123" });
    expect(() => registerStudent({ username: "TEKRAR", password: "sifre123" })).toThrow(
      /zaten kullanılıyor/
    );
  });

  it("admin panelden ogrenci rolü oluşturulabilir", () => {
    const user = createUser({
      username: "panel.ogrenci",
      password: "sifre123",
      role: "ogrenci",
      createdBy: "admin",
    });
    expect(user.role).toBe("ogrenci");
  });
});
