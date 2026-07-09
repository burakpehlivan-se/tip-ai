"use client";

import { useState, useRef, useEffect } from "react";
import { Vaka, ChatMesaj, TestIstegi, DegerlendirmeSonuc, SoruChipi, ChipKategorisi } from "@/lib/types";
import { normalizeSoru, normalizeTest } from "@/lib/nlp/normalize";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { birlesikTestKatalogu } from "@/lib/data";
import { aksiyonRelevantMi, CHIP_KATEGORI_ETIKETLERI } from "@/lib/data/case-generator";
import ResmiRapor from "./ResmiRapor";
import Link from "next/link";

interface Props {
  vaka: Vaka;
  mod?: "normal" | "cemicegek";
  raporHazir?: boolean;
  onTestIstendi?: (testKey: string) => void;
  hastaneAdi?: string;
}

export default function VakaWorkspace({ vaka, mod = "normal", raporHazir = true, onTestIstendi, hastaneAdi = "ÇEMİÇGEZEK DEVLET HASTANESİ" }: Props) {
  const [mesajlar, setMesajlar] = useState<ChatMesaj[]>([
    {
      id: "0",
      rol: "sistem",
      metin: `Vaka başladı. Hasta: ${vaka.hasta.yas} yaş, ${vaka.hasta.cinsiyet === "E" ? "Erkek" : "Kadın"} — ${vaka.hasta.anaSikayet}. Anamnez sorularınızı bekliyorum.`,
      zaman: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [testIstekleri, setTestIstekleri] = useState<TestIstegi[]>([]);
  const [sorulanAksiyonlar, setSorulanAksiyonlar] = useState<string[]>([]);
  const [faz, setFaz] = useState<"anamnez" | "test" | "tani" | "tedavi">("anamnez");
  const [taniInput, setTaniInput] = useState("");
  const [tedaviInput, setTedaviInput] = useState("");
  const [showTestDropdown, setShowTestDropdown] = useState(false);
  const [sonuc, setSonuc] = useState<DegerlendirmeSonuc | null>(null);
  const [testArama, setTestArama] = useState("");
  const [chipArama, setChipArama] = useState("");
  const [acikKategoriler, setAcikKategoriler] = useState<Set<ChipKategorisi>>(new Set<ChipKategorisi>(["anamnez-agri"]));
  const [kaynaklarAcik, setKaynaklarAcik] = useState(false);
  const [showSoruDrawer, setShowSoruDrawer] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleKategori = (kat: ChipKategorisi) => {
    setAcikKategoriler((prev) => {
      const yeni = new Set(prev);
      if (yeni.has(kat)) yeni.delete(kat);
      else yeni.add(kat);
      return yeni;
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesajlar]);

  const soruSor = () => {
    if (!input.trim()) return;

    const normalized = normalizeSoru(input);
    const hastaYanit = vaka.hastaYanitlari[normalized] || vaka.hastaYanitlari["OZEL"];

    const yeniMesajlar: ChatMesaj[] = [
      { id: `${Date.now()}-q`, rol: "ogrenci", metin: input, zaman: Date.now() },
      { id: `${Date.now()}-a`, rol: "hasta", metin: hastaYanit, zaman: Date.now() + 1 },
    ];

    setMesajlar((prev) => [...prev, ...yeniMesajlar]);

    if (normalized !== "OZEL" && !sorulanAksiyonlar.includes(normalized)) {
      setSorulanAksiyonlar((prev) => [...prev, normalized]);
    }

    setInput("");
  };

  const chipSor = (chip: SoruChipi) => {
    // Chip seçildiğinde direkt hasta yanıtını ver — NLP'e gitme
    const normalized = chip.aksiyon;
    const hastaYanit = vaka.hastaYanitlari[normalized] || vaka.hastaYanitlari["OZEL"];

    const yeniMesajlar: ChatMesaj[] = [
      { id: `${Date.now()}-q`, rol: "ogrenci", metin: chip.etiket, zaman: Date.now() },
      { id: `${Date.now()}-a`, rol: "hasta", metin: hastaYanit, zaman: Date.now() + 1 },
    ];

    setMesajlar((prev) => [...prev, ...yeniMesajlar]);

    if (!sorulanAksiyonlar.includes(normalized)) {
      setSorulanAksiyonlar((prev) => [...prev, normalized]);
    }
  };

  const testIstey = (testKey: string) => {
    const statik = vaka.statikTestler[testKey];
      if (!statik) {
      setMesajlar((prev) => {
        const alreadyWarned = prev.some((m) => m.id.endsWith("-err") && m.metin.includes(testKey));
        if (alreadyWarned) return prev;
        return [
          ...prev,
          { id: `${Date.now()}-err`, rol: "sistem", metin: `⚠ "${testKey}" testi sistemde kayıtlı değil. "Tüm Test Kataloğu" listesinden seçim yapabilirsiniz.`, zaman: Date.now() },
        ];
      });
      setShowTestDropdown(false);
      return;
    }

    if (testIstekleri.some((t) => t.testKey === testKey)) {
      setMesajlar((prev) => [
        ...prev,
        {
          id: `${Date.now()}-dup`,
          rol: "sistem",
          metin: `${statik.testAdi} zaten istendi.`,
          zaman: Date.now(),
        },
      ]);
      return;
    }

    const yeniIstek: TestIstegi = {
      testKey,
      testAdi: statik.testAdi,
      sonuc: statik,
      zaman: Date.now(),
    };

    setTestIstekleri((prev) => [...prev, yeniIstek]);

    const durumMesaji = mod === "cemicegek" && !raporHazir
      ? `🧪 ${statik.testAdi} istendi — rapor hazırlanıyor…`
      : `🧪 ${statik.testAdi} istendi`;

    setMesajlar((prev) => [
      ...prev,
      {
        id: `${Date.now()}-test`,
        rol: "sistem",
        metin: durumMesaji,
        zaman: Date.now(),
        testSonucu: (mod === "cemicegek" && !raporHazir) ? undefined : statik,
        testAdi: statik.testAdi,
      },
    ]);
    setShowTestDropdown(false);
    setTestArama("");

    // Cemicegek modunda: test istendiğinde parent'a haber ver
    if (mod === "cemicegek" && !raporHazir) {
      setTimeout(() => onTestIstendi?.(testKey), 500);
    }
  };

  const serbestTestIstey = () => {
    if (!testArama.trim()) return;
    const testKey = normalizeTest(testArama);
    if (testKey) {
      testIstey(testKey);
    } else {
      setMesajlar((prev) => [
        ...prev,
        {
          id: `${Date.now()}-nt`,
          rol: "sistem",
          metin: `"${testArama}" testi tanınmadı. Lütfen dropdown'dan seçin veya farklı bir isim deneyin.`,
          zaman: Date.now(),
        },
      ]);
    }
    setTestArama("");
    setShowTestDropdown(false);
  };

  const tamamlama = () => {
    if (!taniInput.trim()) {
      alert("Lütfen bir ön tanı girin.");
      return;
    }
    setFaz("tedavi");
    setMesajlar((prev) => [
      ...prev,
      { id: `${Date.now()}-sys`, rol: "sistem", metin: "🩺 Tanı alındı. Şimdi tedavi planınızı yazın.", zaman: Date.now() },
    ]);
  };

  const vakaTamamla = () => {
    const istenenTestKeyleri = testIstekleri.map((t) => t.testKey);
    const sonuc = degerlendir(vaka, sorulanAksiyonlar, istenenTestKeyleri, taniInput);
    setSonuc(sonuc);
  };

  const filtreliTestler = birlesikTestKatalogu.filter((t) =>
    testArama.trim() === "" || t.ad.toLowerCase().includes(testArama.toLowerCase()) || t.kategori.toLowerCase().includes(testArama.toLowerCase())
  );

  // Tüm testleri kategori bazında grupla
  const testlerKategoriyeGore: Record<string, typeof birlesikTestKatalogu> = {};
  for (const t of filtreliTestler) {
    if (!testlerKategoriyeGore[t.kategori]) testlerKategoriyeGore[t.kategori] = [];
    testlerKategoriyeGore[t.kategori].push(t);
  }

  // Sonuç ekranı gösteriliyorsa
  if (sonuc) {
    return <SonucEkrani vaka={vaka} sonuc={sonuc} />;
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4">
        <div className="flex items-center gap-3">
          <Link href="/vakalar" className="text-sm text-steel hover:text-ink transition-colors">
            ← Vakalar
          </Link>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium text-ink">{vaka.alan}</span>
          <span className="text-[11px] rounded-full bg-surface-soft border border-hairline px-2 py-0.5 text-muted">
            {vaka.semptom.slice(0, 40)}{vaka.semptom.length > 40 ? "…" : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg bg-surface p-0.5">
            {(["anamnez","test","tani","tedavi"] as const).map((f) => (
              <span
                key={f}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  faz === f
                    ? "bg-ink text-white shadow-sm"
                    : "text-steel hover:text-ink"
                }`}
              >
                {f === "anamnez" ? "Anamnez" : f === "test" ? "Testler" : f === "tani" ? "Tanı" : "Tedavi"}
              </span>
            ))}
          </div>
          <span className="badge badge-blue">{vaka.alan}</span>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sol Panel — Hasta */}
        <div className="hidden w-72 flex-shrink-0 border-r border-hairline bg-surface-soft overflow-y-auto scrollbar-thin lg:flex lg:flex-col">
          <div className="p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Hasta Kartı
            </h3>
            <div className="mb-6 rounded-lg border border-hairline bg-canvas p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-xl">
                  👤
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">{vaka.hasta.tamAd || `Hasta ${vaka.hasta.yas}`}</div>
                  <div className="text-xs text-steel">
                    {vaka.hasta.yas} yaş · {vaka.hasta.cinsiyet === "E" ? "E" : "K"}
                  </div>
                  {vaka.hasta.tc && (
                    <div className="text-[10px] text-muted">TC: {vaka.hasta.tc}</div>
                  )}
                </div>
              </div>
              <div className="border-t border-hairline-soft pt-3">
                <div className="text-xs font-semibold uppercase text-muted mb-1">Ana Şikayet</div>
                <div className="text-sm text-ink">{vaka.hasta.anaSikayet}</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Bilinen Bilgiler
              </h4>
              <ul className="space-y-2">
                {vaka.hasta.ozetBilgiler.map((bilgi, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-steel">
                    <span className="text-brand mt-0.5">•</span>
                    <span>{bilgi}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* İlerleme */}
            <div className="border-t border-hairline pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                İlerleme
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-brand">✓</span>
                  <span className="text-steel">Sorulan: {sorulanAksiyonlar.length} soru</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-brand">✓</span>
                  <span className="text-steel">İstenen: {testIstekleri.length} test</span>
                </div>
              </div>
            </div>

            {/* Vaka Kaynakları */}
            {vaka.kaynaklar && vaka.kaynaklar.length > 0 && (
              <div className="mt-4 border-t border-hairline pt-4">
                <button
                  onClick={() => setKaynaklarAcik(!kaynaklarAcik)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    📚 Vaka Kaynakları
                  </h4>
                  <span className={`text-xs text-muted transition-transform ${kaynaklarAcik ? "rotate-180" : ""}`}>▾</span>
                </button>
                {kaynaklarAcik && (
                  <div className="mt-3 space-y-2.5">
                    {vaka.kaynaklar.map((k, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-hairline bg-canvas px-3 py-2.5 text-[11px] text-steel leading-relaxed"
                      >
                        {k}
                      </div>
                    ))}
                    <div className="rounded-md bg-ink/5 px-3 py-2 text-[10px] text-muted italic">
                      ⚠️ Tüm vakalar sentetiktir. Gerçek hasta verisi içermez. Eğitim amaçlıdır.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Orta Panel — Sohbet */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 lg:px-8">
            <div className="mx-auto max-w-2xl space-y-4">
              {mesajlar.map((msg) => (
                <MesajBalonu key={msg.id} msg={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Soru Toolbar — kompakt yatay bar */}
          <div className="border-t border-hairline-soft px-4 py-2 lg:px-8">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Sorular</span>
              <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
                {(["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => {
                  const chips = (vaka.soruChipleri as SoruChipi[]).filter((c) => c.kategori === kat);
                  const isOpen = faz === "anamnez" && acikKategoriler.has(kat);
                  return (
                    <button
                      key={kat}
                      onClick={() => {
                        if (faz !== "anamnez") return;
                        toggleKategori(kat);
                      }}
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                        isOpen ? "border-ink/30 bg-ink text-white" : "border-hairline bg-canvas text-steel hover:border-ink/30 hover:text-ink"
                      }`}
                    >
                      {CHIP_KATEGORI_ETIKETLERI[kat]}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowSoruDrawer(true)}
                className="shrink-0 rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[10px] font-medium text-steel hover:border-ink/30 hover:text-ink transition-colors"
              >
                Tümü ▸
              </button>
            </div>
            {/* Açık kategorinin önerilen chip'leri (max 2 satır) */}
            {faz === "anamnez" && (["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => {
              if (!acikKategoriler.has(kat)) return null;
              const chips = (vaka.soruChipleri as SoruChipi[]).filter((c) => c.kategori === kat);
              const show = chips.slice(0, 6);
              if (show.length === 0) return null;
              return (
                <div key={kat} className="mx-auto max-w-2xl flex flex-wrap gap-1 pt-1.5 px-1 max-h-[4.5em] overflow-hidden">
                  {show.map((chip, i) => {
                    const soruldu = sorulanAksiyonlar.includes(chip.aksiyon);
                    return (
                      <button key={i} onClick={() => chipSor(chip)} disabled={soruldu}
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                          soruldu ? "cursor-default border-hairline bg-surface text-muted/60 line-through" : "border-hairline bg-canvas text-steel hover:border-ink/50 hover:text-ink hover:bg-surface"
                        }`}>{chip.etiket}</button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Soru Drawer (overlay) */}
          {showSoruDrawer && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/20" onClick={() => setShowSoruDrawer(false)} />
              <div className="relative w-full max-w-md bg-canvas shadow-xl border-l border-hairline overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-canvas px-4 py-3">
                  <span className="text-sm font-semibold text-ink">Tüm Sorular</span>
                  <button onClick={() => setShowSoruDrawer(false)} className="rounded-full p-1 hover:bg-surface text-steel">✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <input type="text" value={chipArama} onChange={(e) => setChipArama(e.target.value)}
                    placeholder="Sorularda ara…"
                    className="w-full h-8 rounded-full border border-hairline bg-surface px-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none" />
                  {(["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => {
                    let chips = (vaka.soruChipleri as SoruChipi[]).filter((c) => c.kategori === kat);
                    if (chipArama.trim()) chips = chips.filter((c) => c.etiket.toLowerCase().includes(chipArama.trim().toLowerCase()));
                    if (chips.length === 0 && !chipArama.trim()) return null;
                    return (
                      <div key={kat}>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{CHIP_KATEGORI_ETIKETLERI[kat]} ({chips.length})</div>
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((chip, i) => {
                            const soruldu = sorulanAksiyonlar.includes(chip.aksiyon);
                            return (
                              <button key={i} onClick={() => { chipSor(chip); if (!soruldu) setShowSoruDrawer(false); }} disabled={soruldu}
                                className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all ${
                                  soruldu ? "cursor-default border-hairline bg-surface text-muted/60 line-through" : "border-hairline bg-canvas text-steel hover:border-ink/50 hover:text-ink hover:bg-surface"
                                }`}>{chip.etiket}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-hairline bg-canvas px-4 py-4 lg:px-8">
            <div className="mx-auto max-w-2xl">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && soruSor()}
                  placeholder="Hastaya soru sor... (örn: 'Ağrı yayılıyor mu?' veya 'Aile öyküsü var mı?')"
                  className="input flex-1"
                />
                <button onClick={soruSor} className="btn-primary px-5">
                  Sor
                </button>
                <button
                  onClick={() => setFaz(faz === "anamnez" ? "test" : "anamnez")}
                  className="btn-secondary"
                >
                  {faz === "anamnez" ? "Testlere Geç →" : "← Sorulara Dön"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Panel — Testler ve Sonuçlar */}
        <div className="hidden w-80 flex-shrink-0 border-l border-hairline bg-surface-soft overflow-y-auto scrollbar-thin xl:flex xl:flex-col">
          <div className="p-6">
            {/* Test İsteme */}
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Test İste
              </h3>

              {/* Serbest metin test arama */}
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={testArama}
                  onChange={(e) => setTestArama(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && serbestTestIstey()}
                  placeholder="Test adı yaz (örn: EKG, troponin)…"
                  className="h-9 flex-1 rounded-md border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none"
                />
                <button onClick={serbestTestIstey} className="btn-accent px-3 py-1.5 text-xs">
                  İste
                </button>
              </div>

              {/* Dropdown — Tüm testler kategori bazında */}
              <div className="relative">
                <button
                  onClick={() => setShowTestDropdown(!showTestDropdown)}
                  className="btn-secondary w-full justify-center text-sm"
                >
                  📋 Tüm Test Kataloğu ({birlesikTestKatalogu.length}) ▾
                </button>
                {showTestDropdown && (
                  <div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-lg border border-hairline bg-canvas shadow-card scrollbar-thin">
                    {Object.entries(testlerKategoriyeGore).map(([kategori, testler]) => (
                      <div key={kategori}>
                        <div className="sticky top-0 bg-surface-soft px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {kategori}
                        </div>
                        {testler.map((test) => {
                          const istendi = testIstekleri.some((t) => t.testKey === test.key);
                          return (
                            <button
                              key={test.key}
                              onClick={() => testIstey(test.key)}
                              disabled={istendi}
                              className={`flex w-full items-center justify-between border-b border-hairline-soft px-4 py-2.5 text-left text-sm last:border-0 hover:bg-surface transition-colors ${
                                istendi ? "opacity-40 cursor-not-allowed" : "text-ink"
                              }`}
                            >
                              <div>
                                <div className="font-medium">{test.ad}</div>
                                {istendi && <div className="text-[10px] text-brand">✓ İstendi</div>}
                              </div>
                              {!istendi && <span className="text-brand">+</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* İstenen Testler / Sonuçlar */}
            <div className="mb-4 border-t border-hairline pt-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Test Sonuçları ({testIstekleri.length})
              </h3>
              {testIstekleri.length === 0 ? (
                <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-muted">
                  Henüz test istenmedi.
                  <br />
                  <span className="text-xs">Yukarıdan test iste.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {testIstekleri.map((istek) => (
                    <TestSonucKarti key={istek.testKey} istek={istek} hasta={vaka.hasta} hastaneAdi="ÇEMİÇGEZEK DEVLET HASTANESİ" />
                  ))}
                </div>
              )}
            </div>

            {/* Tanı ve Tedavi Girişi */}
            {testIstekleri.length > 0 && (
              <div className="mt-6 border-t border-hairline pt-4">
                {faz === "tani" ? (
                  <>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      Ön Tanı
                    </h3>
                    <input
                      type="text"
                      value={taniInput}
                      onChange={(e) => setTaniInput(e.target.value)}
                      placeholder="Ön tanınızı girin (örn: Akut Koroner Sendrom)"
                      className="input mb-3 text-sm"
                    />
                    <button onClick={tamamlama} className="btn-primary w-full justify-center">
                      Tanıyı Kaydet ve Tedaviye Geç →
                    </button>
                  </>
                ) : faz === "tedavi" ? (
                  <>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      Tedavi Planı
                    </h3>
                    <textarea
                      value={tedaviInput}
                      onChange={(e) => setTedaviInput(e.target.value)}
                      placeholder="Tedavi planınızı yazın (ilaçlar, dozlar, prosedürler)..."
                      className="input mb-3 h-28 text-sm resize-none"
                      rows={5}
                    />
                    <button onClick={vakaTamamla} className="btn-accent w-full justify-center">
                      Vakayı Tamamla ve Puanla
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tabs */}
      <div className="flex border-t border-hairline bg-canvas xl:hidden">
        <MobileTab label="Hasta" icon="👤" />
        <MobileTab label="Sohbet" icon="💬" active />
        <MobileTab label="Testler" icon="🧪" />
      </div>
    </div>
  );
}

function MesajBalonu({ msg }: { msg: ChatMesaj }) {
  if (msg.rol === "sistem") {
    const isWarning = msg.metin.startsWith("⚠️");
    const isComplete = msg.metin.startsWith("✅");
    return (
      <div className="flex justify-center">
        <div className={`rounded-lg px-4 py-2 text-xs whitespace-pre-line ${
          isWarning
            ? "bg-clinical-orange/15 text-clinical-orange border border-clinical-orange/30"
            : isComplete
            ? "bg-brand/10 text-brand-deep border border-brand/30"
            : "bg-surface text-steel"
        }`}>
          {msg.metin}
        </div>
        {msg.testSonucu && (
          <div className="mx-auto mt-2 w-full max-w-[85%]">
            <ResmiRapor sonuc={msg.testSonucu} hasta={vaka.hasta} hastaneAdi={hastaneAdi} />
          </div>
        )}
      </div>
    );
  }

  const isOgrenci = msg.rol === "ogrenci";
  return (
    <div className={`flex items-start gap-1.5 ${isOgrenci ? "justify-end" : "justify-start"}`}>
      {!isOgrenci && <span className="mt-1 shrink-0 rounded bg-surface-soft border border-hairline px-1.5 py-0.5 text-[10px] font-semibold text-steel">H</span>}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isOgrenci
            ? "bg-ink text-white rounded-br-md"
            : "bg-white text-ink rounded-bl-md border border-hairline shadow-sm"
        }`}
      >
        <div className="text-sm" style={{ lineHeight: "1.5" }}>
          {msg.metin}
        </div>
      </div>
      {isOgrenci && <span className="mt-1 shrink-0 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">Ö</span>}
    </div>
  );
}

function TestSonucKarti({ istek, hasta, hastaneAdi }: { istek: TestIstegi; hasta: import("@/lib/types").Hasta; hastaneAdi?: string }) {
  const { sonuc } = istek;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between border-b border-hairline-soft px-4 py-3 text-left hover:bg-surface-soft transition-colors"
      >
        <div>
          <div className="text-sm font-semibold text-ink">{sonuc.testAdi}</div>
          <div className="text-xs text-muted">
            {sonuc.tip === "numeric" ? "Sayısal" : sonuc.tip === "json" ? "Detaylı" : sonuc.tip === "image" ? "Radyoloji" : "Rapor"} — raporu {expanded ? "gizle" : "gör"}
          </div>
        </div>
        <span className="text-steel">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="bg-surface-soft p-2">
          <ResmiRapor sonuc={sonuc} hasta={hasta} hastaneAdi={hastaneAdi} compact />
        </div>
      )}
    </div>
  );
}

function MobileTab({ label, icon, active }: { label: string; icon: string; active?: boolean }) {
  return (
    <button
      className={`flex flex-1 flex-col items-center gap-1 py-3 ${
        active ? "text-brand" : "text-steel"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// Sonuç Ekranı
function SonucEkrani({ vaka, sonuc }: { vaka: Vaka; sonuc: DegerlendirmeSonuc }) {
  const yuzde = Math.round((sonuc.toplamPuan / sonuc.maxPuan) * 100);
  const renk =
    yuzde >= 80 ? "text-brand-deep" : yuzde >= 60 ? "text-clinical-orange" : "text-clinical-red";

  return (
    <div className="min-h-screen bg-canvas">
      <nav className="border-b border-hairline-soft bg-canvas">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/vakalar" className="text-sm font-medium text-steel hover:text-ink transition-colors">
            ← Vakalar
          </Link>
          <span className="text-sm font-medium text-ink">Değerlendirme</span>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Puan */}
        <div className="mb-12 text-center">
          <div className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">
            Vaka Sonu Puanı
          </div>
          <div className={`text-7xl font-semibold ${renk}`} style={{ letterSpacing: "-2px" }}>
            {sonuc.toplamPuan}
            <span className="text-3xl text-muted">/{sonuc.maxPuan}</span>
          </div>
          <div className={`mt-2 text-2xl font-semibold ${renk}`}>{yuzde}%</div>
          <div className="mt-4 text-sm text-steel">
            {yuzde >= 80
              ? "Mükemmel klinik yaklaşım! 🎉"
              : yuzde >= 60
              ? "İyi yaklaşım, bazı eksikler var."
              : "Klinik yaklaşımı geliştirmek gerekiyor."}
          </div>
        </div>

        {/* Güçlü Yönler */}
        {sonuc.gucluYonler.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-ink">✅ Güçlü Yönler</h3>
            <div className="space-y-2">
              {sonuc.gucluYonler.map((yon, i) => (
                <div key={i} className="rounded-lg bg-brand/10 px-4 py-3 text-sm text-brand-deep">
                  {yon}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zayıf Yönler */}
        {sonuc.zayifYonler.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-ink">⚠️ Geliştirilecek Yönler</h3>
            <div className="space-y-2">
              {sonuc.zayifYonler.map((yon, i) => (
                <div key={i} className="rounded-lg bg-clinical-red/10 px-4 py-3 text-sm text-clinical-red">
                  {yon}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atlanan Red Flag'ler */}
        {sonuc.atlananRedFlagler.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-clinical-red">🚨 Atlanan Red Flag'ler</h3>
            <div className="space-y-2">
              {sonuc.atlananRedFlagler.map((rf, i) => (
                <div key={i} className="rounded-lg border border-clinical-red/20 bg-clinical-red/5 px-4 py-3 text-sm text-clinical-red">
                  {rf}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anamnez Analizi */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-ink">🔍 Anamnez Analizi</h3>
          <div className="card-feature">
            <div className="mb-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{sonuc.anamnezAnalizi.toplamSoruldu}/{sonuc.anamnezAnalizi.toplamBeklenen}</span>
                <span className="text-steel">kritik soru soruldu</span>
              </div>
              {sonuc.anamnezAnalizi.enIyiKategori && (
                <div className="flex items-center gap-1 text-brand-deep">
                  <span>🏆 En iyi:</span>
                  <span className="font-medium">{sonuc.anamnezAnalizi.enIyiKategori}</span>
                </div>
              )}
              {sonuc.anamnezAnalizi.enCokEksikKategori && (
                <div className="flex items-center gap-1 text-clinical-orange">
                  <span>⚠️ En eksik:</span>
                  <span className="font-medium">{sonuc.anamnezAnalizi.enCokEksikKategori}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {sonuc.anamnezAnalizi.kategoriBazinda
                .filter((k) => k.beklenen > 0)
                .map((k, i) => {
                  const oran = Math.round((k.soruldu / k.beklenen) * 100);
                  const renk = oran >= 80 ? "bg-brand" : oran >= 50 ? "bg-clinical-orange" : "bg-clinical-red";
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-40 flex-shrink-0 text-xs font-medium text-ink">{k.etiket}</div>
                      <div className="flex-1 rounded-full bg-surface">
                        <div className={`h-2 rounded-full transition-all ${renk}`} style={{ width: `${oran}%` }} />
                      </div>
                      <div className="w-20 flex-shrink-0 text-right text-xs text-steel">
                        {k.soruldu}/{k.beklenen} ({oran}%)
                      </div>
                    </div>
                  );
                })}
            </div>
            {sonuc.anamnezAnalizi.kategoriBazinda.some((k) => k.eksik.length > 0) && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-semibold text-muted">Sorulmayan kritik sorular:</div>
                {sonuc.anamnezAnalizi.kategoriBazinda
                  .filter((k) => k.eksik.length > 0)
                  .map((k, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-clinical-red/80">
                      <span className="mt-0.5">•</span>
                      <span>
                        <strong>{k.etiket}:</strong> {k.eksik.join(", ")}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* İdeal Yol */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-ink">📋 İdeal Klinik Yaklaşım</h3>
          <div className="card-feature space-y-2">
            {sonuc.idealYol.map((adim, i) => (
              <div key={i} className="text-sm text-steel" style={{ lineHeight: "1.6" }}>
                {adim}
              </div>
            ))}
          </div>
        </div>

        {/* Eğitim Notu */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-ink">📚 Eğitim Notu</h3>
          <div className="card">
            <p className="text-sm text-steel whitespace-pre-line" style={{ lineHeight: "1.7" }}>
              {sonuc.egitimNotu}
            </p>
          </div>
        </div>

        {/* Tedavi Planı */}
        {sonuc.tedavi && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-ink">💊 Tedavi Planı</h3>
            <div className="card overflow-hidden p-0">
              {/* Tedavi Özet */}
              <div className="bg-brand/10 px-4 py-3 border-b border-hairline">
                <p className="text-sm font-medium text-brand-deep">{sonuc.tedavi.aciklama}</p>
              </div>

              {/* İlaç Tablosu */}
              {sonuc.tedavi.ilaclar.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-hairline bg-surface-soft">
                        <th className="px-4 py-2 font-semibold text-ink">İlaç</th>
                        <th className="px-4 py-2 font-semibold text-ink">Doz</th>
                        <th className="px-4 py-2 font-semibold text-ink">Yol</th>
                        <th className="px-4 py-2 font-semibold text-ink">Endikasyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sonuc.tedavi.ilaclar.map((ilac, i) => (
                        <tr key={i} className="border-b border-hairline-soft last:border-0 hover:bg-surface transition-colors">
                          <td className="px-4 py-2.5 font-medium text-ink">{ilac.ad}</td>
                          <td className="px-4 py-2.5 text-steel">{ilac.doz}</td>
                          <td className="px-4 py-2.5 text-steel">{ilac.yol}</td>
                          <td className="px-4 py-2.5 text-steel">{ilac.endikasyon}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Prosedürler */}
              {sonuc.tedavi.prosedurler.length > 0 && (
                <div className="border-t border-hairline px-4 py-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Prosedürler</div>
                  <ul className="space-y-1">
                    {sonuc.tedavi.prosedurler.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-steel">
                        <span className="mt-1 text-[10px] text-brand">●</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notlar */}
              {sonuc.tedavi.notlar.length > 0 && (
                <div className="border-t border-hairline bg-surface-soft px-4 py-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Önemli Notlar</div>
                  <ul className="space-y-1">
                    {sonuc.tedavi.notlar.map((n, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-steel">
                        <span className="mt-1 text-[10px] text-clinical-orange">!</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Kaynak */}
              <div className="border-t border-hairline px-4 py-2">
                <span className="text-[11px] text-muted">Kaynak: {sonuc.tedavi.kaynak}</span>
              </div>
            </div>
          </div>
        )}

        {/* Özet */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <OzetKart baslik="Doğru Sorular" deger={sonuc.dogruSorular.length} renk="brand" />
          <OzetKart baslik="Eksik Sorular" deger={sonuc.eksikSorular.length} renk="orange" />
          <OzetKart baslik="Doğru Testler" deger={sonuc.dogruTestler.length} renk="brand" />
          <OzetKart baslik="Eksik Testler" deger={sonuc.eksikTestler.length} renk="orange" />
        </div>

        {/* Aksiyonlar */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/vakalar" className="btn-primary flex-1 justify-center">
            Yeni Vaka Seç →
          </Link>
          <Link href="/" className="btn-secondary flex-1 justify-center">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

function OzetKart({ baslik, deger, renk }: { baslik: string; deger: number; renk: string }) {
  const renkSinif =
    renk === "brand"
      ? "text-brand-deep bg-brand/10"
      : renk === "orange"
      ? "text-clinical-orange bg-clinical-orange/10"
      : "text-clinical-red bg-clinical-red/10";

  return (
    <div className={`rounded-lg p-4 text-center ${renkSinif}`}>
      <div className="text-3xl font-semibold">{deger}</div>
      <div className="mt-1 text-xs font-medium">{baslik}</div>
    </div>
  );
}
