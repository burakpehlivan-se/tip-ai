"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VakaWorkspace, { CompletedAttempt } from "@/components/vaka/VakaWorkspace";
import { HastaTipiSecici, tipEmoji, type HastaTipiSecim } from "@/components/vaka/HastaTipiSecici";
import { Vaka } from "@/lib/types";
import { AttemptResumeSnapshot, publicAttemptToVaka, resumableAttemptToSnapshot } from "@/lib/student/public-case";
import type { ClinicalHistory } from "@/lib/clinical-history/types";

export default function PoliklinikPage() {
  const params = useParams();
  const router = useRouter();
  const poliklinikKey = params.key as string;
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<AttemptResumeSnapshot | null>(null);
  const [hastaTipi, setHastaTipi] = useState<{ id: string; ad: string } | null>(null);
  const [vakaNo, setVakaNo] = useState<string | null>(null);
  const [tipler, setTipler] = useState<HastaTipiSecim[]>([]);
  const [seciliTipId, setSeciliTipId] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [girisKontrol, setGirisKontrol] = useState(true);
  const [secimAsamasi, setSecimAsamasi] = useState(false);
  const [hata, setHata] = useState("");
  const [taslakDegisti, setTaslakDegisti] = useState(false);
  const poliklinik = { ad: poliklinikKey };

  const tipleriYukle = useCallback(async () => {
    const res = await fetch("/api/student/hasta-tipleri");
    const data = await res.json().catch(() => null);
    if (Array.isArray(data?.tipler)) setTipler(data.tipler);
  }, []);

  const resumeYukle = useCallback(async () => {
    const devamEden = await fetch(`/api/student/attempts?poliklinikKey=${encodeURIComponent(poliklinikKey)}`);
    const devamVerisi = await devamEden.json();
    if (!devamEden.ok) throw new Error(devamVerisi?.error || "Vaka oturumu yüklenemedi.");
    if (devamVerisi?.vaka) {
      return {
        vaka: publicAttemptToVaka(devamVerisi.vaka),
        snapshot: resumableAttemptToSnapshot(devamVerisi.vaka),
        hastaTipi: devamVerisi.vaka.hastaTipi ?? null,
        vakaNo: typeof devamVerisi.vakaNo === "string" ? devamVerisi.vakaNo : null,
      };
    }
    return null;
  }, [poliklinikKey]);

  const yeniBaslat = useCallback(
    async (tipId: string | null) => {
      const response = await fetch("/api/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poliklinikKey, hastaTipiId: tipId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Vaka hazırlanamadı.");
      }
      const { vaka: remote, vakaNo: remoteVakaNo } = await response.json();
      if (!remote) throw new Error("Vaka hazırlanamadı.");
      return {
        vaka: publicAttemptToVaka(remote),
        hastaTipi: remote.hastaTipi ?? null,
        vakaNo: typeof remoteVakaNo === "string" ? remoteVakaNo : null,
      };
    },
    [poliklinikKey]
  );

  useEffect(() => {
    let cancelled = false;
    const hazirla = async () => {
      try {
        const oturum = await fetch("/api/student/me");
        if (cancelled) return;
        if (!oturum.ok) {
          router.replace(`/giris?sonraki=${encodeURIComponent(`/poliklinik/${poliklinikKey}`)}`);
          return;
        }
        setGirisKontrol(false);
        setHata("");
        const [devam] = await Promise.all([resumeYukle(), tipleriYukle()]);
        if (cancelled) return;
        if (devam) {
          setVaka(devam.vaka);
          setResumeSnapshot(devam.snapshot);
          setHastaTipi(devam.hastaTipi);
          setVakaNo(devam.vakaNo);
        } else {
          setSecimAsamasi(true);
        }
        setYukleniyor(false);
      } catch (error) {
        if (!cancelled) {
          setGirisKontrol(false);
          setHata(error instanceof Error ? error.message : "Sunucuya bağlanılamadı.");
          setYukleniyor(false);
        }
      }
    };
    void hazirla();
    return () => {
      cancelled = true;
    };
  }, [poliklinikKey, router, resumeYukle, tipleriYukle]);

  const baslat = async () => {
    if (yukleniyor) return;
    setYukleniyor(true);
    setHata("");
    try {
      const yeni = await yeniBaslat(seciliTipId);
      setVaka(yeni.vaka);
      setResumeSnapshot(null);
      setHastaTipi(yeni.hastaTipi);
      setVakaNo(yeni.vakaNo);
      setSecimAsamasi(false);
      setTaslakDegisti(false);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Vaka hazırlanamadı.");
    } finally {
      setYukleniyor(false);
    }
  };

  const yeniVakaAl = () => {
    if (yukleniyor) return;
    if (taslakDegisti && !window.confirm("Tanı veya tedavi taslağınız bu cihazda kaydedildi. Yine de vakayı değiştirmek istiyor musunuz?")) return;
    setSeciliTipId(null);
    setSecimAsamasi(true);
    setVaka(null);
    setResumeSnapshot(null);
    setHastaTipi(null);
    setVakaNo(null);
    setTaslakDegisti(false);
    setHata("");
  };

  async function attemptAction(type: "ask" | "test" | "reasoning" | "complete", payload: Record<string, unknown>) {
    if (!vaka) throw new Error("Vaka oturumu bulunamadı.");
    const response = await fetch(`/api/student/attempts/${vaka.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || "İşlem tamamlanamadı.");
    }
    return response.json();
  }

  async function clinicalHistoryRequest(): Promise<ClinicalHistory> {
    if (!vaka) throw new Error("Vaka oturumu bulunamadı.");
    const response = await fetch(`/api/student/attempts/${vaka.id}/history`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.history) {
      throw new Error(data?.error || "Klinik geçmiş alınamadı.");
    }
    return data.history as ClinicalHistory;
  }

  if (girisKontrol) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <p className="text-lg font-medium text-ink mb-2">{poliklinik.ad} Polikliniği</p>
          <p className="text-sm text-steel">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (secimAsamasi) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-canvas">
        <header className="flex min-h-14 items-center gap-3 border-b border-hairline bg-canvas px-4 py-2">
          <Link href="/vakalar" className="inline-flex min-h-11 shrink-0 items-center text-sm text-steel transition-colors hover:text-ink">
            <span className="sm:hidden">← Geri</span>
            <span className="hidden sm:inline">← Poliklinikler</span>
          </Link>
          <span className="text-muted" aria-hidden="true">/</span>
          <span className="truncate text-sm font-medium text-ink">{poliklinik.ad}</span>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Hasta Tipi Seç</h1>
          <p className="mt-3 text-steel">
            Bu vaka için hastanın konuşma tarzını seçin. Seçmezseniz sistem rastgele bir tip atar.
          </p>
          <div className="mt-6">
            <HastaTipiSecici tipler={tipler} seciliTipId={seciliTipId} onSelect={setSeciliTipId} />
          </div>
          {hata && <p role="alert" className="mt-4 text-sm text-clinical-red">{hata}</p>}
          <button
            type="button"
            onClick={() => void baslat()}
            disabled={yukleniyor}
            className="btn-primary mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {yukleniyor ? "Hazırlanıyor…" : "Vakayı Başlat →"}
          </button>
        </main>
      </div>
    );
  }

  if (yukleniyor || !vaka) {
    if (hata) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
          <div className="max-w-sm text-center">
            <p role="alert" className="text-lg font-medium text-clinical-red">{hata}</p>
            <button type="button" onClick={() => yeniVakaAl()} className="btn-primary mt-5">
              Tekrar dene
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <p className="text-lg font-medium text-ink mb-2">{poliklinik.ad} Polikliniği</p>
          <p className="text-sm text-steel">Vaka hazırlanıyor...</p>
          <div className="mt-6 mx-auto h-1 w-32 overflow-hidden rounded-full bg-surface">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas">
      <a href="#vaka-calismasi" className="skip-link">Çalışma alanına atla</a>
      {/* Top Bar — Poliklinik */}
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline bg-canvas px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/vakalar" className="inline-flex min-h-11 shrink-0 items-center text-sm text-steel transition-colors hover:text-ink">
            <span className="sm:hidden">← Geri</span>
            <span className="hidden sm:inline">← Poliklinikler</span>
          </Link>
          <span className="text-muted" aria-hidden="true">/</span>
          <span className="truncate text-sm font-medium text-ink">
            {poliklinik.ad}
          </span>
          {hastaTipi && (
            <span className="badge badge-brand shrink-0" title="Bu vaka için atanan hasta tipi">
              {tipEmoji(hastaTipi.id)} {hastaTipi.ad}
            </span>
          )}
          {vakaNo && (
            <span className="badge badge-steel shrink-0" title={`Paylaşım bağlantısı: /vaka/${vakaNo}`}>
              Vaka #{vakaNo}
            </span>
          )}
        </div>
        <button type="button" onClick={yeniVakaAl} disabled={yukleniyor} className="btn-secondary shrink-0 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:px-5">
          <span className="sm:hidden">Değiştir</span>
          <span className="hidden sm:inline">Vakayı değiştir</span>
        </button>
      </header>

      <main id="vaka-calismasi" tabIndex={-1} className="flex min-h-0 flex-1">
        <VakaWorkspace
          vaka={vaka}
          key={vaka.id}
          embed
          initialSnapshot={resumeSnapshot}
          onboarding={!resumeSnapshot}
          onDirtyChange={setTaslakDegisti}
          onAsk={async (action) => {
            const yanit = (await attemptAction("ask", { action }))?.yanit;
            if (!yanit) throw new Error("Hasta yanıtı alınamadı.");
            return yanit;
          }}
          onTestRequest={async (testKey) => {
            const sonuc = (await attemptAction("test", { testKey }))?.sonuc;
            if (!sonuc) throw new Error("Test sonucu alınamadı.");
            return sonuc;
          }}
          onReasoningSave={async (reasoning) => {
            await attemptAction("reasoning", { reasoning });
          }}
          onClinicalHistoryRequest={clinicalHistoryRequest}
          onEvaluate={async (attempt: CompletedAttempt) => {
            const sonuc = (await attemptAction("complete", { taniGirildi: attempt.taniGirildi, tedaviGirildi: attempt.tedaviGirildi, reasoning: attempt.clinicalReasoning }))?.sonuc;
            if (!sonuc) throw new Error("Değerlendirme alınamadı.");
            return sonuc;
          }}
        />
      </main>
    </div>
  );
}
