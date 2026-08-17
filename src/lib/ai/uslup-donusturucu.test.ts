import { describe, expect, it } from "vitest";
import { uslupDonustur } from "./uslup-donusturucu";
import type { HastaTipi } from "@/lib/admin/types";

function tip(id: string): HastaTipi {
  return {
    id,
    ad: id,
    yasAraligi: [30, 70],
    cinsiyetTercih: "herhangi",
    komorbiditeler: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("uslupDonustur", () => {
  it("nötr (sakin) tipte taban cevabı olduğu gibi döndürür", async () => {
    const yanit = await uslupDonustur({
      vakaId: "v1",
      tip: tip("sakin"),
      actionKey: "VITAL_TANSIYON",
      baseCevap: "Tansiyonum 150/90",
    });
    expect(yanit).toBe("Tansiyonum 150/90");
  });

  it("hasta tipi yoksa taban cevabı olduğu gibi döndürür", async () => {
    const yanit = await uslupDonustur({
      vakaId: "v1",
      tip: null,
      actionKey: "VITAL_TANSIYON",
      baseCevap: "Tansiyonum 150/90",
    });
    expect(yanit).toBe("Tansiyonum 150/90");
  });
});
