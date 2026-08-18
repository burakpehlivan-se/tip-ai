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
  cases?: {
    store: "json" | "postgres";
    runtime: "ready" | "not_ready";
    migration: "not_required" | Record<string, boolean>;
    shadowRead: boolean;
  };
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
  ai: { configured: boolean; model: string };
};

const AUTH_MIGRATION_LABELS: Record<string, string> = {
  migrationJournal: "Migration defteri",
  migrationApplied: "Gerekli migration sayısı uygulandı",
  usersTable: "Kullanıcılar tablosu (users)",
  auditTable: "Denetim kayıtları tablosu (auth_audit_logs)",
  sessionsTable: "Oturumlar tablosu (auth_sessions)",
  learningAttemptsTable: "Öğrenme denemeleri tablosu (learning_attempts)",
  cohortsTable: "Gruplar tablosu (cohorts)",
  cohortMembershipsTable: "Grup üyelikleri tablosu (cohort_memberships)",
  cohortAssignmentsTable: "Grup vaka atamaları tablosu (cohort_case_assignments)",
  rateLimitBucketsTable: "Hız sınırı kovaları tablosu (rate_limit_buckets)",
};

const CASE_MIGRATION_LABELS: Record<string, string> = {
  migrationJournal: "Migration defteri",
  migrationApplied: "Gerekli migration sayısı uygulandı",
  casesTable: "Vakalar tablosu (clinical_cases)",
  publishedVersionsTable: "Yayınlanan vaka sürümleri tablosu (published_clinical_case_versions)",
  auditLogTable: "Vaka denetim kayıtları tablosu (clinical_case_audit_logs)",
};

const STORE_LABELS: Record<string, string> = {
  json: "JSON",
  postgres: "PostgreSQL",
  memory: "Bellek",
  invalid: "Geçersiz",
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sn`;
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)} dk`;
  return `${Math.floor(seconds / 3600)} sa ${Math.floor((seconds % 3600) / 60)} dk`;
}

