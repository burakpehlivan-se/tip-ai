import { describe, expect, it } from "vitest";
import { adminVakaToPlayable } from "./case-to-vaka";
import { caseContentChecksum } from "./case-integrity";
import type { AdminVaka } from "./types";

function fixture(): AdminVaka {
  const now = Date.now();
  return {
    id: "dahiliye::hipertansiyon", poliklinikKey: "dahiliye", poliklinikAd: "Dahiliye",
    poliklinikIcon: "🏥", poliklinikAciklama: "", hastalikKey: "hipertansiyon",
    hastalikAdi: "Hipertansiyon", seviye: "orta", yasAraligi: [40, 60],
    cinsiyetTercih: "herhangi", anaSikayet: "Baş ağrısı", ozetBilgiler: [],
    semptomSablon: "Baş ağrısı", rubric: {
      beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [],
      kabulEdilenTani: ["Hipertansiyon"], puanlama: {},
    }, statikTestler: {}, hastaYanitlari: { OZEL: "Ek bilgi yok" }, idealYol: ["Ölçüm"],
    egitimNotu: "", durum: "aktif", etiketler: [], surum: 2, uzmanOnayi: true,
    createdAt: now, updatedAt: now,
  };
}

describe("admin vaka → oynanabilir vaka", () => {
  it("kaynak sürüm/checksum damgasını ve bağımsız rubrik anlık görüntüsünü taşır", () => {
    const source = fixture();
    const playable = adminVakaToPlayable(source);

    expect(playable.sourceCaseVersion).toBe(2);
    expect(playable.sourceCaseChecksum).toBe(caseContentChecksum(source));

    source.rubric.kabulEdilenTani.push("Sonradan eklenen");
    expect(playable.rubric.kabulEdilenTani).toEqual(["Hipertansiyon"]);
  });
});
