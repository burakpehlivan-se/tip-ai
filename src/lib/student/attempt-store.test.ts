import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  answerStudentAttempt,
  completeStudentAttempt,
  getActiveStudentAttempt,
  getActiveStudentAttemptForAssignment,
  requestStudentAttemptTest,
  startAssignedStudentAttempt,
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

  it("gizli vaka verisini istemci başlangıç yükünden ayırır ve oturumda değerlendirir", async () => {
    const vaka = await startStudentAttempt("ogrenci.test", "kardiyoloji");
    expect(vaka).not.toBeNull();
    const publicPayload = JSON.stringify(vaka);
    expect(publicPayload).not.toContain("hastaYanitlari");
    expect(publicPayload).not.toContain("kabulEdilenTani");
    expect(publicPayload).not.toContain("puanlama");

    const yanit = await answerStudentAttempt(vaka!.id, "ogrenci.test", "VITAL_TANSIYON");
    expect(yanit).toBeTruthy();
    const test = await requestStudentAttemptTest(vaka!.id, "ogrenci.test", vaka!.testler[0].testKey);
    expect(test?.testAdi).toBe(vaka!.testler[0].testAdi);
    const sonuc = await completeStudentAttempt(vaka!.id, "ogrenci.test", "rastgele tanı");
    expect(sonuc).not.toBeNull();
    await expect(completeStudentAttempt(vaka!.id, "ogrenci.test", "rastgele tanı")).resolves.toBeNull();
  });

  it("aynı kullanıcının güncel oturumunu ilerleme verisiyle sürdürür, diğer kullanıcıya göstermez", async () => {
    const vaka = await startStudentAttempt("ogrenci.devam", "kardiyoloji");
    expect(vaka).not.toBeNull();
    await answerStudentAttempt(vaka!.id, "ogrenci.devam", "VITAL_TANSIYON");
    await requestStudentAttemptTest(vaka!.id, "ogrenci.devam", vaka!.testler[0].testKey);

    const resumed = await getActiveStudentAttempt("ogrenci.devam", "kardiyoloji");
    expect(resumed?.id).toBe(vaka!.id);
    expect(resumed?.ilerleme.yanitlar[0]?.aksiyon).toBe("VITAL_TANSIYON");
    expect(resumed?.ilerleme.testSonuclari[0]?.testKey).toBe(vaka!.testler[0].testKey);
    await expect(getActiveStudentAttempt("baska.ogrenci", "kardiyoloji")).resolves.toBeNull();
    await expect(getActiveStudentAttempt("ogrenci.devam", "noroloji")).resolves.toBeNull();
  });

  it("atanan vakayı ayrı bir oturumla başlatır ve yalnızca aynı atamadan sürdürür", async () => {
    const vaka = await startAssignedStudentAttempt(
      "ogrenci.atama",
      "assignment-1",
      "kardiyoloji::stemi"
    );
    expect(vaka).not.toBeNull();
    await answerStudentAttempt(vaka!.id, "ogrenci.atama", "VITAL_TANSIYON");

    const resumed = await getActiveStudentAttemptForAssignment("ogrenci.atama", "assignment-1");
    expect(resumed?.id).toBe(vaka!.id);
    await expect(getActiveStudentAttemptForAssignment("ogrenci.atama", "assignment-2")).resolves.toBeNull();
    await expect(getActiveStudentAttemptForAssignment("baska.ogrenci", "assignment-1")).resolves.toBeNull();
  });

  it("bozuk oturum dosyasını sessizce boş saymak yerine karantinaya alır", async () => {
    const attemptsFile = path.join(tmpDir, "data", "admin", "student-attempts.json");
    fs.writeFileSync(attemptsFile, "{ bozuk-json", "utf8");

    await expect(getActiveStudentAttempt("ogrenci.test", "kardiyoloji")).rejects.toThrow(
      "Öğrenci oturumu deposu"
    );
    expect(fs.readdirSync(path.dirname(attemptsFile)).some((name) => name.startsWith("student-attempts.json.corrupt-"))).toBe(true);
  });

  it("eşzamanlı yanıtları aynı oturumda kaybetmeden serileştirir", async () => {
    const vaka = await startStudentAttempt("ogrenci.eszamanli", "kardiyoloji");
    expect(vaka).not.toBeNull();

    await Promise.all([
      answerStudentAttempt(vaka!.id, "ogrenci.eszamanli", "VITAL_TANSIYON"),
      answerStudentAttempt(vaka!.id, "ogrenci.eszamanli", "VITAL_NABIZ"),
    ]);

    const resumed = await getActiveStudentAttempt("ogrenci.eszamanli", "kardiyoloji");
    expect(resumed?.ilerleme.yanitlar.map((yanit) => yanit.aksiyon).sort()).toEqual([
      "VITAL_NABIZ",
      "VITAL_TANSIYON",
    ]);
  });
});
