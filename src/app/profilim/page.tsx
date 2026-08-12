"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentProgress } from "@/lib/student/progress";
import { StudentPerformanceInsights } from "@/lib/student/performance-insights";

type MeInfo = { username: string; displayName: string };

export default function ProfilimPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [insights, setInsights] = useState<StudentPerformanceInsights | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const session = response.ok ? await response.json() : null;
        if (!session?.student) {
          router.replace(`/giris?sonraki=${encodeURIComponent("/profilim")}`);
          return null;
        }
        return session.student as MeInfo;
      })
      .then((data) => {
        if (data) {
          setMe(data);
          return Promise.all([
            fetch("/api/student/progress", { cache: "no-store" }).then((r) => r.json()),
            fetch("/api/student/performance", { cache: "no-store" }).then((r) => r.json()),
          ]);
        }
        return null;
      })
      .then((data) => {
        if (!data) return;
        if (data[0]?.progress) setProgress(data[0].progress);
        if (data[1]?.insights) setInsights(data[1].insights);
      })
      .catch(() => setHata("İlerleme yüklenemedi."));
  }, [router]);

  async function cikisYap() {
    await fetch("/api/session/logout", { method: "POST" });
    router.replace("/");
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-steel">Yükleniyor…</p>
      </div>
    );
  }

  const p = progress;
  const son = p?.son20 || [];

  return (
    <div className="min-h-screen bg-canvas">
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/vakalar" className="text-sm font-medium text-steel hover:text-ink transition-colors">
              Vakalar
            </Link>
            <button onClick={() => void cikisYap()} className="btn-secondary text-sm">
              Çıkış Yap
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pt-14 pb-24">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight text-ink" style={{ letterSpacing: "-1.5px" }}>
            {me.displayName || me.username}
          </h1>
          <p className="mt-2 text-sm text-steel">
            @{me.username} · İlerlemen her vaka bitişinde otomatik kaydedilir.
          </p>
        </div>

        {hata && <p className="text-sm text-clinical-red mb-6">{hata}</p>}

        {p && (
          <>
            {/* Özet kartlar */}
            <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="card">
                <div className="text-3xl font-semibold text-ink">{p.toplamVaka}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Tamamlanan vaka
                </div>
              </div>
              <div className="card">
                <div className="text-3xl font-semibold text-ink">%{p.ortalamaPuanYuzde}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Ortalama puan
                </div>
              </div>
              <div className="card">
                <div className="text-3xl font-semibold text-ink">%{p.taniDogruOran}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Doğru tanı oranı
                </div>
              </div>
              <div className="card">
                <div className="text-3xl font-semibold text-clinical-red">{p.toplamAtlananRedFlag}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Atlanan red flag
                </div>
              </div>
            </div>

            {insights && insights.practicePriorities.length > 0 && (
              <section className="mb-10" aria-labelledby="gelisim-oncelikleri">
                <h2 id="gelisim-oncelikleri" className="mb-4 text-xl font-semibold text-ink">Gelişim Öncelikleri</h2>
                <div className="card space-y-3">
                  <p className="text-sm text-steel">
                    Son vakalarındaki sonuçlara göre bir sonraki çalışmanda bu alanlara odaklan.
                  </p>
                  <ul className="space-y-2">
                    {insights.practicePriorities.slice(0, 3).map((priority) => (
                      <li key={`${priority.kind}-${priority.label}`} className="flex items-start gap-3 text-sm text-ink">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                        <span>{priority.guidance}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Poliklinik kırılımı */}
            {p.poliklinikler.length > 0 && (
              <div className="mb-10">
                <h2 className="mb-4 text-xl font-semibold text-ink">Poliklinik Kırılımı</h2>
                <div className="card overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hairline bg-surface/50 text-left text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-3 font-medium">Poliklinik</th>
                        <th className="px-4 py-3 font-medium">Vaka</th>
                        <th className="px-4 py-3 font-medium">Ort. Puan</th>
                        <th className="px-4 py-3 font-medium">Doğru Tanı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.poliklinikler.map((pol) => (
                        <tr key={pol.poliklinikKey} className="border-b border-hairline last:border-0">
                          <td className="px-4 py-3 font-medium text-ink">
                            <Link href={`/poliklinik/${pol.poliklinikKey}`} className="hover:text-brand transition-colors">
                              {pol.ad}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-steel">{pol.vakaSayisi}</td>
                          <td className="px-4 py-3 text-steel">%{pol.ortalamaPuanYuzde}</td>
                          <td className="px-4 py-3 text-steel">
                            {pol.taniDogruSayi}/{pol.vakaSayisi}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Son oturumlar */}
            <div>
              <h2 className="mb-4 text-xl font-semibold text-ink">Son Oturumlar</h2>
              {son.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="mb-3 text-3xl">🩺</div>
                  <p className="text-sm text-steel mb-4">Henüz vaka çözmedin.</p>
                  <Link href="/vakalar" className="btn-primary">
                    İlk Vakana Başla →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {son.map((s) => (
                    <div key={s.id} className="card flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{s.hastalikKey}</div>
                        <div className="text-xs text-steel">
                          {new Date(s.createdAt).toLocaleDateString("tr-TR")} ·{" "}
                          {s.poliklinikKey}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {s.toplamPuan}/{s.maxPuan}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.taniDogru
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-clinical-red/10 text-clinical-red"
                          }`}
                        >
                          {s.taniDogru ? "✓ Doğru tanı" : "✗ Yanlış tanı"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
