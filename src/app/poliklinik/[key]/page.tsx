"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VakaWorkspace, { CompletedAttempt } from "@/components/vaka/VakaWorkspace";
import { Vaka } from "@/lib/types";
import { AttemptResumeSnapshot, publicAttemptToVaka, resumableAttemptToSnapshot } from "@/lib/student/public-case";

export default function PoliklinikPage() {
  const params = useParams();
  const router = useRouter();
  const poliklinikKey = params.key as string;
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<AttemptResumeSnapshot | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [girisKontrol, setGirisKontrol] = useState(true);
  const [hata, setHata] = useState("");
  const [taslakDegisti, setTaslakDegisti] = useState(false);
  const poliklinik = { ad: poliklinikKey };

  const uret = useCallback(
    async (devamEdeniYukle: boolean) => {
      if (devamEdeniYukle) {
        const devamEden = await fetch(`/api/student/attempts?poliklinikKey=${encodeURIComponent(poliklinikKey)}`);
        const devamVerisi = await devamEden.json();
        if (!devamEden.ok) throw new Error(devamVerisi?.error || "Vaka oturumu yüklenemedi.");
        if (devamVerisi?.vaka) {
          return {
            vaka: publicAttemptToVaka(devamVerisi.vaka),
            snapshot: resumableAttemptToSnapshot(devamVerisi.vaka),
          };
        }
      }
      const response = await fetch("/api/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poliklinikKey }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Vaka hazırlanamadı.");
      }
      const { vaka: remote } = await response.json();
      if (!remote) throw new Error("Vaka hazırlanamadı.");
      return { vaka: publicAttemptToVaka(remote), snapshot: null };
    },
    [poliklinikKey]
  );

  useEffect(() => {
    let cancelled = false;
    const baslat = async () => {
      try {
        const oturum = await fetch("/api/student/me");
        if (cancelled) return;
        if (!oturum.ok) {
          router.replace(`/giris?sonraki=${encodeURIComponent(`/poliklinik/${poliklinikKey}`)}`);
          return;
        }
        setGirisKontrol(false);
        setYukleniyor(true);
        setHata("");
        const yuklenen = await uret(true);
        if (!cancelled) {
          setVaka(yuklenen.vaka);
          setResumeSnapshot(yuklenen.snapshot);
          setYukleniyor(false);
        }
      } catch (error) {
        if (!cancelled) {
          setGirisKontrol(false);
          setHata(error instanceof Error ? error.message : "Sunucuya bağlanılamadı.");
          setYukleniyor(false);
        }
      }
    };
    void baslat();
    return () => {
      cancelled = true;
    };
  }, [poliklinikKey, router, uret]);

  const yeniVakaAl = async () => {
    if (yukleniyor) return;
    if (taslakDegisti && !window.confirm("Tanı veya tedavi taslağınız bu cihazda kaydedildi. Yine de vakayı değiştirmek istiyor musunuz?")) return;
    setYukleniyor(true);
    setHata("");
    try {
      const yeni = await uret(false);
      setVaka(yeni.vaka);
      setResumeSnapshot(null);
      setTaslakDegisti(false);
    } catch (error) {
      setHata(error instanceof Error ? error.message : "Yeni vaka hazırlanamadı.");
    } finally {
      setYukleniyor(false);
    }
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

  if (yukleniyor || !vaka) {
    if (hata) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
          <div className="max-w-sm text-center">
            <p role="alert" className="text-lg font-medium text-clinical-red">{hata}</p>
            <button type="button" onClick={() => void yeniVakaAl()} className="btn-primary mt-5">
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
        </div>
        <button type="button" onClick={() => void yeniVakaAl()} disabled={yukleniyor} className="btn-secondary shrink-0 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:px-5">
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
