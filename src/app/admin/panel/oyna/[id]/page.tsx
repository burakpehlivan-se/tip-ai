"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import VakaWorkspace from "@/components/vaka/VakaWorkspace";
import { adminVakaToPlayable } from "@/lib/admin/case-to-vaka";
import { AdminVaka } from "@/lib/admin/types";
import { DegerlendirmeSonuc, Vaka } from "@/lib/types";
import { CHIP_HAVUZU } from "@/lib/data/case-generator";

export default function AdminOynaPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [adminCase, setAdminCase] = useState<AdminVaka | null>(null);
  const [playVaka, setPlayVaka] = useState<Vaka | null>(null);
  const [debugMode, setDebugMode] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbacks, setFeedbacks] = useState<
    { id: string; metin: string; actor: string; createdAt: number; debugPuan?: { toplamPuan?: number; maxPuan?: number } }[]
  >([]);
  const [lastSonuc, setLastSonuc] = useState<DegerlendirmeSonuc | null>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/cases/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setAdminCase(d.case);
        const playable = adminVakaToPlayable(d.case);
        playable.soruChipleri = [...CHIP_HAVUZU];
        setPlayVaka(playable);
      })
      .catch((e) => setError(e.message));

    fetch(`/api/admin/feedback?caseId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => setFeedbacks(d.feedbacks || []));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function yenidenBaslat() {
    if (!adminCase) return;
    const playable = adminVakaToPlayable(adminCase);
    playable.soruChipleri = [...CHIP_HAVUZU];
    setPlayVaka(playable);
    setLastSonuc(null);
  }

  async function onComplete(sonuc: DegerlendirmeSonuc) {
    setLastSonuc(sonuc);
    await fetch("/api/admin/play-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: id,
        mode: "admin-debug",
        toplamPuan: sonuc.toplamPuan,
        maxPuan: sonuc.maxPuan,
        taniDogru: sonuc.taniDogru,
        atlananRedFlagler: sonuc.atlananRedFlagler,
        gereksizTestler: sonuc.gereksizTestler,
        eksikSorular: sonuc.eksikSorular,
        eksikTestler: sonuc.eksikTestler,
        anamnezCoverage:
          sonuc.anamnezAnalizi?.toplamBeklenen > 0
            ? Math.round(
                (sonuc.anamnezAnalizi.toplamSoruldu / sonuc.anamnezAnalizi.toplamBeklenen) * 100
              )
            : undefined,
      }),
    });
  }

  async function submitFeedback(e: FormEvent) {
    e.preventDefault();
    if (!feedback.trim() || !adminCase) return;
    const res = await fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: id,
        metin: feedback.trim(),
        debugNotlar: debugMode ? "debug-play" : undefined,
        debugPuan: lastSonuc
          ? {
              toplamPuan: lastSonuc.toplamPuan,
              maxPuan: lastSonuc.maxPuan,
              taniGirildi: lastSonuc.taniGirildi,
              taniDogru: lastSonuc.taniDogru,
            }
          : undefined,
        vakaSnapshot: {
          hastalikAdi: adminCase.hastalikAdi,
          anaSikayet: adminCase.anaSikayet,
          seviye: adminCase.seviye,
          testKeys: Object.keys(adminCase.statikTestler || {}),
          beklenenTani: adminCase.rubric?.kabulEdilenTani || [],
          debugNotlar: lastSonuc
            ? `Puan ${lastSonuc.toplamPuan}/${lastSonuc.maxPuan}`
            : undefined,
        },
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Feedback kaydedilemedi");
      return;
    }
    setFeedback("");
    setFlash("Feedback kaydedildi (vaka değerleriyle birlikte).");
    setTimeout(() => setFlash(""), 3000);
    load();
  }

  const meta = useMemo(() => adminCase, [adminCase]);

  if (error && !adminCase) {
    return (
      <div>
        <p className="text-clinical-red">{error}</p>
        <Link href="/admin/panel/vakalar">← Vakalar</Link>
      </div>
    );
  }

  if (!playVaka || !meta) {
    return <p className="text-sm text-steel">Vaka yükleniyor…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/panel/vakalar/${encodeURIComponent(id)}`} className="text-sm text-steel hover:text-ink">
            ← Editöre dön
          </Link>
          <h1 className="text-xl font-semibold text-ink mt-1">
            🎮 Oyna · {meta.hastalikAdi}
          </h1>
          <p className="text-xs text-muted">
            {meta.poliklinikAd} · {meta.durum} · v{meta.surum}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm rounded-full border border-hairline bg-canvas px-3 py-1.5">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            Debug modu
          </label>
          <button type="button" className="btn-secondary text-xs" onClick={yenidenBaslat}>
            🔄 Yeniden başlat
          </button>
        </div>
      </div>

      {flash && (
        <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{flash}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-hairline overflow-hidden bg-canvas min-h-[70vh] flex flex-col">
          <VakaWorkspace
            key={`${playVaka.id}-${debugMode}`}
            vaka={playVaka}
            embed
            debugMode={debugMode}
            raporHazir
            onComplete={onComplete}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-hairline bg-canvas p-4">
            <h2 className="text-sm font-semibold text-ink mb-2">Vaka feedback</h2>
            <p className="text-xs text-muted mb-3">
              Bu feedback, vaka değerleriyle birlikte kaydedilir (eğitmen notu / bug / iyileştirme).
            </p>
            <form onSubmit={submitFeedback} className="space-y-2">
              <textarea
                className="input w-full min-h-[100px] text-sm"
                placeholder="Örn: Troponin yorumu klinik olarak zayıf; red flag listesine senkop eklensin…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                required
              />
              {lastSonuc && (
                <p className="text-[11px] text-steel">
                  Son oturum: {lastSonuc.toplamPuan}/{lastSonuc.maxPuan} · tanı{" "}
                  {lastSonuc.taniDogru ? "✓" : "✗"}
                </p>
              )}
              <button type="submit" className="btn-primary text-sm w-full">
                Feedback kaydet
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-hairline bg-canvas p-4 max-h-[50vh] overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase text-muted mb-2">
              Kayıtlı feedback ({feedbacks.length})
            </h3>
            <div className="space-y-2">
              {feedbacks.map((f) => (
                <div key={f.id} className="rounded-md border border-hairline-soft p-2 text-xs">
                  <div className="text-ink whitespace-pre-wrap">{f.metin}</div>
                  <div className="mt-1 text-muted">
                    {f.actor} · {new Date(f.createdAt).toLocaleString("tr-TR")}
                    {f.debugPuan
                      ? ` · ${f.debugPuan.toplamPuan}/${f.debugPuan.maxPuan}`
                      : ""}
                  </div>
                </div>
              ))}
              {feedbacks.length === 0 && (
                <p className="text-muted text-xs">Henüz feedback yok.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
