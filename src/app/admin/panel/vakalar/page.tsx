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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Vakalar</h1>
          <p className="mt-1 text-sm text-steel">Polikliniklere göre gruplanmış vaka şablonları</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "İptal" : "+ Yeni vaka"}
        </button>
      </div>

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
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-soft"
              onClick={() => setOpen((o) => ({ ...o, [g.poliklinikKey]: !o[g.poliklinikKey] }))}
            >
              <span className="font-semibold text-ink">
                {g.poliklinikIcon} {g.poliklinikAd}{" "}
                <span className="text-sm font-normal text-muted">({g.cases.length})</span>
              </span>
              <span className="text-muted">{open[g.poliklinikKey] ? "▾" : "▸"}</span>
            </button>
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
