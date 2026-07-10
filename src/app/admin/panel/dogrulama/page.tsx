"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface ValidationIssue {
  code: string;
  field: string;
  message: string;
}

interface VakaResult {
  id: string;
  hastalikAdi?: string;
  poliklinikKey?: string;
  durum?: string;
  seviye?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  status: "valid" | "valid_with_warnings" | "invalid";
}

interface Report {
  generatedAt: string;
  cdmVersion: string;
  summary: {
    total: number;
    valid: number;
    validWithWarnings: number;
    invalid: number;
    errorCount: number;
    warningCount: number;
    topErrorCodes: { code: string; count: number }[];
    topWarningCodes: { code: string; count: number }[];
  };
  results: VakaResult[];
}

type Filter = "all" | "invalid" | "valid_with_warnings" | "valid";

export default function DogrulamaPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("invalid");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/cases/validate")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Rapor alınamadı");
        setReport(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!report) return [];
    let list = report.results;
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(qq) ||
          (r.hastalikAdi || "").toLowerCase().includes(qq) ||
          (r.poliklinikKey || "").toLowerCase().includes(qq)
      );
    }
    return list;
  }, [report, filter, q]);

  async function downloadText() {
    const res = await fetch("/api/admin/cases/validate?format=text");
    const text = await res.text();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tip-ai-dogrulama-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="text-sm text-steel">Doğrulama raporu üretiliyor…</p>;
  }

  if (error || !report) {
    return (
      <div>
        <p className="text-clinical-red">{error || "Rapor yok"}</p>
        <button type="button" className="btn-secondary text-sm mt-2" onClick={load}>
          Yeniden dene
        </button>
      </div>
    );
  }

  const s = report.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Vaka doğrulama raporu
          </h1>
          <p className="mt-1 text-sm text-steel">
            TIP-AI CDM v1 · zorunlu alan, lab/rubrik uyumu, vitals, klinik tutarlılık
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {report.cdmVersion} · {new Date(report.generatedAt).toLocaleString("tr-TR")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={load}>
            Yenile
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={downloadText}>
            📄 Metin rapor
          </button>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam" value={s.total} />
        <StatCard label="Geçerli" value={s.valid} tone="good" />
        <StatCard label="Uyarılı" value={s.validWithWarnings} tone="warn" />
        <StatCard label="Geçersiz" value={s.invalid} tone="bad" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-canvas p-4">
          <h2 className="text-xs font-semibold uppercase text-muted mb-2">
            En sık hatalar ({s.errorCount})
          </h2>
          {s.topErrorCodes.length === 0 ? (
            <p className="text-xs text-steel">Hata yok.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {s.topErrorCodes.map((t) => (
                <li key={t.code} className="flex justify-between gap-2">
                  <code className="text-clinical-red">{t.code}</code>
                  <span className="text-muted">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-hairline bg-canvas p-4">
          <h2 className="text-xs font-semibold uppercase text-muted mb-2">
            En sık uyarılar ({s.warningCount})
          </h2>
          {s.topWarningCodes.length === 0 ? (
            <p className="text-xs text-steel">Uyarı yok.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {s.topWarningCodes.map((t) => (
                <li key={t.code} className="flex justify-between gap-2">
                  <code className="text-clinical-orange">{t.code}</code>
                  <span className="text-muted">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "invalid" as const, label: `Geçersiz (${s.invalid})` },
            {
              id: "valid_with_warnings" as const,
              label: `Uyarılı (${s.validWithWarnings})`,
            },
            { id: "valid" as const, label: `Geçerli (${s.valid})` },
            { id: "all" as const, label: "Tümü" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.id
                ? "bg-ink text-white"
                : "border border-hairline bg-canvas text-steel"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          className="input max-w-xs text-sm ml-auto"
          placeholder="Vaka ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-hairline bg-canvas overflow-hidden"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-soft"
              onClick={() => setOpenId(openId === r.id ? null : r.id)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink truncate">
                  {r.hastalikAdi || r.id}
                </div>
                <div className="text-[11px] text-muted">
                  {r.id} · {r.poliklinikKey} · {r.durum} · {r.seviye}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-[11px] text-muted">
                  {r.errors.length}h · {r.warnings.length}u
                </span>
              </div>
            </button>
            {openId === r.id && (
              <div className="border-t border-hairline px-4 py-3 space-y-3 text-xs">
                {r.errors.length > 0 && (
                  <div>
                    <div className="font-semibold text-clinical-red mb-1">Hatalar</div>
                    <ul className="space-y-1">
                      {r.errors.map((e, i) => (
                        <li key={i}>
                          <code className="text-clinical-red">[{e.code}]</code>{" "}
                          <span className="text-muted">{e.field}</span>: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.warnings.length > 0 && (
                  <div>
                    <div className="font-semibold text-clinical-orange mb-1">Uyarılar</div>
                    <ul className="space-y-1">
                      {r.warnings.map((w, i) => (
                        <li key={i}>
                          <code className="text-clinical-orange">[{w.code}]</code>{" "}
                          <span className="text-muted">{w.field}</span>: {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Link
                  href={`/admin/panel/vakalar/${encodeURIComponent(r.id)}`}
                  className="inline-block text-brand-deep font-medium hover:underline"
                >
                  Editörde aç →
                </Link>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-steel py-6 text-center">Bu filtrede vaka yok.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-brand-deep"
      : tone === "warn"
        ? "text-clinical-orange"
        : tone === "bad"
          ? "text-clinical-red"
          : "text-ink";
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: VakaResult["status"] }) {
  const map = {
    valid: "bg-brand/15 text-brand-deep",
    valid_with_warnings: "bg-clinical-orange/15 text-clinical-orange",
    invalid: "bg-clinical-red/15 text-clinical-red",
  };
  const label = {
    valid: "geçerli",
    valid_with_warnings: "uyarılı",
    invalid: "geçersiz",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  );
}
