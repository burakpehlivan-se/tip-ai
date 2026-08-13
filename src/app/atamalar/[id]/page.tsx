"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VakaWorkspace, { type CompletedAttempt } from "@/components/vaka/VakaWorkspace";
import type { Vaka } from "@/lib/types";
import type { AttemptResumeSnapshot } from "@/lib/student/public-case";
import { publicAttemptToVaka, resumableAttemptToSnapshot } from "@/lib/student/public-case";

export default function AtananVakaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [resumeSnapshot, setResumeSnapshot] = useState<AttemptResumeSnapshot | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata("");
    const existing = await fetch(`/api/student/assignments/${encodeURIComponent(id)}/attempt`, { cache: "no-store" });
    if (existing.status === 401) {
      router.replace(`/giris?sonraki=${encodeURIComponent(`/atamalar/${id}`)}`);
      return;
    }
    const existingData = await existing.json().catch(() => null);
    if (!existing.ok && existing.status !== 404) throw new Error(existingData?.error || "Atama yüklenemedi.");
    if (existingData?.vaka) {
      setVaka(publicAttemptToVaka(existingData.vaka));
      setResumeSnapshot(resumableAttemptToSnapshot(existingData.vaka));
      setYukleniyor(false);
      return;
    }
    const started = await fetch(`/api/student/assignments/${encodeURIComponent(id)}/attempt`, { method: "POST" });
    const startedData = await started.json().catch(() => null);
    if (!started.ok || !startedData?.vaka) throw new Error(startedData?.error || "Atanan vaka başlatılamadı.");
    setVaka(publicAttemptToVaka(startedData.vaka));
    setResumeSnapshot(null);
    setYukleniyor(false);
  }, [id, router]);

  useEffect(() => {
    void yukle().catch((error: unknown) => {
      setHata(error instanceof Error ? error.message : "Sunucuya bağlanılamadı.");
      setYukleniyor(false);
    });
  }, [yukle]);

  async function attemptAction(type: "ask" | "test" | "reasoning" | "complete", payload: Record<string, unknown>) {
    if (!vaka) throw new Error("Vaka oturumu bulunamadı.");
    const response = await fetch(`/api/student/attempts/${vaka.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "İşlem tamamlanamadı.");
    return data;
  }

  if (yukleniyor || !vaka) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4" aria-live="polite">
        <div className="max-w-md text-center">
          {hata ? (
            <>
              <p className="text-lg font-medium text-clinical-red">{hata}</p>
              <button type="button" onClick={() => void yukle()} className="btn-primary mt-5">Tekrar dene</button>
              <Link href="/profilim" className="btn-secondary ml-2">Profilime dön</Link>
            </>
          ) : <p className="text-sm text-steel">Atanan vaka hazırlanıyor…</p>}
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-canvas">
      <header className="flex min-h-14 items-center border-b border-hairline bg-canvas px-4">
        <Link href="/profilim" className="text-sm text-steel transition-colors hover:text-ink">Profilime dön</Link>
        <span className="mx-3 text-muted" aria-hidden="true">/</span>
        <span className="truncate text-sm font-medium text-ink">Atanan vaka</span>
      </header>
      <VakaWorkspace
        key={vaka.id}
        vaka={vaka}
        embed
        initialSnapshot={resumeSnapshot}
        onboarding={!resumeSnapshot}
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
          const sonuc = (await attemptAction("complete", { taniGirildi: attempt.taniGirildi, reasoning: attempt.clinicalReasoning }))?.sonuc;
          if (!sonuc) throw new Error("Değerlendirme alınamadı.");
          return sonuc;
        }}
      />
    </div>
  );
}
