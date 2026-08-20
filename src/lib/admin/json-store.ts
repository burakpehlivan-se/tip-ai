import fs from "fs";
import path from "path";
import { quarantineCorruptJson } from "./json-recovery";

export class JsonStoreReadError extends Error {
  constructor(store: string, cause: unknown) {
    super(`${store} okunamadı`);
    this.name = "JsonStoreReadError";
    this.cause = cause;
  }
}

// ── Basit in-process read cache (mtime kontrollü, ~30 satır, Redis yok) ──
const jsonCache = new Map<string, { mtimeMs: number; data: unknown }>();

function mtimeMs(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

function clone<T>(v: T): T {
  // Store.ts'deki clone ile aynı: JSON round-trip, undefined korunur
  if (v === undefined) return v;
  return JSON.parse(JSON.stringify(v)) as T;
}

export function invalidateJsonCache(file: string): void {
  jsonCache.delete(file);
}

export function clearJsonCacheForTests(): void {
  jsonCache.clear();
}

let writeChain: Promise<void> = Promise.resolve();

/** Tek Node sürecindeki read-modify-write işlemlerini sıraya koyar. */
export function withJsonStoreLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = writeChain.then(() => fn());
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Bozuk kalıcı JSON'u karantinaya alır; çağıranın isteği başarısız saymasını sağlar. */
export function readJsonOrRecover<T>(file: string, fallback: T, store: string): T {
  if (!fs.existsSync(file)) return clone(fallback);
  const mtime = mtimeMs(file);
  const cached = mtime !== null ? jsonCache.get(file) : undefined;
  if (cached && cached.mtimeMs === mtime) return clone(cached.data as T);
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    if (mtime !== null) jsonCache.set(file, { mtimeMs: mtime, data: clone(data) });
    return clone(data);
  } catch (error) {
    // Bozuk dosya cache'lenmez, karantinaya alınır ve tekrar okunmaz
    jsonCache.delete(file);
    quarantineCorruptJson(file, error, store);
    throw new JsonStoreReadError(store, error);
  }
}

/** store.ts gibi fallback dönen okumalar için cache'li versiyon (hata fırlatmaz). */
export function readJsonWithFallback<T>(file: string, fallback: T, storeLabel: string): T {
  if (!fs.existsSync(file)) return clone(fallback);
  const mtime = mtimeMs(file);
  const cached = mtime !== null ? jsonCache.get(file) : undefined;
  if (cached && cached.mtimeMs === mtime) return clone(cached.data as T);
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    if (mtime !== null) jsonCache.set(file, { mtimeMs: mtime, data: clone(data) });
    return clone(data);
  } catch (error) {
    jsonCache.delete(file);
    quarantineCorruptJson(file, error, storeLabel);
    return clone(fallback);
  }
}

/** Aynı dosya sistemi üzerinde fsync + atomic rename ile kalıcı JSON yazımı. */
export function writeJsonAtomic(file: string, data: unknown): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const handle = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(handle, JSON.stringify(data, null, 2), "utf8");
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(tmp, file);
  const dirHandle = fs.openSync(dir, "r");
  try {
    fs.fsyncSync(dirHandle);
  } finally {
    fs.closeSync(dirHandle);
  }
  // Yazma sonrası cache'i yeni mtime ile güncelle (bir sonraki okuma hit eder)
  const mtime = mtimeMs(file);
  if (mtime !== null) jsonCache.set(file, { mtimeMs: mtime, data: clone(data) });
  else jsonCache.delete(file);
}
