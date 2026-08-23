import { describe, expect, it } from "vitest";
import type { Vaka } from "@/lib/types";
import { simulatedPatientAnswer } from "./engine";

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
});
