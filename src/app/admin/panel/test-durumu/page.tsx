"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

interface ScanCase {
  vakaId: string;
  hastalikAdi?: string;
  poliklinikKey?: string;
  durum?: string;
  okTests: string[];
  needsGenerated: string[];
  staticRequired: string[];
  invalidKeys: string[];
}

interface Inventory {
  totalKeys: number;
  unknownKeys: { key: string; vakaIds: string[] }[];
}

interface ScanReport {
  totalCases: number;
  totalOk: number;
  totalNeedsGenerated: number;
  totalStaticRequired: number;
  totalInvalid: number;
  cases: ScanCase[];
}

interface PipelineData {
  inventory: Inventory;
  scan: ScanReport;
}

interface OverrideReport {
  vakaId: string;
  hastalikAdi: string;
  poliklinikKey: string;
  totalStaticTests: number;
  summary: {
    total: number;
    removableCount: number;
    keepCount: number;
    unknownCount: number;
    reductionPercent: number;
  };
  removable: Array<{ testKey: string; testAdi: string; reason: string }>;
  keep: Array<{ testKey: string; testAdi: string; reason: string }>;
}

interface OverrideData {
  reports: OverrideReport[];
  grandTotal: {
    totalCases: number;
    totalStaticTests: number;
    totalRemovable: number;
    totalKeep: number;
    totalUnknown: number;
    overallReductionPercent: number;
  };
}

