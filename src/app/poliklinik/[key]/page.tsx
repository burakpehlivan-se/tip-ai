"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VakaWorkspace, { CompletedAttempt } from "@/components/vaka/VakaWorkspace";
import { Vaka } from "@/lib/types";
import { publicAttemptToVaka } from "@/lib/student/public-case";

export default function PoliklinikPage() {
  const params = useParams();
  const router = useRouter();
  const poliklinikKey = params.key as string;
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [girisKontrol, setGirisKontrol] = useState(true);
  const poliklinik = { ad: poliklinikKey, icon: "🏥" };

  // Giriş kapısı — poliklinikler yalnızca girişli kullanıcılar içindir
  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/me")
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          router.replace(
            `/giris?sonraki=${encodeURIComponent(`/poliklinik/${poliklinikKey}`)}`
          );
        } else {
          setGirisKontrol(false);
        }
      })
      .catch(() => {
        if (!cancelled) setGirisKontrol(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, poliklinikKey]);

  const uret = useCallback(
    async () => {
      const response = await fetch("/api/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poliklinikKey }),
      });
      if (!response.ok) throw new Error("Vaka hazırlanamadı.");
      const { vaka: remote } = await response.json();
      return publicAttemptToVaka(remote);
    },
    [poliklinikKey]
  );

  useEffect(() => {
    let cancelled = false;
    setYukleniyor(true);
    uret().then((yeniVaka) => {
      if (!cancelled) {
        setVaka(yeniVaka);
        setYukleniyor(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [poliklinikKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const yeniVakaAl = () => {
    setYukleniyor(true);
    uret().then((yeni) => {
      setVaka(yeni);
      setYukleniyor(false);
    });
  };

  async function attemptAction(type: "ask" | "test" | "complete", payload: Record<string, string>) {
    if (!vaka) return null;
    try {
      const response = await fetch(`/api/student/attempts/${vaka.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...payload }),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  if (girisKontrol) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="mb-4 text-5xl">{poliklinik.icon}</div>
          <p className="text-lg font-medium text-ink mb-2">{poliklinik.ad} Polikliniği</p>
          <p className="text-sm text-steel">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (yukleniyor || !vaka) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="mb-4 text-5xl">{poliklinik.icon}</div>
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
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar — Poliklinik */}
      <div className="flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4">
        <div className="flex items-center gap-3">
          <Link href="/vakalar" className="text-sm text-steel hover:text-ink transition-colors">
            ← Poliklinikler
          </Link>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium text-ink">
            {poliklinik.icon} {poliklinik.ad}
          </span>
        </div>
        <button onClick={yeniVakaAl} className="btn-secondary text-sm">
          🔄 Yeni Hasta
        </button>
      </div>

      <VakaWorkspace
        vaka={vaka}
        key={vaka.id}
        onAsk={async (action) => (await attemptAction("ask", { action }))?.yanit || "Yanıt alınamadı."}
        onTestRequest={async (testKey) => (await attemptAction("test", { testKey }))?.sonuc || null}
        onEvaluate={async (attempt: CompletedAttempt) => (await attemptAction("complete", { taniGirildi: attempt.taniGirildi }))?.sonuc || null}
      />
    </div>
  );
}
