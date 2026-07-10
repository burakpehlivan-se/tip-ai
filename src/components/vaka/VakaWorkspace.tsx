"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Vaka,
  ChatMesaj,
  TestIstegi,
  DegerlendirmeSonuc,
  SoruChipi,
  ChipKategorisi,
  TestSonucu,
  Hasta,
} from "@/lib/types";
import { normalizeSoru, normalizeTest } from "@/lib/nlp/normalize";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { birlesikTestKatalogu } from "@/lib/data";
import { aksiyonRelevantMi, CHIP_KATEGORI_ETIKETLERI } from "@/lib/data/case-generator";
import ResmiRapor from "./ResmiRapor";
import Link from "next/link";

export type WorkspaceFaz = "anamnez" | "test" | "tani" | "tedavi";

/** Çemiçgezek kuyruğu için sohbet/test durumu anlık görüntüsü */
export interface WorkspaceSnapshot {
  mesajlar: ChatMesaj[];
  testIstekleri: TestIstegi[];
  sorulanAksiyonlar: string[];
  faz: WorkspaceFaz;
  taniInput: string;
  tedaviInput: string;
}

interface Props {
  vaka: Vaka;
  mod?: "normal" | "cemicegek";
  raporHazir?: boolean;
  onTestIstendi?: (testKey: string) => void;
  /** Her anlamlı state değişiminde parent’a snapshot (kuyruk kaydı için) */
  onSnapshotChange?: (snap: WorkspaceSnapshot) => void;
  /** Hasta geri döndüğünde önceki sohbet/test durumu */
  initialSnapshot?: WorkspaceSnapshot | null;
  hastaneAdi?: string;
  /** Üst bar / geri link gizle (parent kendi bar’ını kullanıyorsa) */
  embed?: boolean;
  /** Admin debug: beklenen tanı/red flag/test sonuçları hemen görünür */
  debugMode?: boolean;
  onComplete?: (sonuc: DegerlendirmeSonuc) => void;
}

function defaultMesajlar(vaka: Vaka): ChatMesaj[] {
  return [
    {
      id: "0",
      rol: "sistem",
      metin: `Vaka başladı. Hasta: ${vaka.hasta.yas} yaş, ${vaka.hasta.cinsiyet === "E" ? "Erkek" : "Kadın"} — ${vaka.hasta.anaSikayet}. Anamnez sorularınızı bekliyorum.`,
      zaman: Date.now(),
    },
  ];
}

/** Lab’dan dönüşte “rapor hazırlanıyor” mesajlarına sonuç ekle */
function mesajlaraSonucEkle(mesajlar: ChatMesaj[], testler: TestIstegi[]): ChatMesaj[] {
  return mesajlar.map((m) => {
    if (m.rol !== "sistem" || !m.testAdi || m.testSonucu) return m;
    const eslesen = testler.find((t) => t.testAdi === m.testAdi || m.metin.includes(t.testAdi));
    if (!eslesen) return m;
    return {
      ...m,
      metin: `🧪 ${eslesen.testAdi} — rapor hazır`,
      testSonucu: eslesen.sonuc,
    };
  });
}

