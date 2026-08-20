import { describe, expect, it, vi } from "vitest";
import { defaultMesajlar, mesajlaraSonucEkle, toReasoningList } from "./workspace-helpers";
import type { ChatMesaj, TestIstegi, Vaka } from "@/lib/types";

function fakeVaka(): Vaka {
  return {
    id: "test-id",
    semptom: "test",
    hastalik: "stemi",
    alan: "Kardiyoloji",
    seviye: "baslangic",
    hasta: { ad: "Ahmet", tamAd: "Ahmet Yılmaz", tc: "123", yas: 55, cinsiyet: "E", anaSikayet: "göğüs ağrısı", ozetBilgiler: [] },
    profile: undefined,
    episodeZamani: 0,
    beklenenTani: ["MI"],
    rubric: { beklenenSorular: [], beklenenTestler: [], gereksizTestler: [], redFlagler: [], kabulEdilenTani: ["MI"], puanlama: {} },
    statikTestler: {},
    hastaYanitlari: {},
    soruChipleri: [],
    relevantAksiyonlar: [],
    idealYol: [],
    egitimNotu: "",
  } as unknown as Vaka;
}

describe("workspace-helpers", () => {
  it("defaultMesajlar üretir", () => {
    const msgs = defaultMesajlar(fakeVaka());
    expect(msgs).toHaveLength(1);
    expect(msgs[0].rol).toBe("sistem");
    expect(msgs[0].metin).toContain("55 yaş");
    expect(msgs[0].metin).toContain("göğüs ağrısı");
  });

  it("mesajlaraSonucEkle eşleşen testi rapora dönüştürür", () => {
    const msgs: ChatMesaj[] = [
      { id: "1", rol: "sistem", metin: "🧪 Troponin istendi — rapor hazırlanıyor…", zaman: 1, testAdi: "Troponin I" },
      { id: "2", rol: "sistem", metin: "diğer", zaman: 2 },
    ];
    const testler: TestIstegi[] = [
      { testKey: "TROPONIN", testAdi: "Troponin I", sonuc: { testKey: "TROPONIN", testAdi: "Troponin", tip: "numeric", sonuc: { deger: 1 } } as any, zaman: 1 },
    ];
    const out = mesajlaraSonucEkle(msgs, testler);
    expect(out[0].metin).toBe("🧪 Troponin I — rapor hazır");
    expect(out[0].testSonucu).toBeDefined();
    expect(out[1].metin).toBe("diğer");
  });

  it("toReasoningList satırlara ayırır ve 5 ile sınırlar", () => {
    expect(toReasoningList("a\nb\n c \n\n")).toEqual(["a", "b", "c"]);
    expect(toReasoningList("1\n2\n3\n4\n5\n6\n7")).toHaveLength(5);
    expect(toReasoningList("")).toEqual([]);
  });

  it("aiEslestir fetch başarısızlığında null döner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    const { aiEslestir } = await import("./workspace-helpers");
    expect(await aiEslestir("nabız kaç")).toBeNull();
    vi.unstubAllGlobals();
  });
});
