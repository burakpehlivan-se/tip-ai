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

export default function TestDurumuPage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
