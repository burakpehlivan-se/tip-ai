"use client";

import { useCallback, useEffect, useState } from "react";

type Readiness = {
  status: "ok" | "not_ready";
  auth: {
    store: "json" | "postgres" | "invalid";
    migration: "not_required" | "not_checked" | Record<string, boolean>;
  };
  attempts?: { store: "json" | "postgres"; runtime: "ready" | "not_ready" };
  rateLimit?: { store: "memory" | "postgres" | "invalid"; runtime: "ready" | "not_ready" };
};

type Diagnostics = {
  generatedAt: string;
  readiness: Readiness;
  runtime: { node: string; uptimeSeconds: number };
  stores: {
    auth: "json" | "postgres" | "invalid";
    attempts: "json" | "postgres" | "invalid";
    rateLimit: "memory" | "postgres" | "invalid";
  };
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sn`;
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)} dk`;
  return `${Math.floor(seconds / 3600)} sa ${Math.floor((seconds % 3600) / 60)} dk`;
}

function statusClass(ok: boolean) {
  return ok ? "badge-brand" : "badge-orange";
}

export default function AdminDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/diagnostics", { cache: "no-store" });
      const body = await response.json() as Diagnostics | { error?: string };
      if (!response.ok) throw new Error("error" in body ? body.error : "Sistem tanısı yüklenemedi.");
      setDiagnostics(body as Diagnostics);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sistem tanısı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checks = diagnostics && typeof diagnostics.readiness.auth.migration === "object"
    ? Object.entries(diagnostics.readiness.auth.migration)
    : [];
  const isReady = diagnostics?.readiness.status === "ok";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sistem tanısı</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-steel">
            Yayın öncesi hazır oluş, migration ve çalışma zamanı deposu özetini güvenli biçimde gösterir.
            Bağlantı bilgileri, tokenlar ve kullanıcı verileri bu ekranda yer almaz.
          </p>
        </div>
        <button type="button" className="btn-secondary min-h-11 px-4 text-sm" onClick={() => void load()} disabled={loading}>
          {loading ? "Yenileniyor…" : "Durumu yenile"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-clinical-red/25 bg-clinical-red/5 px-4 py-3 text-sm text-clinical-red">
          {error}
        </p>
      )}

      {diagnostics && (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="system-summary-title">
            <h2 id="system-summary-title" className="sr-only">Sistem özeti</h2>
            <article className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Hazır oluş</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`badge ${statusClass(isReady)}`}>{isReady ? "Hazır" : "İnceleme gerekli"}</span>
              </div>
              <p className="mt-3 text-sm text-steel">Trafiğe kabul için bağımlılık ve yapılandırma kontrolü.</p>
            </article>
            <article className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Çalışma süresi</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{formatDuration(diagnostics.runtime.uptimeSeconds)}</p>
              <p className="mt-3 text-sm text-steel">Node {diagnostics.runtime.node}</p>
            </article>
            <article className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Son ölçüm</p>
              <p className="mt-3 text-lg font-semibold text-ink">{new Date(diagnostics.generatedAt).toLocaleTimeString("tr-TR")}</p>
              <p className="mt-3 text-sm text-steel">Bu ekran açıldığında veya yenilendiğinde ölçülür.</p>
            </article>
          </section>

          <section className="mt-8 rounded-xl border border-hairline bg-canvas" aria-labelledby="store-status-title">
            <div className="border-b border-hairline px-4 py-3 sm:px-5">
              <h2 id="store-status-title" className="text-base font-semibold text-ink">Çalışma zamanı depoları</h2>
              <p className="mt-1 text-sm text-steel">Seçili doğruluk kaynakları ve hazır oluş durumu.</p>
            </div>
            <dl className="grid divide-y divide-hairline-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Kimlik</dt>
                <dd className="mt-2 text-sm font-medium text-ink">{diagnostics.stores.auth}</dd>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Öğrenci denemeleri</dt>
                <dd className="mt-2 text-sm font-medium text-ink">{diagnostics.stores.attempts}</dd>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Rate limit</dt>
                <dd className="mt-2 text-sm font-medium text-ink">{diagnostics.stores.rateLimit}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-8 rounded-xl border border-hairline bg-canvas" aria-labelledby="migration-checks-title">
            <div className="border-b border-hairline px-4 py-3 sm:px-5">
              <h2 id="migration-checks-title" className="text-base font-semibold text-ink">Migration ve bağımlılık kontrolleri</h2>
              <p className="mt-1 text-sm text-steel">Ayrıntılar yalnızca yetkili adminlere gösterilir.</p>
            </div>
            {checks.length > 0 ? (
              <ul className="divide-y divide-hairline-soft" aria-label="Migration kontrolleri">
                {checks.map(([name, passed]) => (
                  <li key={name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="text-sm text-ink">{name}</span>
                    <span className={`badge ${statusClass(passed)}`}>{passed ? "Geçti" : "Eksik"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-5 text-sm text-steel sm:px-5">
                {diagnostics.readiness.auth.migration === "not_required"
                  ? "Seçili JSON kimlik deposu için PostgreSQL migration kontrolü gerekmez."
                  : "Migration kontrolü şu anda doğrulanamadı."}
              </p>
            )}
          </section>
        </>
      )}

      {!diagnostics && loading && <p role="status" className="mt-8 text-sm text-steel">Sistem tanısı yükleniyor…</p>}
    </div>
  );
}
