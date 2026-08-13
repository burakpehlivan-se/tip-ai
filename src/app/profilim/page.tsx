"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentProgress } from "@/lib/student/progress";
import { StudentPerformanceInsights } from "@/lib/student/performance-insights";
import type { NextCaseRecommendation } from "@/lib/student/next-case-recommendation";

type MeInfo = { username: string; displayName: string };
type StudentAssignment = {
  id: string;
  cohortName: string;
  caseId: string;
  title: string | null;
  instructions: string | null;
  dueAt: number | null;
};
type ManagedSession = {
  id: string;
  role: "admin" | "doktor" | "ogrenci";
  deviceLabel: string;
  issuedAt: number;
  lastSeenAt: number;
  expiresAt: number;
  current: boolean;
};

async function fetchJsonIfOk<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  if (response.ok) return new Error(fallback);
  const body = await response.json().catch(() => null);
  return new Error(body?.error || fallback);
}

export default function ProfilimPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [insights, setInsights] = useState<StudentPerformanceInsights | null>(null);
  const [recommendation, setRecommendation] = useState<NextCaseRecommendation | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [assignmentsAvailable, setAssignmentsAvailable] = useState(false);
  const [sessions, setSessions] = useState<ManagedSession[]>([]);
  const [sessionsAvailable, setSessionsAvailable] = useState(false);
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
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
            fetchJsonIfOk<{ progress?: StudentProgress }>("/api/student/progress"),
            fetchJsonIfOk<{ insights?: StudentPerformanceInsights }>("/api/student/performance"),
            fetchJsonIfOk<{ recommendation?: NextCaseRecommendation }>("/api/student/next-case"),
            fetchJsonIfOk<{ available?: boolean; assignments?: StudentAssignment[] }>("/api/student/assignments"),
            fetchJsonIfOk<{ available?: boolean; sessions?: ManagedSession[] }>("/api/sessions"),
          ]);
        }
        return null;
      })
      .then((data) => {
        if (!data) return;
        if (data[0]?.progress) setProgress(data[0].progress);
        if (data[1]?.insights) setInsights(data[1].insights);
        if (data[2]?.recommendation) setRecommendation(data[2].recommendation);
        if (data[3]?.available) {
          setAssignmentsAvailable(true);
          setAssignments(data[3].assignments || []);
        }
        if (data[4]?.available) {
          setSessionsAvailable(true);
          setSessions(data[4].sessions || []);
        }
      })
      .catch(() => setHata("İlerleme yüklenemedi."));
  }, [router]);

  async function cikisYap() {
    await fetch("/api/session/logout", { method: "POST" });
    router.replace("/");
  }

  async function closeSession(id: string, current: boolean) {
    if (!confirm(current ? "Bu cihazdan çıkış yapmak istiyor musunuz?" : "Bu cihazdaki oturumu kapatmak istiyor musunuz?")) return;
    setSessionBusy(id);
    setSessionMessage("");
    try {
      const response = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) throw await responseError(response, "Oturum kapatılamadı.");
      if (current) {
        router.replace("/giris");
        return;
      }
      setSessions((items) => items.filter((session) => session.id !== id));
      setSessionMessage("Cihaz oturumu kapatıldı.");
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "Oturum kapatılamadı.");
    } finally {
      setSessionBusy(null);
    }
  }

  async function closeAllSessions() {
    if (!confirm("Tüm cihazlardaki oturumlar kapatılacak. Devam etmek istiyor musunuz?")) return;
    setSessionBusy("all");
    setSessionMessage("");
    try {
      const response = await fetch("/api/sessions", { method: "POST" });
      if (!response.ok) throw await responseError(response, "Oturumlar kapatılamadı.");
      router.replace("/giris");
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "Oturumlar kapatılamadı.");
    } finally {
      setSessionBusy(null);
    }
  }

  async function downloadPersonalData() {
    setExportBusy(true);
    setExportMessage("");
    try {
      const response = await fetch("/api/student/data-export", { cache: "no-store" });
      if (!response.ok) throw await responseError(response, "Veri kopyası hazırlanamadı.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tip-ai-kisisel-veri.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      setExportMessage("Kişisel öğrenme verileriniz indirildi.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Veri kopyası hazırlanamadı.");
    } finally {
      setExportBusy(false);
    }
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

        {sessionsAvailable && (
          <section className="mb-10" aria-labelledby="aktif-oturumlar">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="aktif-oturumlar" className="text-xl font-semibold text-ink">Aktif Oturumlar</h2>
                <p className="mt-1 text-sm text-steel">
                  Yalnızca cihaz türü ve son etkinlik zamanı gösterilir; tarayıcı ayrıntısı saklanmaz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void closeAllSessions()}
                disabled={sessionBusy !== null || sessions.length === 0}
                className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tüm cihazlardan çıkış
              </button>
            </div>

            {sessionMessage && (
              <p
                className={`mb-3 text-sm ${sessionMessage.includes("kapatıldı") ? "text-brand-deep" : "text-clinical-red"}`}
                role="status"
                aria-live="polite"
              >
                {sessionMessage}
              </p>
            )}

            {sessions.length === 0 ? (
              <div className="card"><p className="text-sm text-steel">Görüntülenecek aktif oturum yok.</p></div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <article key={session.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">{session.deviceLabel}</h3>
                        {session.current && <span className="badge badge-brand">Bu cihaz</span>}
                      </div>
                      <p className="mt-1 text-sm text-steel">
                        Son etkinlik: {new Date(session.lastSeenAt).toLocaleString("tr-TR")}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Oturum bitişi: {new Date(session.expiresAt).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void closeSession(session.id, session.current)}
                      disabled={sessionBusy !== null}
                      className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sessionBusy === session.id ? "Kapatılıyor…" : session.current ? "Bu cihazdan çıkış" : "Oturumu kapat"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mb-10" aria-labelledby="veri-ve-gizlilik">
          <div className="card border-hairline">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2 id="veri-ve-gizlilik" className="text-xl font-semibold text-ink">Veri ve gizlilik</h2>
                <p className="mt-2 text-sm leading-6 text-steel">
                  Profiliniz ve tamamlanmış vaka sonuçlarınızın size ait kopyasını indirebilirsiniz. Parola, oturum bilgileri,
                  tam vaka/rubrik içeriği ve aktif serbest metin taslakları bu dosyaya eklenmez.
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Bu indirme yalnızca kişisel veri kopyası içindir; hesap veya eğitim kaydı silme işlemi başlatmaz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void downloadPersonalData()}
                disabled={exportBusy}
                className="btn-secondary shrink-0 justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportBusy ? "Hazırlanıyor…" : "Verilerimin kopyasını indir"}
              </button>
            </div>
            {exportMessage && (
              <p
                role="status"
                aria-live="polite"
                className={`mt-4 text-sm ${exportMessage.includes("indirildi") ? "text-brand-deep" : "text-clinical-red"}`}
              >
                {exportMessage}
              </p>
            )}
          </div>
        </section>

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
              {insights && insights.overall.confidenceCalibration.averageGap !== null && (
                <div className="card">
                  <div className="text-3xl font-semibold text-ink">%{insights.overall.confidenceCalibration.averageGap}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                    Tanı kalibrasyon farkı
                  </div>
                  <p className="mt-2 text-xs leading-5 text-steel">Güvenin ile sonucun arasındaki ortalama fark; düşük olması hedeflenir.</p>
                </div>
              )}
            </div>

            {recommendation && (
              <section className="mb-10" aria-labelledby="sonraki-vaka-onerisi">
                <div className="card border-brand/30">
                  <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
                    <div className="max-w-2xl">
                      <span className="badge badge-brand">Önerilen çalışma</span>
                      <h2 id="sonraki-vaka-onerisi" className="mt-3 text-xl font-semibold text-ink">
                        {recommendation.poliklinikAd} odağında bir sonraki vaka
                      </h2>
                      <p className="mt-2 text-sm text-steel">{recommendation.reason}</p>
                      <p className="mt-3 text-xs text-muted">
                        Bu bir öneridir; dilersen başka bir poliklinik veya vaka seçebilirsin.
                      </p>
                    </div>
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-48">
                      <Link href={`/poliklinik/${recommendation.poliklinikKey}`} className="btn-primary justify-center">
                        Önerilen alanda başla
                      </Link>
                      <Link href="/vakalar" className="btn-secondary justify-center text-center">
                        Tüm vakaları gör
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {assignmentsAvailable && (
              <section className="mb-10" aria-labelledby="atanan-vakalar">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h2 id="atanan-vakalar" className="text-xl font-semibold text-ink">Atanan Vakalar</h2>
                    <p className="mt-1 text-sm text-steel">Eğitmeninizin grubunuz için belirlediği çalışmalar.</p>
                  </div>
                  <span className="badge badge-steel">{assignments.length}</span>
                </div>
                {assignments.length === 0 ? (
                  <div className="card">
                    <p className="text-sm text-steel">Şu an size atanmış bir vaka yok.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <article key={assignment.id} className="card flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">{assignment.cohortName}</p>
                          <h3 className="mt-1 text-lg font-semibold text-ink">{assignment.title || assignment.caseId}</h3>
                          {assignment.instructions && <p className="mt-2 text-sm text-steel">{assignment.instructions}</p>}
                          {assignment.dueAt && (
                            <p className="mt-2 text-xs text-muted">
                              Son tarih: {new Date(assignment.dueAt).toLocaleDateString("tr-TR")}
                            </p>
                          )}
                        </div>
                        <Link href={`/atamalar/${assignment.id}`} className="btn-primary shrink-0 justify-center">
                          Vakayı aç
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

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
