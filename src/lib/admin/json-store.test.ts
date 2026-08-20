import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJsonCacheForTests, readJsonOrRecover, readJsonWithFallback, writeJsonAtomic } from "./json-store";

describe("json-store cache", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-cache-"));
    file = path.join(dir, "test.json");
    clearJsonCacheForTests();
  });

  afterEach(() => {
    clearJsonCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("ikinci okuma mtime aynıysa fs.readFileSync çağrılmaz (hit)", () => {
    fs.writeFileSync(file, JSON.stringify({ a: 1 }));
    const spy = vi.spyOn(fs, "readFileSync");
    const first = readJsonWithFallback(file, { a: 0 }, "test");
    expect(first).toEqual({ a: 1 });
    const callsAfterFirst = spy.mock.calls.length;
    const second = readJsonWithFallback(file, { a: 0 }, "test");
    expect(second).toEqual({ a: 1 });
    // ikinci okuma cache hit -> ek readFileSync yok
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("writeJsonAtomic sonrası cache güncellenir, okuma hit eder", () => {
    fs.writeFileSync(file, JSON.stringify({ a: 1 }));
    expect(readJsonWithFallback(file, { a: 0 }, "test")).toEqual({ a: 1 });
    writeJsonAtomic(file, { a: 2 });
    const spy = vi.spyOn(fs, "readFileSync");
    const afterWrite = readJsonWithFallback(file, { a: 0 }, "test");
    expect(afterWrite).toEqual({ a: 2 });
    // write sonrası cache güncellendiği için tekrar readFileSync yok
    expect(spy).not.toHaveBeenCalled();
  });

  it("harici mtime değişirse cache miss ve yeni veri döner", async () => {
    fs.writeFileSync(file, JSON.stringify({ a: 1 }));
    expect(readJsonWithFallback(file, { a: 0 }, "test")).toEqual({ a: 1 });
    // mtime değişmesi için 10ms bekle ve dosyayı dışarıdan değiştir
    await new Promise((r) => setTimeout(r, 15));
    fs.writeFileSync(file, JSON.stringify({ a: 99 }));
    expect(readJsonWithFallback(file, { a: 0 }, "test")).toEqual({ a: 99 });
  });

  it("readJsonOrRecover bozuk dosyada throw eder ve cache'i temizler", () => {
    fs.writeFileSync(file, JSON.stringify({ a: 1 }));
    expect(readJsonOrRecover(file, { a: 0 }, "test")).toEqual({ a: 1 });
    fs.writeFileSync(file, "{ bozuk json");
    expect(() => readJsonOrRecover(file, { a: 0 }, "test")).toThrow();
    // düzeltildikten sonra tekrar okunabilir
    fs.writeFileSync(file, JSON.stringify({ a: 2 }));
    expect(readJsonOrRecover(file, { a: 0 }, "test")).toEqual({ a: 2 });
  });

  it("readJsonWithFallback bozuk dosyada fallback döner ve tekrar bozuk okumada yine fallback", () => {
    fs.writeFileSync(file, "{ bozuk");
    expect(readJsonWithFallback(file, { a: 42 }, "test")).toEqual({ a: 42 });
    expect(readJsonWithFallback(file, { a: 42 }, "test")).toEqual({ a: 42 });
  });
});
