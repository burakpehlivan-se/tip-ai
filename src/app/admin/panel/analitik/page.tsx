"use client";

import { useEffect, useState } from "react";

export default function AdminAnalitikPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-sm text-steel">Yükleniyor…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Analitik</h1>
      <p className="mt-1 text-sm text-steel">
        Oyun oturumları, vaka performansı ve feedback özeti (admin debug + kayıtlı session’lar).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Oturum", value: data.totalSessions },
          { label: "Vaka", value: data.caseCount },
          { label: "Aktif vaka", value: data.activeCount },
          { label: "Feedback", value: data.feedbackCount },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-hairline bg-canvas p-4">
            <div className="text-xs uppercase text-muted">{c.label}</div>
            <div className="text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-ink">Vaka bazında</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-canvas">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-surface-soft text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Vaka</th>
              <th className="px-3 py-2">n</th>
              <th className="px-3 py-2">Ort. %</th>
              <th className="px-3 py-2">Tanı %</th>
              <th className="px-3 py-2">Sık atlanan red flag</th>
              <th className="px-3 py-2">Sık gereksiz test</th>
            </tr>
          </thead>
          <tbody>
            {(data.caseStats || []).map(
              (r: any) => (
                <tr key={r.caseId} className="border-b border-hairline-soft">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{r.ad}</div>
                    <div className="text-[11px] text-muted">{r.caseId}</div>
                  </td>
                  <td className="px-3 py-2">{r.n}</td>
                  <td className="px-3 py-2">{r.avgPuan}%</td>
                  <td className="px-3 py-2">{r.taniDogruOran}%</td>
                  <td className="px-3 py-2 text-xs">
                    {(r.topRedFlags || []).map((x: { etiket: string; n: number }) => (
                      <div key={x.etiket}>
                        {x.etiket} ({x.n})
                      </div>
                    ))}
                    {!r.topRedFlags?.length && "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(r.topGereksiz || []).map((x: { etiket: string; n: number }) => (
                      <div key={x.etiket}>
                        {x.etiket} ({x.n})
                      </div>
                    ))}
                    {!r.topGereksiz?.length && "—"}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        {!(data.caseStats || []).length && (
          <p className="p-4 text-sm text-muted">
            Henüz oturum yok. Admin’den vaka oynayıp tamamlayınca burada görünür.
          </p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-ink">Poliklinik bazında</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data.poliStats || []).map(
          (p: any) => (
            <div key={p.poliklinikKey} className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="font-medium text-ink">{p.poliklinikKey}</div>
              <div className="text-sm text-steel">
                {p.n} oturum · ort. {p.avgPuan}%
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
