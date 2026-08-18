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
  it("tanımsız veya json değeriyle JSON deposunu seçer", () => {
    expect(storeMode()).toBe("json");
    expect(storeMode("")).toBe("json");
    expect(storeMode("json")).toBe("json");
  });

  it("PostgreSQL'i yalnızca açık postgres değeriyle seçer", () => {
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

  it("gerçek kullanıcılar STORE_MODE'ya göre yönlendirilir", () => {
    process.env.STORE_MODE = "json";
    expect(shouldUsePostgresStore("ogrenci")).toBe(false);
    process.env.STORE_MODE = "postgres";
    expect(shouldUsePostgresStore("ogrenci")).toBe(true);
  });
});
