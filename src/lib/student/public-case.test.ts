import { describe, expect, it } from "vitest";
import { publicAttemptToVaka, resumableAttemptToSnapshot } from "./public-case";
import type { PublicAttemptCase, ResumableAttemptCase } from "./attempt-store";

function ornekPublic(uzerine: Partial<PublicAttemptCase> = {}): PublicAttemptCase {
  return {
    id: "attempt-1",
    semptom: "göğüs ağrısı",
    alan: "kardiyoloji",
    seviye: "orta",
    hasta: {
      ad: "demo",
      tamAd: "Demo Hasta",
      tc: "",
      yas: 54,
      cinsiyet: "E",
      anaSikayet: "Göğsümü sıkıyor",
      ozetBilgiler: [],
    },
    soruChipleri: [
      { etiket: "Ağrının yayılımı", aksiyon: "agri-yayilim", kategori: "anamnez-agri" },
    ],
    testler: [
      { testKey: "EKG", testAdi: "Elektrokardiyografi" },
      { testKey: "TROPONIN", testAdi: "Troponin I" },
    ],
    ...uzerine,
  };
}

function ornekResumable(uzerine: Partial<ResumableAttemptCase> = {}): ResumableAttemptCase {
  return {
    ...ornekPublic(),
    ilerleme: {
      yanitlar: [
        { aksiyon: "agri-yayilim", yanit: "Koluma doğru yayılıyor." },
        { aksiyon: "ozel-soru", yanit: "Bilmiyorum." },
      ],
      muayeneBulgulari: [],
      testSonuclari: [
        {
          testKey: "EKG",
          testAdi: "Elektrokardiyografi",
          tip: "text",
          sonuc: "ST elevasyonu var.",
        },
      ],
      clinicalReasoning: null,
    },
    ...uzerine,
  };
}

describe("publicAttemptToVaka", () => {
  it("gizli alanları sıfırlar (tanı, rubric, cevaplar)", () => {
    const vaka = publicAttemptToVaka(ornekPublic());
    expect(vaka.hastalik).toBe("gizli");
    expect(vaka.beklenenTani).toEqual([]);
    expect(vaka.rubric.beklenenSorular).toEqual([]);
    expect(vaka.rubric.beklenenTestler).toEqual([]);
    expect(vaka.rubric.gereksizTestler).toEqual([]);
    expect(vaka.rubric.redFlagler).toEqual([]);
    expect(vaka.rubric.kabulEdilenTani).toEqual([]);
    expect(vaka.rubric.puanlama).toEqual({});
    expect(vaka.hastaYanitlari).toEqual({});
    expect(vaka.relevantAksiyonlar).toEqual([]);
  });

  it("statik testleri boş sonuçlarla anahtarlar", () => {
    const vaka = publicAttemptToVaka(ornekPublic());
    expect(Object.keys(vaka.statikTestler)).toEqual(["EKG", "TROPONIN"]);
    expect(vaka.statikTestler.EKG).toMatchObject({ testAdi: "Elektrokardiyografi", tip: "text", sonuc: "" });
  });

  it("açık alanları olduğu gibi taşır", () => {
    const kaynak = ornekPublic();
    const vaka = publicAttemptToVaka(kaynak);
    expect(vaka.id).toBe(kaynak.id);
    expect(vaka.alan).toBe(kaynak.alan);
    expect(vaka.seviye).toBe(kaynak.seviye);
    expect(vaka.hasta).toBe(kaynak.hasta);
    expect(vaka.soruChipleri).toBe(kaynak.soruChipleri);
  });
});

describe("resumableAttemptToSnapshot", () => {
  it("giriş mesajını yaş/cinsiyet/şikâyet ile kurar", () => {
    const anlik = resumableAttemptToSnapshot(ornekResumable());
    const giris = anlik.mesajlar[0];
    expect(giris.rol).toBe("sistem");
    expect(giris.metin).toContain("54 yaş");
    expect(giris.metin).toContain("Erkek");
    expect(giris.metin).toContain("Göğsümü sıkıyor");
  });

  it("kadın hastada cinsiyeti Türkçe çevirir", () => {
    const anlik = resumableAttemptToSnapshot(
      ornekResumable({ hasta: { ...ornekPublic().hasta, cinsiyet: "K" } })
    );
    expect(anlik.mesajlar[0].metin).toContain("Kadın");
  });

  it("soru-cevap çiftlerini chip etiketiyle sıralar", () => {
    const anlik = resumableAttemptToSnapshot(ornekResumable());
    const soru = anlik.mesajlar.find((m) => m.id === "resume-question-0");
    const cevap = anlik.mesajlar.find((m) => m.id === "resume-answer-0");
    expect(soru?.rol).toBe("ogrenci");
    expect(soru?.metin).toBe("Ağrının yayılımı");
    expect(cevap?.rol).toBe("hasta");
    expect(cevap?.metin).toBe("Koluma doğru yayılıyor.");
  });

  it("chip eşleşmeyen aksiyonu insan-okur hale getirir", () => {
    const anlik = resumableAttemptToSnapshot(
      ornekResumable({
        soruChipleri: [],
      })
    );
    const soru = anlik.mesajlar.find((m) => m.id === "resume-question-0");
    expect(soru?.metin).toBe("agri-yayilim");
  });

  it("test sonuçlarını sistem mesajı ve testIstekleri olarak ekler", () => {
    const anlik = resumableAttemptToSnapshot(ornekResumable());
    const testMesaji = anlik.mesajlar.find((m) => m.id === "resume-test-0");
    expect(testMesaji?.metin).toContain("Elektrokardiyografi");
    expect(anlik.testIstekleri).toHaveLength(1);
    expect(anlik.testIstekleri[0].testKey).toBe("EKG");
    expect(anlik.faz).toBe("test");
  });

  it("istenen muayene bulgularını snapshot'a ve sistem mesajına ekler", () => {
    const anlik = resumableAttemptToSnapshot(ornekResumable({
      ilerleme: {
        ...ornekResumable().ilerleme,
        muayeneBulgulari: [{ action: "VITAL_TANSIYON", label: "Tansiyon", answer: "145/90" }],
      },
    }));
    expect(anlik.muayeneBulgulari).toEqual([{ action: "VITAL_TANSIYON", label: "Tansiyon", answer: "145/90" }]);
    expect(anlik.mesajlar.find((mesaj) => mesaj.id === "resume-exam-0")?.metin).toContain("145/90");
  });

  it("test yoksa fazı anamnez tutar", () => {
    const anlik = resumableAttemptToSnapshot(
      ornekResumable({ ilerleme: { yanitlar: [], muayeneBulgulari: [], testSonuclari: [], clinicalReasoning: null } })
    );
    expect(anlik.faz).toBe("anamnez");
    expect(anlik.sorulanAksiyonlar).toEqual([]);
  });

  it("tanı/tedavi girişini sıfırlar ve aksiyon sırasını korur", () => {
    const anlik = resumableAttemptToSnapshot(ornekResumable());
    expect(anlik.taniInput).toBe("");
    expect(anlik.tedaviInput).toBe("");
    expect(anlik.clinicalReasoning).toBeNull();
    expect(anlik.sorulanAksiyonlar).toEqual(["agri-yayilim", "ozel-soru"]);
  });

  it("mesaj zaman damgaları artan sıradadır", () => {
    const anlik = resumableAttemptToSnapshot(ornekResumable());
    const zamanlar = anlik.mesajlar.map((m) => m.zaman);
    for (let i = 1; i < zamanlar.length; i++) {
      expect(zamanlar[i]).toBeGreaterThan(zamanlar[i - 1]);
    }
  });
});
