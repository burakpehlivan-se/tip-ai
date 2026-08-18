import { describe, expect, it, vi } from "vitest";

const runtimeStore = vi.hoisted(() => ({ listRuntimeCasesGrouped: vi.fn() }));

vi.mock("@/lib/admin/runtime-case-store", () => runtimeStore);

import { caseIdFromVakaNo, parseVakaNo, vakaNoFromCaseId } from "./vaka-no";

const groups = [
  {
    poliklinikKey: "beyin-cerrahisi",
    poliklinikAd: "Beyin Cerrahisi",
    poliklinikIcon: "🧠",
    cases: [
      { id: "beyin-cerrahisi::epilepsi" },
      { id: "beyin-cerrahisi::tumor" },
      { id: "beyin-cerrahisi::anevrizma" },
    ],
  },
  {
    poliklinikKey: "endokrin",
    poliklinikAd: "Endokrin",
    poliklinikIcon: "🫁",
    cases: [
      { id: "endokrin::tip2-dm" },
      { id: "endokrin::hipotiroidi" },
    ],
  },
];

describe("parseVakaNo", () => {
  it("4 haneli geçerli numaraları ayrıştırır", () => {
    expect(parseVakaNo("0307")).toEqual({ poliklinikSira: 3, vakaSira: 7 });
    expect(parseVakaNo("0101")).toEqual({ poliklinikSira: 1, vakaSira: 1 });
    expect(parseVakaNo("1818")).toEqual({ poliklinikSira: 18, vakaSira: 18 });
  });

  it("geçersiz biçimleri reddeder", () => {
    expect(parseVakaNo("")).toBeNull();
    expect(parseVakaNo("abc")).toBeNull();
    expect(parseVakaNo("12345")).toBeNull();
    expect(parseVakaNo("030")).toBeNull();
    expect(parseVakaNo("0007")).toBeNull();
    expect(parseVakaNo("0300")).toBeNull();
  });
});

describe("vakaNoFromCaseId", () => {
  it("caseId'yi alfabetik poliklinik sırasına göre numaralandırır", async () => {
    runtimeStore.listRuntimeCasesGrouped.mockResolvedValue(groups);
    expect(await vakaNoFromCaseId("beyin-cerrahisi::tumor")).toBe("0102");
    expect(await vakaNoFromCaseId("endokrin::tip2-dm")).toBe("0201");
    expect(await vakaNoFromCaseId("beyin-cerrahisi::anevrizma")).toBe("0103");
  });

  it("bulunamayan caseId'de null döner", async () => {
    runtimeStore.listRuntimeCasesGrouped.mockResolvedValue(groups);
    expect(await vakaNoFromCaseId("olmayan::vaka")).toBeNull();
  });
});

describe("caseIdFromVakaNo", () => {
  it("vaka no'yu caseId ve poliklinik anahtarına çözer", async () => {
    runtimeStore.listRuntimeCasesGrouped.mockResolvedValue(groups);
    expect(await caseIdFromVakaNo("0102")).toEqual({
      caseId: "beyin-cerrahisi::tumor",
      poliklinikKey: "beyin-cerrahisi",
    });
    expect(await caseIdFromVakaNo("0202")).toEqual({
      caseId: "endokrin::hipotiroidi",
      poliklinikKey: "endokrin",
    });
  });

  it("sınır dışı veya geçersiz numaralarda null döner", async () => {
    runtimeStore.listRuntimeCasesGrouped.mockResolvedValue(groups);
    expect(await caseIdFromVakaNo("0301")).toBeNull();
    expect(await caseIdFromVakaNo("0104")).toBeNull();
    expect(await caseIdFromVakaNo("9999")).toBeNull();
    expect(await caseIdFromVakaNo("geçersiz")).toBeNull();
  });
});