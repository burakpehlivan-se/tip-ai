import { describe, expect, it } from "vitest";
import { authUserStoreMode } from "./runtime-user-store";

describe("runtime kullanıcı deposu seçimi", () => {
  it("tanımsız veya json değeriyle JSON deposunu seçer", () => {
    expect(authUserStoreMode()).toBe("json");
    expect(authUserStoreMode("")).toBe("json");
    expect(authUserStoreMode("json")).toBe("json");
  });

  it("PostgreSQL'i yalnızca açık postgres değeriyle seçer", () => {
    expect(authUserStoreMode("postgres")).toBe("postgres");
  });

  it("belirsiz bir değeri sessizce başka depoya yönlendirmez", () => {
    expect(() => authUserStoreMode("sqlite")).toThrow("AUTH_USER_STORE");
  });
});
