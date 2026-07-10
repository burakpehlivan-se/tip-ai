"use client";

import { FormEvent, useEffect, useState } from "react";

export default function AdminAyarlarPage() {
  const [form, setForm] = useState({
    kalabaliklik: "orta" as "az" | "orta" | "cok",
    geriDonusMin: 2,
    geriDonusMax: 3,
    aktifPoliklinikler: "" as string,
    aktifHastaliklar: "" as string,
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const c = d.settings?.cemicegek;
        if (!c) return;
        setForm({
          kalabaliklik: c.kalabaliklik || "orta",
          geriDonusMin: c.geriDonusMin ?? 2,
          geriDonusMax: c.geriDonusMax ?? 3,
          aktifPoliklinikler: (c.aktifPoliklinikler || []).join(", "),
          aktifHastaliklar: (c.aktifHastaliklar || []).join(", "),
        });
      });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cemicegek: {
          kalabaliklik: form.kalabaliklik,
          geriDonusMin: form.geriDonusMin,
          geriDonusMax: form.geriDonusMax,
          aktifPoliklinikler: form.aktifPoliklinikler
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          aktifHastaliklar: form.aktifHastaliklar
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErr(d.error || "Kayıt hatası");
      return;
    }
    setMsg("Ayarlar kaydedildi.");
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Ayarlar</h1>
      <p className="mt-1 text-sm text-steel">
        Çemiçgezek acil akışı ve kurum profili parametreleri.
      </p>

      <form onSubmit={save} className="mt-6 space-y-4 rounded-xl border border-hairline bg-canvas p-5">
        <h2 className="text-sm font-semibold text-ink">Çemiçgezek</h2>

        <div>
          <label className="text-xs text-muted">Kalabalıklık seviyesi</label>
          <select
            className="input w-full"
            value={form.kalabaliklik}
            onChange={(e) =>
              setForm({ ...form, kalabaliklik: e.target.value as "az" | "orta" | "cok" })
            }
          >
            <option value="az">Az</option>
            <option value="orta">Orta</option>
            <option value="cok">Çok</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted">Geri dönüş min (hasta)</label>
            <input
              type="number"
              min={1}
              className="input w-full"
              value={form.geriDonusMin}
              onChange={(e) => setForm({ ...form, geriDonusMin: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Geri dönüş max (hasta)</label>
            <input
              type="number"
              min={1}
              className="input w-full"
              value={form.geriDonusMax}
              onChange={(e) => setForm({ ...form, geriDonusMax: Number(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted">
          Lab’a giden hasta, min–max aralığında rastgele sayıda yeni hastadan sonra geri döner.
        </p>

        <div>
          <label className="text-xs text-muted">
            Aktif poliklinikler (virgülle key; boş = hepsi)
          </label>
          <input
            className="input w-full"
            placeholder="kardiyoloji, solunum, enfeksiyon"
            value={form.aktifPoliklinikler}
            onChange={(e) => setForm({ ...form, aktifPoliklinikler: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-muted">
            Aktif hastalıklar (virgülle hastalikKey; boş = hepsi)
          </label>
          <input
            className="input w-full"
            placeholder="stemi, pnomoni, iye"
            value={form.aktifHastaliklar}
            onChange={(e) => setForm({ ...form, aktifHastaliklar: e.target.value })}
          />
        </div>

        {msg && <p className="text-sm text-brand-deep">{msg}</p>}
        {err && <p className="text-sm text-clinical-red">{err}</p>}

        <button type="submit" className="btn-primary text-sm">
          Kaydet
        </button>
      </form>
    </div>
  );
}
