"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import VakaWorkspace, { type DebugJson } from "@/components/vaka/VakaWorkspace";
import { AdminVaka } from "@/lib/admin/types";
import { DegerlendirmeSonuc, Vaka } from "@/lib/types";

export default function AdminOynaPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [adminCase, setAdminCase] = useState<AdminVaka | null>(null);
  const [playVaka, setPlayVaka] = useState<Vaka | null>(null);
  const [debugMode, setDebugMode] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbacks, setFeedbacks] = useState<
    {
      id: string;
      metin: string;
      actor: string;
      createdAt: number;
      debugPuan?: { toplamPuan?: number; maxPuan?: number };
    }[]
  >([]);
  const [lastSonuc, setLastSonuc] = useState<DegerlendirmeSonuc | null>(null);
  const [flash, setFlash] = useState("");
  /** Masaüstünde not paneli açık; mobilde oyun alanına yer ver */
  const [sidebarAcik, setSidebarAcik] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarAcik(false);
    }
  }, []);
  const [feedbackTab, setFeedbackTab] = useState<"not" | "kayitli" | "rubric" | "json">("not");
  const [debugJson, setDebugJson] = useState<DebugJson | null>(null);
  const [tumSorulariDahilEt, setTumSorulariDahilEt] = useState(true);
  const [kopyalandi, setKopyalandi] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/cases/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setAdminCase(d.case);
      })
      .catch((e) => setError(e.message));

    fetch(`/api/admin/cases/${encodeURIComponent(id)}/playable`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Oynanabilir vaka yüklenemedi");
        setPlayVaka(d.vaka);
      })
      .catch((e) => setError(e.message));

    fetch(`/api/admin/feedback?caseId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => setFeedbacks(d.feedbacks || []));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function yenidenBaslat() {
    const response = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/playable`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Vaka yeniden başlatılamadı");
      return;
    }
    setPlayVaka(data.vaka);
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
    setFlash("Feedback kaydedildi");
    setTimeout(() => setFlash(""), 2500);
    load();
  }

  const meta = useMemo(() => adminCase, [adminCase]);

  const debugJsonString = useMemo(() => {
    if (!debugJson) return "";
    const data = tumSorulariDahilEt ? debugJson : { ...debugJson, tumSorular: undefined };
    return JSON.stringify(data, null, 2);
  }, [debugJson, tumSorulariDahilEt]);

  async function copyDebugJson() {
    if (!debugJsonString) return;
    try {
      await navigator.clipboard.writeText(debugJsonString);
      setKopyalandi(true);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = debugJsonString;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setKopyalandi(true);
    }
    setTimeout(() => setKopyalandi(false), 1600);
  }

  if (error && !adminCase) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <p className="text-clinical-red">{error}</p>
          <Link href="/admin/panel/vakalar" className="mt-2 inline-block text-sm text-steel hover:text-ink">
            ← Vakalar
          </Link>
        </div>
      </div>
    );
  }

  if (!playVaka || !meta) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-steel">Vaka yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Kompakt üst toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hairline bg-canvas px-3 py-1.5 lg:px-4">
        <Link
          href={`/admin/panel/vakalar/${encodeURIComponent(id)}`}
          className="shrink-0 text-xs text-steel hover:text-ink"
        >
          ← Editör
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-sm font-semibold text-ink">
              🎮 {meta.hastalikAdi}
            </h1>
            <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
              {meta.poliklinikAd} · {meta.durum} · v{meta.surum}
            </span>
          </div>
        </div>

        {lastSonuc && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              lastSonuc.taniDogru
                ? "bg-clinical-green/15 text-clinical-green"
                : "bg-clinical-orange/15 text-clinical-orange"
            }`}
          >
            {lastSonuc.toplamPuan}/{lastSonuc.maxPuan}
          </span>
        )}

        {flash && (
          <span className="shrink-0 text-[11px] font-medium text-brand-deep">{flash}</span>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-ink">
            <input
              type="checkbox"
              className="h-3 w-3 accent-brand"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            Debug
          </label>
          <button
            type="button"
            className="btn-secondary px-2.5 py-1 text-[11px]"
            onClick={yenidenBaslat}
          >
            🔄 Yeniden
          </button>
          <button
            type="button"
            className="btn-secondary px-2.5 py-1 text-[11px] lg:hidden"
            onClick={() => setSidebarAcik((v) => !v)}
          >
            {sidebarAcik ? "Notlar ▸" : "Notlar ◂"}
          </button>
          <button
            type="button"
            className="btn-secondary hidden px-2.5 py-1 text-[11px] lg:inline-flex"
            onClick={() => setSidebarAcik((v) => !v)}
            title={sidebarAcik ? "Paneli gizle" : "Paneli göster"}
          >
            {sidebarAcik ? "▸ Panel" : "◂ Panel"}
          </button>
        </div>
      </div>

      {/* Tam yükseklik: workspace + isteğe bağlı yan panel */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas ${
            sidebarAcik ? "hidden lg:flex" : "flex"
          }`}
        >
          <VakaWorkspace
            key={`${playVaka.id}-${debugMode}`}
            vaka={playVaka}
            embed
            debugMode={debugMode}
            raporHazir
            onComplete={onComplete}
            onDebugSnapshot={setDebugJson}
          />
        </div>

        {sidebarAcik && (
          <aside className="flex w-full shrink-0 flex-col overflow-hidden border-l border-hairline bg-canvas lg:w-80">
            {/* Tab başlıkları */}
            <div className="flex shrink-0 border-b border-hairline">
              {(
                [
                  { id: "not" as const, label: "Not" },
                  { id: "kayitli" as const, label: `Kayıt (${feedbacks.length})` },
                  { id: "rubric" as const, label: "Rubrik" },
                  { id: "json" as const, label: "Debug JSON" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFeedbackTab(t.id)}
                  className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                    feedbackTab === t.id
                      ? "border-b-2 border-ink text-ink"
                      : "text-steel hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-3">
              {feedbackTab === "not" && (
                <form onSubmit={submitFeedback} className="flex h-full min-h-0 flex-col gap-2">
                  <p className="text-[11px] text-muted">
                    Vaka değerleriyle birlikte kaydedilir (bug / iyileştirme / eğitmen notu).
                  </p>
                  <textarea
                    className="input min-h-[120px] w-full flex-1 resize-none text-sm"
                    placeholder="Örn: Troponin yorumu zayıf; red flag listesine senkop eklensin…"
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
                  {error && <p className="text-[11px] text-clinical-red">{error}</p>}
                  <button type="submit" className="btn-primary w-full text-sm">
                    Feedback kaydet
                  </button>
                </form>
              )}

              {feedbackTab === "kayitli" && (
                <div className="space-y-2">
                  {feedbacks.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-md border border-hairline-soft p-2 text-xs"
                    >
                      <div className="whitespace-pre-wrap text-ink">{f.metin}</div>
                      <div className="mt-1 text-muted">
                        {f.actor} · {new Date(f.createdAt).toLocaleString("tr-TR")}
                        {f.debugPuan
                          ? ` · ${f.debugPuan.toplamPuan}/${f.debugPuan.maxPuan}`
                          : ""}
                      </div>
                    </div>
                  ))}
                  {feedbacks.length === 0 && (
                    <p className="text-xs text-muted">Henüz feedback yok.</p>
                  )}
                </div>
              )}

              {feedbackTab === "rubric" && (
                <div className="space-y-3 text-xs">
                  <RubrikSatir
                    baslik="Beklenen tanı"
                    items={meta.rubric?.kabulEdilenTani || playVaka.beklenenTani || []}
                  />
                  <RubrikSatir
                    baslik="Red flags"
                    items={(meta.rubric?.redFlagler || playVaka.rubric?.redFlagler || []).map(
                      (r) => (typeof r === "string" ? r : r.etiket)
                    )}
                  />
                  <RubrikSatir
                    baslik="Beklenen testler"
                    items={(
                      meta.rubric?.beklenenTestler ||
                      playVaka.rubric?.beklenenTestler ||
                      []
                    ).map((t) => (typeof t === "string" ? t : t.etiket))}
                  />
                  <RubrikSatir
                    baslik="Gereksiz testler"
                    items={(
                      meta.rubric?.gereksizTestler ||
                      playVaka.rubric?.gereksizTestler ||
                      []
                    ).map((t) => (typeof t === "string" ? t : t.etiket))}
                  />
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Meta
                    </div>
                    <div className="rounded-md border border-hairline-soft bg-surface-soft px-2 py-1.5 text-steel">
                      key: {meta.hastalikKey || playVaka.hastalik}
                      <br />
                      seviye: {meta.seviye}
                      <br />
                      testler: {Object.keys(meta.statikTestler || {}).length}
                    </div>
                  </div>
                </div>
              )}

              {feedbackTab === "json" && (
                <div className="flex h-full min-h-0 flex-col gap-2">
                  <div className="flex shrink-0 items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-ink">
                      <input
                        type="checkbox"
                        className="h-3 w-3 accent-brand"
                        checked={tumSorulariDahilEt}
                        onChange={(e) => setTumSorulariDahilEt(e.target.checked)}
                      />
                      Bütün soruları dahil et
                    </label>
                    <button
                      type="button"
                      onClick={() => void copyDebugJson()}
                      disabled={!debugJsonString}
                      className="btn-secondary shrink-0 px-2.5 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {kopyalandi ? "✓ Kopyalandı" : "Kopyala"}
                    </button>
                  </div>
                  <pre className="min-h-0 flex-1 overflow-auto scrollbar-thin rounded-md border border-hairline-soft bg-surface-soft p-2 font-mono text-[11px] leading-relaxed text-ink">
                    {debugJsonString || "Henüz soru sorulmadı."}
                  </pre>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function RubrikSatir({ baslik, items }: { baslik: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {baslik}
      </div>
      {items.length === 0 ? (
        <p className="text-muted">—</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {items.map((it, i) => (
            <li
              key={`${it}-${i}`}
              className="rounded-full border border-hairline bg-surface-soft px-2 py-0.5 text-[11px] text-ink"
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
