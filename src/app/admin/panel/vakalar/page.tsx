"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface AdminVakaLite {
  id: string;
  hastalikKey: string;
  hastalikAdi: string;
  seviye: string;
  durum?: string;
  etiketler?: string[];
  uzmanOnayi?: boolean;
  surum?: number;
  statikTestler: Record<string, unknown>;
}

interface Group {
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  cases: AdminVakaLite[];
}

async function downloadExport(opts: {
  format: "json" | "pdf" | "cdm";
  poliklinik?: string;
}): Promise<void> {
  const params = new URLSearchParams({ format: opts.format });
  if (opts.poliklinik) params.set("poliklinik", opts.poliklinik);
  const res = await fetch(`/api/admin/cases/export?${params.toString()}`);
  if (!res.ok) {
    let msg = "Export başarısız";
    try {
      const d = await res.json();
      msg = d.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename="([^"]+)"/.exec(cd);
  const filename =
    m?.[1] ||
    `tip-ai-vakalar.${opts.format === "pdf" ? "pdf" : "json"}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminVakalarPage() {
  const [grouped, setGrouped] = useState<Group[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    poliklinikKey: "",
    hastalikKey: "",
    hastalikAdi: "",
    anaSikayet: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [showCdm, setShowCdm] = useState(false);
  const [cdmOverwrite, setCdmOverwrite] = useState(false);
  const [cdmBusy, setCdmBusy] = useState(false);
  const [cdmReport, setCdmReport] = useState("");
  const [migrating, setMigrating] = useState(false);

  function load() {
    fetch("/api/admin/cases")
      .then((r) => r.json())
      .then((d) => {
        setGrouped(d.grouped || []);
        const o: Record<string, boolean> = {};
        for (const g of d.grouped || []) o[g.poliklinikKey] = true;
        setOpen(o);
        if (!form.poliklinikKey && d.grouped?.[0]) {
          setForm((f) => ({ ...f, poliklinikKey: d.grouped[0].poliklinikKey }));
        }
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCases = useMemo(
    () => grouped.reduce((n, g) => n + g.cases.length, 0),
    [grouped]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return grouped;
    return grouped
      .map((g) => ({
        ...g,
        cases: g.cases.filter(
          (c) =>
            c.hastalikAdi.toLowerCase().includes(qq) ||
            c.hastalikKey.toLowerCase().includes(qq) ||
            g.poliklinikAd.toLowerCase().includes(qq)
        ),
      }))
      .filter((g) => g.cases.length > 0);
  }, [grouped, q]);

  async function createCase(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/admin/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Oluşturulamadı");
      return;
    }
    setMsg(`Vaka eklendi: ${data.case.id}`);
    setShowNew(false);
    setForm((f) => ({ ...f, hastalikKey: "", hastalikAdi: "", anaSikayet: "" }));
    load();
  }

  async function runExport(format: "json" | "pdf" | "cdm", poliklinik?: string) {
    const key = `${format}:${poliklinik || "all"}`;
    setExporting(key);
    setErr("");
    setMsg("");
    try {
      await downloadExport({ format, poliklinik });
      setMsg(
        format === "pdf"
          ? "PDF indirildi (klinik özet — doktora gösterilebilir)."
          : format === "cdm"
            ? "CDM v1 bundle indirildi (standart yazar şeması)."
            : "JSON indirildi (depodaki tüm alanlar)."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export başarısız");
    } finally {
      setExporting(null);
    }
  }

  async function migrateAllToCdm() {
    setMigrating(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/cases/migrate-cdm", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Migrate başarısız");
      setMsg(
        `CDM v1 migrate: ${d.upgradedCount}/${d.total} vaka güncellendi (conditions, vitals, kanonik lab key).`
      );
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Migrate hatası");
    } finally {
      setMigrating(false);
    }
  }

  async function downloadCdmTemplate() {
    setCdmBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/cases/cdm?template=1");
      if (!res.ok) throw new Error("Şablon indirilemedi");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tip-ai-cdm-v1-ornek-kbh.json";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("CDM örnek şablon (KBH) indirildi.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Şablon hatası");
    } finally {
      setCdmBusy(false);
    }
  }

  async function importCdmFile(file: File, dryRun: boolean) {
    setCdmBusy(true);
    setErr("");
    setMsg("");
    setCdmReport("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const qs = new URLSearchParams();
      if (dryRun) qs.set("dryRun", "1");
      if (cdmOverwrite) qs.set("overwrite", "1");
      const res = await fetch(`/api/admin/cases/import-cdm?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          data.validations
            ?.flatMap(
              (v: { id: string; errors?: { path: string; message: string }[] }) =>
                (v.errors || []).map((e: { path: string; message: string }) => `${v.id}: ${e.path} — ${e.message}`)
            )
            .slice(0, 8)
            .join("\n") || data.error;
        throw new Error(detail || "Import başarısız");
      }
      const warnCount =
        data.validations?.reduce(
          (n: number, v: { warnings?: unknown[] }) => n + (v.warnings?.length || 0),
          0
        ) || 0;
      if (dryRun) {
        setMsg(`Doğrulama OK · ${data.count} belge · ${warnCount} uyarı`);
        setCdmReport(
          (data.previewIds || []).map((id: string) => `• ${id}`).join("\n") +
            (warnCount
              ? `\n\nUyarılar: ${data.validations
                  ?.flatMap((v: { warnings?: { message: string }[] }) =>
                    (v.warnings || []).map((w: { message: string }) => w.message)
                  )
                  .slice(0, 6)
                  .join("; ")}`
              : "")
        );
      } else {
        setMsg(
          `CDM import: +${(data.imported || []).length} yeni, ${(data.updated || []).length} güncelleme, ${(data.skipped || []).length} atlandı.`
        );
        load();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import hatası");
    } finally {
      setCdmBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Vakalar</h1>
          <p className="mt-1 text-sm text-steel">
            Polikliniklere göre gruplanmış vaka şablonları · {totalCases} vaka
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!!exporting || totalCases === 0}
            onClick={() => runExport("pdf")}
            title="Tüm vakalar — klinik özet PDF"
          >
            {exporting === "pdf:all" ? "…" : "📄 Tümü PDF"}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!!exporting || totalCases === 0}
            onClick={() => runExport("json")}
            title="Tüm vakalar — ham JSON (DB)"
          >
            {exporting === "json:all" ? "…" : "{ } Tümü JSON"}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!!exporting || totalCases === 0}
            onClick={() => runExport("cdm")}
            title="TIP-AI CDM v1 bundle"
          >
            {exporting === "cdm:all" ? "…" : "CDM v1"}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setShowCdm((v) => !v)}
          >
            {showCdm ? "CDM paneli ▴" : "CDM paneli ▾"}
          </button>
          <button className="btn-primary text-sm" onClick={() => setShowNew((v) => !v)}>
            {showNew ? "İptal" : "+ Yeni vaka"}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-[11px] text-steel">
        <strong className="text-ink">Export:</strong> PDF klinik özet · JSON depo dump ·{" "}
        <strong className="text-ink">CDM v1</strong> standart yazar şeması (OMOP + OSCE). Yeni
        vakaları CDM ile üretin ki test/tanı kodları tutarlı kalsın.
      </div>

      {showCdm && (
        <div className="mt-4 rounded-xl border border-brand/25 bg-canvas p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">TIP-AI CDM v1</h2>
            <p className="mt-1 text-xs text-steel leading-relaxed">
              OMOP benzeri mini şema: <code className="text-[11px]">patient</code> ·{" "}
              <code className="text-[11px]">conditions</code> ·{" "}
              <code className="text-[11px]">labs</code> ·{" "}
              <code className="text-[11px]">vitals</code> ·{" "}
              <code className="text-[11px]">management</code> (+ OSCE presentation/rubric). Lab
              anahtarları birleşik test kataloğuna (KREATININ, IDRAR, GLUKOZ…) uymalı; alias’lar
              otomatik kanonikleştirilir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={migrating}
              onClick={migrateAllToCdm}
            >
              {migrating ? "…" : "Eski vakaları CDM’e yükselt"}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={cdmBusy}
              onClick={downloadCdmTemplate}
            >
              Örnek şablon (KBH)
            </button>
            <label className="btn-secondary text-xs cursor-pointer">
              {cdmBusy ? "…" : "CDM doğrula"}
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCdmFile(f, true);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="btn-accent text-xs cursor-pointer">
              {cdmBusy ? "…" : "CDM import"}
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCdmFile(f, false);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-steel">
              <input
                type="checkbox"
                checked={cdmOverwrite}
                onChange={(e) => setCdmOverwrite(e.target.checked)}
              />
              Var olan id’leri üzerine yaz
            </label>
          </div>
          {cdmReport && (
            <pre className="max-h-40 overflow-auto rounded-md border border-hairline-soft bg-surface-soft p-2 text-[11px] text-steel whitespace-pre-wrap">
              {cdmReport}
            </pre>
          )}
        </div>
      )}

      <div className="mt-4">
        <input
          className="input w-full max-w-md"
          placeholder="Vaka veya poliklinik ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {showNew && (
        <form
          onSubmit={createCase}
          className="mt-4 rounded-xl border border-hairline bg-canvas p-5 space-y-3 max-w-xl"
        >
          <h2 className="text-sm font-semibold text-ink">Yeni vaka</h2>
          <div>
            <label className="text-xs text-muted">Poliklinik</label>
            <select
              className="input w-full"
              value={form.poliklinikKey}
              onChange={(e) => setForm({ ...form, poliklinikKey: e.target.value })}
              required
            >
              {grouped.map((g) => (
                <option key={g.poliklinikKey} value={g.poliklinikKey}>
                  {g.poliklinikIcon} {g.poliklinikAd}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Hastalık anahtarı (slug)</label>
            <input
              className="input w-full"
              placeholder="ornek-hastalik"
              value={form.hastalikKey}
              onChange={(e) => setForm({ ...form, hastalikKey: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted">Hastalık adı</label>
            <input
              className="input w-full"
              value={form.hastalikAdi}
              onChange={(e) => setForm({ ...form, hastalikAdi: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted">Ana şikayet</label>
            <input
              className="input w-full"
              value={form.anaSikayet}
              onChange={(e) => setForm({ ...form, anaSikayet: e.target.value })}
            />
          </div>
          {err && <p className="text-sm text-clinical-red">{err}</p>}
          <button type="submit" className="btn-accent text-sm">
            Kaydet
          </button>
        </form>
      )}

      {msg && <p className="mt-3 text-sm text-brand-deep">{msg}</p>}

      <div className="mt-8 space-y-4">
        {filtered.map((g) => (
          <div key={g.poliklinikKey} className="rounded-xl border border-hairline bg-canvas overflow-hidden">
            <div className="flex items-center gap-2 border-b border-hairline-soft px-2 py-1.5 sm:px-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between px-2 py-2 text-left hover:bg-surface-soft rounded-md"
                onClick={() =>
                  setOpen((o) => ({ ...o, [g.poliklinikKey]: !o[g.poliklinikKey] }))
                }
              >
                <span className="font-semibold text-ink">
                  {g.poliklinikIcon} {g.poliklinikAd}{" "}
                  <span className="text-sm font-normal text-muted">({g.cases.length})</span>
                </span>
                <span className="text-muted">{open[g.poliklinikKey] ? "▾" : "▸"}</span>
              </button>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded-md border border-hairline bg-canvas px-2 py-1 text-[11px] font-medium text-steel hover:text-ink disabled:opacity-50"
                  disabled={!!exporting || g.cases.length === 0}
                  title={`${g.poliklinikAd} — PDF`}
                  onClick={() => runExport("pdf", g.poliklinikKey)}
                >
                  {exporting === `pdf:${g.poliklinikKey}` ? "…" : "PDF"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-hairline bg-canvas px-2 py-1 text-[11px] font-medium text-steel hover:text-ink disabled:opacity-50"
                  disabled={!!exporting || g.cases.length === 0}
                  title={`${g.poliklinikAd} — JSON`}
                  onClick={() => runExport("json", g.poliklinikKey)}
                >
                  {exporting === `json:${g.poliklinikKey}` ? "…" : "JSON"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-hairline bg-canvas px-2 py-1 text-[11px] font-medium text-steel hover:text-ink disabled:opacity-50"
                  disabled={!!exporting || g.cases.length === 0}
                  title={`${g.poliklinikAd} — CDM v1`}
                  onClick={() => runExport("cdm", g.poliklinikKey)}
                >
                  {exporting === `cdm:${g.poliklinikKey}` ? "…" : "CDM"}
                </button>
              </div>
            </div>
            {open[g.poliklinikKey] && (
              <div className="border-t border-hairline divide-y divide-hairline-soft">
                {g.cases.map((c) => {
                  const testCount = Object.keys(c.statikTestler || {}).length;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft transition-colors"
                    >
                      <Link
                        href={`/admin/panel/vakalar/${encodeURIComponent(c.id)}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="text-sm font-medium text-ink">{c.hastalikAdi}</div>
                        <div className="text-xs text-muted">
                          {c.hastalikKey} · {c.seviye} · {testCount} test · {c.durum || "aktif"}
                          {c.uzmanOnayi ? " · ✓" : ""} · v{c.surum ?? 1}
                          {(c.etiketler || []).length
                            ? ` · ${(c.etiketler || []).slice(0, 3).join(", ")}`
                            : ""}
                        </div>
                      </Link>
                      <div className="flex shrink-0 gap-2">
                        <Link
                          href={`/admin/panel/oyna/${encodeURIComponent(c.id)}`}
                          className="text-xs font-medium text-brand-deep hover:underline"
                        >
                          Oyna
                        </Link>
                        <Link
                          href={`/admin/panel/vakalar/${encodeURIComponent(c.id)}`}
                          className="text-xs text-steel hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-steel">Sonuç yok.</p>
        )}
      </div>
    </div>
  );
}
