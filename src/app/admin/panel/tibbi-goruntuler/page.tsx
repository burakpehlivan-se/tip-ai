"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface RadiologyItem {
  caseId: string;
  imageIndex: string;
  findingLabel: string;
  source: string;
  imageAvailable: boolean;
  vaka: {
    hastalikAdi: string;
    hastalikKey: string;
    poliklinikAd: string;
    poliklinikKey: string;
    seviye: string;
    anaSikayet: string;
    cinsiyetTercih: string;
    yasAraligi: unknown[];
    komorbiditeler: unknown[];
    conditions: string[];
  };
}

interface RadiologyResponse {
  items: RadiologyItem[];
  summary: {
    total: number;
    imageAvailable: number;
    labels: Record<string, number>;
    poliklinikler: Record<string, number>;
  };
}

export default function AdminTibbiGoruntulerPage() {
  const [data, setData] = useState<RadiologyResponse | null>(null);
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("all");
  const [poliklinik, setPoliklinik] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/admin/radiology-sources")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tıbbi görüntüler yüklenemedi.");
        if (!cancelled) setData(body as RadiologyResponse);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Tıbbi görüntüler yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    return (data?.items || []).filter((item) => {
      const matchesLabel = label === "all" || item.findingLabel === label;
      const matchesPoliklinik = poliklinik === "all" || (item.vaka.poliklinikAd || item.vaka.poliklinikKey) === poliklinik;
      const haystack = [item.caseId, item.imageIndex, item.findingLabel, item.vaka.hastalikAdi, item.vaka.hastalikKey, item.vaka.poliklinikAd]
        .join(" ")
        .toLocaleLowerCase("tr");
      return matchesLabel && matchesPoliklinik && (!normalized || haystack.includes(normalized));
    });
  }, [data, label, poliklinik, query]);

  const hasRecords = Boolean(data && data.items.length > 0);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Tıbbi Görüntüler</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-steel">
            Vakalara yaş, cinsiyet ve bulgu etiketiyle eşleştirilen NIH ChestX-ray14 görüntülerini yönetin ve vaka bağlamını inceleyin.
          </p>
        </div>
        <Link href="/admin/panel/ayarlar" className="btn-secondary text-sm">Kaynak Ayarları</Link>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-clinical-red/30 bg-clinical-red/5 px-5 py-4">
          <div className="text-sm font-semibold text-clinical-red">Görüntü kayıtları yüklenemedi</div>
          <p className="mt-1 text-sm text-steel">
            Sunucudaki tıbbi görüntü volume'üne erişilemiyor. Bu durum genellikle şu sebeplerden kaynaklanır:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-steel">
            <li>Dosya yolu hatalı (config: <code className="font-mono">/data/images</code>)</li>
            <li>Volume mount edilmemiş</li>
            <li>İzin sorunu</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={load}>Tekrar Dene</button>
            <Link href="/admin/panel/ayarlar" className="btn-secondary text-xs">Ayarları Kontrol Et</Link>
          </div>
        </div>
      )}

      <section aria-label="Görüntüleme özeti" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Eşleşmiş vaka" value={loading ? "—" : data?.summary.total ?? 0} hint="Radyoloji kaynağı bulunan vaka" />
        <SummaryCard label="Dosyası hazır" value={loading ? "—" : data?.summary.imageAvailable ?? 0} hint="Sunucu volume'ünde bulunan PNG" accent="brand" />
        <SummaryCard label="Bulgu etiketi" value={loading ? "—" : Object.keys(data?.summary.labels || {}).length} hint="Benzersiz ChestX-ray etiketi" />
      </section>

      {!loading && !error && hasRecords && (
        <section className="rounded-xl border border-hairline bg-canvas p-4 sm:p-5" aria-labelledby="goruntu-filtre-baslik">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="goruntu-arama" className="mb-1 block text-xs font-medium text-muted">Vaka veya görüntü ara</label>
              <input id="goruntu-arama" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pneumonia, vaka adı, dosya…" />
            </div>
            <div className="min-w-48">
              <label htmlFor="goruntu-label" className="mb-1 block text-xs font-medium text-muted">Bulgu etiketi</label>
              <select id="goruntu-label" className="input" value={label} onChange={(event) => setLabel(event.target.value)}>
                <option value="all">Tüm etiketler</option>
                {Object.keys(data?.summary.labels || {}).sort((a, b) => a.localeCompare(b, "tr")).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="min-w-52">
              <label htmlFor="goruntu-poliklinik" className="mb-1 block text-xs font-medium text-muted">Poliklinik</label>
              <select id="goruntu-poliklinik" className="input" value={poliklinik} onChange={(event) => setPoliklinik(event.target.value)}>
                <option value="all">Tüm poliklinikler</option>
                {Object.keys(data?.summary.poliklinikler || {}).sort((a, b) => a.localeCompare(b, "tr")).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <p id="goruntu-filtre-baslik" className="mt-3 text-xs text-muted" aria-live="polite">{`${filtered.length} görüntü kaydı gösteriliyor.`}</p>
        </section>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-72 animate-pulse rounded-xl bg-surface" />)}
        </div>
      ) : error ? null : !hasRecords ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface-soft px-4 py-12 text-center">
          <div className="text-4xl">🖼️</div>
          <h2 className="mt-3 text-lg font-semibold text-ink">Henüz görüntü kaynağı bağlı değil</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-steel">
            Vakalarınıza radyolojik görüntü ve EKG eklemek için önce kaynak ayarlarını yapılandırın. NIH ChestX-ray14 gibi bir dış kaynak bağlandığında eşleşen görüntüler burada listelenir.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/admin/panel/ayarlar" className="btn-accent text-sm">⚙️ Kaynak Ayarlarını Yapılandır</Link>
          </div>
          <p className="mt-4 text-xs text-muted">Görüntü yükleme rehberi için <Link href="/admin/panel/ayarlar" className="underline">yardım</Link> bölümüne bakın.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface-soft px-4 py-10 text-center text-sm text-steel">Filtrelerle eşleşen görüntü kaydı bulunamadı.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => <RadiologyCard key={item.caseId} item={item} />)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint, accent = "ink" }: { label: string; value: number | string; hint: string; accent?: "ink" | "brand" }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${accent === "brand" ? "text-brand-deep" : "text-ink"}`}>{value}</div>
      <p className="mt-1 text-xs text-steel">{hint}</p>
    </div>
  );
}

function RadiologyCard({ item }: { item: RadiologyItem }) {
  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-canvas">
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,13rem)_1fr] sm:p-5">
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface-soft">
          {item.imageAvailable ? (
            <>
              {/* Dinamik admin endpoint'i görüntüyü vaka yetkisiyle servis eder. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/cases/${encodeURIComponent(item.caseId)}/radiology-image`} alt={`${item.vaka.hastalikAdi} — ${item.findingLabel}`} className="aspect-square w-full object-contain" loading="lazy" />
            </>
          ) : <div className="flex aspect-square items-center justify-center px-4 text-center text-xs text-clinical-orange">Görüntü dosyası volume'de yok</div>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="badge badge-brand">{item.findingLabel}</span>
              <h2 className="mt-2 text-lg font-semibold text-ink">{item.vaka.hastalikAdi}</h2>
              <p className="text-xs text-muted">{item.vaka.poliklinikAd} · {item.vaka.seviye || "—"}</p>
            </div>
            <span className={`badge ${item.imageAvailable ? "badge-brand" : "badge-orange"}`}>{item.imageAvailable ? "Dosya hazır" : "Dosya eksik"}</span>
          </div>
          <dl className="mt-4 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <div><dt className="text-muted">Görüntü</dt><dd className="mt-0.5 break-all font-mono text-ink">{item.imageIndex}</dd></div>
            <div><dt className="text-muted">Kaynak</dt><dd className="mt-0.5 text-ink">{item.source}</dd></div>
            <div><dt className="text-muted">Vaka anahtarı</dt><dd className="mt-0.5 break-all font-mono text-ink">{item.vaka.hastalikKey || "—"}</dd></div>
            <div><dt className="text-muted">Yaş / cinsiyet</dt><dd className="mt-0.5 text-ink">{item.vaka.yasAraligi.join("–")} · {item.vaka.cinsiyetTercih || "—"}</dd></div>
          </dl>
          {item.vaka.anaSikayet && <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-sm text-steel">{item.vaka.anaSikayet}</p>}
          {item.vaka.conditions.length > 0 && <p className="mt-3 text-xs text-muted">Tanılar: <span className="text-steel">{item.vaka.conditions.join(", ")}</span></p>}
          <Link href={`/admin/panel/vakalar/${encodeURIComponent(item.caseId)}`} className="btn-secondary mt-4 inline-flex text-xs">Vaka detayını aç</Link>
        </div>
      </div>
    </article>
  );
}
