"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

interface HastaTipiLite {
  id: string;
  ad: string;
  aciklama?: string;
  yasAraligi: [number, number];
  cinsiyetTercih: string;
  komorbiditeler: string[];
  kisilikTipi?: string;
  ornekCevaplar?: Record<string, string>;
}

export default function AdminHastaTipleriPage() {
  const [tipler, setTipler] = useState<HastaTipiLite[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [ad, setAd] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const response = await fetch("/api/admin/hasta-tipleri");
      const data = (await response.json()) as { tipler?: HastaTipiLite[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Hasta tipleri yüklenemedi.");
      setTipler(Array.isArray(data.tipler) ? data.tipler : []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Hasta tipleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/hasta-tipleri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Oluşturulamadı");
        return;
      }
      setMsg(`Hasta tipi eklendi: ${d.tip.ad}`);
      setAd("");
      setShowNew(false);
      load();
    } catch {
      setErr("Oluşturma başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Hasta Tipleri</h1>
          <p className="mt-1 text-sm text-muted">
            Yeniden kullanılabilir hasta şablonları — vaka oluştururken uygulanabilir.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Vazgeç" : "+ Yeni hasta tipi"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="rounded-xl border border-hairline bg-canvas p-5 space-y-3">
          <div>
            <label htmlFor="hasta-tipi-ad" className="text-xs text-muted">Tip adı</label>
            <input
              id="hasta-tipi-ad"
              className="input w-full"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Örn. Diyabetik Kadın"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary text-sm" disabled={busy || !ad.trim()}>
              {busy ? "Ekleniyor…" : "Ekle ve düzenle"}
            </button>
            <p className="text-xs text-steel">Diğer alanlar (yaş, cinsiyet, kişilik, AI) bir sonraki ekranda girilir.</p>
          </div>
        </form>
      )}

      {msg && <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{msg}</div>}
      {err && <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">{err}</div>}

      {loading ? (
        <p role="status" className="text-sm text-steel">Hasta tipleri yükleniyor…</p>
      ) : tipler.length === 0 && !err ? (
        <p className="text-sm text-steel">Henüz hasta tipi yok.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tipler.map((t) => (
            <Link
              key={t.id}
              href={`/admin/panel/hasta-tipleri/${encodeURIComponent(t.id)}`}
              className="rounded-xl border border-hairline bg-canvas p-4 hover:border-brand/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{t.ad}</h2>
                <span className="text-[11px] text-steel">
                  {t.yasAraligi?.[0]}–{t.yasAraligi?.[1]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {t.cinsiyetTercih === "E" ? "Erkek" : t.cinsiyetTercih === "K" ? "Kadın" : "Herhangi"}
                {t.kisilikTipi ? ` · ${t.kisilikTipi}` : ""}
              </p>
              {t.komorbiditeler?.length ? (
                <p className="mt-1 truncate text-xs text-steel">{t.komorbiditeler.join(", ")}</p>
              ) : null}
              {t.ornekCevaplar && Object.keys(t.ornekCevaplar).length > 0 ? (
                <span className="mt-2 inline-block rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-deep">
                  AI cevapları hazır
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
