import { describe, expect, it } from "vitest";
import { compareCaseStoreShadow } from "./case-store-shadow";
import type { CasesStore } from "./types";

function store(version: number, checksum: string, publishedChecksum = "published-v1"): CasesStore {
  return {
    version: 1,
    seededAt: 0,
    updatedAt: 1,
    changeCount: 0,
    cases: [
      {
        id: "acil::fixture",
        poliklinikKey: "acil",
        poliklinikAd: "Acil",
        poliklinikIcon: "🏥",
        poliklinikAciklama: "",
        hastalikKey: "fixture",
        hastalikAdi: "Fixture",
        seviye: "orta",
        yasAraligi: [30, 70],
        cinsiyetTercih: "herhangi",
        anaSikayet: "",
        ozetBilgiler: [],
        semptomSablon: "",
        rubric: { beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [], kabulEdilenTani: [], puanlama: {} as never },
        statikTestler: {},
        hastaYanitlari: {},
        idealYol: [],
        egitimNotu: "",
        durum: "aktif",
        etiketler: [],
        surum: version,
        uzmanOnayi: true,
        incelemeDurumu: "onayli",
        contentChecksum: checksum,
        createdAt: 0,
        updatedAt: 1,
      },
    ],
    publishedVersions: [
      {
        id: "acil::fixture@1",
        caseId: "acil::fixture",
        version: 1,
        contentChecksum: publishedChecksum,
        approvedBy: "reviewer",
        approvedAt: 1,
        content: {} as CasesStore["cases"][number],
      },
    ],
  };
}

describe("case-store shadow summary", () => {
  it("yalnızca eşitlik sayaçlarını döndürür", () => {
    expect(compareCaseStoreShadow(store(1, "v1"), store(1, "v1"))).toMatchObject({
      matches: true,
      sourceCases: 1,
      replicaCases: 1,
      caseChecksumMismatches: 0,
    });
  });

  it("sürüm/checksum sapmasını güvenli sayaçlarla bildirir", () => {
    expect(compareCaseStoreShadow(store(1, "v1", "published-v1"), store(2, "v2", "published-v2"))).toMatchObject({
      matches: false,
      caseVersionMismatches: 1,
      caseChecksumMismatches: 1,
      publishedVersionChecksumMismatches: 1,
    });
  });
});
