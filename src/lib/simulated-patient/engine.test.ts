import { describe, expect, it } from "vitest";
import type { Vaka } from "@/lib/types";
import { simulatedPatientAnswer } from "./engine";
import { enrichHastaYanitlari } from "@/lib/data/hasta-yanit-enrich";
import { vakaChipleriniUret } from "@/lib/data/vaka-chip-uretici";

const vaka: Vaka = {
  id: "vaka-1",
  semptom: "göğüs ağrısı",
  hastalik: "gizli",
  alan: "kardiyoloji",
  seviye: "orta",
  hasta: { ad: "A", tamAd: "A Hasta", tc: "", yas: 58, cinsiyet: "E", anaSikayet: "Göğsümde sıkışma var.", ozetBilgiler: [] },
  beklenenTani: ["STEMI"],
  rubric: { beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [], kabulEdilenTani: [], puanlama: {} },
  statikTestler: {
    TROPONIN: { testKey: "TROPONIN", testAdi: "Troponin I", tip: "text", sonuc: "Yüksek" },
  },
  hastaYanitlari: {
    AGRI_SURE: "Yaklaşık bir buçuk saat önce başladı.",
    AGRI_YAYILIM: "Sol koluma ve çeneme doğru vuruyor.",
    VITAL_TANSIYON: "165/95",
    SIZINTI: "EKG'de ST elevasyonu var.",
  },
  soruChipleri: [
    { etiket: "Ağrı ne zamandır var?", aksiyon: "AGRI_SURE", kategori: "anamnez-agri" },
    { etiket: "Ağrı yayılıyor mu?", aksiyon: "AGRI_YAYILIM", kategori: "anamnez-agri" },
    { etiket: "Tansiyon kaç?", aksiyon: "VITAL_TANSIYON", kategori: "vital" },
    { etiket: "Sızıntı", aksiyon: "SIZINTI", kategori: "anamnez-agri" },
  ],
  relevantAksiyonlar: [],
};

