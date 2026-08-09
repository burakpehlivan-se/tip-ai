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

  async function actionIstek(type: "ask" | "test" | "complete", payload: Record<string, string>) {
    if (!vaka) return null;
    const response = await fetch(`/api/student/attempts/${vaka.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
    return response.ok ? response.json() : null;
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <div className="flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4">
        <div className="flex items-center gap-3">
          <Link href="/vakalar" className="text-sm text-steel hover:text-ink transition-colors">
            ← Poliklinikler
          </Link>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium text-ink">🔓 Deneme Vakası</span>
        </div>
        <span className="badge badge-brand">Ücretsiz — giriş gerekmez</span>
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
          initialSnapshot={resumeSnapshot}
          onAsk={async (action) => (await actionIstek("ask", { action }))?.yanit || "Yanıt alınamadı."}
          onTestRequest={async (testKey) => (await actionIstek("test", { testKey }))?.sonuc || null}
          onEvaluate={async (attempt: CompletedAttempt) => (await actionIstek("complete", { taniGirildi: attempt.taniGirildi }))?.sonuc || null}
        />
      )}
    </div>
  );
}
