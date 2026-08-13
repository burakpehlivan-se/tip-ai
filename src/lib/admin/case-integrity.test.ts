import { describe, expect, it } from "vitest";
import { caseContentChecksum, caseVersionStamp } from "./case-integrity";
import type { AdminVaka } from "./types";

function fixture(): AdminVaka {
  const now = 1_700_000_000_000;
  return {
    id: "acil::gogus-agrisi",
    poliklinikKey: "acil",
    poliklinikAd: "Acil",
    poliklinikIcon: "🏥",
    poliklinikAciklama: "",
    hastalikKey: "gogus-agrisi",
    hastalikAdi: "Göğüs ağrısı",
    seviye: "orta",
    yasAraligi: [40, 70],
    cinsiyetTercih: "herhangi",
    anaSikayet: "Göğüs ağrısı",
    ozetBilgiler: ["Ani başlangıç"],
    semptomSablon: "Göğüs ağrısı",
    rubric: {
      beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [],
      kabulEdilenTani: ["AKS"], puanlama: { tani_dogru: 5 },
    },
    statikTestler: {},
    hastaYanitlari: { OZEL: "Ek bilgi yok" },
    idealYol: ["EKG"],
    egitimNotu: "Acil değerlendirme",
    durum: "aktif",
    etiketler: ["Acil"],
    surum: 4,
    uzmanOnayi: true,
    updatedAt: now,
    createdAt: now,
  };
}

describe("vaka içerik bütünlüğü", () => {
  it("audit/yayın alanları değişse bile içerik checksum'ını korur", () => {
    const vaka = fixture();
    const before = caseContentChecksum(vaka);
    expect(caseContentChecksum({ ...vaka, updatedAt: vaka.updatedAt + 1, etiketler: ["Yeni"] })).toBe(before);
  });

  it("skoru etkileyen içerik değişince checksum değişir", () => {
    const vaka = fixture();
    expect(caseContentChecksum({ ...vaka, idealYol: ["EKG", "Troponin"] })).not.toBe(caseContentChecksum(vaka));
  });

  it("sürüm damgası kaynak sürüm ve checksum'ı birlikte taşır", () => {
    const vaka = fixture();
    expect(caseVersionStamp(vaka)).toEqual({ version: 4, checksum: caseContentChecksum(vaka) });
  });
});
