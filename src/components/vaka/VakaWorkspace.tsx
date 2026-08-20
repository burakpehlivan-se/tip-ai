"use client";

import { useState, useRef, useEffect, useMemo, type MouseEvent } from "react";
import {
  Vaka,
  ChatMesaj,
  TestIstegi,
  DegerlendirmeSonuc,
  SoruChipi,
  ChipKategorisi,
  TestSonucu,
  RubrikAksiyon,
  Hasta,
} from "@/lib/types";
import { normalizeSoru } from "@/lib/nlp/normalize";
import { degerlendir } from "@/lib/scoring/degerlendir";
import { birlesikTestKatalogu, TEST_VISIBILITY_MAP } from "@/lib/data/test-catalogue";
import { CHIP_KATEGORI_ETIKETLERI } from "@/lib/data/chip-labels";
import SonucEkrani from "./SonucEkrani";
import { DebugTestKarti, TestSonucKarti } from "./TestResultCards";
import VakaHastaPanel from "./VakaHastaPanel";
import Link from "next/link";
import {
  type ClinicalReasoningInput,
} from "@/lib/student/clinical-reasoning";
import { clinicalHistoryChatSummary, type ClinicalHistory } from "@/lib/clinical-history/types";
import { aiEslestir, defaultMesajlar, mesajlaraSonucEkle, toReasoningList } from "./workspace-helpers";
import {
  buildDebugTestEnvanteri,
  hasDataKeys,
  visibleAllWithData as getVisibleAllWithData,
} from "./workspace-catalog";
import { FAZLAR, type WorkspaceFaz } from "./workspace-constants";
import {
  ClinicalReasoningFields,
  FazGorevYuzeyi,
  FazStepper,
  KlinikGecmisDialog,
  MesajBalonu,
  TaslakDurumu,
} from "./VakaWorkspace.parts";

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
  tedaviGirildi: string;
}

