import { describe, expect, it } from "vitest";
import { buildDebugTestEnvanteri, hasDataKeys, visibleAllNonHidden, visibleAllWithData } from "./workspace-catalog";
import type { Vaka } from "@/lib/types";

function fakeVaka(overrides: Partial<Vaka> = {}): Vaka {
  return {
    id: "v1",
    semptom: "s",
    hastalik: "stemi",
    alan: "Kardiyoloji",
    seviye: "orta",
    hasta: { ad: "A", tamAd: "A B", tc: "1", yas: 40, cinsiyet: "E", anaSikayet: "ağrı", ozetBilgiler: [] },
    statikTestler: {
      TROPONIN: { testKey: "TROPONIN", testAdi: "Troponin", tip: "numeric", sonuc: { deger: 1 } } as any,
      CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: {} } as any,
    },
    rubric: {
      beklenenSorular: [],
      beklenenTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "" }],
      gereksizTestler: [{ key: "BT_TORAKS", etiket: "BT Toraks", aciklama: "" }],
      redFlagler: [],
      kabulEdilenTani: [],
      puanlama: {},
    },
    soruChipleri: [],
    relevantAksiyonlar: [],
    idealYol: [],
    egitimNotu: "",
    hastaYanitlari: {},
    beklenenTani: [],
    ...overrides,
  } as unknown as Vaka;
}

describe("workspace-catalog", () => {
  it("hasDataKeys onTestRequest varsa motor anahtarlarını ekler", () => {
    const vaka = fakeVaka();
    const without = hasDataKeys(vaka, null);
    const withMotor = hasDataKeys(vaka, {} as any);
    expect(without.has("TROPONIN")).toBe(true);
    expect(withMotor.size).toBeGreaterThan(without.size);
  });

  it("visibleAllNonHidden hidden olmayanları filtreler", () => {
    const all = visibleAllNonHidden();
    expect(all.length).toBeGreaterThan(0);
    // hidden visibility yoksa hepsi döner, hidden olanlar elenir
    for (const t of all) {
      expect(t.key).toBeDefined();
    }
  });

  it("visibleAllWithData sadece hasData ile kesişimi döner", () => {
    const vaka = fakeVaka();
    const keys = hasDataKeys(vaka, null);
    const visible = visibleAllWithData(keys);
    for (const t of visible) {
      expect(keys.has(t.key)).toBe(true);
    }
  });

  it("buildDebugTestEnvanteri beklenen ve sonuçlu olarak sıralar", () => {
    const vaka = fakeVaka();
    const env = buildDebugTestEnvanteri(vaka);
    expect(env.sonucuVar).toBe(2);
    expect(env.sonucuYok).toBeGreaterThan(0);
    // İlk eleman sonucu olan ve beklenen olmalı (TROPONIN)
    expect(env.items[0].hasSonuc).toBe(true);
    expect(env.items[0].beklenen).toBe(true);
  });
});