export default function VakaWorkspace({
  vaka,
  mod = "normal",
  raporHazir = true,
  onTestIstendi,
  onSnapshotChange,
  initialSnapshot = null,
  hastaneAdi = "ÇEMİÇGEZEK DEVLET HASTANESİ",
  embed = false,
  debugMode = false,
  onComplete,
}: Props) {
  // Debug modda sonuçlar her zaman açık
  const effectiveRaporHazir = debugMode ? true : raporHazir;
  const baslangicMesaj = initialSnapshot
    ? effectiveRaporHazir
      ? mesajlaraSonucEkle(initialSnapshot.mesajlar, initialSnapshot.testIstekleri)
      : initialSnapshot.mesajlar
    : defaultMesajlar(vaka);

  const [mesajlar, setMesajlar] = useState<ChatMesaj[]>(baslangicMesaj);
  const [input, setInput] = useState("");
  const [testIstekleri, setTestIstekleri] = useState<TestIstegi[]>(
    initialSnapshot?.testIstekleri || []
  );
  const [sorulanAksiyonlar, setSorulanAksiyonlar] = useState<string[]>(
    initialSnapshot?.sorulanAksiyonlar || []
  );
  const [faz, setFaz] = useState<WorkspaceFaz>(initialSnapshot?.faz || "anamnez");
  const [taniInput, setTaniInput] = useState(initialSnapshot?.taniInput || "");
  const [tedaviInput, setTedaviInput] = useState(initialSnapshot?.tedaviInput || "");
  const [showTestDropdown, setShowTestDropdown] = useState(false);
  const [sonuc, setSonuc] = useState<DegerlendirmeSonuc | null>(null);
  const [testArama, setTestArama] = useState("");
  const [chipArama, setChipArama] = useState("");
  const [acikKategoriler, setAcikKategoriler] = useState<Set<ChipKategorisi>>(new Set<ChipKategorisi>(["anamnez-agri"]));
  const [kaynaklarAcik, setKaynaklarAcik] = useState(false);
  const [showSoruDrawer, setShowSoruDrawer] = useState(false);
  const [showKatDropdown, setShowKatDropdown] = useState(false);
  const [mobilPanel, setMobilPanel] = useState<"hasta" | "sohbet" | "testler">("sohbet");
  const [debugDetayAcik, setDebugDetayAcik] = useState(false);
  const [debugTumSonuclarAcik, setDebugTumSonuclarAcik] = useState(false);
  const [debugTestFiltre, setDebugTestFiltre] = useState<"hepsi" | "var" | "yok">("hepsi");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const skipFirstSnapshot = useRef(true);

  // Parent’a snapshot
  useEffect(() => {
    if (!onSnapshotChange) return;
    if (skipFirstSnapshot.current) {
      skipFirstSnapshot.current = false;
      // İlk mount’ta da parent senkron kalsın (restore sonrası)
      onSnapshotChange({
        mesajlar,
        testIstekleri,
        sorulanAksiyonlar,
        faz,
        taniInput,
        tedaviInput,
      });
      return;
    }
    onSnapshotChange({
      mesajlar,
      testIstekleri,
      sorulanAksiyonlar,
      faz,
      taniInput,
      tedaviInput,
    });
  }, [mesajlar, testIstekleri, sorulanAksiyonlar, faz, taniInput, tedaviInput, onSnapshotChange]);

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

  // Faz değişince mobil panel otomatik ayarlansın
  useEffect(() => {
    if (faz === "test" || faz === "tani" || faz === "tedavi") {
      setMobilPanel("testler");
    } else {
      setMobilPanel("sohbet");
    }
  }, [faz]);

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
    setMobilPanel("sohbet");

    const durumMesaji = mod === "cemicegek" && !effectiveRaporHazir
      ? `🧪 ${statik.testAdi} istendi — rapor hazırlanıyor…`
      : `🧪 ${statik.testAdi} istendi`;

    setMesajlar((prev) => [
      ...prev,
      {
        id: `${Date.now()}-test`,
        rol: "sistem",
        metin: durumMesaji,
        zaman: Date.now(),
        testSonucu: (mod === "cemicegek" && !effectiveRaporHazir) ? undefined : statik,
        testAdi: statik.testAdi,
      },
    ]);
    setShowTestDropdown(false);
    setTestArama("");

    // Cemicegek modunda: test istendiğinde parent'a haber ver
    if (mod === "cemicegek" && !effectiveRaporHazir) {
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
    const deg = degerlendir(vaka, sorulanAksiyonlar, istenenTestKeyleri, taniInput);
    setSonuc(deg);
    onComplete?.(deg);
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

  /** Debug: tanı/vaka için sonucu olan + olmayan tüm testler */
  const debugTestEnvanteri = useMemo(() => {
    const beklenenKeys = new Set((vaka.rubric?.beklenenTestler || []).map((t) => t.key));
    const gereksizKeys = new Set((vaka.rubric?.gereksizTestler || []).map((t) => t.key));
    const keys = new Set<string>();
    for (const t of birlesikTestKatalogu) keys.add(t.key);
    for (const k of Object.keys(vaka.statikTestler || {})) keys.add(k);
    for (const t of vaka.rubric?.beklenenTestler || []) keys.add(t.key);
    for (const t of vaka.rubric?.gereksizTestler || []) keys.add(t.key);

    const items = Array.from(keys).map((key) => {
      const kat = birlesikTestKatalogu.find((t) => t.key === key);
      const sonuc = vaka.statikTestler?.[key];
      const rubrikEtiket =
        (vaka.rubric?.beklenenTestler || []).find((t) => t.key === key)?.etiket ||
        (vaka.rubric?.gereksizTestler || []).find((t) => t.key === key)?.etiket;
      return {
        key,
        ad: sonuc?.testAdi || rubrikEtiket || kat?.ad || key,
        kategori: kat?.kategori || "Diğer",
        sonuc: sonuc as TestSonucu | undefined,
        hasSonuc: !!sonuc,
        beklenen: beklenenKeys.has(key),
        gereksiz: gereksizKeys.has(key),
        source: sonuc?.source,
      };
    });

    items.sort((a, b) => {
      // Önce sonucu olan, sonra beklenen, sonra ada göre
      if (a.hasSonuc !== b.hasSonuc) return a.hasSonuc ? -1 : 1;
      if (a.beklenen !== b.beklenen) return a.beklenen ? -1 : 1;
      return a.ad.localeCompare(b.ad, "tr");
    });

    const sonucuVar = items.filter((i) => i.hasSonuc).length;
    const sonucuYok = items.length - sonucuVar;
    return { items, sonucuVar, sonucuYok };
  }, [vaka.statikTestler, vaka.rubric]);

  const debugGosterilenTestler = useMemo(() => {
    if (debugTestFiltre === "var") return debugTestEnvanteri.items.filter((i) => i.hasSonuc);
    if (debugTestFiltre === "yok") return debugTestEnvanteri.items.filter((i) => !i.hasSonuc);
    return debugTestEnvanteri.items;
  }, [debugTestEnvanteri, debugTestFiltre]);

  // Sonuç ekranı gösteriliyorsa
  if (sonuc) {
    return <SonucEkrani vaka={vaka} sonuc={sonuc} embed={embed} />;
  }

  return (
    <div
      className={`flex min-h-0 flex-col bg-canvas ${
        embed ? "h-full flex-1 overflow-hidden" : "h-screen"
      }`}
    >
      {debugMode && (
        <div className="shrink-0 border-b border-clinical-orange/30 bg-clinical-orange/10 text-[11px] text-ink">
          <button
            type="button"
            onClick={() => setDebugDetayAcik((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-clinical-orange/10"
          >
            <span className="shrink-0 font-semibold text-clinical-orange">🐛 Debug</span>
            <span className="min-w-0 flex-1 truncate text-steel">
              <span className="text-muted">Tanı:</span>{" "}
              {(vaka.beklenenTani || []).slice(0, 2).join(", ") || "—"}
              {(vaka.beklenenTani || []).length > 2 ? "…" : ""}
              <span className="mx-1.5 text-hairline">·</span>
              <span className="text-muted">RF:</span>{" "}
              {(vaka.rubric?.redFlagler || []).length} ·{" "}
              <span className="text-muted">Test:</span>{" "}
              {(vaka.rubric?.beklenenTestler || []).length} beklenen · sonuç anında
            </span>
            <span className="shrink-0 text-muted">{debugDetayAcik ? "▴" : "▾"}</span>
          </button>
          {debugDetayAcik && (
            <div className="grid max-h-28 gap-x-3 gap-y-0.5 overflow-y-auto border-t border-clinical-orange/20 px-3 py-1.5 sm:grid-cols-2 lg:grid-cols-3 scrollbar-thin">
              <div>
                <span className="text-muted">Beklenen tanı: </span>
                {(vaka.beklenenTani || []).join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted">Red flags: </span>
                {(vaka.rubric?.redFlagler || []).map((r) => r.etiket).join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted">Beklenen testler: </span>
                {(vaka.rubric?.beklenenTestler || []).map((t) => t.etiket).join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted">Gereksiz testler: </span>
                {(vaka.rubric?.gereksizTestler || []).map((t) => t.etiket).join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted">Hastalık key: </span>
                {vaka.hastalik}
              </div>
              <div>
                <span className="text-muted">Test sonucu: </span>
                anında görünür
              </div>
            </div>
          )}
        </div>
      )}
      {/* Top Bar — embed/cemicegek’te parent bar kullanır */}
      {!embed && (
      <div className="flex h-12 lg:h-14 items-center justify-between border-b border-hairline bg-canvas px-3 lg:px-4">
        <div className="flex items-center gap-1.5 lg:gap-2 min-w-0">
          <Link href="/vakalar" className="text-steel hover:text-ink transition-colors shrink-0">
            <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-sm lg:text-base font-semibold text-ink truncate">{vaka.alan} · {vaka.hasta.yas} yaş</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-surface p-0.5">
          {(["anamnez","test","tani","tedavi"] as const).map((f) => (
            <button key={f} onClick={() => setFaz(f)} className={`px-2.5 lg:px-3 py-1 rounded-md text-[11px] lg:text-xs font-medium transition-colors ${faz === f ? "bg-ink text-white shadow-sm" : "text-steel hover:bg-surface-soft"}`}>
              {f === "anamnez" ? "Anamnez" : f === "test" ? "Test" : f === "tani" ? "Tanı" : "Tedavi"}
            </button>
          ))}
        </div>
      </div>
      )}
      {/* Cemicegek / admin embed: faz sekmeleri yine görünsün */}
      {embed && (
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline bg-canvas px-3">
        <span className="text-xs text-steel truncate">
          {vaka.hasta.tamAd || vaka.hasta.ad} · {vaka.hasta.yas} yaş · {vaka.alan}
        </span>
        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-surface p-0.5">
          {(["anamnez","test","tani","tedavi"] as const).map((f) => (
            <button key={f} onClick={() => setFaz(f)} className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${faz === f ? "bg-ink text-white shadow-sm" : "text-steel hover:bg-surface-soft"}`}>
              {f === "anamnez" ? "Anamnez" : f === "test" ? "Test" : f === "tani" ? "Tanı" : "Tedavi"}
            </button>
          ))}
        </div>
      </div>
      )}
      {/* Mobil faz sekmeleri (sm altı) */}
      <div className="flex sm:hidden shrink-0 border-b border-hairline bg-canvas px-1 overflow-x-auto scrollbar-none">
        {(["anamnez","test","tani","tedavi"] as const).map((f) => (
          <button key={f} onClick={() => setFaz(f)} className={`shrink-0 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${faz === f ? "border-ink text-ink" : "border-transparent text-steel"}`}>
            {f === "anamnez" ? "Anamnez" : f === "test" ? "Test" : f === "tani" ? "Tanı" : "Tedavi"}
          </button>
        ))}
      </div>

      {/* 3-Panel Layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sol Panel — Hasta */}
        <div className={`${mobilPanel !== "hasta" ? "hidden" : "flex"} lg:flex w-72 flex-shrink-0 border-r border-hairline bg-surface-soft overflow-y-auto scrollbar-thin flex-col`}>
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
                        className="rounded-md border border-hairline bg-canvas px-3 py-2.5 text-[11px] text-steel leading-relaxed break-words"
                      >
                        <KaynakMetni metin={k} />
                      </div>
                    ))}
                    <div className="rounded-md bg-ink/5 px-3 py-2 text-[10px] text-muted italic">
                      ⚠️ Tüm vakalar eğitim amaçlıdır. Lab bazal paneli Synthea sentetik EHR satırlarından örneklenir; gerçek MIMIC erişimi planlanmaktadır. KVKK özel nitelikli kişisel veri işlenmez.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Orta Panel — Sohbet */}
        <div className={`${mobilPanel !== "sohbet" ? "hidden" : "flex"} lg:flex flex-col flex-1 overflow-hidden`}>
          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 lg:px-8">
            <div className="mx-auto max-w-2xl space-y-4">
              {mesajlar.map((msg) => (
                <MesajBalonu key={msg.id} msg={msg} vaka={vaka} hastaneAdi={hastaneAdi} />
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Soru Toolbar — dropdown + sabit layout, scroll yok */}
          <div className="border-t border-hairline-soft px-3 lg:px-8 py-1.5">
            <div className="mx-auto max-w-2xl flex items-center justify-between gap-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted hidden sm:inline">SORULAR</span>
              {/* Kategori dropdown */}
              <div className="relative">
                <button onClick={() => setShowKatDropdown(!showKatDropdown)}
                  className="flex items-center gap-1 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/30 transition-colors">
                  {CHIP_KATEGORI_ETIKETLERI[Array.from(acikKategoriler)[0] || "anamnez-agri"]} ▾
                </button>
                {showKatDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-30 w-48 rounded-lg border border-hairline bg-canvas shadow-lg overflow-hidden">
                    {(["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => (
                      <button key={kat} onClick={() => { setAcikKategoriler(new Set([kat])); setShowKatDropdown(false); }}
                        className={`flex w-full items-center px-3 py-2 text-left text-xs hover:bg-surface transition-colors ${acikKategoriler.has(kat) ? "bg-surface font-semibold text-ink" : "text-steel"}`}>
                        {CHIP_KATEGORI_ETIKETLERI[kat]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setShowSoruDrawer(true)}
                className="rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-steel hover:border-ink/30 hover:text-ink transition-colors">
                Tümü ▸
              </button>
            </div>
            {/* Aktif kategoriden 2 satır chip */}
            {faz === "anamnez" && (() => {
              const aktifKat = Array.from(acikKategoriler)[0];
              if (!aktifKat) return null;
              const all = (vaka.soruChipleri as SoruChipi[]).filter((c) => c.kategori === aktifKat);
              // Önce vakaya relevant sorular, sonra diğerleri — kesme yok
              const relevant = all.filter((c) => vaka.relevantAksiyonlar?.includes(c.aksiyon));
              const rest = all.filter((c) => !vaka.relevantAksiyonlar?.includes(c.aksiyon));
              const chips = [...relevant, ...rest];
              if (chips.length === 0) return null;
              return (
                <div className="mx-auto max-w-2xl flex flex-wrap gap-1 pt-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                  {chips.map((chip, i) => {
                    const soruldu = sorulanAksiyonlar.includes(chip.aksiyon);
                    const rel = vaka.relevantAksiyonlar?.includes(chip.aksiyon);
                    return (
                      <button key={`${chip.aksiyon}-${i}`} onClick={() => chipSor(chip)} disabled={soruldu}
                        className={`rounded-full border px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs font-medium transition-all ${
                          soruldu
                            ? "cursor-default border-hairline bg-surface text-muted/60 line-through"
                            : rel
                              ? "border-brand/40 bg-brand/5 text-ink hover:border-brand hover:bg-brand/10"
                              : "border-hairline bg-canvas text-steel hover:border-ink/50 hover:text-ink hover:bg-surface"
                        }`}>{chip.etiket}</button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Soru Drawer (overlay) */}
          {showSoruDrawer && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/20" onClick={() => setShowSoruDrawer(false)} />
              <div className="relative w-full max-w-md bg-canvas shadow-xl border-l border-hairline overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-canvas px-4 py-3">
                  {/* Kategori seçici */}
                  <div className="flex flex-wrap gap-1">
                    {(["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => (
                      <button key={kat} onClick={() => { toggleKategori(kat); }}
                        className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${acikKategoriler.has(kat) ? "border-ink/30 bg-ink text-white" : "border-hairline bg-canvas text-steel"}`}>
                        {CHIP_KATEGORI_ETIKETLERI[kat]}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowSoruDrawer(false)} className="rounded-full p-1 hover:bg-surface text-steel shrink-0">✕</button>
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

          {/* Input — faz bazlı */}
          <div className="border-t border-hairline bg-canvas px-3 py-3 lg:px-8 lg:py-4">
            <div className="mx-auto max-w-2xl">
              {faz === "anamnez" ? (
                <div className="flex gap-2">
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && soruSor()}
                    placeholder="Hastaya soru sor…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none" />
                  <button onClick={soruSor} className="btn-primary h-11 lg:h-10 px-5 shrink-0 text-sm">Sor</button>
                </div>
              ) : faz === "tani" ? (
                <div className="flex gap-2">
                  <input type="text" value={taniInput} onChange={(e) => setTaniInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tamamlama()}
                    placeholder="Ön tanınızı girin (örn: Akut Koroner Sendrom)…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none" />
                  <button onClick={tamamlama} className="btn-primary h-11 lg:h-10 px-5 shrink-0 text-sm">Tanı →</button>
                </div>
              ) : faz === "tedavi" ? (
                <div className="flex gap-2">
                  <textarea value={tedaviInput} onChange={(e) => setTedaviInput(e.target.value)}
                    placeholder="Tedavi planınızı yazın (ilaçlar, dozlar, prosedürler)…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none resize-none" rows={1} />
                  <button onClick={vakaTamamla} className="btn-accent h-11 lg:h-10 px-5 shrink-0 text-sm">Puanla ✓</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-steel">Test istemek için sağ paneli kullanın</span>
                  <button onClick={() => setFaz("tani")} className="btn-secondary h-11 lg:h-10 shrink-0 text-xs lg:text-sm px-3 lg:px-4" disabled={testIstekleri.length === 0}>
                    Tanı ▸
                  </button>
                </div>
              )}
              {/* Faz geçiş butonu */}
              <div className="flex justify-center mt-1.5">
                <button onClick={() => {
                  const sira = (["anamnez","test","tani","tedavi"] as const);
                  const idx = sira.indexOf(faz);
                  setFaz(sira[(idx + 1) % sira.length]);
                }}
                  className="text-[10px] text-muted hover:text-ink transition-colors">
                  {faz === "anamnez" ? "Testler ▸" : faz === "test" ? "Tanı ▸" : faz === "tani" ? "Tedavi ▸" : "Anamnez ▸"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Panel — Testler ve Sonuçlar */}
        <div className={`${mobilPanel !== "testler" ? "hidden" : "flex"} xl:flex w-80 flex-shrink-0 border-l border-hairline bg-surface-soft overflow-y-auto scrollbar-thin flex-col`}>
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
                          const hasSonuc = !!vaka.statikTestler?.[test.key];
                          return (
                            <button
                              key={test.key}
                              onClick={() => testIstey(test.key)}
                              disabled={istendi}
                              className={`flex w-full items-center justify-between border-b border-hairline-soft px-4 py-2.5 text-left text-sm last:border-0 hover:bg-surface transition-colors ${
                                istendi ? "opacity-40 cursor-not-allowed" : "text-ink"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-medium">{test.ad}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  {istendi && (
                                    <span className="text-[10px] text-brand">✓ İstendi</span>
                                  )}
                                  {debugMode && (
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                        hasSonuc
                                          ? "bg-brand/15 text-brand-deep"
                                          : "bg-clinical-orange/15 text-clinical-orange"
                                      }`}
                                    >
                                      {hasSonuc ? "sonuç var" : "sonuç yok"}
                                    </span>
                                  )}
                                </div>
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

            {/* Debug: tanı için tüm test envanteri (sonuçlu + sonuçsuz) */}
            {debugMode && (
              <div className="mb-4 border-t border-clinical-orange/30 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinical-orange">
                  Debug · vaka testleri
                </h3>
                <p className="mb-2 text-[11px] text-muted">
                  Bu tanı/vaka için sonucu olan ve olmayan tüm testler.
                  {" "}
                  <span className="text-steel">
                    {debugTestEnvanteri.sonucuVar} sonuçlu · {debugTestEnvanteri.sonucuYok} sonuçsuz
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDebugTumSonuclarAcik((v) => !v);
                    if (!debugTumSonuclarAcik) setMobilPanel("testler");
                  }}
                  className="btn-secondary w-full justify-center text-xs"
                >
                  {debugTumSonuclarAcik
                    ? "Test sonuçlarını gizle"
                    : "Test sonuçlarını göster"}
                </button>

                {debugTumSonuclarAcik && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          { id: "hepsi" as const, label: `Tümü (${debugTestEnvanteri.items.length})` },
                          { id: "var" as const, label: `Sonuçlu (${debugTestEnvanteri.sonucuVar})` },
                          { id: "yok" as const, label: `Sonuçsuz (${debugTestEnvanteri.sonucuYok})` },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setDebugTestFiltre(f.id)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            debugTestFiltre === f.id
                              ? "bg-ink text-white"
                              : "border border-hairline bg-canvas text-steel hover:text-ink"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-[55vh] space-y-2 overflow-y-auto scrollbar-thin pr-0.5">
                      {debugGosterilenTestler.map((item) => (
                        <DebugTestKarti
                          key={item.key}
                          item={item}
                          hasta={vaka.hasta}
                          hastaneAdi={hastaneAdi}
                          defaultOpen={item.hasSonuc && debugTestFiltre !== "hepsi"}
                        />
                      ))}
                      {debugGosterilenTestler.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted">Bu filtrede test yok.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* İstenen Testler / Sonuçlar */}
            <div className="mb-4 border-t border-hairline pt-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                İstenen Test Sonuçları ({testIstekleri.length})
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

            {/* Tanı ve Tedavi Girişi — her zaman görünür */}
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
        <button onClick={() => setMobilPanel("hasta")} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${mobilPanel === "hasta" ? "text-brand" : "text-steel"}`}>
          <span className="text-base">👤</span>
          <span className="text-[10px] font-medium">Hasta</span>
        </button>
        <button onClick={() => setMobilPanel("sohbet")} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${mobilPanel === "sohbet" ? "text-brand" : "text-steel"}`}>
          <span className="text-base">💬</span>
          <span className="text-[10px] font-medium">Sohbet</span>
        </button>
        <button onClick={() => setMobilPanel("testler")} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${mobilPanel === "testler" ? "text-brand" : "text-steel"}`}>
          <span className="text-base">🧪</span>
          <span className="text-[10px] font-medium">Testler</span>
        </button>
      </div>
    </div>
  );
}

function MesajBalonu({ msg, vaka, hastaneAdi }: { msg: ChatMesaj; vaka: Vaka; hastaneAdi: string }) {
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

/** Kaynak satırındaki URL’leri tıklanabilir link yap */
function KaynakMetni({ metin }: { metin: string }) {
  const parts = metin.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("http") ? (
          <a
            key={i}
            href={p.replace(/[.,;)]+$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-clinical-blue underline break-all hover:text-ink"
          >
            {p.replace(/[.,;)]+$/, "")}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function TestSonucKarti({ istek, hasta, hastaneAdi }: { istek: TestIstegi; hasta: Hasta; hastaneAdi?: string }) {
  const { sonuc } = istek;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between border-b border-hairline-soft px-4 py-3 text-left hover:bg-surface-soft transition-colors"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-ink">{sonuc.testAdi}</div>
            {sonuc.source === "dataset" && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel" title="Synthea lab-pool — profil eşleşmeli satır">
                dataset
              </span>
            )}
            {sonuc.source === "synthetic" && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel" title="Eski sentetik (kullanımdan kalktı)">
                sentetik
              </span>
            )}
            {sonuc.source === "original" && (
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep" title="Vaka şablonu — patoloji">
                patoloji
              </span>
            )}
          </div>
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

type DebugTestItem = {
  key: string;
  ad: string;
  kategori: string;
  sonuc?: TestSonucu;
  hasSonuc: boolean;
  beklenen: boolean;
  gereksiz: boolean;
  source?: string;
};

function DebugTestKarti({
  item,
  hasta,
  hastaneAdi,
  defaultOpen = false,
}: {
  item: DebugTestItem;
  hasta: Hasta;
  hastaneAdi?: string;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        item.hasSonuc
          ? "border-hairline bg-canvas"
          : "border-dashed border-clinical-orange/40 bg-clinical-orange/5"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-soft/80 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-ink">{item.ad}</span>
            {item.hasSonuc ? (
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                sonuç var
              </span>
            ) : (
              <span className="rounded-full bg-clinical-orange/20 px-1.5 py-0.5 text-[10px] font-medium text-clinical-orange">
                sonuç yok
              </span>
            )}
            {item.beklenen && (
              <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                beklenen
              </span>
            )}
            {item.gereksiz && (
              <span className="rounded-full bg-clinical-red/10 px-1.5 py-0.5 text-[10px] font-medium text-clinical-red">
                gereksiz
              </span>
            )}
            {item.source === "original" && (
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                patoloji
              </span>
            )}
            {item.source === "dataset" && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel">
                dataset
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {item.kategori} · <span className="font-mono">{item.key}</span>
            {item.hasSonuc
              ? ` · ${expanded ? "raporu gizle" : "raporu gör"}`
              : " · bu vakada sonuç tanımlı değil"}
          </div>
        </div>
        <span className="shrink-0 text-steel">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-hairline-soft bg-surface-soft p-2">
          {item.hasSonuc && item.sonuc ? (
            <ResmiRapor sonuc={item.sonuc} hasta={hasta} hastaneAdi={hastaneAdi} compact />
          ) : (
            <div className="rounded-md border border-dashed border-clinical-orange/30 bg-canvas px-3 py-3 text-xs text-steel">
              <div className="font-medium text-clinical-orange">Sonuç yok</div>
              <p className="mt-1 leading-relaxed">
                Bu test katalogda/rubrikte yer alıyor ancak vaka şablonunda veya lab
                havuzunda sonuç üretilmemiş. Admin editöründen sonuç ekleyebilirsiniz.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SonucEkrani({
  vaka,
  sonuc,
  embed = false,
}: {
  vaka: Vaka;
  sonuc: DegerlendirmeSonuc;
  embed?: boolean;
}) {
  const yuzde = Math.round((sonuc.toplamPuan / sonuc.maxPuan) * 100);
  const renk =
    yuzde >= 80 ? "text-brand-deep" : yuzde >= 60 ? "text-clinical-orange" : "text-clinical-red";

  return (
    <div
      className={`bg-canvas ${
        embed ? "flex h-full min-h-0 flex-col overflow-hidden" : "min-h-screen"
      }`}
    >
      <nav className="shrink-0 border-b border-hairline-soft bg-canvas">
        <div
          className={`flex items-center justify-between px-4 ${
            embed ? "h-10 max-w-none" : "mx-auto h-16 max-w-4xl px-6"
          }`}
        >
          {!embed ? (
            <Link
              href="/vakalar"
              className="text-sm font-medium text-steel transition-colors hover:text-ink"
            >
              ← Vakalar
            </Link>
          ) : (
            <span className="text-xs font-medium text-steel">Admin debug · değerlendirme</span>
          )}
          <span className={`font-medium text-ink ${embed ? "text-xs" : "text-sm"}`}>
            Değerlendirme
          </span>
        </div>
      </nav>

      <div
        className={`mx-auto max-w-4xl px-4 ${
          embed ? "min-h-0 flex-1 overflow-y-auto py-6 scrollbar-thin lg:px-6" : "px-6 py-12"
        }`}
      >
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