/** Admin debug modunda yan panele yazılan vaka konuşma/kapsam görüntüsü. */
export interface DebugJson {
  hasta: Hasta;
  sorulanSorular: Array<{ soru: string; aksiyon: string; cevap: string }>;
  sorulmasiGerekenSorular: Array<RubrikAksiyon & { cevap: string }>;
  tumSorular: Array<SoruChipi & { cevap: string }>;
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
  /** Tanı veya tedavi taslağı varken vaka değiştirmeden önce kullanıcıyı uyarır. */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Admin debug: konuşma/hasta/beklenen/tüm sorular JSON'ını parent'a bildirir. */
  onDebugSnapshot?: (snapshot: DebugJson) => void;
  /** Kullanıcı isterse, sahip olduğu vaka oturumunun kimliksiz klinik geçmişini getirir. */
  onClinicalHistoryRequest?: () => Promise<ClinicalHistory>;
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
  onDirtyChange,
  onDebugSnapshot,
  onClinicalHistoryRequest,
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
  const [seciliTestKeyleri, setSeciliTestKeyleri] = useState<string[]>([]);
  const [chipArama, setChipArama] = useState("");
  const [acikKategoriler, setAcikKategoriler] = useState<Set<ChipKategorisi>>(new Set<ChipKategorisi>(["anamnez-agri"]));
  const [showSoruDrawer, setShowSoruDrawer] = useState(false);
  const soruDrawerRef = useRef<HTMLDialogElement>(null);
  const drawerKapatBtnRef = useRef<HTMLButtonElement>(null);
  const drawerTetikleyiciRef = useRef<HTMLButtonElement>(null);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const completionConfirmRef = useRef<HTMLDialogElement>(null);
  const completionCancelRef = useRef<HTMLButtonElement>(null);
  const completionTetikleyiciRef = useRef<HTMLButtonElement>(null);
  const [showClinicalHistory, setShowClinicalHistory] = useState(false);
  const [clinicalHistory, setClinicalHistory] = useState<ClinicalHistory | null>(null);
  const [clinicalHistoryLoading, setClinicalHistoryLoading] = useState(false);
  const clinicalHistoryDialogRef = useRef<HTMLDialogElement>(null);
  const [showKatDropdown, setShowKatDropdown] = useState(false);
  const [mobilPanel, setMobilPanel] = useState<"hasta" | "sohbet" | "testler">("sohbet");
  const [debugDetayAcik, setDebugDetayAcik] = useState(false);
  const [debugTumSonuclarAcik, setDebugTumSonuclarAcik] = useState(false);
  const [debugTestFiltre, setDebugTestFiltre] = useState<"hepsi" | "var" | "yok">("hepsi");
  const [onboardingKapatildi, setOnboardingKapatildi] = useState(false);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);
  const [islemHatasi, setIslemHatasi] = useState("");
  const [taslakHazir, setTaslakHazir] = useState(false);
  const [taslakDurumu, setTaslakDurumu] = useState<"kaydediliyor" | "yerel">("yerel");
  const [taniHatasi, setTaniHatasi] = useState("");
  const [tedaviHatasi, setTedaviHatasi] = useState("");
  const [fazUyarisi, setFazUyarisi] = useState("");
  const [taniKaydedildi, setTaniKaydedildi] = useState(initialSnapshot?.faz === "tedavi");

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

  const debugJson = useMemo<DebugJson>(() => {
    const chipList = vaka.soruChipleri as SoruChipi[];
    const sorulanSorular: DebugJson["sorulanSorular"] = [];
    for (let i = 0; i < mesajlar.length; i++) {
      const m = mesajlar[i];
      if (m.rol !== "ogrenci") continue;
      const cevap = mesajlar[i + 1]?.rol === "hasta" ? mesajlar[i + 1].metin : "";
      const chip = chipList.find((c) => c.etiket === m.metin);
      const aksiyon = chip?.aksiyon ?? normalizeSoru(m.metin);
      sorulanSorular.push({ soru: m.metin, aksiyon, cevap });
    }
    return {
      hasta: vaka.hasta,
      sorulanSorular,
      sorulmasiGerekenSorular: vaka.rubric.beklenenSorular.map((s) => ({
        ...s,
        cevap: vaka.hastaYanitlari[s.key] ?? "",
      })),
      tumSorular: chipList.map((c) => ({
        ...c,
        cevap: vaka.hastaYanitlari[c.aksiyon] ?? "",
      })),
    };
  }, [vaka, mesajlar]);

  useEffect(() => {
    onDebugSnapshot?.(debugJson);
  }, [debugJson, onDebugSnapshot]);

  const maxAcikFazIndex = taniKaydedildi ? 3 : testIstekleri.length > 0 ? 2 : 1;
  const fazDegistir = (sonrakiFaz: WorkspaceFaz) => {
    const sonrakiIndex = FAZLAR.findIndex((item) => item.id === sonrakiFaz);
    if (sonrakiIndex > maxAcikFazIndex) {
      const gereken = sonrakiFaz === "tani" ? "Tanı aşamasını açmak için önce en az bir tetkik isteyin." : "Tedavi aşamasını açmak için önce ön tanınızı kaydedin.";
      setFazUyarisi(gereken);
      return;
    }
    setFazUyarisi("");
    setFaz(sonrakiFaz);
  };

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
    setMobilPanel("sohbet");
  }, [faz]);

  // Tanı ve tedavi taslağı ağ bağlantısından bağımsız olarak bu cihazda korunur.
  useEffect(() => {
    try {
      const kayit = window.localStorage.getItem(`tip-ai-vaka-taslagi:${vaka.id}`);
      if (kayit) {
        const taslak = JSON.parse(kayit) as { taniInput?: string; tedaviInput?: string };
        setTaniInput((mevcut) => mevcut || taslak.taniInput || "");
        setTedaviInput((mevcut) => mevcut || taslak.tedaviInput || "");
      }
    } catch {
      // Yerel depolama kullanılamazsa vaka akışı kesilmez.
    } finally {
      setTaslakHazir(true);
    }
  }, [vaka.id]);

  useEffect(() => {
    if (!taslakHazir) return;
    setTaslakDurumu("kaydediliyor");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `tip-ai-vaka-taslagi:${vaka.id}`,
          JSON.stringify({ taniInput, tedaviInput })
        );
        setTaslakDurumu("yerel");
      } catch {
        setIslemHatasi("Taslak bu cihazda kaydedilemedi. Yanıtınızı kopyalayarak güvene alın.");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [taniInput, tedaviInput, taslakHazir, vaka.id]);

  useEffect(() => {
    onDirtyChange?.(Boolean(taniInput.trim() || tedaviInput.trim()));
  }, [onDirtyChange, taniInput, tedaviInput]);

  // Native dialog klavye odağını sınırlar ve ESC ile iptal olayını sağlar.
  useEffect(() => {
    const drawer = soruDrawerRef.current;
    if (!showSoruDrawer || !drawer) return;
    drawer.showModal();
    drawerKapatBtnRef.current?.focus();
    return () => drawer.close();
  }, [showSoruDrawer]);

  useEffect(() => {
    const dialog = completionConfirmRef.current;
    if (!showCompletionConfirm || !dialog) return;
    dialog.showModal();
    completionCancelRef.current?.focus();
    return () => dialog.close();
  }, [showCompletionConfirm]);

  useEffect(() => {
    const dialog = clinicalHistoryDialogRef.current;
    if (!showClinicalHistory || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [showClinicalHistory]);

  useEffect(() => {
    if (onboarding) {
      setOnboardingKapatildi(window.localStorage.getItem("tip-ai-ilk-vaka-rehberi-kapatildi") === "1");
    }
  }, [onboarding]);

  const soruSor = async () => {
    if (!input.trim() || islemYukleniyor) return;

    const normalized = normalizeSoru(input);
    let aksiyon = normalized;
    if (normalized === "OZEL") {
      const eslesen = await aiEslestir(input);
      if (eslesen) aksiyon = eslesen;
    }

    setIslemYukleniyor(true);
    setIslemHatasi("");
    try {
      const hastaYanit = onAsk
        ? await onAsk(aksiyon)
        : vaka.hastaYanitlari[aksiyon] || vaka.hastaYanitlari["OZEL"];
      const yeniMesajlar: ChatMesaj[] = [
        { id: `${Date.now()}-q`, rol: "ogrenci", metin: input, zaman: Date.now() },
        { id: `${Date.now()}-a`, rol: "hasta", metin: hastaYanit, zaman: Date.now() + 1 },
      ];
      setMesajlar((prev) => [...prev, ...yeniMesajlar]);
      if (aksiyon !== "OZEL" && !sorulanAksiyonlar.includes(aksiyon)) {
        setSorulanAksiyonlar((prev) => [...prev, aksiyon]);
      }
      setInput("");
    } catch {
      setIslemHatasi("Hasta yanıtı alınamadı. Bağlantınızı kontrol edip soruyu yeniden deneyin.");
    } finally {
      setIslemYukleniyor(false);
    }
  };

  const klinikGecmisiIste = async () => {
    if (!onClinicalHistoryRequest || clinicalHistoryLoading) return;
    setClinicalHistoryLoading(true);
    setIslemHatasi("");
    try {
      const history = await onClinicalHistoryRequest();
      setClinicalHistory(history);
      setShowClinicalHistory(true);
      setMesajlar((prev) => [
        ...prev,
        { id: `${Date.now()}-history`, rol: "sistem", metin: clinicalHistoryChatSummary(history), zaman: Date.now() },
      ]);
    } catch (error) {
      setIslemHatasi(error instanceof Error ? error.message : "Klinik geçmiş alınamadı. Lütfen tekrar deneyin.");
    } finally {
      setClinicalHistoryLoading(false);
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
    setSeciliTestKeyleri((prev) => prev.filter((key) => key !== testKey));
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

  const testSeciminiDegistir = (testKey: string) => {
    if (testIstekleri.some((t) => t.testKey === testKey)) return;
    setSeciliTestKeyleri((prev) =>
      prev.includes(testKey) ? prev.filter((key) => key !== testKey) : [...prev, testKey]
    );
  };

  const seciliTestleriIste = async () => {
    if (seciliTestKeyleri.length === 0 || islemYukleniyor) return;
    for (const testKey of seciliTestKeyleri) {
      await testIstey(testKey);
    }
  };

  const tamamlama = () => {
    if (!taniInput.trim()) {
      setTaniHatasi("Tedavi aşamasına geçmeden önce ön tanınızı girin.");
      return;
    }
    setTaniHatasi("");
    setTaniKaydedildi(true);
    setFaz("tedavi");
    setMesajlar((prev) => [
      ...prev,
      { id: `${Date.now()}-sys`, rol: "sistem", metin: "🩺 Tanı alındı. Şimdi tedavi planınızı yazın.", zaman: Date.now() },
    ]);
  };

  const soruDrawerAc = (event: MouseEvent<HTMLButtonElement>) => {
    drawerTetikleyiciRef.current = event.currentTarget;
    setShowSoruDrawer(true);
  };

  const soruDrawerKapat = () => {
    setShowSoruDrawer(false);
    window.requestAnimationFrame(() => drawerTetikleyiciRef.current?.focus());
  };

  const vakaTamamlamayiIste = (event: MouseEvent<HTMLButtonElement>) => {
    if (!taniInput.trim()) {
      setTaniHatasi("Tedavi aşamasına geçmeden önce ön tanınızı girin.");
      setFaz("tani");
      return;
    }
    if (!tedaviInput.trim()) {
      setTedaviHatasi("Tedaviyi değerlendirmek için en az bir tedavi, girişim veya izlem kararı ekleyin.");
      return;
    }
    completionTetikleyiciRef.current = event.currentTarget;
    setTaniHatasi("");
    setTedaviHatasi("");
    setShowCompletionConfirm(true);
  };

  const vakaTamamlamaTeyidiniKapat = () => {
    setShowCompletionConfirm(false);
    window.requestAnimationFrame(() => completionTetikleyiciRef.current?.focus());
  };

  const vakaTamamla = async (): Promise<boolean> => {
    if (islemYukleniyor) return false;
    if (!taniInput.trim() || !tedaviInput.trim()) return false;
    setIslemYukleniyor(true);
    setIslemHatasi("");
    try {
    const istenenTestKeyleri = testIstekleri.map((t) => t.testKey);
    const attempt = { sorulanAksiyonlar, istenenTestler: istenenTestKeyleri, taniGirildi: taniInput, clinicalReasoning, tedaviGirildi: tedaviInput };
    const deg = onEvaluate ? await onEvaluate(attempt) : degerlendir(vaka, sorulanAksiyonlar, istenenTestKeyleri, taniInput);
    if (!deg) return false;
    setSonuc(deg);
    onComplete?.(deg, attempt);
    return true;
    } catch {
      setIslemHatasi("Değerlendirme alınamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      return false;
    } finally {
      setIslemYukleniyor(false);
    }
  };

  const vakaTamamlamayiOnayla = async () => {
    setShowCompletionConfirm(false);
    const basarili = await vakaTamamla();
    if (!basarili) {
      window.requestAnimationFrame(() => completionTetikleyiciRef.current?.focus());
    }
  };

  // ── hasData + visibility filtreli test kataloğu ── (pure helpers: workspace-catalog.ts)
  const hasDataLocal = useMemo(() => hasDataKeys(vaka, onTestRequest), [vaka, onTestRequest]);
  const displayTests = useMemo(() => getVisibleAllWithData(hasDataLocal), [hasDataLocal]);

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
  const debugTestEnvanteri = useMemo(() => buildDebugTestEnvanteri(vaka), [vaka]);

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
      <header className="flex min-h-14 items-center gap-3 border-b border-hairline bg-canvas px-3 lg:px-5">
        <div className="flex min-w-0 items-center gap-1.5 lg:gap-2">
          <Link href="/vakalar" aria-label="Vakalara dön" className="min-h-11 min-w-11 text-steel hover:text-ink transition-colors shrink-0 inline-flex items-center justify-center">
            <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-sm font-semibold text-ink truncate">Vaka · {vaka.alan}</span>
        </div>
        <FazStepper faz={faz} onChange={fazDegistir} maxAcikFazIndex={maxAcikFazIndex} className="ml-auto hidden md:flex" />
      </header>
      )}
      {/* Cemicegek / admin embed: faz sekmeleri yine görünsün */}
      {embed && (
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-canvas px-3">
        <span className="text-xs text-steel truncate">
          {vaka.hasta.tamAd || vaka.hasta.ad} · {vaka.hasta.yas} yaş · {vaka.alan}
        </span>
        <FazStepper faz={faz} onChange={fazDegistir} maxAcikFazIndex={maxAcikFazIndex} className="hidden md:flex" />
      </header>
      )}
      {/* Mobil faz sekmeleri (sm altı) */}
      <FazStepper faz={faz} onChange={fazDegistir} maxAcikFazIndex={maxAcikFazIndex} className="md:hidden" compact />

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

      <aside id="simule-vaka-uyarisi" className="shrink-0 border-b border-clinical-orange/20 bg-clinical-orange/5 px-4 py-2 text-xs leading-5 text-steel lg:px-6" aria-label="Veri kullanımı uyarısı">
        <span className="mr-1 font-medium text-ink">Simülasyon uyarısı:</span>
        Bu alana gerçek hasta bilgisi veya kişisel sağlık verisi girmeyin; yalnızca bu sentetik vaka üzerinden çalışın.
      </aside>

      {fazUyarisi && (
        <div className="shrink-0 border-b border-clinical-orange/30 bg-clinical-orange/5 px-4 py-2 lg:px-6" role="status" aria-live="polite">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-ink">{fazUyarisi}</p>
            <button type="button" onClick={() => setFazUyarisi("")} className="btn-ghost shrink-0 px-2 py-1 text-xs">Kapat</button>
          </div>
        </div>
      )}

      {showClinicalHistory && clinicalHistory && (
        <KlinikGecmisDialog
          dialogRef={clinicalHistoryDialogRef}
          history={clinicalHistory}
          onClose={() => setShowClinicalHistory(false)}
        />
      )}

      {/* 3-Panel Layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <VakaHastaPanel
          vaka={vaka}
          mobilGorunur={mobilPanel === "hasta"}
          sorulanAksiyonSayisi={sorulanAksiyonlar.length}
          istenenTestSayisi={testIstekleri.length}
          onClinicalHistoryRequest={onClinicalHistoryRequest ? klinikGecmisiIste : undefined}
          clinicalHistoryLoading={clinicalHistoryLoading}
        />

        {/* Orta Panel — aktif klinik görev */}
        <main id="vaka-gorevi" className={`${mobilPanel !== "sohbet" ? "hidden" : "flex"} lg:flex min-w-0 flex-col flex-1 overflow-hidden`}>
          <section className="shrink-0 border-b border-hairline-soft bg-canvas px-4 py-4 lg:px-8">
            <div className="mx-auto flex max-w-4xl items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-brand-deep">Adım {FAZLAR.find((item) => item.id === faz)?.sira} / {FAZLAR.length}</p>
                <h1 className="mt-1 text-heading-5 text-ink">{FAZLAR.find((item) => item.id === faz)?.etiket}</h1>
                <p className="mt-1 text-sm text-steel">{FAZLAR.find((item) => item.id === faz)?.aciklama}</p>
              </div>
              <TaslakDurumu durum={taslakDurumu} />
            </div>
          </section>
          {faz === "anamnez" ? <>
          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 lg:px-8">
            <div className="mx-auto max-w-2xl space-y-4" role="log" aria-label="Vaka sohbeti" aria-live="polite" aria-relevant="additions text">
              {mesajlar.map((msg) => (
                <MesajBalonu key={msg.id} msg={msg} vaka={vaka} hastaneAdi={hastaneAdi} debugMode={debugMode} />
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
                <button
                  type="button"
                  onClick={() => setShowKatDropdown(!showKatDropdown)}
                  aria-expanded={showKatDropdown}
                  aria-controls="soru-kategori-listesi"
                  className="flex min-h-11 items-center gap-1 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/30 transition-colors">
                  {CHIP_KATEGORI_ETIKETLERI[Array.from(acikKategoriler)[0] || "anamnez-agri"]} ▾
                </button>
                {showKatDropdown && (
                  <div id="soru-kategori-listesi" className="absolute bottom-full left-0 mb-1 z-30 w-48 rounded-lg border border-hairline bg-canvas shadow-lg overflow-hidden">
                    {(["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => (
                      <button key={kat} onClick={() => { setAcikKategoriler(new Set([kat])); setShowKatDropdown(false); }}
                        className={`flex w-full items-center px-3 py-2 text-left text-xs hover:bg-surface transition-colors ${acikKategoriler.has(kat) ? "bg-surface font-semibold text-ink" : "text-steel"}`}>
                        {CHIP_KATEGORI_ETIKETLERI[kat]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={soruDrawerAc}
                className="min-h-11 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-steel hover:border-ink/30 hover:text-ink transition-colors">
                Tümü ▸
              </button>
            </div>
            {/* Aktif kategoriden 2 satır chip */}
            {faz === "anamnez" && (() => {
              const aktifKat = Array.from(acikKategoriler)[0];
              if (!aktifKat) return null;
              const all = (vaka.soruChipleri as SoruChipi[]).filter((c) => c.kategori === aktifKat);
              // Debug kapalıyken "ilgili soru" sıralaması ve vurgusu kapalı (kör oynama);
              // debug açıkken beklenen sorular öne alınır ve yeşil vurgulanır.
              const relevant = all.filter((c) => relevantAksiyonSeti.has(c.aksiyon));
              const rest = all.filter((c) => !relevantAksiyonSeti.has(c.aksiyon));
              const chips = debugMode ? [...relevant, ...rest] : all;
              if (chips.length === 0) return null;
              return (
                <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto pt-1.5 scrollbar-thin" aria-label="Önerilen anamnez soruları">
                  {chips.map((chip) => {
                    const soruldu = sorulanAksiyonSeti.has(chip.aksiyon);
                    const rel = debugMode && relevantAksiyonSeti.has(chip.aksiyon);
                    return (
                          <button key={chip.aksiyon} onClick={() => chipSor(chip)} disabled={soruldu || islemYukleniyor}
                        className={`min-h-8 shrink-0 rounded-full border px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs font-medium transition-[background-color,border-color,color] ${
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
                soruDrawerKapat();
              }}
              aria-labelledby="tum-sorular-baslik"
              className="fixed inset-0 z-50 m-0 flex h-[100dvh] w-full max-w-none justify-end border-0 bg-transparent p-0 backdrop:bg-black/20"
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label="Soru panelini kapat"
                onClick={soruDrawerKapat}
                className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
              />
              <div className="relative h-full w-full max-w-md overflow-y-auto border-l border-hairline bg-canvas shadow-xl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-canvas px-4 py-3">
                  <h2 id="tum-sorular-baslik" className="sr-only">Tüm anamnez soruları</h2>
                  {/* Kategori seçici */}
                  <div className="flex flex-wrap gap-1">
                    {(["anamnez-agri","anamnez-sistemik","anamnez-oyku","soygecmis","vital","fizik","red-flag"] as ChipKategorisi[]).map((kat) => (
                      <button key={kat} onClick={() => { toggleKategori(kat); }}
                        className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${acikKategoriler.has(kat) ? "border-ink/30 bg-ink text-white" : "border-hairline bg-canvas text-steel"}`}>
                        {CHIP_KATEGORI_ETIKETLERI[kat]}
                      </button>
                    ))}
                  </div>
                  <button ref={drawerKapatBtnRef} onClick={soruDrawerKapat} aria-label="Soru panelini kapat" className="min-h-11 min-w-11 rounded-full p-1 hover:bg-surface text-steel shrink-0">✕</button>
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
                              <button key={chip.aksiyon} onClick={() => { chipSor(chip); if (!soruldu) soruDrawerKapat(); }} disabled={soruldu || islemYukleniyor}
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

          </> : (
            <FazGorevYuzeyi
              faz={faz}
              taniInput={taniInput}
              tedaviInput={tedaviInput}
              seciliTestKeyleri={seciliTestKeyleri}
              testIstekleri={testIstekleri}
              testKatalogu={displayTests}
              onFazChange={fazDegistir}
            />
          )}

          {/* Input — faz bazlı */}
          <div className="border-t border-hairline bg-canvas px-3 py-3 lg:px-8 lg:py-4">
            <div className="mx-auto max-w-2xl">
              {faz === "anamnez" ? (
                <div className="flex gap-2">
                  <label htmlFor="anamnez-sorusu" className="sr-only">Hastaya soru sor</label>
                  <input id="anamnez-sorusu" type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && soruSor()} aria-describedby="simule-vaka-uyarisi"
                    placeholder="Hastaya soru sor…"
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none" />
                  <button onClick={soruSor} disabled={islemYukleniyor} className="btn-primary h-11 lg:h-10 px-5 shrink-0 text-sm">{islemYukleniyor ? "Gönderiliyor…" : "Sor"}</button>
                </div>
              ) : faz === "tani" ? (
                <div>
                  <div className="flex gap-2">
                  <label htmlFor="on-tani-ana" className="sr-only">Ön tanı</label>
                  <input id="on-tani-ana" type="text" value={taniInput} onChange={(e) => { setTaniInput(e.target.value); setTaniKaydedildi(false); }} onKeyDown={(e) => e.key === "Enter" && tamamlama()}
                    placeholder="Ön tanınızı girin (örn: Akut Koroner Sendrom)…"
                    aria-invalid={Boolean(taniHatasi)} aria-describedby={taniHatasi ? "tani-hatasi" : undefined}
                    className="flex-1 h-11 lg:h-10 rounded-xl border border-hairline bg-surface px-4 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none" />
                  <button onClick={tamamlama} className="btn-primary h-11 lg:h-10 px-5 shrink-0 text-sm">Tanıyı kaydet</button>
                  </div>
                  {taniHatasi && <p id="tani-hatasi" className="mt-2 text-sm text-clinical-red" role="alert">{taniHatasi}</p>}
                </div>
              ) : faz === "tedavi" ? (
                <div>
                  <div className="flex gap-2">
                  <label htmlFor="tedavi-plani-ana" className="sr-only">Tedavi planı</label>
                  <textarea id="tedavi-plani-ana" value={tedaviInput} onChange={(e) => setTedaviInput(e.target.value)}
                    placeholder="İlaç/girişim, doz veya yöntem, izlem ve takip kararınızı yazın…"
                    aria-invalid={Boolean(tedaviHatasi)} aria-describedby={tedaviHatasi ? "tedavi-hatasi" : undefined}
                    className="flex-1 min-h-12 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm lg:text-base text-ink placeholder:text-muted focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20 focus:outline-none resize-none" rows={2} />
                  <button onClick={vakaTamamlamayiIste} disabled={islemYukleniyor || !tedaviInput.trim()} className="btn-accent min-h-12 px-5 shrink-0 text-sm">{islemYukleniyor ? "Değerlendiriliyor…" : "Tedaviyi değerlendir"}</button>
                  </div>
                  {tedaviHatasi && <p id="tedavi-hatasi" className="mt-2 text-sm text-clinical-red" role="alert">{tedaviHatasi}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-steel">Önce bağlam araçlarından tetkikleri seçin, ardından istemi gönderin.</span>
                  <button onClick={() => setFaz("tani")} className="btn-secondary h-11 lg:h-10 shrink-0 text-xs lg:text-sm px-3 lg:px-4" disabled={testIstekleri.length === 0}>
                    Tanıya geç
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Sağ Panel — Testler ve Sonuçlar */}
        <div className={`${mobilPanel !== "testler" ? "hidden" : "flex"} w-full xl:flex xl:w-80 flex-shrink-0 border-l border-hairline bg-surface-soft overflow-y-auto scrollbar-thin flex-col`}>
          <div className="p-4 xl:p-6">
            {/* Test İsteme */}
            <div className={`${faz === "test" ? "block" : "hidden"} mb-6`}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Tetkik kataloğu
              </h3>

              <div className="mb-3 rounded-lg border border-brand/25 bg-brand/5 p-3 xl:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">Seçili tetkikler ({seciliTestKeyleri.length})</h4>
                    <p className="mt-0.5 text-xs text-steel">İstem gönderilene kadar sonuç oluşmaz.</p>
                  </div>
                  <button type="button" onClick={seciliTestleriIste} disabled={seciliTestKeyleri.length === 0 || islemYukleniyor} className="btn-primary min-h-11 px-3 text-xs">
                    {islemYukleniyor ? "İsteniyor…" : "Tetkikleri iste"}
                  </button>
                </div>
              </div>

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
                    aria-label="Aramayı temizle"
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
                        const secili = seciliTestKeyleri.includes(test.key);
                        const hasSonuc = !!vaka.statikTestler?.[test.key];
                        const tier = TEST_VISIBILITY_MAP[test.key]?.tier;
                        const beklenti = test.kategori === "Beklenti";
                        return (
                          <button
                            key={test.key}
                            onClick={() => testSeciminiDegistir(test.key)}
                            disabled={istendi || islemYukleniyor}
                            className={`flex min-h-11 w-full items-center justify-between border-b border-hairline-soft px-4 py-2 text-left text-sm last:border-0 transition-colors ${
                              istendi
                                ? "opacity-40 cursor-not-allowed bg-surface-soft"
                                : secili ? "bg-brand/10 text-ink ring-1 ring-inset ring-brand/40" : "hover:bg-surface text-ink"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-medium leading-5">
                                <span className="block">{test.ad}</span>
                                <span className="mt-1 flex flex-wrap gap-1">
                                {tier === "core" && (
                                  <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                                    Temel test
                                  </span>
                                )}
                                {tier === "branch" && (
                                  <span className="rounded-full bg-clinical-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-clinical-blue">
                                    Branşa özel
                                  </span>
                                )}
                                </span>
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
                              {!istendi && <span className="text-xs font-medium text-brand-deep">{secili ? "Seçildi" : "Seç"}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted text-right">
                {displayTests.length} test
              </p>
              <div className="mt-4 hidden rounded-lg border border-brand/25 bg-brand/5 p-3 xl:block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">Seçili tetkikler ({seciliTestKeyleri.length})</h4>
                    <p className="mt-1 text-xs text-steel">Seçim, istem gönderilene kadar sonuç oluşturmaz.</p>
                  </div>
                  <button type="button" onClick={seciliTestleriIste} disabled={seciliTestKeyleri.length === 0 || islemYukleniyor} className="btn-primary min-h-11 px-3 text-xs">
                    {islemYukleniyor ? "İsteniyor…" : "Tetkikleri iste"}
                  </button>
                </div>
                {seciliTestKeyleri.length > 0 && (
                  <ul className="mt-3 space-y-1.5" aria-label="Seçili tetkikler">
                    {seciliTestKeyleri.map((key) => {
                      const test = displayTests.find((item) => item.key === key);
                      return test ? <li key={key} className="flex min-h-10 items-center justify-between gap-2 rounded-md bg-canvas px-2.5 text-xs text-ink"><span>{test.ad}</span><button type="button" onClick={() => testSeciminiDegistir(key)} className="btn-ghost min-h-9 px-2 text-xs text-steel">Kaldır</button></li> : null;
                    })}
                  </ul>
                )}
              </div>
            </div>

            {faz !== "test" && (
              <aside className="mb-6 rounded-lg border border-hairline bg-canvas p-4" aria-labelledby="baglam-araci-baslik">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bağlam aracı</p>
                <h3 id="baglam-araci-baslik" className="mt-1 text-heading-5 text-ink">
                  {faz === "anamnez" ? "Vaka özeti" : faz === "tani" ? "Bulgular ve tetkikler" : "Tedavi güvenlik özeti"}
                </h3>
                {faz === "anamnez" ? (
                  <p className="mt-2 text-sm leading-6 text-steel">Önce hastanın öyküsünü netleştirin. Sorularınız ve yanıtlarınız ana çalışma alanında birikir.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-steel">
                    <p><span className="font-medium text-ink">{testIstekleri.length}</span> tetkik istendi</p>
                    {taniInput && <p><span className="font-medium text-ink">Ön tanı:</span> {taniInput}</p>}
                    {faz === "tedavi" && <p className="rounded-md bg-clinical-orange/10 px-3 py-2 text-xs text-clinical-orange">Alerji ve kontrendikasyonlar için vaka bulgularını planınızla birlikte yeniden kontrol edin.</p>}
                  </div>
                )}
              </aside>
            )}

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
                          debugMode={debugMode}
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
                İstenen tetkikler ve sonuçlar ({testIstekleri.length})
              </h3>
              {testIstekleri.length === 0 ? (
                <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-muted">
                  Henüz tetkik istenmedi.
                  <br />
                  <span className="text-xs">Tetkik aşamasında katalogdan seçim yapıp istemi gönderin.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {testIstekleri.map((istek) => (
                    <TestSonucKarti key={istek.testKey} istek={istek} hasta={vaka.hasta} hastaneAdi="ÇEMİÇGEZEK DEVLET HASTANESİ" debugMode={debugMode} />
                  ))}
                </div>
              )}
            </div>

            {(faz === "tani" || faz === "tedavi") && (
              <div className="mt-6 border-t border-hairline pt-4">
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
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompletionConfirm && (
        <dialog
          ref={completionConfirmRef}
          aria-labelledby="vaka-tamamlama-baslik"
          aria-describedby="vaka-tamamlama-aciklama"
          onCancel={(event) => {
            event.preventDefault();
            vakaTamamlamaTeyidiniKapat();
          }}
          className="fixed inset-0 z-[60] m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-hairline bg-canvas p-0 text-ink shadow-xl backdrop:bg-black/30"
        >
          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">Değerlendirme özeti</p>
            <h2 id="vaka-tamamlama-baslik" className="mt-1 text-xl font-semibold tracking-tight text-ink">
              Vakayı tamamlamak istiyor musunuz?
            </h2>
            <p id="vaka-tamamlama-aciklama" className="mt-2 text-sm leading-6 text-steel">
              Puanlama, aşağıdaki çalışma kaydınız üzerinden hazırlanır. Onaylamadan önce bilgileri gözden geçirebilirsiniz.
            </p>

            <dl className="mt-5 divide-y divide-hairline rounded-lg border border-hairline bg-surface-soft text-sm">
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-steel">Ön tanı</dt>
                <dd className="mt-1 font-medium text-ink">{taniInput.trim()}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4 px-4 py-3">
                <div>
                  <dt className="text-xs font-medium text-steel">Sorulan bilgi</dt>
                  <dd className="mt-1 font-medium text-ink">{sorulanAksiyonlar.length} soru</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-steel">İstenen tetkik</dt>
                  <dd className="mt-1 font-medium text-ink">{testIstekleri.length} test</dd>
                </div>
              </div>
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-steel">Tedavi planı</dt>
                <dd className="mt-1 line-clamp-3 text-ink">
                  {tedaviInput.trim() || "Tedavi planı eklenmedi."}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button ref={completionCancelRef} type="button" onClick={vakaTamamlamaTeyidiniKapat} className="btn-secondary min-h-11 justify-center">
                Geri dön
              </button>
              <button type="button" onClick={() => void vakaTamamlamayiOnayla()} disabled={islemYukleniyor} className="btn-accent min-h-11 justify-center">
                {islemYukleniyor ? "Puanlanıyor…" : "Onayla ve puanla"}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Mobile Bottom Tabs */}
      <div className="flex border-t border-hairline bg-canvas xl:hidden" role="group" aria-label="Mobil çalışma alanı">
        <button aria-pressed={mobilPanel === "hasta"} onClick={() => setMobilPanel("hasta")} className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 ${mobilPanel === "hasta" ? "text-brand" : "text-steel"}`}>
          <span className="text-[10px] font-medium">Hasta</span>
        </button>
        <button aria-pressed={mobilPanel === "sohbet"} onClick={() => setMobilPanel("sohbet")} className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 ${mobilPanel === "sohbet" ? "text-brand" : "text-steel"}`}>
          <span className="text-[10px] font-medium">Görev</span>
        </button>
        <button aria-pressed={mobilPanel === "testler"} onClick={() => setMobilPanel("testler")} className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 ${mobilPanel === "testler" ? "text-brand" : "text-steel"}`}>
          <span className="text-[10px] font-medium">Araçlar</span>
        </button>
      </div>
    </div>
  );
}

