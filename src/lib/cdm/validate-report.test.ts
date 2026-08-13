import { describe, expect, it } from "vitest";
import {
  validateCdmReadiness,
  validateVakaDocument,
  validateAdminVaka,
  validateAdminVakaForPublication,
} from "./validate-report";
import { EXAMPLE_CDM_KBH } from "./example-kbh";
import { cdmToAdminVaka, adminVakaToCdm } from "./convert";
import { validateCdmShape } from "./validation-rules";

describe("validateVakaDocument", () => {
  it("accepts a structurally valid draft but marks missing clinical answers as not publication-ready", () => {
    const { ODEM_SURE: _removed, ...hastaYanitlari } = EXAMPLE_CDM_KBH.hastaYanitlari;
    const draft = {
      ...EXAMPLE_CDM_KBH,
      meta: { ...EXAMPLE_CDM_KBH.meta, durum: "taslak" as const },
      hastaYanitlari,
    };

    expect(validateCdmShape(draft)).toEqual([]);
    expect(validateCdmReadiness(draft).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_ANSWER_FOR_QUESTION",
          field: "hastaYanitlari.ODEM_SURE",
        }),
      ])
    );
  });

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

  it("yayın kapısı hata içeren vakayı engeller", () => {
    const av = cdmToAdminVaka(EXAMPLE_CDM_KBH);
    const { ODEM_SURE: _removed, ...hastaYanitlari } = av.hastaYanitlari;
    const result = validateAdminVakaForPublication({ ...av, hastaYanitlari });

    expect(result.allowed).toBe(false);
    expect(result.validation.errors.some((issue) => issue.code === "MISSING_ANSWER_FOR_QUESTION")).toBe(true);
  });

  it("yayın kapısında kaynak, tarih ve eğitim hedefi zorunludur", () => {
    const av = cdmToAdminVaka(EXAMPLE_CDM_KBH);
    const missingGovernance = validateAdminVakaForPublication(av);
    expect(missingGovernance.allowed).toBe(false);
    expect(missingGovernance.validation.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "MISSING_CLINICAL_SOURCE",
      "MISSING_SOURCE_DATE",
      "MISSING_LEARNING_OBJECTIVE",
    ]));

    const approved = validateAdminVakaForPublication({
      ...av,
      klinikKaynak: "Örnek klinik kaynak",
      klinikKaynakTarihi: "2026-08-13",
      egitimHedefleri: ["Kritik bulguları yapılandırılmış biçimde değerlendirir."],
    });
    expect(approved.allowed).toBe(true);
  });
});
