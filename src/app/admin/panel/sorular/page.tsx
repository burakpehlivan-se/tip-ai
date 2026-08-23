"use client";

import { useEffect, useMemo, useState } from "react";
import { ChipKategorisi } from "@/lib/types";

type QuestionScope = "global" | "poliklinik";

interface QuestionItem {
  chip: { etiket: string; aksiyon: string; kategori: ChipKategorisi };
  source: "static" | "custom";
  custom?: {
    id: string;
    scope: QuestionScope;
    poliklinikKey?: string | null;
    createdAt: number;
  };
  disabled?: boolean;
}

const KATEGORILER: { value: ChipKategorisi; label: string }[] = [
  { value: "anamnez-agri", label: "Ağrı" },
  { value: "anamnez-sistemik", label: "Sistemik" },
  { value: "anamnez-oyku", label: "Öykü" },
  { value: "soygecmis", label: "Soygeçmiş" },
  { value: "vital", label: "Vital" },
  { value: "fizik", label: "Fizik" },
  { value: "red-flag", label: "Red Flag" },
];

export default function AdminSorularPage() {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [poliklinikler, setPoliklinikler] = useState<{ key: string; ad: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [filterKat, setFilterKat] = useState<ChipKategorisi | "hepsi">("hepsi");
  const [filterScope, setFilterScope] = useState<"hepsi" | "global" | "poliklinik" | "static">("hepsi");

  // Form
  const [etiket, setEtiket] = useState("");
  const [aksiyon, setAksiyon] = useState("");
  const [kategori, setKategori] = useState<ChipKategorisi>("anamnez-agri");
  const [scope, setScope] = useState<QuestionScope>("global");
  const [poliklinikKey, setPoliklinikKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEtiket, setEditEtiket] = useState("");
  const [editKategori, setEditKategori] = useState<ChipKategorisi>("anamnez-agri");
  const [editScope, setEditScope] = useState<QuestionScope>("global");
  const [editPoliklinikKey, setEditPoliklinikKey] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [qRes, cRes] = await Promise.all([
        fetch("/api/admin/questions"),
        fetch("/api/admin/cases"),
      ]);
      const qData = await qRes.json();
      if (!qRes.ok) throw new Error(qData.error || "Sorular yüklenemedi");
      setItems(qData.all || []);
      if (cRes.ok) {
        const cData = await cRes.json();
        const groups = (cData.grouped || []) as { poliklinikKey: string; poliklinikAd: string }[];
        setPoliklinikler(groups.map((g) => ({ key: g.poliklinikKey, ad: g.poliklinikAd })));
        if (!poliklinikKey && groups[0]) setPoliklinikKey(groups[0].poliklinikKey);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filterKat !== "hepsi" && it.chip.kategori !== filterKat) return false;
      if (filterScope === "global" && !(it.source === "custom" && it.custom?.scope === "global")) return false;
      if (filterScope === "poliklinik" && !(it.source === "custom" && it.custom?.scope === "poliklinik")) return false;
      if (filterScope === "static" && it.source !== "static") return false;
      if (qq && !`${it.chip.etiket} ${it.chip.aksiyon} ${it.chip.kategori}`.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [items, q, filterKat, filterScope]);

  const grouped = useMemo(() => {
    const map = new Map<string, QuestionItem[]>();
    for (const it of filtered) {
      const key = it.chip.kategori;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etiket: etiket.trim(),
          aksiyon: aksiyon.trim() || etiket.trim(),
          kategori,
          scope,
          poliklinikKey: scope === "poliklinik" ? poliklinikKey : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");
      setMsg(`Soru eklendi: ${data.question.etiket} (${data.question.aksiyon})`);
      setEtiket("");
      setAksiyon("");
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu soru silinsin mi?")) return;
    setErr("");
    const res = await fetch(`/api/admin/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "Silinemedi");
      return;
    }
    setMsg("Soru silindi.");
    load();
  }

  async function handleToggleStatic(aksiyon: string, currentlyDisabled: boolean) {
    setErr("");
    const res = await fetch("/api/admin/questions/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksiyon, disabled: !currentlyDisabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "Güncellenemedi");
      return;
    }
    setMsg(currentlyDisabled ? `Soru etkinleştirildi: ${aksiyon}` : `Soru devre dışı bırakıldı: ${aksiyon}`);
    load();
  }

  function startEditStatic(item: QuestionItem) {
    setEditingId(`static-${item.chip.aksiyon}`);
    setEditEtiket(item.chip.etiket);
    setEditKategori(item.chip.kategori);
    setEditScope("global");
    setEditPoliklinikKey("");
  }

  function startEditCustom(item: QuestionItem) {
    if (!item.custom) return;
    setEditingId(item.custom.id);
    setEditEtiket(item.chip.etiket);
    setEditKategori(item.chip.kategori);
    setEditScope(item.custom.scope);
    setEditPoliklinikKey(item.custom.poliklinikKey || poliklinikler[0]?.key || "");
  }

  async function handleEditSave() {
    if (!editingId) return;
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      if (editingId.startsWith("static-")) {
        const aksiyon = editingId.replace("static-", "");
        const res = await fetch("/api/admin/questions/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksiyon, etiket: editEtiket.trim(), kategori: editKategori }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Güncellenemedi");
        setMsg(`Soru güncellendi: ${aksiyon}`);
      } else {
        const res = await fetch(`/api/admin/questions/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            etiket: editEtiket.trim(),
            kategori: editKategori,
            scope: editScope,
            poliklinikKey: editScope === "poliklinik" ? editPoliklinikKey : null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Güncellenemedi");
        setMsg(`Soru güncellendi: ${editEtiket}`);
      }
      setEditingId(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sorular</h1>
          <p className="mt-1 text-sm text-steel">
            Anamnez sorularını yönetin · {items.length} soru · global veya kliniğe özel
          </p>
          <p className="mt-1 text-xs text-muted">
            Statik sorular devre dışı bırakılabilir, özel sorular eklenip silinebilir. Değişiklikler anında vakalara yansır.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Kapat" : "+ Yeni soru"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-xl border border-hairline bg-canvas p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Yeni soru ekle</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="soru-etiket" className="text-xs text-muted">Soru metni</label>
              <input
                id="soru-etiket"
                className="input w-full"
                placeholder="Örn. Gece terlemesi var mı?"
                value={etiket}
                onChange={(e) => setEtiket(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="soru-aksiyon" className="text-xs text-muted">Aksiyon (otomatik: SORU_METNİ → SORU_METNI)</label>
              <input
                id="soru-aksiyon"
                className="input w-full font-mono text-sm"
                placeholder="GECE_TERLEMESI"
                value={aksiyon}
                onChange={(e) => setAksiyon(e.target.value.toUpperCase())}
                pattern="[A-Z0-9_]{2,40}"
              />
              <p className="mt-1 text-[11px] text-muted">Boş bırakılırsa soru metninden üretilir.</p>
            </div>
            <div>
              <label htmlFor="soru-kategori" className="text-xs text-muted">Kategori</label>
              <select
                id="soru-kategori"
                className="input w-full"
                value={kategori}
                onChange={(e) => setKategori(e.target.value as ChipKategorisi)}
              >
                {KATEGORILER.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label} ({k.value})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="soru-scope" className="text-xs text-muted">Kapsam</label>
              <select
                id="soru-scope"
                className="input w-full"
                value={scope}
                onChange={(e) => setScope(e.target.value as QuestionScope)}
              >
                <option value="global">Global — tüm klinikler</option>
                <option value="poliklinik">Kliniğe özel</option>
              </select>
            </div>
            {scope === "poliklinik" && (
              <div>
                <label htmlFor="soru-poliklinik" className="text-xs text-muted">Klinik</label>
                <select
                  id="soru-poliklinik"
                  className="input w-full"
                  value={poliklinikKey}
                  onChange={(e) => setPoliklinikKey(e.target.value)}
                  required
                >
                  {poliklinikler.length === 0 && <option value="">Klinik bulunamadı</option>}
                  {poliklinikler.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.ad} ({p.key})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-accent text-sm" disabled={busy || !etiket.trim()}>
              {busy ? "Ekleniyor…" : "Ekle"}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowForm(false)}>
              İptal
            </button>
          </div>
        </form>
      )}

      {msg && <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{msg}</div>}
      {err && <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">{err}</div>}

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-sm flex-1"
          placeholder="Soru, aksiyon veya kategori ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-40" value={filterKat} onChange={(e) => setFilterKat(e.target.value as never)}>
          <option value="hepsi">Tüm kategoriler</option>
          {KATEGORILER.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select className="input w-44" value={filterScope} onChange={(e) => setFilterScope(e.target.value as never)}>
          <option value="hepsi">Tüm kaynaklar</option>
          <option value="static">Statik</option>
          <option value="global">Global özel</option>
          <option value="poliklinik">Klinik özel</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-steel">Yükleniyor…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-steel">Sonuç yok.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([kategori, list]) => (
            <div key={kategori} className="rounded-xl border border-hairline bg-canvas overflow-hidden">
              <div className="border-b border-hairline-soft bg-surface-soft px-4 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {KATEGORILER.find((k) => k.value === kategori)?.label || kategori} · {list.length}
                </h2>
              </div>
              <div className="divide-y divide-hairline-soft">
                {list.map((it) => (
                  <div key={`${it.source}-${it.chip.aksiyon}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-soft">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{it.chip.etiket}</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">{it.chip.aksiyon}</span>
                        {it.source === "static" ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${it.disabled ? "bg-clinical-red/15 text-clinical-red" : "bg-ink/10 text-ink"}`}>
                            {it.disabled ? "devre dışı" : "statik"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-deep">
                            {it.custom?.scope === "global" ? "global özel" : `klinik: ${it.custom?.poliklinikKey}`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {it.chip.kategori} · {it.source === "custom" ? `id: ${it.custom?.id.slice(0, 8)}` : "yerleşik"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {editingId === (it.source === "static" ? `static-${it.chip.aksiyon}` : it.custom?.id) ? (
                        <>
                          <button type="button" className="text-xs font-medium text-brand-deep hover:underline" onClick={handleEditSave} disabled={busy}>
                            Kaydet
                          </button>
                          <button type="button" className="text-xs text-steel hover:underline" onClick={() => setEditingId(null)}>
                            İptal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="text-xs font-medium text-steel hover:underline"
                            onClick={() => (it.source === "static" ? startEditStatic(it) : startEditCustom(it))}
                          >
                            Düzenle
                          </button>
                          {it.source === "static" ? (
                            <button
                              type="button"
                              className={`text-xs font-medium hover:underline ${it.disabled ? "text-brand-deep" : "text-clinical-red"}`}
                              onClick={() => handleToggleStatic(it.chip.aksiyon, !!it.disabled)}
                            >
                              {it.disabled ? "Etkinleştir" : "Devre dışı bırak"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-xs font-medium text-clinical-red hover:underline"
                              onClick={() => handleDelete(it.custom!.id)}
                            >
                              Sil
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {editingId === (it.source === "static" ? `static-${it.chip.aksiyon}` : it.custom?.id) && (
                      <div className="mt-3 flex w-full flex-wrap gap-3 rounded-lg border border-hairline bg-surface-soft p-3">
                        <input
                          className="input flex-1 min-w-[200px]"
                          value={editEtiket}
                          onChange={(e) => setEditEtiket(e.target.value)}
                          placeholder="Soru metni"
                          maxLength={120}
                        />
                        <select className="input w-40" value={editKategori} onChange={(e) => setEditKategori(e.target.value as ChipKategorisi)}>
                          {KATEGORILER.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                        {it.source === "custom" && (
                          <>
                            <select className="input w-40" value={editScope} onChange={(e) => setEditScope(e.target.value as QuestionScope)}>
                              <option value="global">Global</option>
                              <option value="poliklinik">Kliniğe özel</option>
                            </select>
                            {editScope === "poliklinik" && (
                              <select className="input w-40" value={editPoliklinikKey} onChange={(e) => setEditPoliklinikKey(e.target.value)}>
                                {poliklinikler.map((p) => (
                                  <option key={p.key} value={p.key}>
                                    {p.ad}
                                  </option>
                                ))}
                              </select>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
