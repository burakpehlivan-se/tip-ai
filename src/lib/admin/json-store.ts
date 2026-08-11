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
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (error) {
    quarantineCorruptJson(file, error, store);
    throw new JsonStoreReadError(store, error);
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
}