function formatRelative(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "az önce";
  if (seconds < 60) return `${seconds} sn önce`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`;
  return `${Math.floor(seconds / 3600)} sa önce`;
}

function statusBadge(ok: boolean) {
  return ok ? "badge-brand" : "badge-orange";
}

function SkeletonCard() {
  return (
    <article className="card animate-pulse">
      <div className="h-3 w-24 rounded bg-surface" />
      <div className="mt-4 h-7 w-20 rounded bg-surface" />
      <div className="mt-4 h-3 w-40 rounded bg-surface" />
    </article>
  );
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

  const isReady = diagnostics?.readiness.status === "ok";
  const readiness = diagnostics?.readiness;

  const authChecks =
    readiness && typeof readiness.auth.migration === "object"
      ? Object.entries(readiness.auth.migration)
      : [];
  const caseChecks =
    readiness?.cases && typeof readiness.cases.migration === "object"
      ? Object.entries(readiness.cases.migration)
      : [];
  const checks = [...authChecks, ...caseChecks];
  const passedChecks = checks.filter(([, passed]) => passed).length;
  const hasChecks = checks.length > 0;

  const depots: { key: string; label: string; mode: string; detail: string }[] = [];
  if (readiness) {
    depots.push(
      {
        key: "auth",
        label: "Kimlik deposu",
        mode: STORE_LABELS[readiness.auth.store] ?? readiness.auth.store,
        detail: readiness.auth.store === "json" ? "Harici bağımlılık yok" : "Migration'lar izleniyor",
      },
      {
        key: "attempts",
        label: "Öğrenci denemeleri",
        mode: STORE_LABELS[readiness.attempts?.store ?? "invalid"] ?? "—",
        detail: readiness.attempts?.runtime === "ready" ? "Çalışıyor" : "Kullanılamıyor",
      },
      {
        key: "rateLimit",
        label: "Hız sınırı",
        mode: STORE_LABELS[readiness.rateLimit?.store ?? "invalid"] ?? "—",
        detail: readiness.rateLimit?.runtime === "ready" ? "Çalışıyor" : "Kullanılamıyor",
      }
    );
    if (readiness.cases) {
      depots.push(
        {
          key: "cases",
          label: "Vaka deposu",
          mode: STORE_LABELS[readiness.cases.store] ?? readiness.cases.store,
          detail:
            readiness.cases.runtime === "ready"
              ? readiness.cases.shadowRead
                ? "Parity (gölge) okuması açık"
                : "Çalışıyor"
              : "Kullanılamıyor",
        },
        {
          key: "ai",
          label: "AI servisi",
          mode: diagnostics.ai.configured ? diagnostics.ai.model : "Yapılandırılmamış",
          detail: diagnostics.ai.configured ? "Çalışmaya hazır" : "DEEPSEEK_API_KEY tanımlı değil",
        }
      );
    }
  }

  const renderMigrationGroup = (title: string, group: [string, boolean][]) => (
    <div>
      <h3 className="px-4 pt-4 text-sm font-semibold text-ink sm:px-5">{title}</h3>
      <ul className="divide-y divide-hairline-soft" aria-label={title}>
        {group.map(([name, passed]) => (
          <li key={name} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <span className="flex items-center gap-2 text-sm text-ink">
              <span aria-hidden className={passed ? "text-brand-deep" : "text-clinical-orange"}>
                {passed ? "✓" : "⏳"}
              </span>
              {AUTH_MIGRATION_LABELS[name] ?? CASE_MIGRATION_LABELS[name] ?? name}
            </span>
            <span className={`badge ${statusBadge(passed)}`}>{passed ? "Uygulandı" : "Bekliyor"}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sistem tanısı</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-steel">
            Uygulamanın hazır olup olmadığını ve bağımlılıklarının durumunu tek ekranda gösterir.
            Bağlantı bilgileri ve kullanıcı verileri burada yer almaz.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {diagnostics && (
            <span className="text-xs text-muted">Son ölçüm: {formatRelative(diagnostics.generatedAt)}</span>
          )}
          <button type="button" className="btn-secondary min-h-11 px-4 text-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Yenileniyor…" : "Şimdi yenile"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-clinical-red/25 bg-clinical-red/5 px-4 py-4">
          <p className="text-sm font-medium text-clinical-red">Sistem tanısı yüklenemedi</p>
          <p className="mt-1 text-sm text-steel">{error}</p>
          <button type="button" className="btn-secondary mt-3 min-h-10 px-4 text-sm" onClick={() => void load()}>
            Tekrar dene
          </button>
        </div>
      )}

      {loading && !diagnostics && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Sistem tanısı yükleniyor">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </section>
      )}

      {diagnostics && (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="system-summary-title">
            <h2 id="system-summary-title" className="sr-only">Sistem sağlığı özeti</h2>
            <article className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Sistem sağlığı</p>
              <div className="mt-3 flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 rounded-full ${isReady ? "bg-brand-deep" : "bg-clinical-orange"}`}
                />
                <span className={`badge ${statusBadge(isReady)}`}>
                  {isReady ? "Tümü çalışıyor" : "İnceleme gerekli"}
                </span>
              </div>
              <p className="mt-3 text-sm text-steel">
                {hasChecks
                  ? `${passedChecks}/${checks.length} kontrol geçti.`
                  : isReady
                    ? "Trafiğe kabul için bağımlılıklar hazır."
                    : "Bağımlılık durumu doğrulanamadı."}
              </p>
            </article>
            <article className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Çalışma süresi</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{formatDuration(diagnostics.runtime.uptimeSeconds)}</p>
              <p className="mt-3 text-sm text-steel">Node {diagnostics.runtime.node}</p>
            </article>
            <article className="card">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Son ölçüm</p>
              <p className="mt-3 text-lg font-semibold text-ink">
                {new Date(diagnostics.generatedAt).toLocaleTimeString("tr-TR")}
              </p>
              <p className="mt-3 text-sm text-steel">{formatRelative(diagnostics.generatedAt)}</p>
            </article>
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="dependency-title">
            <h2 id="dependency-title" className="sr-only">Bağımlılık durumu</h2>
            {depots.map((depot) => (
              <article key={depot.key} className="card">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{depot.label}</p>
                <p className="mt-3 truncate text-lg font-semibold text-ink" title={depot.mode}>{depot.mode}</p>
                <p className="mt-1 text-sm text-steel">{depot.detail}</p>
              </article>
            ))}
          </section>

          {hasChecks ? (
            <section className="mt-8 rounded-xl border border-hairline bg-canvas" aria-labelledby="migration-checks-title">
              <div className="border-b border-hairline px-4 py-3 sm:px-5">
                <h2 id="migration-checks-title" className="text-base font-semibold text-ink">Migration ve bağımlılık kontrolleri</h2>
                <p className="mt-1 text-sm text-steel">Ayrıntılar yalnızca yetkili adminlere gösterilir.</p>
              </div>
              {authChecks.length > 0 && renderMigrationGroup("Kimlik şeması", authChecks)}
              {caseChecks.length > 0 && renderMigrationGroup("Vaka şeması", caseChecks)}
            </section>
          ) : (
            <section className="mt-8 rounded-xl border border-hairline bg-canvas" aria-labelledby="migration-checks-title">
              <div className="border-b border-hairline px-4 py-3 sm:px-5">
                <h2 id="migration-checks-title" className="text-base font-semibold text-ink">Migration ve bağımlılık kontrolleri</h2>
                <p className="mt-1 text-sm text-steel">Ayrıntılar yalnızca yetkili adminlere gösterilir.</p>
              </div>
              <p className="px-4 py-5 text-sm text-steel sm:px-5">
                {diagnostics.readiness.auth.migration === "not_required" &&
              (!diagnostics.readiness.cases || diagnostics.readiness.cases.migration === "not_required")
                  ? "JSON kimlik ve vaka depoları için PostgreSQL migration kontrolü gerekmez."
                  : "Migration kontrolü şu anda doğrulanamadı."}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}