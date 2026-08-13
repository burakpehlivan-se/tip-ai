import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-progress-test-"));
const oldCwd = process.cwd();
const oldPassword = process.env.ADMIN_PASSWORD;

import { buildStudentLearningExport, getStudentProgress } from "./progress";
import { recordPlaySession } from "@/lib/admin/store";
import { registerStudent } from "@/lib/admin/users";

function oturum(k: string, overrides: Partial<Parameters<typeof recordPlaySession>[0]> = {}) {
  recordPlaySession(
    {
      caseId: `kardiyoloji::stemi-${k}`,
      hastalikKey: "stemi",
      poliklinikKey: "kardiyoloji",
      actor: "ali.veli",
      mode: "ogrenci",
      toplamPuan: 60,
      maxPuan: 100,
      taniDogru: true,
      atlananRedFlagler: [],
      gereksizTestler: [],
      eksikSorular: [],
      eksikTestler: [],
      ...overrides,
    },
    "ali.veli"
  );
}

describe("getStudentProgress", () => {
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

  it("boş kullanıcı için sıfır özet döner", () => {
    const p = getStudentProgress("yok.boyle");
    expect(p.toplamVaka).toBe(0);
    expect(p.ortalamaPuanYuzde).toBe(0);
    expect(p.taniDogruOran).toBe(0);
    expect(p.poliklinikler).toEqual([]);
  });

  it("yalnızca o kullanıcının oturumlarını toplar", () => {
    registerStudent({ username: "ali.veli", password: "sifre123" });
    oturum("a", { taniDogru: true, toplamPuan: 80 });
    oturum("b", { taniDogru: false, toplamPuan: 40 });
    // Başka kullanıcının oturumu karışmamalı
    recordPlaySession(
      {
        caseId: "kardiyoloji::stemi-x",
        hastalikKey: "stemi",
        poliklinikKey: "kardiyoloji",
        actor: "baska.biri",
        mode: "ogrenci",
        toplamPuan: 100,
        maxPuan: 100,
        taniDogru: true,
        atlananRedFlagler: [],
        gereksizTestler: [],
        eksikSorular: [],
        eksikTestler: [],
      },
      "baska.biri"
    );
    // admin-debug oturumları karışmamalı
    recordPlaySession(
      {
        caseId: "kardiyoloji::stemi-y",
        hastalikKey: "stemi",
        poliklinikKey: "kardiyoloji",
        actor: "admin",
        mode: "admin-debug",
        toplamPuan: 100,
        maxPuan: 100,
        taniDogru: true,
        atlananRedFlagler: [],
        gereksizTestler: [],
        eksikSorular: [],
        eksikTestler: [],
      },
      "admin"
    );

    const p = getStudentProgress("ali.veli");
    expect(p.toplamVaka).toBe(2);
    expect(p.ortalamaPuanYuzde).toBe(60); // (80+40)/2
    expect(p.taniDogruOran).toBe(50);
    expect(p.son20).toHaveLength(2);
    expect(p.poliklinikler[0].ad).toBe("Kardiyoloji");
    expect(p.poliklinikler[0].vakaSayisi).toBe(2);
  });

  it("atlanan red flag sayısını toplar", () => {
    oturum("c", { atlananRedFlagler: ["ST elevasyonu", "Hipotansiyon"] });
    const p = getStudentProgress("ali.veli");
    expect(p.toplamAtlananRedFlag).toBe(2);
  });

  it("kullanıcı adını büyük/küçük harf duyarsız eşleştirir", () => {
    const p = getStudentProgress("ALI.VELI");
    expect(p.toplamVaka).toBe(3);
  });

  it("öğrenci export'unda yalnızca sahibinin tamamlanmış kayıtları bulunur", () => {
    const exported = buildStudentLearningExport("ali.veli", new Date("2026-08-13T12:00:00.000Z"));

    expect(exported.generatedAt).toBe("2026-08-13T12:00:00.000Z");
    expect(exported.summary.username).toBe("ali.veli");
    expect(exported.completedCaseRecords).toHaveLength(3);
    expect(exported.completedCaseRecords.every((record) => !("actor" in record))).toBe(true);
    expect(exported.completedCaseRecords.every((record) => record.mode === "ogrenci")).toBe(true);
  });
});