export default function TestDurumuPage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [overrideData, setOverrideData] = useState<OverrideData | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [overrideApplying, setOverrideApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pipeline/scan");
      const json = (await res.json()) as PipelineData;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOverrideAnalyze() {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      const res = await fetch("/api/admin/cases/analyze-overrides");
      const json = (await res.json()) as OverrideData;
      setOverrideData(json);
    } catch (e) {
      setOverrideMsg("Override analizi başarısız: " + String(e));
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleOverrideApply() {
    setOverrideApplying(true);
    setOverrideMsg(null);
    try {
      const res = await fetch("/api/admin/cases/apply-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json();
      if (json.dryRun === false) {
        setOverrideMsg(
          `${json.totalMigrated} vaka güncellendi · ${json.totalRemoved} test temizlendi · ${json.totalKept} test korundu.`
        );
      } else {
        setOverrideMsg(json.message || String(json.error));
      }
    } catch (e) {
      setOverrideMsg("Override uygulama başarısız: " + String(e));
    } finally {
      setOverrideApplying(false);
    }
  }

  async function handleFill() {
    setFilling(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/pipeline/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg(
          `Dolduruldu · motor=${json.totalFilled ?? 0}, statik gerekli=${json.totalStaticRequired ?? 0}, geçersiz=${json.totalInvalid ?? 0}`
        );
        await load();
      } else {
        setMsg(json.error || "Doldurma başarısız");
      }
    } catch (e) {
      setMsg("İstek başarısız: " + String(e));
    } finally {
      setFilling(false);
    }
  }

  const problems = data
    ? data.scan.cases.filter(
        (c) =>
          c.needsGenerated.length ||
          c.staticRequired.length ||
          c.invalidKeys.length
      )
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Test Durumu
      </h1>
      <p className="mt-1 text-sm text-steel">
        4 katmanlı test pipeline&apos;ı: sözlük standardizasyonu, eksik taraması,
        lab motoru ile doldurma ve validasyon.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Toplam vaka" value={data?.scan.totalCases ?? "—"} />
        <Card label="Sonuçlu (OK)" value={data?.scan.totalOk ?? "—"} />
        <Card
          label="Motor→doldurulacak"
          value={data?.scan.totalNeedsGenerated ?? "—"}
          accent={data?.scan.totalNeedsGenerated ? "orange" : "brand"}
        />
        <Card
          label="Geçersiz (sözlük dışı)"
          value={data?.scan.totalInvalid ?? "—"}
          accent={data?.scan.totalInvalid ? "red" : "brand"}
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          className="btn-accent"
          onClick={handleFill}
          disabled={filling || loading}
        >
          {filling ? "Dolduruluyor…" : "Eksik testleri doldur"}
        </button>
        <span className="text-sm text-steel">
          Statik gerekli: {data?.scan.totalStaticRequired ?? "—"} (görüntüleme/patoloji —
          yazar eklemeli)
        </span>
      </div>

      {msg && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface-soft p-3 text-sm text-ink">
          {msg}
        </div>
      )}

      {data?.inventory.unknownKeys?.length ? (
        <div className="mt-8 rounded-xl border border-clinical-orange/40 bg-clinical-orange/10 p-5">
          <h2 className="text-heading-5 font-semibold text-ink">
            Test Sözlüğü Uyuşmazlığı
          </h2>
          <p className="mt-1 text-sm text-steel">
            Rubrikte olup katalogda olmayan key&apos;ler. Alias ekleyin veya
            rubrikten çıkarın.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {data.inventory.unknownKeys.map((u) => (
              <li key={u.key} className="font-mono text-ink">
                {u.key}{" "}
                <span className="text-steel">→ {u.vakaIds.length} vaka</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="text-heading-4 font-semibold text-ink">
          Sorunlu Vakalar ({problems.length})
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-steel">Yükleniyor…</p>
        ) : problems.length === 0 ? (
          <p className="mt-3 text-sm text-steel">
            Tüm vakalarda beklenen testlerin sonucu mevcut.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {problems.map((c) => (
              <div
                key={c.vakaId}
                className="rounded-xl border border-hairline bg-canvas p-4"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/admin/panel/vakalar/${encodeURIComponent(c.vakaId)}`}
                    className="font-mono text-sm font-medium text-ink hover:text-brand-deep"
                  >
                    {c.vakaId}
                  </Link>
                  <span className="text-xs text-steel">
                    {c.hastalikAdi}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {c.needsGenerated.length > 0 && (
                    <Badge tone="orange">
                      Motor→ {c.needsGenerated.join(", ")}
                    </Badge>
                  )}
                  {c.staticRequired.length > 0 && (
                    <Badge tone="steel">
                      Statik→ {c.staticRequired.join(", ")}
                    </Badge>
                  )}
                  {c.invalidKeys.length > 0 && (
                    <Badge tone="red">
                      Geçersiz→ {c.invalidKeys.join(", ")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Phase 2: Override Analizi ── */}
      <hr className="mt-8 border-hairline-soft" />
      <div className="mt-6">
        <h2 className="text-heading-4 font-semibold text-ink">
          Override Analizi (Faz 2)
        </h2>
        <p className="mt-1 text-sm text-steel">
          Her vakanın statikTestler alanını referans kütüphanesiyle karşılaştırır.
          Normal değerler otomatik üretilebildiği için statikTestler&apos;den
          çıkarılabilir.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-accent"
            onClick={handleOverrideAnalyze}
            disabled={overrideLoading}
          >
            {overrideLoading ? "Analiz ediliyor…" : "Override analizi yap"}
          </button>
          {overrideData && (
            <button
              className="btn-secondary text-xs"
              onClick={handleOverrideApply}
              disabled={overrideApplying}
            >
              {overrideApplying
                ? "Uygulanıyor…"
                : `Temizliği uygula (${overrideData.grandTotal.totalRemovable} test)`}
            </button>
          )}
        </div>

        {overrideMsg && (
          <div className="mt-3 rounded-lg border border-hairline bg-surface-soft p-3 text-sm text-ink">
            {overrideMsg}
          </div>
        )}

        {overrideData && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                label="Taranan vaka"
                value={overrideData.grandTotal.totalCases}
              />
              <Card
                label="Toplam statik test"
                value={overrideData.grandTotal.totalStaticTests}
              />
              <Card
                label="Silinebilir (ref var)"
                value={overrideData.grandTotal.totalRemovable}
                accent="orange"
              />
              <Card
                label="Azalma"
                value={`%${overrideData.grandTotal.overallReductionPercent}`}
                accent="brand"
              />
            </div>

            <div className="mt-6 space-y-4">
              {overrideData.reports
                .filter((r) => r.totalStaticTests > 0)
                .map((r) => (
                  <div
                    key={r.vakaId}
                    className="rounded-lg border border-hairline-soft bg-surface-soft p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-ink">
                          {r.hastalikAdi}
                        </span>
                        <span className="ml-2 text-xs text-steel">
                          {r.vakaId}
                        </span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        {r.summary.removableCount > 0 && (
                          <span className="rounded-full bg-clinical-orange/15 px-2 py-0.5 text-clinical-orange">
                            {r.summary.removableCount} silinebilir
                          </span>
                        )}
                        <span className="rounded-full bg-surface px-2 py-0.5 text-steel">
                          {r.summary.keepCount} korunacak
                        </span>
                      </div>
                    </div>

                    {r.removable.length > 0 && (
                      <div className="mt-2 text-xs text-steel">
                        <span className="font-medium text-clinical-orange">
                          Referansla karşılanabilir:{" "}
                        </span>
                        {r.removable
                          .map((x) => `${x.testAdi} (${x.reason})`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "brand" | "orange" | "red";
}) {
  const ring =
    accent === "red"
      ? "border-clinical-red/40"
      : accent === "orange"
        ? "border-clinical-orange/40"
        : "border-hairline";
  return (
    <div className={`rounded-xl border ${ring} bg-canvas p-5`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "orange" | "steel" | "red";
  children: ReactNode;
}) {
  const cls =
    tone === "red"
      ? "bg-clinical-red/15 text-clinical-red"
      : tone === "orange"
        ? "bg-clinical-orange/15 text-clinical-orange"
        : "bg-surface text-steel";
  return (
    <span className={`rounded-full px-2.5 py-1 ${cls}`}>{children}</span>
  );
}
