import { afterEach, describe, expect, it } from "vitest";
import { isShadowReadEnabled, shouldUsePostgresStore, storeMode } from "./store-mode";

const OLD_ENV = process.env.STORE_MODE;
const OLD_SHADOW = process.env.STORE_SHADOW_READ;

afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.STORE_MODE;
  else process.env.STORE_MODE = OLD_ENV;
  if (OLD_SHADOW === undefined) delete process.env.STORE_SHADOW_READ;
  else process.env.STORE_SHADOW_READ = OLD_SHADOW;
});

describe("storeMode", () => {
  it("tanımsız, boş veya legacy json değeriyle testte json, prod'da postgres'e düşer", () => {
    // test default is json
    expect(storeMode()).toBe("json");
    expect(storeMode("")).toBe("json");
    expect(storeMode("json")).toBe("json");
    // prod fallback
    const oldNode = process.env.NODE_ENV;
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "production";
    expect(storeMode("json")).toBe("postgres");
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = oldNode;
  });

  it("postgres değerini korur", () => {
    expect(storeMode("postgres")).toBe("postgres");
  });

  it("belirsiz bir değerde hata fırlatır", () => {
    expect(() => storeMode("sqlite")).toThrow("STORE_MODE");
  });
});

describe("isShadowReadEnabled", () => {
  it("yalnızca 1 veya true ile etkinleşir", () => {
    expect(isShadowReadEnabled("1")).toBe(true);
    expect(isShadowReadEnabled("true")).toBe(true);
    expect(isShadowReadEnabled("0")).toBe(false);
    expect(isShadowReadEnabled("false")).toBe(false);
    expect(isShadowReadEnabled(undefined)).toBe(false);
    expect(isShadowReadEnabled("")).toBe(false);
  });

  it("geçersiz değerde hata fırlatar", () => {
    expect(() => isShadowReadEnabled("yes")).toThrow("STORE_SHADOW_READ");
  });
});

describe("shouldUsePostgresStore", () => {
  it("guest aktörler her zaman JSON kullanır", () => {
    process.env.STORE_MODE = "postgres";
    expect(shouldUsePostgresStore("guest:abc-123")).toBe(false);
  });

  it("gerçek kullanıcılar her zaman postgres kullanır (json fallback)", () => {
    const oldNode = process.env.NODE_ENV;
    // testte json -> postgres kullanmaz
    process.env.STORE_MODE = "json";
    expect(shouldUsePostgresStore("ogrenci")).toBe(false);
    // prod'da json fallback postgres
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = "production";
    expect(shouldUsePostgresStore("ogrenci")).toBe(true);
    (process.env as unknown as Record<string, string | undefined>).NODE_ENV = oldNode;
    process.env.STORE_MODE = "postgres";
    expect(shouldUsePostgresStore("ogrenci")).toBe(true);
  });
});
