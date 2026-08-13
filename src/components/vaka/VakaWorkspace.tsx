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
  humanizeKey,
} from "@/lib/types";
import { normalizeSoru } from "@/lib/nlp/normalize";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { birlesikTestKatalogu, TEST_VISIBILITY_MAP, MOTOR_CAPABLE_KEYS } from "@/lib/data/test-catalogue";
import { CHIP_KATEGORI_ETIKETLERI } from "@/lib/data/chip-labels";
import ResmiRapor from "./ResmiRapor";
import SonucEkrani from "./SonucEkrani";
import { DebugTestKarti, TestSonucKarti } from "./TestResultCards";
import VakaHastaPanel from "./VakaHastaPanel";
import Link from "next/link";
import {
  type ClinicalReasoningInput,
} from "@/lib/student/clinical-reasoning";

export type WorkspaceFaz = "anamnez" | "test" | "tani" | "tedavi";

/** Çemiçgezek kuyruğu için sohbet/test durumu anlık görüntüsü */
export interface WorkspaceSnapshot {
  mesajlar: ChatMesaj[];
  testIstekleri: TestIstegi[];
  sorulanAksiyonlar: string[];
  faz: WorkspaceFaz;
  taniInput: string;
  tedaviInput: string;
  clinicalReasoning?: ClinicalReasoningInput | null;
}

export interface CompletedAttempt {
  sorulanAksiyonlar: string[];
  istenenTestler: string[];
  taniGirildi: string;
  clinicalReasoning: ClinicalReasoningInput;
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
  onComplete?: (sonuc: DegerlendirmeSonuc, attempt: CompletedAttempt) => void;
  /** Öğrenci modunda cevap/test/puan sunucudaki vaka oturumundan gelir. */
  onAsk?: (action: string) => Promise<string>;
  onTestRequest?: (testKey: string) => Promise<TestSonucu | null>;
  onEvaluate?: (attempt: CompletedAttempt) => Promise<DegerlendirmeSonuc | null>;
  /** Sunucudaki aktif öğrenci denemesine debounced muhakeme taslağını kaydeder. */
  onReasoningSave?: (reasoning: ClinicalReasoningInput) => Promise<void>;
  /** İlk öğrenci vakasında kısa ve kapatılabilir çalışma rehberi gösterir. */
  onboarding?: boolean;
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

function toReasoningList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
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
  onAsk,
  onTestRequest,
  onEvaluate,
  onReasoningSave,
  onboarding = false,
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
  const [problemRepresentation, setProblemRepresentation] = useState(initialSnapshot?.clinicalReasoning?.problemRepresentation || "");
  const [differentialsText, setDifferentialsText] = useState(initialSnapshot?.clinicalReasoning?.differentials.join("\n") || "");
  const [supportingFindingsText, setSupportingFindingsText] = useState(initialSnapshot?.clinicalReasoning?.supportingFindings.join("\n") || "");
  const [opposingFindingsText, setOpposingFindingsText] = useState(initialSnapshot?.clinicalReasoning?.opposingFindings.join("\n") || "");
  const [confidence, setConfidence] = useState<number | null>(initialSnapshot?.clinicalReasoning?.confidence ?? null);
  const [reasoningDirty, setReasoningDirty] = useState(false);
  const [reasoningSaveState, setReasoningSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sonuc, setSonuc] = useState<DegerlendirmeSonuc | null>(null);
  const [testArama, setTestArama] = useState("");
  const [chipArama, setChipArama] = useState("");
  const [acikKategoriler, setAcikKategoriler] = useState<Set<ChipKategorisi>>(new Set<ChipKategorisi>(["anamnez-agri"]));
  const [showSoruDrawer, setShowSoruDrawer] = useState(false);
  const soruDrawerRef = useRef<HTMLDialogElement>(null);
  const drawerKapatBtnRef = useRef<HTMLButtonElement>(null);
  const [showKatDropdown, setShowKatDropdown] = useState(false);
  const [mobilPanel, setMobilPanel] = useState<"hasta" | "sohbet" | "testler">("sohbet");
  const [debugDetayAcik, setDebugDetayAcik] = useState(false);
  const [debugTumSonuclarAcik, setDebugTumSonuclarAcik] = useState(false);
  const [debugTestFiltre, setDebugTestFiltre] = useState<"hepsi" | "var" | "yok">("hepsi");
  const [onboardingKapatildi, setOnboardingKapatildi] = useState(false);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState("");

