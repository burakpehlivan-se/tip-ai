import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  answerStudentAttempt,
  completeStudentAttempt,
  requestStudentAttemptTest,
  startStudentAttempt,
} from "./attempt-store";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-attempt-store-test-"));
const oldCwd = process.cwd();

describe("student attempt store", () => {
  beforeAll(() => process.chdir(tmpDir));
  afterAll(() => {
    process.chdir(oldCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("gizli vaka verisini istemci başlangıç yükünden ayırır ve oturumda değerlendirir", () => {
    const vaka = startStudentAttempt("ogrenci.test", "kardiyoloji");
    expect(vaka).not.toBeNull();
    const publicPayload = JSON.stringify(vaka);
    expect(publicPayload).not.toContain("hastaYanitlari");
    expect(publicPayload).not.toContain("kabulEdilenTani");
    expect(publicPayload).not.toContain("puanlama");

    const yanit = answerStudentAttempt(vaka!.id, "ogrenci.test", "VITAL_TANSIYON");
    expect(yanit).toBeTruthy();
    const test = requestStudentAttemptTest(vaka!.id, "ogrenci.test", vaka!.testler[0].testKey);
    expect(test?.testAdi).toBe(vaka!.testler[0].testAdi);
    const sonuc = completeStudentAttempt(vaka!.id, "ogrenci.test", "rastgele tanı");
    expect(sonuc).not.toBeNull();
    expect(completeStudentAttempt(vaka!.id, "ogrenci.test", "rastgele tanı")).toBeNull();
  });
});
