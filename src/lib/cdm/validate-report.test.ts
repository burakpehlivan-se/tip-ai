import { describe, expect, it } from "vitest";
import { validateVakaDocument, validateAdminVaka } from "./validate-report";
import { EXAMPLE_CDM_KBH } from "./example-kbh";
import { cdmToAdminVaka, adminVakaToCdm } from "./convert";

describe("validateVakaDocument", () => {
  it("örnek KBH belgesini geçerli kabul eder", () => {
    const result = validateVakaDocument(EXAMPLE_CDM_KBH);
    expect(result.status).toBe("valid");
    expect(result.errors.length).toBe(0);
  });

  it("cdmVersion uyuşmazlığında warning üretir (legacy toleransı)", () => {
    const doc = { ...EXAMPLE_CDM_KBH, cdmVersion: "tip-ai-cdm-v0" as never };
    const result = validateVakaDocument(doc);
    expect(result.status).toBe("valid_with_warnings");
    expect(result.warnings.some((w) => w.code === "CDM_VERSION_MISMATCH")).toBe(true);
  });

  it("rubric beklenenTestler boşsa uyarı/hatası üretir", () => {
    const doc = {
      ...EXAMPLE_CDM_KBH,
      rubric: { ...EXAMPLE_CDM_KBH.rubric, beklenenTestler: [] },
    };
    const result = validateVakaDocument(doc);
    expect(result.status).not.toBe("valid");
  });

  it("meta.durum geçersizse invalid döner", () => {
    const doc = {
      ...EXAMPLE_CDM_KBH,
      meta: { ...EXAMPLE_CDM_KBH.meta, durum: "bilinmeyen" as never },
    };
    const result = validateVakaDocument(doc);
    expect(result.status).toBe("invalid");
  });

  it("aktif vakada eksik beklenen hasta yanıtını hata sayar", () => {
    const { ODEM_SURE: _removed, ...yanitlar } = EXAMPLE_CDM_KBH.hastaYanitlari;
    const result = validateVakaDocument({ ...EXAMPLE_CDM_KBH, hastaYanitlari: yanitlar });

    expect(result.status).toBe("invalid");
    expect(result.errors.some((issue) => issue.code === "MISSING_ANSWER_FOR_QUESTION")).toBe(true);
  });

  it("sayısal testte birim ve referans aralığı eksikse uyarır", () => {
    const kreatinin = EXAMPLE_CDM_KBH.labs.statikTestler.KREATININ;
    const result = validateVakaDocument({
      ...EXAMPLE_CDM_KBH,
      labs: {
        ...EXAMPLE_CDM_KBH.labs,
        statikTestler: {
          ...EXAMPLE_CDM_KBH.labs.statikTestler,
          KREATININ: {
            ...kreatinin,
            sonuc: { deger: 2.1 },
          },
        },
      },
    });

    expect(result.warnings.some((issue) => issue.code === "LAB_MISSING_UNIT")).toBe(true);
    expect(result.warnings.some((issue) => issue.code === "LAB_MISSING_REFERENCE_RANGE")).toBe(true);
  });
});

describe("validateAdminVaka + CDM round-trip", () => {
  it("CDM → AdminVaka → CDM dönüşümü id ve ana alanları korur", () => {
    const av = cdmToAdminVaka(EXAMPLE_CDM_KBH);
    const back = adminVakaToCdm(av);
    expect(back.id).toBe(EXAMPLE_CDM_KBH.id);
    expect(back.meta.hastalikKey).toBe(EXAMPLE_CDM_KBH.meta.hastalikKey);
    expect(back.presentation.anaSikayet).toBe(EXAMPLE_CDM_KBH.presentation.anaSikayet);
    expect(back.rubric.kabulEdilenTani).toEqual(EXAMPLE_CDM_KBH.rubric.kabulEdilenTani);
    expect(back.rubric.beklenenSorular[0].kategori).toBe("Sikayet");
    expect(back.vitals?.solunum).toBe(18);
    expect(back.management.tedavi?.ilaclar?.[0]?.siklik).toBe("Günde 1 kez");
    expect(back.management.tedavi?.ilaclar?.[0]?.sure).toContain("kreatinin");
  });

  it("AdminVaka CDM'e dönüştürülüp geri validate edilebilir", () => {
    const av = cdmToAdminVaka(EXAMPLE_CDM_KBH);
    const validation = validateAdminVaka(av);
    expect(validation.status).toBe("valid");
  });
});
