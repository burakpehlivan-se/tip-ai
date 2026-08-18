"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface CaseStat {
  caseId: string;
  ad: string;
  n: number;
  avgPuan: number;
  taniDogruOran: number;
  topRedFlags?: { etiket: string; n: number }[];
  topGereksiz?: { etiket: string; n: number }[];
}

interface PoliStat {
  poliklinikKey: string;
  n: number;
  avgPuan: number;
}

interface AnalyticsData {
  totalSessions: number;
  caseCount: number;
  activeCount: number;
  draftCount: number;
  feedbackCount: number;
  caseStats: CaseStat[];
  poliStats: PoliStat[];
  dailySeries: { gun: string; n: number }[];
  days: number | null;
}

type Donem = 7 | 30 | null;

function SkorCubugu({ deger }: { deger: number }) {
  return (
    <span className="inline-flex h-2 w-24 items-center gap-1" role="img" aria-label={`%${deger}`}>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
        <span
          className={`block h-full rounded-full ${deger >= 60 ? "bg-brand" : deger >= 30 ? "bg-clinical-orange" : "bg-clinical-red"}`}
          style={{ width: `${Math.max(2, Math.min(100, deger))}%` }}
        />
      </span>
    </span>
  );
}

function ZamanSerisiGrafik({ seri, gunSayisi }: { seri: { gun: string; n: number }[]; gunSayisi: number | null }) {
  const max = Math.max(1, ...seri.map((d) => d.n));
  const toplam = seri.reduce((a, d) => a + d.n, 0);
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={`Günlük oturum sayısı, toplam ${toplam}`}>
        {seri.map((d, i) => (
          <div
            key={d.gun}
            className="group relative flex-1 rounded-t bg-brand/50 transition-colors hover:bg-brand"
            style={{ height: `${Math.max(d.n > 0 ? 8 : 2, (d.n / max) * 100)}%` }}
            title={`${d.gun}: ${d.n} oturum`}
          >
            <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {d.gun}: {d.n}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{seri[0]?.gun}</span>
        <span>
          {gunSayisi ? `Son ${gunSayisi} gün` : "Tüm zamanlar"} · {toplam} oturum
        </span>
        <span>{seri[seri.length - 1]?.gun}</span>
      </div>
    </div>
  );
}

export default function AdminAnalitikPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [onceki, setOnceki] = useState<AnalyticsData | null>(null);
  const [donem, setDonem] = useState<Donem>(7);
  const [sortZor, setSortZor] = useState(false);

  const load = useCallback(async (d: Donem) => {
    const q = d ? `?days=${d}` : "";
    const [kur, onk] = await Promise.all([
      fetch(`/api/admin/analytics${q}`).then((r) => r.json()),
      fetch(`/api/admin/analytics?days=${d ?? 30}&offset=${d ?? 30}`).then((r) => r.json()),
    ]);
    setData(kur);
    setOnceki(onk);
  }, []);

  useEffect(() => {
    load(donem);
  }, [donem, load]);

  const trend = useMemo(() => {
    if (!data || !onceki || onceki.totalSessions === 0) return null;
    const fark = data.totalSessions - onceki.totalSessions;
    const yuzde = Math.round((fark / onceki.totalSessions) * 100);
    return { fark, yuzde };
  }, [data, onceki]);

  const metrikler = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Oturum", value: data.totalSessions, aciklama: trend ? `${trend.fark > 0 ? "↑" : trend.fark < 0 ? "↓" : "→"} önceki döneme göre %${Math.abs(trend.yuzde)}` : "önceki dönemle karşılaştırma yok" },
      { label: "Vaka", value: data.caseCount, aciklama: `${data.draftCount} taslak` },
      { label: "Aktif vaka", value: data.activeCount, aciklama: "oynanabilir vaka" },
      { label: "Feedback", value: data.feedbackCount, aciklama: "öğrenci geri bildirimi" },
    ];
  }, [data, trend]);

  const siraliCaseStats = useMemo(() => {
    if (!data?.caseStats) return [];
    const list = [...data.caseStats];
    if (sortZor) {
      list.sort((a, b) => (b.n === 0 ? -1 : a.n === 0 ? 1 : a.avgPuan / a.n - b.avgPuan / b.n));
    }
    return list;
  }, [data, sortZor]);

  if (!data) return <p className="text-sm text-steel">Yükleniyor…</p>;

  const azVeri = data.totalSessions < 5;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Analitik</h1>
          <p className="mt-1 text-sm text-steel">
            Öğrenci performansı ve vaka etkinliği (admin debug + kayıtlı oturumlar).
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-canvas p-1" role="group" aria-label="Zaman filtresi">
          {[
            { d: 7 as Donem, etiket: "Son 7 gün" },
            { d: 30 as Donem, etiket: "Son 30 gün" },
            { d: null as Donem, etiket: "Tümü" },
          ].map(({ d, etiket }) => (
            <button
              key={String(d)}
              type="button"
              onClick={() => setDonem(d)}
              aria-pressed={donem === d}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                donem === d ? "bg-surface-soft text-brand-deep" : "text-muted hover:text-ink"
              }`}
            >
              {etiket}
            </button>
          ))}
        </div>
      </div>

      {azVeri && (
        <div className="mt-4 rounded-lg border border-clinical-orange/30 bg-clinical-orange/5 px-4 py-3 text-sm text-clinical-orange">
          Analitik verileri henüz olgunlaşmadı — yalnızca {data.totalSessions} oturum var. Daha anlamlı grafikler için
          birkaç öğrenci oturumu daha tamamlanmalı.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrikler.map((c) => (
          <div key={c.label} className="rounded-xl border border-hairline bg-canvas p-4">
            <div className="text-xs uppercase text-muted">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{c.value}</div>
            <div className="mt-1 text-[11px] text-steel">{c.aciklama}</div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Zaman serisi</h2>
          <span className="text-xs text-muted">Günlük oturum sayısı</span>
        </div>
        <div className="mt-3 rounded-xl border border-hairline bg-canvas p-5">
          {data.dailySeries?.length ? (
            <ZamanSerisiGrafik seri={data.dailySeries} gunSayisi={data.days} />
          ) : (
            <p className="text-sm text-muted">Bu dönemde oturum verisi yok.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Vaka performansı</h2>
          <button
            type="button"
            onClick={() => setSortZor((v) => !v)}
            className={`btn-secondary text-xs ${sortZor ? "bg-surface-soft" : ""}`}
            aria-pressed={sortZor}
          >
            {sortZor ? "En zorlar sıralı" : "En çok oynanan sıralı"}
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-canvas">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-surface-soft text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Vaka</th>
                <th className="px-3 py-2">n</th>
                <th className="px-3 py-2">Ort. skor</th>
                <th className="px-3 py-2">Tanı doğruluğu</th>
                <th className="px-3 py-2">Sık atlanan red flag</th>
                <th className="px-3 py-2">Sık gereksiz test</th>
              </tr>
            </thead>
            <tbody>
              {siraliCaseStats.map((r) => (
                <tr key={r.caseId} className="border-b border-hairline-soft">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{r.ad}</div>
                    <div className="text-[11px] text-muted">{r.caseId}</div>
                  </td>
                  <td className="px-3 py-2">{r.n}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <SkorCubugu deger={r.avgPuan} />
                      <span className="text-xs text-steel">%{r.avgPuan}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <SkorCubugu deger={r.taniDogruOran} />
                      <span className="text-xs text-steel">%{r.taniDogruOran}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(r.topRedFlags || []).map((x) => (
                      <div key={x.etiket}>
                        ⚠️ {x.etiket} <span className="text-muted">({x.n}/{r.n})</span>
                      </div>
                    ))}
                    {!r.topRedFlags?.length && "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(r.topGereksiz || []).map((x) => (
                      <div key={x.etiket}>
                        {x.etiket} <span className="text-muted">({x.n})</span>
                      </div>
                    ))}
                    {!r.topGereksiz?.length && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!siraliCaseStats.length && (
            <p className="p-4 text-sm text-muted">
              Henüz oturum yok. Admin panelinden vaka oynayıp tamamlayınca burada görünür.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Poliklinik karşılaştırması</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data.poliStats || []).map((p) => (
            <div key={p.poliklinikKey} className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{p.poliklinikKey}</span>
                <span className="badge badge-steel shrink-0">{p.n} oturum</span>
              </div>
              {p.n > 0 ? (
                <div className="mt-2 flex items-center gap-2">
                  <SkorCubugu deger={p.avgPuan} />
                  <span className="text-xs text-steel">ort. %{p.avgPuan}</span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">Bu dönemde oturum yok.</p>
              )}
            </div>
          ))}
          {!data.poliStats?.length && (
            <p className="col-span-full rounded-xl border border-hairline bg-canvas p-4 text-sm text-muted">
              Henüz poliklinik bazında veri yok.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}