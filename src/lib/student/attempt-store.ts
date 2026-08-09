import crypto from "crypto";
import fs from "fs";
import path from "path";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { loadCasesStore } from "@/lib/admin/store";
import type { DegerlendirmeSonuc, TestSonucu, Vaka } from "@/lib/types";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { getLabResult } from "@/lib/lab-motor";
import { recordPlaySession } from "@/lib/admin/store";

const ATTEMPT_TTL_MS = 1000 * 60 * 60 * 12;

interface AttemptRecord {
  id: string;
  actor: string;
  poliklinikKey: string;
  vaka: Vaka;
  sorulanAksiyonlar: string[];
  istenenTestler: string[];
  createdAt: number;
  updatedAt: number;
}

interface AttemptStore {
  version: 1;
  attempts: AttemptRecord[];
}

function storePath() {
  const dir = path.join(process.cwd(), "data", "admin");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "student-attempts.json");
}

function load(): AttemptStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), "utf8")) as AttemptStore;
    const now = Date.now();
    return { version: 1, attempts: (parsed.attempts || []).filter((a) => now - a.updatedAt < ATTEMPT_TTL_MS) };
  } catch {
    return { version: 1, attempts: [] };
  }
}

function save(store: AttemptStore) {
  const target = storePath();
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, target);
}

export interface PublicAttemptCase {
  id: string;
  semptom: string;
  alan: string;
  seviye: Vaka["seviye"];
  hasta: Vaka["hasta"];
  soruChipleri: Vaka["soruChipleri"];
  testler: Array<{ testKey: string; testAdi: string }>;
}

/**
 * Sadece sahibinin devam ettiği oturuma gönderilen ilerleme verisi.
 * Yeni vaka başlangıcında cevaplar ve sonuçlar asla istemciye gönderilmez.
 */
export interface ResumableAttemptCase extends PublicAttemptCase {
  ilerleme: {
    yanitlar: Array<{ aksiyon: string; yanit: string }>;
    testSonuclari: TestSonucu[];
  };
}

function toPublicAttempt(record: AttemptRecord): PublicAttemptCase {
  return {
    id: record.id,
    semptom: record.vaka.semptom,
    alan: record.vaka.alan,
    seviye: record.vaka.seviye,
    hasta: record.vaka.hasta,
    soruChipleri: record.vaka.soruChipleri,
    testler: Object.values(record.vaka.statikTestler).map((test) => ({
      testKey: test.testKey,
      testAdi: test.testAdi,
    })),
  };
}

function attemptAnswer(record: AttemptRecord, action: string) {
  return record.vaka.hastaYanitlari[action] || record.vaka.hastaYanitlari.OZEL || "Bu konuda ek bilgi veremiyorum.";
}

function attemptTest(record: AttemptRecord, testKey: string) {
  const { vaka } = record;
  return vaka.statikTestler[testKey] || (vaka.profile ? getLabResult(testKey, vaka.profile, vaka.statikTestler) : null);
}

function toResumableAttempt(record: AttemptRecord): ResumableAttemptCase {
  return {
    ...toPublicAttempt(record),
    ilerleme: {
      yanitlar: record.sorulanAksiyonlar.map((aksiyon) => ({ aksiyon, yanit: attemptAnswer(record, aksiyon) })),
      testSonuclari: record.istenenTestler
        .map((testKey) => attemptTest(record, testKey))
        .filter((test): test is TestSonucu => test !== null),
    },
  };
}

function ownAttempt(id: string, actor: string): { store: AttemptStore; attempt: AttemptRecord } | null {
  const store = load();
  const attempt = store.attempts.find((item) => item.id === id && item.actor === actor);
  return attempt ? { store, attempt } : null;
}

export function startStudentAttempt(actor: string, poliklinikKey: string): PublicAttemptCase | null {
  const candidates = loadCasesStore().cases.filter(
    (item) => item.durum === "aktif" && (poliklinikKey === "*" || item.poliklinikKey === poliklinikKey)
  );
  if (!candidates.length) return null;

  const template = candidates[Math.floor(Math.random() * candidates.length)];
  const record: AttemptRecord = {
    id: crypto.randomUUID(),
    actor,
    poliklinikKey,
    vaka: adminVakaToPlayable(template),
    sorulanAksiyonlar: [],
    istenenTestler: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const store = load();
  store.attempts.push(record);
  save(store);
  return toPublicAttempt(record);
}

/** Aynı kullanıcı ve poliklinik için son 12 saatte güncellenmiş vakayı döndürür. */
export function getActiveStudentAttempt(actor: string, poliklinikKey: string): ResumableAttemptCase | null {
  const candidates = load().attempts.filter(
    (attempt) =>
      attempt.actor === actor &&
      (poliklinikKey === "*" || attempt.poliklinikKey === poliklinikKey || attempt.vaka.profile?.poliklinikKey === poliklinikKey)
  );
  const latest = candidates.reduce<AttemptRecord | null>(
    (current, attempt) => (!current || attempt.updatedAt > current.updatedAt ? attempt : current),
    null
  );
  return latest ? toResumableAttempt(latest) : null;
}

export function answerStudentAttempt(id: string, actor: string, action: string): string | null {
  const found = ownAttempt(id, actor);
  if (!found) return null;
  if (!found.attempt.sorulanAksiyonlar.includes(action)) found.attempt.sorulanAksiyonlar.push(action);
  found.attempt.updatedAt = Date.now();
  save(found.store);
  return attemptAnswer(found.attempt, action);
}

export function requestStudentAttemptTest(id: string, actor: string, testKey: string): TestSonucu | null {
  const found = ownAttempt(id, actor);
  if (!found) return null;
  const result = attemptTest(found.attempt, testKey);
  if (!result) return null;
  if (!found.attempt.istenenTestler.includes(testKey)) found.attempt.istenenTestler.push(testKey);
  found.attempt.updatedAt = Date.now();
  save(found.store);
  return result;
}

export function completeStudentAttempt(id: string, actor: string, taniGirildi: string): DegerlendirmeSonuc | null {
  const found = ownAttempt(id, actor);
  if (!found) return null;
  const sonuc = degerlendir(found.attempt.vaka, found.attempt.sorulanAksiyonlar, found.attempt.istenenTestler, taniGirildi);
  if (!actor.startsWith("guest:")) recordPlaySession({
    caseId: found.attempt.vaka.id,
    hastalikKey: found.attempt.vaka.hastalik,
    poliklinikKey: found.attempt.vaka.profile?.poliklinikKey || "",
    actor,
    mode: "ogrenci",
    toplamPuan: sonuc.toplamPuan,
    maxPuan: sonuc.maxPuan,
    taniDogru: sonuc.taniDogru,
    atlananRedFlagler: sonuc.atlananRedFlagler,
    gereksizTestler: sonuc.gereksizTestler,
    eksikSorular: sonuc.eksikSorular,
    eksikTestler: sonuc.eksikTestler,
    anamnezCoverage: sonuc.anamnezAnalizi.toplamBeklenen ? Math.round(sonuc.anamnezAnalizi.toplamSoruldu / sonuc.anamnezAnalizi.toplamBeklenen * 100) : undefined,
  }, actor);
  found.store.attempts = found.store.attempts.filter((item) => item.id !== id);
  save(found.store);
  return sonuc;
}
