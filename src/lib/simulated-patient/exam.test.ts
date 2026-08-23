import { describe, expect, it } from "vitest";
import type { Vaka } from "@/lib/types";
import { isExamAction, requestExamFinding } from "./exam";

const vaka = {
  id: "exam-vaka", semptom: "göğüs ağrısı", hastalik: "gizli", alan: "kardiyoloji", seviye: "orta",
  hasta: { ad: "A", tamAd: "A", tc: "", yas: 58, cinsiyet: "E", anaSikayet: "Ağrı", ozetBilgiler: [] },
  beklenenTani: ["STEMI"], rubric: { beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [], kabulEdilenTani: [], puanlama: {} },
  statikTestler: {}, hastaYanitlari: { VITAL_TANSIYON: "165/95 mmHg", FIZIK_AKCIGER: "Akciğer sesleri doğal." },
  soruChipleri: [{ etiket: "Akciğer sesleri nasıl?", aksiyon: "FIZIK_AKCIGER", kategori: "fizik" as const }], relevantAksiyonlar: [],
} satisfies Vaka;

describe("requestExamFinding", () => {
  it("yalnız muayene aksiyonlarını ayrı bulgu olarak döndürür", () => {
    expect(isExamAction("VITAL_TANSIYON")).toBe(true);
    expect(isExamAction("FIZIK_AKCIGER")).toBe(true);
    expect(isExamAction("AGRI_SURE")).toBe(false);
    expect(requestExamFinding(vaka, "VITAL_TANSIYON")).toEqual({ action: "VITAL_TANSIYON", label: "VITAL_TANSIYON", answer: "165/95 mmHg" });
  });

  it("anamnez aksiyonunu ve olmayan muayene bulgusunu reddeder", () => {
    expect(requestExamFinding(vaka, "AGRI_SURE")).toBeNull();
    expect(requestExamFinding(vaka, "FIZIK_KALP")).toBeNull();
  });
});
