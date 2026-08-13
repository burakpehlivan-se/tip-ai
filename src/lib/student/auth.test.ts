import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-student-auth-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;
const oldAuthStore = process.env.AUTH_USER_STORE;

import {
  createStudentSessionToken,
  getCurrentStudentSession,
  verifyStudentSessionToken,
  authenticateStudent,
} from "./auth";
import { createSessionToken } from "@/lib/admin/auth";
import { createUser, registerStudent, updateUser } from "@/lib/admin/users";

describe("student auth", () => {
  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    delete process.env.AUTH_USER_STORE;
  });
  afterAll(() => {
    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
    if (oldAuthStore === undefined) delete process.env.AUTH_USER_STORE;
    else process.env.AUTH_USER_STORE = oldAuthStore;
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("öğrenci token üretir ve doğrular", async () => {
    const token = await createStudentSessionToken("ali.veli", "user_123");
    const session = verifyStudentSessionToken(token);
    expect(session).not.toBeNull();
    expect(session!.username).toBe("ali.veli");
    expect(session!.role).toBe("ogrenci");
    expect(session!.userId).toBe("user_123");
  });

  it("admin rolü token'ları öğrenci oturumu olarak kabul etmez", () => {
    const token = createSessionToken("admin", "admin", "user_admin");
    expect(verifyStudentSessionToken(token)).toBeNull();
  });

  it("kurcalanmış token'ı reddeder", async () => {
    const token = await createStudentSessionToken("ali.veli", "user_123");
    const tampered = token.slice(0, -3) + "abc";
    expect(verifyStudentSessionToken(tampered)).toBeNull();
  });

  it("süresi dolmuş token'ı reddeder", async () => {
    vi.useFakeTimers();
    try {
      const token = await createStudentSessionToken("ali.veli", "user_123");
      vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 13); // 13 saat sonra
      expect(verifyStudentSessionToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("yalnızca aktif öğrenci hesapları kimlik doğrular", async () => {
    const student = registerStudent({ username: "ayse.ogrenci", password: "sifre123" });
    await expect(authenticateStudent("ayse.ogrenci", "sifre123")).resolves.toEqual({
      username: student.username,
      userId: student.id,
    });
    await expect(authenticateStudent("ayse.ogrenci", "yanlis")).resolves.toBeNull();
    await expect(authenticateStudent("yok.boyle", "sifre123")).resolves.toBeNull();
  });

  it("admin/doktor hesapları öğrenci girişine kabul edilmez", async () => {
    createUser({ username: "dr.falan", password: "sifre123", role: "doktor", createdBy: "test" });
    await expect(authenticateStudent("dr.falan", "sifre123")).resolves.toBeNull();
  });

  it("pasifleştirilmiş öğrenci giriş yapamaz", async () => {
    const student = registerStudent({ username: "pasif.ogrenci", password: "sifre123" });
    updateUser(student.id, { active: false }, { username: "admin" });
    await expect(authenticateStudent("pasif.ogrenci", "sifre123")).resolves.toBeNull();
  });

  it("pasifleştirilen öğrenci mevcut oturumunu da kaybeder", async () => {
    const student = registerStudent({ username: "oturum.pasif", password: "sifre123" });
    const token = await createStudentSessionToken(student.username, student.id);
    expect((await getCurrentStudentSession(token))?.username).toBe(student.username);

    updateUser(student.id, { active: false }, { username: "admin" });
    await expect(getCurrentStudentSession(token)).resolves.toBeNull();
  });
});
