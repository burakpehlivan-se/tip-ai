import { describe, expect, it } from "vitest";
import { parseCasePatchInput, parseCreateCaseInput } from "./case-input";

describe("admin vaka request parser", () => {
  it("yasAraligi sayı çifti değilse patch'i reddeder", () => {
    expect(parseCasePatchInput({ yasAraligi: "30,70" })).toEqual({
      ok: false,
      issues: [{ field: "yasAraligi", message: "[min, max] sayı çifti olmalı." }],
    });
  });

  it("yalnızca izinli ve tiplenmiş patch alanlarını döndürür", () => {
    expect(
      parseCasePatchInput({
        anaSikayet: "Göğüs ağrısı",
        durum: "taslak",
        unexpected: "depo dışı",
      })
    ).toEqual({
      ok: true,
      value: { anaSikayet: "Göğüs ağrısı", durum: "taslak" },
    });
  });

  it("geçersiz vital değerini alan bazlı hata ile reddeder", () => {
    expect(parseCasePatchInput({ vitals: { spo2: 120 } })).toEqual({
      ok: false,
      issues: [{ field: "vitals.spo2", message: "50 ile 100 arasında sayı olmalı." }],
    });
  });

  it("boş klinikKaynakTarihi'ni eksik kabul edip patch'i reddetmez", () => {
    expect(parseCasePatchInput({ klinikKaynakTarihi: "" })).toEqual({
      ok: true,
      value: {},
    });
  });

  it("oluşturma isteğinde kimlik alanlarını ve normalleştirilmiş key'i döndürür", () => {
    expect(
      parseCreateCaseInput({
        poliklinikKey: " kardiyoloji ",
        hastalikKey: " Akut Koroner Sendrom ",
        hastalikAdi: "Akut Koroner Sendrom",
      })
    ).toEqual({
      ok: true,
      value: {
        poliklinikKey: "kardiyoloji",
        hastalikKey: "akut-koroner-sendrom",
        hastalikAdi: "Akut Koroner Sendrom",
      },
    });
  });
});