  const sorulanAksiyonSeti = useMemo(
    () => new Set(sorulanAksiyonlar),
    [sorulanAksiyonlar]
  );
  const relevantAksiyonSeti = useMemo(
    () => new Set(vaka.relevantAksiyonlar),
    [vaka.relevantAksiyonlar]
  );
  const clinicalReasoning = useMemo<ClinicalReasoningInput>(() => ({
    problemRepresentation: problemRepresentation.trim(),
    differentials: toReasoningList(differentialsText),
    supportingFindings: toReasoningList(supportingFindingsText),
    opposingFindings: toReasoningList(opposingFindingsText),
    confidence,
  }), [problemRepresentation, differentialsText, supportingFindingsText, opposingFindingsText, confidence]);

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
        clinicalReasoning,
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
      clinicalReasoning,
    });
  }, [mesajlar, testIstekleri, sorulanAksiyonlar, faz, taniInput, tedaviInput, clinicalReasoning, onSnapshotChange]);

  useEffect(() => {
    if (!onReasoningSave || !reasoningDirty) return;
    const timer = window.setTimeout(() => {
      setReasoningSaveState("saving");
      void onReasoningSave(clinicalReasoning)
        .then(() => setReasoningSaveState("saved"))
        .catch(() => setReasoningSaveState("error"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [clinicalReasoning, onReasoningSave, reasoningDirty]);

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

  // Native dialog klavye odağını sınırlar ve ESC ile iptal olayını sağlar.
  useEffect(() => {
    const drawer = soruDrawerRef.current;
    if (!showSoruDrawer || !drawer) return;
    drawer.showModal();
    drawerKapatBtnRef.current?.focus();
    return () => drawer.close();
  }, [showSoruDrawer]);

  useEffect(() => {
    if (onboarding) {
      setOnboardingKapatildi(window.localStorage.getItem("tip-ai-ilk-vaka-rehberi-kapatildi") === "1");
    }
  }, [onboarding]);

  const soruSor = async () => {
    if (!input.trim() || islemYukleniyor) return;

    const normalized = normalizeSoru(input);
    setIslemYukleniyor(true);
    setIslemHatasi("");
    try {
      const hastaYanit = onAsk
        ? await onAsk(normalized)
        : vaka.hastaYanitlari[normalized] || vaka.hastaYanitlari["OZEL"];
      const yeniMesajlar: ChatMesaj[] = [
        { id: `${Date.now()}-q`, rol: "ogrenci", metin: input, zaman: Date.now() },
        { id: `${Date.now()}-a`, rol: "hasta", metin: hastaYanit, zaman: Date.now() + 1 },
      ];
      setMesajlar((prev) => [...prev, ...yeniMesajlar]);
      if (normalized !== "OZEL" && !sorulanAksiyonlar.includes(normalized)) {
        setSorulanAksiyonlar((prev) => [...prev, normalized]);
      }
      setInput("");
    } catch {
      setIslemHatasi("Hasta yanıtı alınamadı. Bağlantınızı kontrol edip soruyu yeniden deneyin.");
    } finally {
      setIslemYukleniyor(false);
    }
  };

  const chipSor = async (chip: SoruChipi) => {
    if (islemYukleniyor) return;
    // Chip seçildiğinde direkt hasta yanıtını ver — NLP'e gitme
    const normalized = chip.aksiyon;
    setIslemYukleniyor(true);
    setIslemHatasi("");
    try {
      const hastaYanit = onAsk
        ? await onAsk(normalized)
        : vaka.hastaYanitlari[normalized] || vaka.hastaYanitlari["OZEL"];
      const yeniMesajlar: ChatMesaj[] = [
        { id: `${Date.now()}-q`, rol: "ogrenci", metin: chip.etiket, zaman: Date.now() },
        { id: `${Date.now()}-a`, rol: "hasta", metin: hastaYanit, zaman: Date.now() + 1 },
      ];
      setMesajlar((prev) => [...prev, ...yeniMesajlar]);
      if (!sorulanAksiyonlar.includes(normalized)) {
        setSorulanAksiyonlar((prev) => [...prev, normalized]);
      }
    } catch {
      setIslemHatasi("Hasta yanıtı alınamadı. Bağlantınızı kontrol edip soruyu yeniden deneyin.");
    } finally {
      setIslemYukleniyor(false);
    }
  };

  const testIstey = async (testKey: string) => {
    if (islemYukleniyor) return;
    setIslemYukleniyor(true);
    setIslemHatasi("");
    try {
      const statik = onTestRequest
        ? await onTestRequest(testKey)
        : vaka.statikTestler[testKey] || null;
      if (!statik) {
        setMesajlar((prev) => {
          const alreadyWarned = prev.some((m) => m.id.endsWith("-err") && m.metin.includes(testKey));
          if (alreadyWarned) return prev;
          return [
            ...prev,
            { id: `${Date.now()}-err`, rol: "sistem", metin: `⚠ "${testKey}" testi sistemde kayıtlı değil. "Tüm Test Kataloğu" listesinden seçim yapabilirsiniz.`, zaman: Date.now() },
          ];
        });
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
    setTestArama("");

    // Cemicegek modunda: test istendiğinde parent'a haber ver
    if (mod === "cemicegek" && !effectiveRaporHazir) {
      setTimeout(() => onTestIstendi?.(testKey), 500);
    }
    } catch {
      setIslemHatasi("Test sonucu alınamadı. Bağlantınızı kontrol edip testi yeniden deneyin.");
    } finally {
      setIslemYukleniyor(false);
    }
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

  const vakaTamamla = async () => {
    if (islemYukleniyor) return;
    setIslemYukleniyor(true);
    setIslemHatasi("");
    try {
    const istenenTestKeyleri = testIstekleri.map((t) => t.testKey);
    const attempt = { sorulanAksiyonlar, istenenTestler: istenenTestKeyleri, taniGirildi: taniInput, clinicalReasoning };
    const deg = onEvaluate ? await onEvaluate(attempt) : degerlendir(vaka, sorulanAksiyonlar, istenenTestKeyleri, taniInput);
    if (!deg) return;
    setSonuc(deg);
    onComplete?.(deg, attempt);
    } catch {
      setIslemHatasi("Değerlendirme alınamadı. Bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setIslemYukleniyor(false);
    }
  };

  // ── hasData + visibility filtreli test kataloğu ──
  const hasDataLocal = useMemo(() => {
    const s = new Set(Object.keys(vaka.statikTestler || {}));
    if (onTestRequest) {
      for (const k of Array.from(MOTOR_CAPABLE_KEYS)) s.add(k);
    }
    return s;
  }, [onTestRequest, vaka.statikTestler]);

  const visibleAllNonHidden = useMemo(
    () =>
      birlesikTestKatalogu.filter((t) => {
        const v = TEST_VISIBILITY_MAP[t.key];
        return !v || v.visibility !== "hidden";
      }),
    []
  );

  const visibleAllWithData = useMemo(
    () => visibleAllNonHidden.filter((t) => hasDataLocal.has(t.key)),
    [visibleAllNonHidden, hasDataLocal]
  );

  const displayTests = visibleAllWithData;

  const filtreliTestler = displayTests.filter(
    (t) =>
      testArama.trim() === "" ||
      t.ad.toLowerCase().includes(testArama.toLowerCase()) ||
      t.kategori.toLowerCase().includes(testArama.toLowerCase())
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
        ad: sonuc?.testAdi || rubrikEtiket || kat?.ad || humanizeKey(key),
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
        embed ? "h-full flex-1 overflow-hidden" : "h-[100dvh]"
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
          <Link href="/vakalar" aria-label="Vakalara dön" className="text-steel hover:text-ink transition-colors shrink-0">
            <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-sm lg:text-base font-semibold text-ink truncate">{vaka.alan} · {vaka.hasta.yas} yaş</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 rounded-lg bg-surface p-0.5">
          {(["anamnez","test","tani","tedavi"] as const).map((f) => (
            <button key={f} aria-pressed={faz === f} onClick={() => setFaz(f)} className={`px-2.5 lg:px-3 py-1 rounded-md text-[11px] lg:text-xs font-medium transition-colors ${faz === f ? "bg-ink text-white shadow-sm" : "text-steel hover:bg-surface-soft"}`}>
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
            <button key={f} aria-pressed={faz === f} onClick={() => setFaz(f)} className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${faz === f ? "bg-ink text-white shadow-sm" : "text-steel hover:bg-surface-soft"}`}>
              {f === "anamnez" ? "Anamnez" : f === "test" ? "Test" : f === "tani" ? "Tanı" : "Tedavi"}
            </button>
          ))}
        </div>
      </div>
      )}
      {/* Mobil faz sekmeleri (sm altı) */}
      <div className="flex sm:hidden shrink-0 border-b border-hairline bg-canvas px-1 overflow-x-auto scrollbar-none">
        {(["anamnez","test","tani","tedavi"] as const).map((f) => (
          <button key={f} aria-pressed={faz === f} onClick={() => setFaz(f)} className={`min-h-11 shrink-0 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${faz === f ? "border-ink text-ink" : "border-transparent text-steel"}`}>
            {f === "anamnez" ? "Anamnez" : f === "test" ? "Test" : f === "tani" ? "Tanı" : "Tedavi"}
          </button>
        ))}
      </div>

      {onboarding && !onboardingKapatildi && (
        <aside
          aria-labelledby="ilk-vaka-rehberi"
          className="shrink-0 border-b border-brand/25 bg-brand-soft/35 px-4 py-3 lg:px-6"
        >
          <div className="mx-auto flex max-w-6xl items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="ilk-vaka-rehberi" className="text-sm font-semibold text-ink">
                İlk vakan için kısa rehber
              </h2>
              <ol className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-steel">
                <li><span className="font-medium text-ink">1.</span> Anamnez sorusu sor</li>
                <li><span className="font-medium text-ink">2.</span> Gerekli tetkikleri iste</li>
                <li><span className="font-medium text-ink">3.</span> Ön tanını girip değerlendirmeyi al</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("tip-ai-ilk-vaka-rehberi-kapatildi", "1");
                setOnboardingKapatildi(true);
              }}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-steel hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label="İlk vaka rehberini kapat"
            >
              Kapat
            </button>
          </div>
        </aside>
      )}

      {islemHatasi && (
        <div className="shrink-0 border-b border-clinical-red/30 bg-clinical-red/5 px-4 py-2 lg:px-6" role="alert">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-ink">{islemHatasi}</p>
            <button type="button" onClick={() => setIslemHatasi("")} className="btn-ghost shrink-0 px-2 py-1 text-xs">
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* 3-Panel Layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <VakaHastaPanel
          vaka={vaka}
          mobilGorunur={mobilPanel === "hasta"}
          sorulanAksiyonSayisi={sorulanAksiyonlar.length}
          istenenTestSayisi={testIstekleri.length}
        />

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
                  className="flex min-h-11 items-center gap-1 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/30 transition-colors">
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
                className="min-h-11 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-steel hover:border-ink/30 hover:text-ink transition-colors">
                Tümü ▸
              </button>
            </div>
            {/* Aktif kategoriden 2 satır chip */}
            {faz === "anamnez" && (() => {
              const aktifKat = Array.from(acikKategoriler)[0];
              if (!aktifKat) return null;
              const all = (vaka.soruChipleri as SoruChipi[]).filter((c) => c.kategori === aktifKat);
              // Önce vakaya relevant sorular, sonra diğerleri — kesme yok
              const relevant = all.filter((c) => relevantAksiyonSeti.has(c.aksiyon));
              const rest = all.filter((c) => !relevantAksiyonSeti.has(c.aksiyon));
              const chips = [...relevant, ...rest];
              if (chips.length === 0) return null;
              return (
                <div className="mx-auto max-w-2xl flex flex-wrap gap-1 pt-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                  {chips.map((chip) => {
                    const soruldu = sorulanAksiyonSeti.has(chip.aksiyon);
                    const rel = relevantAksiyonSeti.has(chip.aksiyon);
                    return (
                      <button key={chip.aksiyon} onClick={() => chipSor(chip)} disabled={soruldu || islemYukleniyor}
                        className={`min-h-8 rounded-full border px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs font-medium transition-[background-color,border-color,color] ${
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
            <dialog
              ref={soruDrawerRef}
              onCancel={(event) => {
                event.preventDefault();
                setShowSoruDrawer(false);
              }}
              aria-label="Tüm sorular"
              className="fixed inset-0 z-50 m-0 flex h-[100dvh] w-full max-w-none justify-end border-0 bg-transparent p-0 backdrop:bg-black/20"
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label="Soru panelini kapat"
                onClick={() => setShowSoruDrawer(false)}
                className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
              />
              <div className="relative h-full w-full max-w-md overflow-y-auto border-l border-hairline bg-canvas shadow-xl">
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
                  <button ref={drawerKapatBtnRef} onClick={() => setShowSoruDrawer(false)} aria-label="Soru panelini kapat" className="min-h-11 min-w-11 rounded-full p-1 hover:bg-surface text-steel shrink-0">✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <label htmlFor="soru-arama" className="sr-only">Sorularda ara</label>
                  <input id="soru-arama" type="text" value={chipArama} onChange={(e) => setChipArama(e.target.value)}
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
                          {chips.map((chip) => {
                            const soruldu = sorulanAksiyonSeti.has(chip.aksiyon);
                            return (
                              <button key={chip.aksiyon} onClick={() => { chipSor(chip); if (!soruldu) setShowSoruDrawer(false); }} disabled={soruldu || islemYukleniyor}
                                className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-[background-color,border-color,color] ${
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
            </dialog>
          )}

          {/* Input — faz bazlı */}
          <div className="border-t border-hairline bg-canvas px-3 py-3 lg:px-8 lg:py-4">
            <div className="mx-auto max-w-2xl">
              {faz === "anamnez" ? (
                <div className="flex gap-2">
                  <label htmlFor="anamnez-sorusu" className="sr-only">Hastaya soru sor</label>
                  <input id="anamnez-sorusu" type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && soruSor()}
                    placeholder="Hastaya soru sor…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none" />
                  <button onClick={soruSor} disabled={islemYukleniyor} className="btn-primary h-11 lg:h-10 px-5 shrink-0 text-sm">{islemYukleniyor ? "Gönderiliyor…" : "Sor"}</button>
                </div>
              ) : faz === "tani" ? (
                <div className="flex gap-2">
                  <label htmlFor="on-tani-ana" className="sr-only">Ön tanı</label>
                  <input id="on-tani-ana" type="text" value={taniInput} onChange={(e) => setTaniInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tamamlama()}
                    placeholder="Ön tanınızı girin (örn: Akut Koroner Sendrom)…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none" />
                  <button onClick={tamamlama} className="btn-primary h-11 lg:h-10 px-5 shrink-0 text-sm">Tanı →</button>
                </div>
              ) : faz === "tedavi" ? (
                <div className="flex gap-2">
                  <label htmlFor="tedavi-plani-ana" className="sr-only">Tedavi planı</label>
                  <textarea id="tedavi-plani-ana" value={tedaviInput} onChange={(e) => setTedaviInput(e.target.value)}
                    placeholder="Tedavi planınızı yazın (ilaçlar, dozlar, prosedürler)…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none resize-none" rows={1} />
                  <button onClick={vakaTamamla} disabled={islemYukleniyor} className="btn-accent h-11 lg:h-10 px-5 shrink-0 text-sm">{islemYukleniyor ? "Puanlanıyor…" : "Puanla ✓"}</button>
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
        <div className={`${mobilPanel !== "testler" ? "hidden" : "flex"} w-full xl:flex xl:w-80 flex-shrink-0 border-l border-hairline bg-surface-soft overflow-y-auto scrollbar-thin flex-col`}>
          <div className="p-4 xl:p-6">
            {/* Test İsteme */}
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Test İste
              </h3>

              {/* Test arama + inline filtreli liste */}
              <div className="mb-3 flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="4.5"/>
                    <line x1="10.5" y1="10.5" x2="14" y2="14"/>
                  </svg>
                  <label htmlFor="test-arama" className="sr-only">Test ara</label>
                  <input
                    id="test-arama"
                    type="text"
                    value={testArama}
                    onChange={(e) => setTestArama(e.target.value)}
                    placeholder="Test ara…"
                    className="h-9 w-full rounded-md border border-hairline bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  />
                </div>
                {testArama.trim() && (
                  <button
                    onClick={() => setTestArama("")}
                    className="btn-ghost px-2 text-xs text-muted hover:text-ink"
                    title="Temizle"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Kategori bazında tüm testler — canlı filtreli */}
              <div className="-mx-2 min-h-0 flex-1 rounded-lg border border-hairline bg-canvas xl:max-h-[calc(100dvh-28rem)] xl:overflow-y-auto xl:scrollbar-thin">
                {filtreliTestler.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted">
                    {testArama.trim()
                      ? `"${testArama}" ile eşleşen test bulunamadı.`
                      : "Hiç test yok."}
                  </div>
                ) : (
                  Object.entries(testlerKategoriyeGore).map(([kategori, testler]) => (
                    <div key={kategori}>
                      <div className="sticky top-0 z-10 bg-surface-soft px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-hairline-soft">
                        {kategori}
                      </div>
                      {testler.map((test) => {
                        const istendi = testIstekleri.some((t) => t.testKey === test.key);
                        const hasSonuc = !!vaka.statikTestler?.[test.key];
                        const tier = TEST_VISIBILITY_MAP[test.key]?.tier;
                        const beklenti = test.kategori === "Beklenti";
                        return (
                          <button
                            key={test.key}
                            onClick={() => testIstey(test.key)}
                            disabled={istendi || islemYukleniyor}
                            className={`flex min-h-11 w-full items-center justify-between border-b border-hairline-soft px-4 py-2 text-left text-sm last:border-0 transition-colors ${
                              istendi
                                ? "opacity-40 cursor-not-allowed bg-surface-soft"
                                : "hover:bg-surface text-ink"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-medium flex items-center gap-1.5">
                                {test.ad}
                                {tier === "core" && (
                                  <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                                    çekirdek
                                  </span>
                                )}
                                {tier === "branch" && (
                                  <span className="rounded-full bg-clinical-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-clinical-blue">
                                    branş
                                  </span>
                                )}
                              </div>
                              {beklenti && (
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
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
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {istendi && (
                                <span className="text-[10px] text-brand-deep font-medium">✓</span>
                              )}
                              {!istendi && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand-deep hover:bg-brand/20 transition-colors">
                                  +
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted text-right">
                {visibleAllWithData.length} test
              </p>
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
                {(faz === "tani" || faz === "tedavi") && (
                  <ClinicalReasoningFields
                    problemRepresentation={problemRepresentation}
                    differentialsText={differentialsText}
                    supportingFindingsText={supportingFindingsText}
                    opposingFindingsText={opposingFindingsText}
                    confidence={confidence}
                    savedState={reasoningSaveState}
                    onProblemRepresentationChange={(value) => { setProblemRepresentation(value); setReasoningDirty(true); }}
                    onDifferentialsChange={(value) => { setDifferentialsText(value); setReasoningDirty(true); }}
                    onSupportingFindingsChange={(value) => { setSupportingFindingsText(value); setReasoningDirty(true); }}
                    onOpposingFindingsChange={(value) => { setOpposingFindingsText(value); setReasoningDirty(true); }}
                    onConfidenceChange={(value) => { setConfidence(value); setReasoningDirty(true); }}
                  />
                )}
                {faz === "tani" ? (
                  <>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      Ön Tanı
                    </h3>
                    <label htmlFor="on-tani-sag" className="sr-only">Ön tanı</label>
                    <input
                      id="on-tani-sag"
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
                    <label htmlFor="tedavi-plani-sag" className="sr-only">Tedavi planı</label>
                    <textarea
                      id="tedavi-plani-sag"
                      value={tedaviInput}
                      onChange={(e) => setTedaviInput(e.target.value)}
                      placeholder="Tedavi planınızı yazın (ilaçlar, dozlar, prosedürler)..."
                      className="input mb-3 h-28 text-sm resize-none"
                      rows={5}
                    />
                    <button onClick={vakaTamamla} disabled={islemYukleniyor} className="btn-accent w-full justify-center">
                      {islemYukleniyor ? "Puanlanıyor…" : "Vakayı Tamamla ve Puanla"}
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
        <button aria-pressed={mobilPanel === "hasta"} onClick={() => setMobilPanel("hasta")} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${mobilPanel === "hasta" ? "text-brand" : "text-steel"}`}>
          <span className="text-base">👤</span>
          <span className="text-[10px] font-medium">Hasta</span>
        </button>
        <button aria-pressed={mobilPanel === "sohbet"} onClick={() => setMobilPanel("sohbet")} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${mobilPanel === "sohbet" ? "text-brand" : "text-steel"}`}>
          <span className="text-base">💬</span>
          <span className="text-[10px] font-medium">Sohbet</span>
        </button>
        <button aria-pressed={mobilPanel === "testler"} onClick={() => setMobilPanel("testler")} className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${mobilPanel === "testler" ? "text-brand" : "text-steel"}`}>
          <span className="text-base">🧪</span>
          <span className="text-[10px] font-medium">Testler</span>
        </button>
      </div>
    </div>
  );
}

function ClinicalReasoningFields({
  problemRepresentation,
  differentialsText,
  supportingFindingsText,
  opposingFindingsText,
  confidence,
  savedState,
  onProblemRepresentationChange,
  onDifferentialsChange,
  onSupportingFindingsChange,
  onOpposingFindingsChange,
  onConfidenceChange,
}: {
  problemRepresentation: string;
  differentialsText: string;
  supportingFindingsText: string;
  opposingFindingsText: string;
  confidence: number | null;
  savedState: "idle" | "saving" | "saved" | "error";
  onProblemRepresentationChange: (value: string) => void;
  onDifferentialsChange: (value: string) => void;
  onSupportingFindingsChange: (value: string) => void;
  onOpposingFindingsChange: (value: string) => void;
  onConfidenceChange: (value: number | null) => void;
}) {
  const savedLabel = savedState === "saving"
    ? "Taslak kaydediliyor…"
    : savedState === "saved"
      ? "Taslak kaydedildi"
      : savedState === "error"
        ? "Taslak kaydedilemedi; vaka tamamlanırken yeniden gönderilecek."
        : "";

  return (
    <fieldset className="mb-6 rounded-lg border border-hairline bg-canvas p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Klinik muhakeme</legend>
      <p className="mb-3 text-xs leading-5 text-steel">Düşünme sürecini kaydet. Her listeye satır başına bir madde yaz; en fazla 5 madde eklenir.</p>
      <div className="space-y-3">
        <div>
          <label htmlFor="problem-temsili" className="mb-1 block text-xs font-medium text-ink">Problem temsili</label>
          <textarea id="problem-temsili" value={problemRepresentation} maxLength={600} onChange={(event) => onProblemRepresentationChange(event.target.value)} className="input h-20 resize-none text-sm" placeholder="Yaş, bağlam, temel sorun ve ayırt edici bulguları özetle." rows={3} />
        </div>
        <div>
          <label htmlFor="ayirici-tanilar" className="mb-1 block text-xs font-medium text-ink">Ayırıcı tanılar</label>
          <textarea id="ayirici-tanilar" value={differentialsText} maxLength={604} onChange={(event) => onDifferentialsChange(event.target.value)} className="input h-20 resize-none text-sm" placeholder={"Akut koroner sendrom\nPulmoner emboli"} rows={3} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="destekleyen-bulgular" className="mb-1 block text-xs font-medium text-ink">Destekleyen bulgular</label>
            <textarea id="destekleyen-bulgular" value={supportingFindingsText} maxLength={904} onChange={(event) => onSupportingFindingsChange(event.target.value)} className="input h-20 resize-none text-sm" placeholder="Her satıra bir bulgu" rows={3} />
          </div>
          <div>
            <label htmlFor="karsi-bulgular" className="mb-1 block text-xs font-medium text-ink">Karşı çıkan bulgular</label>
            <textarea id="karsi-bulgular" value={opposingFindingsText} maxLength={904} onChange={(event) => onOpposingFindingsChange(event.target.value)} className="input h-20 resize-none text-sm" placeholder="Her satıra bir bulgu" rows={3} />
          </div>
        </div>
        <div>
          <label htmlFor="tani-guveni" className="mb-1 block text-xs font-medium text-ink">Tanına güvenin</label>
          <select id="tani-guveni" value={confidence ?? ""} onChange={(event) => onConfidenceChange(event.target.value === "" ? null : Number(event.target.value))} className="input text-sm">
            <option value="">Belirtmek istemiyorum</option>
            {[20, 40, 60, 80, 100].map((value) => <option key={value} value={value}>%{value}</option>)}
          </select>
        </div>
      </div>
      <p aria-live="polite" className={`mt-3 text-xs ${savedState === "error" ? "text-clinical-red" : "text-steel"}`}>{savedLabel}</p>
    </fieldset>
  );
}

function MesajBalonu({ msg, vaka, hastaneAdi }: { msg: ChatMesaj; vaka: Vaka; hastaneAdi: string }) {
  if (msg.rol === "sistem") {
    const isWarning = msg.metin.startsWith("⚠️");
    const isComplete = msg.metin.startsWith("✅");
    return (
      <div className="flex flex-col items-center">
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
          <div className="mt-2 w-full max-w-[85%]">
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
