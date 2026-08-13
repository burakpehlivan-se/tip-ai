"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VakaWorkspace, { CompletedAttempt } from "@/components/vaka/VakaWorkspace";
import { Vaka } from "@/lib/types";
import { AttemptResumeSnapshot, publicAttemptToVaka, resumableAttemptToSnapshot } from "@/lib/student/public-case";

export default function DenemePage() {
  const router = useRouter();
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<AttemptResumeSnapshot | null>(null);
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const yukle = async () => {
      try {
        // Girişli kullanıcılar deneme sayfası yerine polikliniklere gider.
        const oturum = await fetch("/api/student/me");
        if (cancelled) return;
        if (oturum.ok) {
          router.replace("/vakalar");
          return;
        }

        const devamEden = await fetch("/api/student/attempts?guest=1&poliklinikKey=*");
        const devamVerisi = await devamEden.json();
        if (cancelled) return;
        if (devamEden.ok && devamVerisi?.vaka) {
          setVaka(publicAttemptToVaka(devamVerisi.vaka));
          setResumeSnapshot(resumableAttemptToSnapshot(devamVerisi.vaka));
          setYukleniyor(false);
          return;
        }

        const yeniVaka = await fetch("/api/student/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poliklinikKey: "*", guest: true }),
        });
        const yeniVeri = await yeniVaka.json();
        if (cancelled) return;
        if (!yeniVaka.ok || !yeniVeri?.vaka) throw new Error(yeniVeri?.error || "Deneme vakası yüklenemedi.");
        setVaka(publicAttemptToVaka(yeniVeri.vaka));
        setResumeSnapshot(null);
        setYukleniyor(false);
      } catch (error) {
        if (!cancelled) {
          setHata(error instanceof Error ? error.message : "Sunucuya bağlanılamadı.");
          setYukleniyor(false);
        }
      }
    };
    void yukle();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function actionIstek(type: "ask" | "test" | "reasoning" | "complete", payload: Record<string, unknown>) {
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

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline bg-canvas px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/vakalar" className="shrink-0 text-sm text-steel transition-colors hover:text-ink">
            <span className="sm:hidden">← Geri</span>
            <span className="hidden sm:inline">← Poliklinikler</span>
          </Link>
          <span className="text-muted" aria-hidden="true">/</span>
          <span className="truncate text-sm font-medium text-ink">🔓 Deneme Vakası</span>
        </div>
        <span className="badge badge-brand shrink-0 text-[11px]">
          <span className="sm:hidden">Ücretsiz</span>
          <span className="hidden sm:inline">Ücretsiz — giriş gerekmez</span>
        </span>
      </div>

      {yukleniyor && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-5xl">🩺</div>
            <p className="text-lg font-medium text-ink mb-2">Deneme Vakası</p>
            <p className="text-sm text-steel">Vaka hazırlanıyor...</p>
            <div className="mt-6 mx-auto h-1 w-32 overflow-hidden rounded-full bg-surface">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
            </div>
          </div>
        </div>
      )}

      {hata && !yukleniyor && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-clinical-red mb-4">{hata}</p>
            <Link href="/giris" className="btn-primary">
              Giriş Yap →
            </Link>
          </div>
        </div>
      )}

      {vaka && !yukleniyor && (
        <VakaWorkspace
          vaka={vaka}
          key={vaka.id}
          embed
          initialSnapshot={resumeSnapshot}
          onboarding={!resumeSnapshot}
          onAsk={async (action) => {
            const yanit = (await actionIstek("ask", { action }))?.yanit;
            if (!yanit) throw new Error("Hasta yanıtı alınamadı.");
            return yanit;
          }}
          onTestRequest={async (testKey) => {
            const sonuc = (await actionIstek("test", { testKey }))?.sonuc;
            if (!sonuc) throw new Error("Test sonucu alınamadı.");
            return sonuc;
          }}
          onReasoningSave={async (reasoning) => {
            await actionIstek("reasoning", { reasoning });
          }}
          onEvaluate={async (attempt: CompletedAttempt) => {
            const sonuc = (await actionIstek("complete", { taniGirildi: attempt.taniGirildi, reasoning: attempt.clinicalReasoning }))?.sonuc;
            if (!sonuc) throw new Error("Değerlendirme alınamadı.");
            return sonuc;
          }}
        />
      )}
    </div>
  );
}