describe("simulatedPatientAnswer", () => {
  it("aynı soruda bulunan iki anamnez slotunu birleştirir", () => {
    const reply = simulatedPatientAnswer(vaka, "Ağrı ne zamandır var, sol kolunuza yayılıyor mu?");
    expect(reply.channel).toBe("hasta");
    expect(reply.actions).toEqual(["AGRI_SURE", "AGRI_YAYILIM"]);
    expect(reply.answer).toContain("bir buçuk saat");
    expect(reply.answer).toContain("Sol koluma");
  });

  it("vital bilgiyi hasta sohbetinden vermez", () => {
    const reply = simulatedPatientAnswer(vaka, "Tansiyonunuz kaç?");
    expect(reply.channel).toBe("muayene");
    expect(reply.answer).not.toContain("165/95");
  });

  it("chip anahtarıyla gelen eski istemci isteğini de aynı kuralla sınırlar", () => {
    const reply = simulatedPatientAnswer(vaka, "VITAL_TANSIYON");
    expect(reply.channel).toBe("muayene");
    expect(reply.actions).toEqual(["VITAL_TANSIYON"]);
  });

  it("test veya tanı sızıntısı içeren slot yanıtını kullanıcıya vermez", () => {
    const leakCase = { ...vaka, hastaYanitlari: { ...vaka.hastaYanitlari, AGRI_SURE: "EKG'de ST elevasyonu var." } };
    const reply = simulatedPatientAnswer(leakCase, "Ağrı ne zamandır var?");
    expect(reply.answer).not.toMatch(/ekg|st elevasyon/i);
  });

  it("vakanın gizli tanısını içeren yanıtı kullanıcıya vermez", () => {
    const leakCase = { ...vaka, hastaYanitlari: { ...vaka.hastaYanitlari, AGRI_SURE: "STEMI geçiriyorum galiba." } };
    const reply = simulatedPatientAnswer(leakCase, "Ağrı ne zamandır var?");
    expect(reply.answer).not.toMatch(/stemi/i);
  });

  it("tetkik isteğini hasta sohbetinden ayırır", () => {
    const reply = simulatedPatientAnswer(vaka, "Troponin ve EKG istiyorum.");
    expect(reply.channel).toBe("tetkik");
    expect(reply.answer).not.toMatch(/yüksek/i);
  });

  it("serbest Türkçe soruyu Synthea vaka slotuna yönlendirir", () => {
    const syntheaVaka: Vaka = {
      ...vaka,
      hastaYanitlari: {
        CHIEF_COMPLAINT: "Yaklaşık bir haftadır öksürüyorum.",
        HISTORY_OF_PRESENT: "Öksürük soğuk algınlığından sonra başladı ve balgamlı.",
        MEDICATIONS: "Düzenli ilaç kullanmıyorum.",
      },
      soruChipleri: [
        { etiket: "Şikayetinizi biraz açar mısınız?", aksiyon: "CHIEF_COMPLAINT", kategori: "anamnez-sistemik" },
        { etiket: "Şikayetler nasıl başladı, nasıl seyrediyor?", aksiyon: "HISTORY_OF_PRESENT", kategori: "anamnez-sistemik" },
        { etiket: "Düzenli kullandığınız ilaç var mı?", aksiyon: "MEDICATIONS", kategori: "anamnez-oyku" },
      ],
    };

    expect(simulatedPatientAnswer(syntheaVaka, "Şikayetler nasıl başladı?")).toEqual(expect.objectContaining({
      channel: "hasta", actions: ["HISTORY_OF_PRESENT"], answer: expect.stringContaining("soğuk algınlığından"),
    }));
    expect(simulatedPatientAnswer(syntheaVaka, "Düzenli ilaç kullanıyor musunuz?")).toEqual(expect.objectContaining({
      channel: "hasta", actions: ["MEDICATIONS"], answer: "Düzenli ilaç kullanmıyorum.",
    }));
  });

  it("Synthea kaynak slotunu çelişebilen yerel varsayılandan öncelikli seçer", () => {
    const syntheaVaka: Vaka = {
      ...vaka,
      hastaYanitlari: {
        SIGARA: "Sigara kullanmıyorum.",
        SOCIAL_HISTORY: "Yirmi yıldır günde bir paket sigara içiyorum.",
        SIKAYET_SURE: "Şikayetim bir süredir devam ediyor.",
        HISTORY_OF_PRESENT: "Üç gün önce düştükten sonra kalça ağrım başladı.",
        ILAC: "Düzenli ilaç kullanmıyorum.",
        MEDICATIONS: "Doktorum ağrım için parasetamol ve ibuprofen yazdı.",
      },
      soruChipleri: [
        { etiket: "Sosyal öykü", aksiyon: "SOCIAL_HISTORY", kategori: "anamnez-oyku" },
        { etiket: "Şikayet öyküsü", aksiyon: "HISTORY_OF_PRESENT", kategori: "anamnez-sistemik" },
        { etiket: "İlaçlar", aksiyon: "MEDICATIONS", kategori: "anamnez-oyku" },
      ],
    };

    expect(simulatedPatientAnswer(syntheaVaka, "Sigara kullanıyor musunuz?")).toEqual(expect.objectContaining({
      actions: ["SOCIAL_HISTORY"], answer: expect.stringContaining("Yirmi yıldır"),
    }));
    expect(simulatedPatientAnswer(syntheaVaka, "Şikayetler nasıl başladı?")).toEqual(expect.objectContaining({
      actions: ["HISTORY_OF_PRESENT"], answer: expect.stringContaining("Üç gün önce"),
    }));
    expect(simulatedPatientAnswer(syntheaVaka, "Düzenli ilaç kullanıyor musunuz?")).toEqual(expect.objectContaining({
      actions: ["MEDICATIONS"], answer: expect.stringContaining("parasetamol"),
    }));
  });

  it("eşdeğer sigara ve ilaç aksiyonlarını tek, çelişkisiz cevaba indirir", () => {
    const hamYanitlar = {
      SIGARA: "Sigara kullanmıyorum.",
      SIGARA_OYKUSU: "Günde bir paket, 20 yıldır içiyorum.",
      ILAC: "Düzenli ilaç kullanmıyorum.",
      ILAC_OYKUSU: "Her gün metformin kullanıyorum.",
    };
    const chips = vakaChipleriniUret(hamYanitlar);
    const yanitlar = enrichHastaYanitlari(hamYanitlar, {
      chipHavuzu: chips,
      anaSikayet: "Öksürük",
    });
    const tutarliVaka: Vaka = { ...vaka, hastaYanitlari: yanitlar, soruChipleri: chips };

    expect(chips.filter((chip) => chip.aksiyon === "SIGARA")).toHaveLength(1);
    expect(chips.some((chip) => chip.aksiyon === "SIGARA_OYKUSU")).toBe(false);
    expect(yanitlar.SIGARA).toContain("20 yıldır");
    expect(yanitlar.ILAC).toContain("metformin");
    expect(simulatedPatientAnswer(tutarliVaka, "Kaç yıl sigara içtiniz?")).toEqual(expect.objectContaining({
      actions: ["SIGARA"], answer: expect.stringContaining("20 yıldır"),
    }));
    expect(simulatedPatientAnswer(tutarliVaka, "SIGARA_OYKUSU")).toEqual(expect.objectContaining({
      actions: ["SIGARA"], answer: expect.stringContaining("20 yıldır"),
    }));
  });
});
