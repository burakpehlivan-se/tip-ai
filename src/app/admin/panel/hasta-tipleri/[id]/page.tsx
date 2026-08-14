"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { KISILIK_TIPLERI, KISILIK_TIPI_KEYLERI } from "@/lib/ai/kisilik-tipleri";

interface HastaTipi {
  id: string;
  ad: string;
  aciklama?: string;
  yasAraligi: [number, number];
  cinsiyetTercih: "E" | "K" | "herhangi";
  komorbiditeler: string[];
  kisilikTipi?: string;
  ornekCevaplar?: Record<string, string>;
  updatedAt: number;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[11px] text-muted leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function AdminHastaTipiDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);

  const [tip, setTip] = useState<HastaTipi | null>(null);
  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [yasMin, setYasMin] = useState(30);
  const [yasMax, setYasMax] = useState(70);
  const [cinsiyet, setCinsiyet] = useState<HastaTipi["cinsiyetTercih"]>("herhangi");
  const [komorbiditeler, setKomorbiditeler] = useState("");
  const [kisilikTipi, setKisilikTipi] = useState("");

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // AI penceresi
  const [aiUretiliyor, setAiUretiliyor] = useState(false);
  const [aiCevaplar, setAiCevaplar] = useState<Record<string, string> | null>(null);
  const [aiRapor, setAiRapor] = useState("");
  const [aiKaydediliyor, setAiKaydediliyor] = useState(false);

  const ornekCevapVar = useMemo(
    () => (tip?.ornekCevaplar ? Object.keys(tip.ornekCevaplar).length > 0 : false),
    [tip]
  );

  function hydrate(t: HastaTipi) {
    setTip(t);
    setAd(t.ad || "");
    setAciklama(t.aciklama || "");
    setYasMin(t.yasAraligi?.[0] ?? 30);
    setYasMax(t.yasAraligi?.[1] ?? 70);
    setCinsiyet(t.cinsiyetTercih || "herhangi");
    setKomorbiditeler((t.komorbiditeler || []).join(", "));
    setKisilikTipi(t.kisilikTipi || "");
  }

  function load() {
    fetch(`/api/admin/hasta-tipleri/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        hydrate(d.tip);
      })
      .catch((e) => setErr(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!tip) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/hasta-tipleri/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad,
          aciklama,
          yasAraligi: [Number(yasMin), Number(yasMax)],
          cinsiyetTercih: cinsiyet,
          komorbiditeler: komorbiditeler.split(",").map((s) => s.trim()).filter(Boolean),
          kisilikTipi: kisilikTipi || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Kayıt hatası");
        return;
      }
      setMsg("Hasta tipi kaydedildi.");
      hydrate(d.tip);
      // ad değiştiyse slug/id değişebilir → yeni adrese git
      if (d.tip.id !== id) router.replace(`/admin/panel/hasta-tipleri/${encodeURIComponent(d.tip.id)}`);
    } catch {
      setErr("Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!tip) return;
    if (!confirm(`"${tip.ad}" tipini silmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/admin/hasta-tipleri/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/admin/panel/hasta-tipleri");
    } else {
      const d = await res.json().catch(() => null);
      setErr(d?.error || "Silme başarısız.");
    }
  }

  async function aiUret() {
    if (!tip) return;
    setAiUretiliyor(true);
    setErr("");
    setAiCevaplar(null);
    setAiRapor("Başlatılıyor…");
    try {
      const res = await fetch(`/api/admin/hasta-tipleri/${encodeURIComponent(id)}/ai`, { method: "POST" });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => null);
        setErr(d?.error || "AI üretimi başarısız.");
        setAiRapor("");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let tampon = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        tampon += decoder.decode(value, { stream: true });
        let ayrac: number;
        while ((ayrac = tampon.indexOf("\n\n")) !== -1) {
          const blok = tampon.slice(0, ayrac);
          tampon = tampon.slice(ayrac + 2);
          const dataSatiri = blok.split("\n").find((l) => l.startsWith("data:"));
          if (!dataSatiri) continue;
          const olay = JSON.parse(dataSatiri.slice(5));
          if (olay.tip === "basla") {
            setAiRapor("Örnek cevaplar üretiliyor…");
          } else if (olay.tip === "tamam") {
            setAiCevaplar(olay.cevaplar || {});
            const eksik = Array.isArray(olay.rapor?.uyarilar) && olay.rapor.uyarilar.length
              ? ` · ${olay.rapor.uyarilar.length} uyarı`
              : "";
            setAiRapor(`${olay.basarili ? "Üretildi" : "Kısmen üretildi"}${eksik}.`);
          } else if (olay.tip === "hata") {
            setErr(olay.mesaj || "AI üretimi başarısız.");
            setAiRapor("");
          }
        }
      }
    } catch {
      setErr("AI üretimi başarısız.");
      setAiRapor("");
    } finally {
      setAiUretiliyor(false);
    }
  }

  async function aiKaydet() {
    if (!tip || !aiCevaplar) return;
    setAiKaydediliyor(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/hasta-tipleri/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ornekCevaplar: aiCevaplar }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "AI cevapları kaydedilemedi");
        return;
      }
      hydrate(d.tip);
      setMsg("AI örnek cevapları kaydedildi.");
    } catch {
      setErr("AI cevapları kaydedilemedi.");
    } finally {
      setAiKaydediliyor(false);
    }
  }

  if (!tip) {
    return (
      <div>
        <p className="text-sm text-steel">Yükleniyor…</p>
        {err && <p className="text-sm text-clinical-red">{err}</p>}
        <Link href="/admin/panel/hasta-tipleri" className="text-sm text-steel">← Hasta tipleri</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/panel/hasta-tipleri" className="text-sm text-steel hover:text-ink">← Hasta tipleri</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{tip.ad}</h1>
          <p className="text-sm text-muted">id: {tip.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" disabled={saving} onClick={save}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={remove}>Sil</button>
        </div>
      </div>

      {msg && <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{msg}</div>}
      {err && <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">{err}</div>}

      <Section title="temel bilgiler" hint="Tip adı, demografi ve komorbiditeler.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">Tip adı</label>
            <input className="input w-full" value={ad} onChange={(e) => setAd(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">Cinsiyet tercihi</label>
            <select className="input w-full" value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value as HastaTipi["cinsiyetTercih"])}>
              <option value="herhangi">Herhangi</option>
              <option value="E">Erkek</option>
              <option value="K">Kadın</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Yaş min</label>
            <input type="number" className="input w-full" value={yasMin} onChange={(e) => setYasMin(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted">Yaş max</label>
            <input type="number" className="input w-full" value={yasMax} onChange={(e) => setYasMax(Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted">Komorbiditeler / hastalık öyküsü (virgülle)</label>
            <input className="input w-full" value={komorbiditeler} onChange={(e) => setKomorbiditeler(e.target.value)} placeholder="HTN, T2DM, KOAH" />
          </div>
        </div>
      </Section>

      <Section title="kişilik (AI ton)" hint="Bu tipin simüle edilen hastası hangi tonda konuşacak.">
        <select className="input w-full" value={kisilikTipi} onChange={(e) => setKisilikTipi(e.target.value)}>
          <option value="">Doğal / sakin (varsayılan)</option>
          {KISILIK_TIPI_KEYLERI.map((k) => (
            <option key={k} value={k}>{KISILIK_TIPLERI[k].ad}</option>
          ))}
        </select>
      </Section>

      <Section title="örnekler / açıklama" hint="Tipin hangi senaryolarda kullanılacağına dair not.">
        <textarea className="input h-28 w-full resize-y" value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Örn. T2DM + HT tanılı, kontrol randevusuna gelen orta yaş hasta." />
      </Section>

      <Section title="AI penceresi — örnek hasta cevapları" hint="AI bu tip için standart sorulara örnek hasta cevapları üretir. Üretim kaydetmez; gözden geçirip kaydetmelisin.">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary text-sm" disabled={aiUretiliyor} onClick={aiUret}>
            {aiUretiliyor ? "Üretiliyor…" : "AI ile örnek cevaplar üret"}
          </button>
          {aiRapor && <span className="text-xs text-steel">{aiRapor}</span>}
          {ornekCevapVar && (
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-deep">
              Kayıtlı AI cevapları var
            </span>
          )}
        </div>

        {(aiCevaplar || tip.ornekCevaplar) && (
          <div className="space-y-2">
            {Object.entries(aiCevaplar || tip.ornekCevaplar || {}).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface px-3 py-2">
                <span className="text-[11px] font-medium text-brand-deep">{k}</span>
                <p className="text-sm text-ink">{v}</p>
              </div>
            ))}
          </div>
        )}

        {aiCevaplar && Object.keys(aiCevaplar).length > 0 && (
          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary text-sm" disabled={aiKaydediliyor} onClick={aiKaydet}>
              {aiKaydediliyor ? "Kaydediliyor…" : "Bu cevapları tipe kaydet"}
            </button>
            <button type="button" className="text-xs text-steel hover:text-ink" onClick={() => setAiCevaplar(null)}>
              Vazgeç
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
