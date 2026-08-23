import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Vaka } from "@/lib/types";

const geminiChatMock = vi.fn();

vi.mock("@/lib/ai/gemini", () => ({
  geminiYapilandirilmisMi: () => true,
  geminiChat: (params: unknown) => geminiChatMock(params),
  jsonCikar: (content: string) => JSON.parse(content),
}));

import { simuleHastaYanitla } from "./gemini-response";

const vaka: Vaka = {
  id: "vaka-gemini",
  semptom: "göğüs ağrısı",
  hastalik: "gizli",
  alan: "kardiyoloji",
  seviye: "orta",
  hasta: { ad: "A", tamAd: "", tc: "", yas: 58, cinsiyet: "E", anaSikayet: "Göğsümde sıkışma var.", ozetBilgiler: [] },
  beklenenTani: ["STEMI"],
  rubric: { beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [], kabulEdilenTani: [], puanlama: {} },
  statikTestler: { TROPONIN: { testKey: "TROPONIN", testAdi: "Troponin I", tip: "text", sonuc: "Yüksek" } },
  hastaYanitlari: {
    AGRI_SURE: "Yaklaşık bir buçuk saat önce başladı.",
    AGRI_YAYILIM: "Sol koluma ve çeneme doğru vuruyor.",
    TERLEME: "Soğuk soğuk terliyorum.",
  },
  soruChipleri: [
    { etiket: "Ağrı ne zamandır var?", aksiyon: "AGRI_SURE", kategori: "anamnez-agri" },
    { etiket: "Ağrı yayılıyor mu?", aksiyon: "AGRI_YAYILIM", kategori: "anamnez-agri" },
    { etiket: "Terleme var mı?", aksiyon: "TERLEME", kategori: "anamnez-sistemik" },
  ],
  relevantAksiyonlar: [],
};

describe("simuleHastaYanitla", () => {
  beforeEach(() => {
    geminiChatMock.mockReset();
  });

  it("tek-slot standart soruyu Gemini çağrısı yapmadan deterministik yanıtlar", async () => {
    const reply = await simuleHastaYanitla({ vaka, question: "Ağrı ne zamandır var?", previousTurns: [] });
    expect(reply.answer).toBe("Yaklaşık bir buçuk saat önce başladı.");
    expect(geminiChatMock).not.toHaveBeenCalled();
  });

  it("çok-slotlu soruda yalnız seçilmiş slotlarla yapılandırılmış Gemini yanıtı üretir", async () => {
    geminiChatMock.mockResolvedValue({
      content: JSON.stringify({
        answer: "Bir buçuk saat kadar önce başladı doktor bey. Sol koluma ve çeneme doğru da vuruyor.",
        usedActions: ["AGRI_SURE", "AGRI_YAYILIM"],
      }),
    });
    const reply = await simuleHastaYanitla({
      vaka,
      question: "Ağrı ne zamandır var, sol kolunuza yayılıyor mu?",
      previousTurns: [],
    });

    expect(reply.answer).toMatch(/bir buçuk saat/i);
    expect(reply.actions).toEqual(["AGRI_SURE", "AGRI_YAYILIM"]);
    expect(geminiChatMock).toHaveBeenCalledWith(expect.objectContaining({
      responseSchema: expect.objectContaining({ type: "object" }),
    }));
    const prompt = geminiChatMock.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain("AGRI_SURE");
    expect(prompt).toContain("AGRI_YAYILIM");
    expect(prompt).not.toContain("TERLEME");
    expect(prompt).not.toContain("TROPONIN");
  });

  it("Gemini tanı veya tetkik sızdırırsa güvenli şablon yanıtına döner", async () => {
    geminiChatMock.mockResolvedValue({
      content: JSON.stringify({
        answer: "EKG'de sorun olduğu için bu ağrı başladı.",
        usedActions: ["AGRI_SURE", "AGRI_YAYILIM"],
      }),
    });
    const reply = await simuleHastaYanitla({
      vaka,
      question: "Ağrı ne zamandır var, sol kolunuza yayılıyor mu?",
      previousTurns: [],
    });
    expect(reply.answer).toBe("Yaklaşık bir buçuk saat önce başladı. Sol koluma ve çeneme doğru vuruyor.");
  });

  it("aynı slot yeniden sorulduğunda persona bağlamıyla Gemini varyasyonu ister", async () => {
    geminiChatMock.mockResolvedValue({
      content: JSON.stringify({
        answer: "Saatine bakmadım ama bir buçuk saati geçti doktor bey.",
        usedActions: ["AGRI_SURE"],
      }),
    });
    const reply = await simuleHastaYanitla({
      vaka,
      question: "Ağrı ne zamandır var?",
      previousTurns: [{ question: "Ağrı ne zamandır var?", actions: ["AGRI_SURE"], answer: "Yaklaşık bir buçuk saat önce başladı.", channel: "hasta" }],
    });
    expect(reply.answer).toContain("bir buçuk");
    expect(geminiChatMock).toHaveBeenCalledTimes(1);
  });
});
