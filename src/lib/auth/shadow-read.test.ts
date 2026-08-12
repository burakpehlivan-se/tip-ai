import { describe, expect, it } from "vitest";
import { isAuthShadowReadEnabled, userParity } from "./shadow-read";

const jsonUser = {
  username: "ogrenci.ornek",
  role: "ogrenci" as const,
  active: true,
  superAdmin: false,
  displayName: "Örnek Öğrenci",
};

describe("auth shadow-read parity", () => {
  it("yalnızca açık 1 değeriyle etkinleşir", () => {
    expect(isAuthShadowReadEnabled("1")).toBe(true);
    expect(isAuthShadowReadEnabled("true")).toBe(false);
    expect(isAuthShadowReadEnabled("0")).toBe(false);
    expect(isAuthShadowReadEnabled(undefined)).toBe(false);
  });

  it("eş kullanıcı kaydını match olarak sınıflar", () => {
    expect(userParity(jsonUser, { ...jsonUser })).toEqual({ outcome: "match" });
  });

  it("güvenlik alanlarındaki ayrışmayı kullanıcı verisi döndürmeden belirtir", () => {
    expect(
      userParity(jsonUser, { ...jsonUser, role: "doktor", active: false, displayName: "Başka ad" })
    ).toEqual({ outcome: "mismatch", fields: ["role", "active", "displayName"] });
  });

  it("PostgreSQL'de olmayan kullanıcıyı ayrı bir sonuç olarak bildirir", () => {
    expect(userParity(jsonUser, null)).toEqual({ outcome: "postgres_missing" });
  });
});
