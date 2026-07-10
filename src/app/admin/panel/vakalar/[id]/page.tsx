"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { birlesikTestKatalogu } from "@/lib/data";

interface TestSonucu {
  testKey: string;
  testAdi: string;
  tip: string;
  sonuc: unknown;
  referans?: string;
  yorum?: string;
}

interface RubrikAksiyon {
  key: string;
  etiket: string;
  aciklama: string;
}

interface AdminVaka {
  id: string;
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  hastalikKey: string;
  hastalikAdi: string;
  seviye: string;
  yasAraligi: [number, number];
  cinsiyetTercih: string;
  anaSikayet: string;
  ozetBilgiler: string[];
  egitimNotu: string;
  idealYol: string[];
  statikTestler: Record<string, TestSonucu>;
  durum: string;
  etiketler: string[];
  surum: number;
  uzmanOnayi: boolean;
  rubric: {
    beklenenSorular: RubrikAksiyon[];
    beklenenTestler: RubrikAksiyon[];
    gereksizTestler: RubrikAksiyon[];
    redFlagler: RubrikAksiyon[];
    kabulEdilenTani: string[];
    puanlama: Record<string, number>;
  };
  updatedAt: number;
}

function pretty(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

/** Katalog testine göre varsayılan sonuç şablonu */
function defaultSonucForKey(key: string): { tip: string; sonuc: string } {
  const jsonPanel: Record<string, string> = {
    CBC: JSON.stringify(
      { hemoglobin: "14.0 g/dL", lokosit: "8.5 K/uL", trombosit: "250 K/uL" },
      null,
      2
    ),
    ELEKTROLIT: JSON.stringify({ sodyum: "140 mmol/L", potasyum: "4.2 mmol/L", klor: "102 mmol/L" }, null, 2),
    KOLESTEROL: JSON.stringify(
      { totalKolesterol: "180 mg/dL", ldl: "100 mg/dL", hdl: "50 mg/dL", trigliserit: "120 mg/dL" },
      null,
      2
    ),
    IDRAR: JSON.stringify({ dansite: "1015", protein: "Negatif", glukoz: "Negatif", ph: 6.0 }, null, 2),
    ABG: JSON.stringify({ pH: "7.40", pCO2: "40 mmHg", pO2: "90 mmHg", HCO3: "24 mmol/L" }, null, 2),
    EKG: JSON.stringify({ ritim: "Sinüs", kalpHizi: "78", yorum: "Normal sinüs ritmi" }, null, 2),
    DEMIR: JSON.stringify({ serumDemir: "90 µg/dL", tdbk: "300 µg/dL", transferrinSaturasyonu: "30%" }, null, 2),
    PT: JSON.stringify({ PT: "12 sn", INR: "1.0" }, null, 2),
    KARACIGER_ENZIM: JSON.stringify({ AST: "25 U/L", ALT: "28 U/L" }, null, 2),
  };
  if (jsonPanel[key]) return { tip: "json", sonuc: jsonPanel[key] };

  const numericDefaults: Record<string, string> = {
    TROPONIN: JSON.stringify({ deger: 0.01, birim: "ng/mL", referansAralik: "<0.04" }, null, 2),
    BNP: JSON.stringify({ deger: 50, birim: "pg/mL", referansAralik: "<100" }, null, 2),
    GLUKOZ: JSON.stringify({ deger: 92, birim: "mg/dL", referansAralik: "70-100" }, null, 2),
    HBA1C: JSON.stringify({ deger: 5.4, birim: "%", referansAralik: "<5.7" }, null, 2),
    TSH: JSON.stringify({ deger: 2.1, birim: "mIU/L", referansAralik: "0.4-4.0" }, null, 2),
    T4: JSON.stringify({ deger: 1.2, birim: "ng/dL", referansAralik: "0.8-1.8" }, null, 2),
    CRP: JSON.stringify({ deger: 3, birim: "mg/L", referansAralik: "<5" }, null, 2),
    KREATININ: JSON.stringify({ deger: 0.9, birim: "mg/dL", referansAralik: "0.7-1.3" }, null, 2),
    URE: JSON.stringify({ deger: 14, birim: "mg/dL", referansAralik: "7-20" }, null, 2),
    AST: JSON.stringify({ deger: 22, birim: "U/L", referansAralik: "10-40" }, null, 2),
    ALT: JSON.stringify({ deger: 24, birim: "U/L", referansAralik: "10-41" }, null, 2),
    FERITIN: JSON.stringify({ deger: 80, birim: "ng/mL", referansAralik: "30-300" }, null, 2),
    D_DIMER: JSON.stringify({ deger: 200, birim: "ng/mL", referansAralik: "<500" }, null, 2),
    PTT: JSON.stringify({ deger: 30, birim: "sn", referansAralik: "25-35" }, null, 2),
    GOZ_BASINCI: JSON.stringify({ deger: 15, birim: "mmHg", referansAralik: "10-21" }, null, 2),
    KREATININ_KINAZ: JSON.stringify({ deger: 120, birim: "U/L", referansAralik: "30-200" }, null, 2),
    BHCG: JSON.stringify({ deger: 0, birim: "mIU/mL", referansAralik: "<5" }, null, 2),
  };
  if (numericDefaults[key]) return { tip: "numeric", sonuc: numericDefaults[key] };

  const imageLike = ["AKCIGER_GRAFISI", "BT_TORAKS", "MAMOGRAFI", "MEME_USG", "BT_ABDOMEN", "BT_KRANIYAL", "USG_ABDOMEN", "PELVIK_USG"];
  if (imageLike.includes(key)) {
    return { tip: "image", sonuc: "Görüntüleme: belirgin patoloji yok / klinik korelasyon önerilir." };
  }
  if (key === "BIYOPSI") {
    return { tip: "text", sonuc: "Patoloji raporu: bulgular klinik bağlamda değerlendirilmeli." };
  }
  return { tip: "text", sonuc: "Sonuç normal sınırlarda." };
}

function katalogAdi(key: string, fallback?: string): string {
  return birlesikTestKatalogu.find((t) => t.key === key)?.ad || fallback || key;
}

export default function AdminVakaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const [vaka, setVaka] = useState<AdminVaka | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [meta, setMeta] = useState({
    hastalikAdi: "",
    anaSikayet: "",
    egitimNotu: "",
    seviye: "orta",
    durum: "aktif",
    etiketler: "",
    yasMin: 30,
    yasMax: 70,
    cinsiyetTercih: "herhangi",
    ozetBilgiler: "",
    kabulEdilenTani: "",
    uzmanOnayi: false,
    surum: 1,
  });
  const [rubricJson, setRubricJson] = useState("");
  const [newTest, setNewTest] = useState({
    testKey: "",
    testAdi: "",
    tip: "numeric",
    sonuc: '{"deger":0,"birim":"","referansAralik":""}',
    yorum: "",
  });
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [katalogFiltre, setKatalogFiltre] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/cases/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setVaka(d.case);
        setMeta({
          hastalikAdi: d.case.hastalikAdi,
          anaSikayet: d.case.anaSikayet,
          egitimNotu: d.case.egitimNotu || "",
          seviye: d.case.seviye || "orta",
          durum: d.case.durum || "aktif",
          etiketler: (d.case.etiketler || []).join(", "),
          yasMin: d.case.yasAraligi?.[0] ?? 30,
          yasMax: d.case.yasAraligi?.[1] ?? 70,
          cinsiyetTercih: d.case.cinsiyetTercih || "herhangi",
          ozetBilgiler: (d.case.ozetBilgiler || []).join("\n"),
          kabulEdilenTani: (d.case.rubric?.kabulEdilenTani || []).join(", "),
          uzmanOnayi: !!d.case.uzmanOnayi,
          surum: d.case.surum ?? 1,
        });
        setRubricJson(JSON.stringify(d.case.rubric || {}, null, 2));
        const drafts: Record<string, string> = {};
        for (const [k, t] of Object.entries(d.case.statikTestler || {}) as [string, TestSonucu][]) {
          drafts[`${k}::sonuc`] = pretty(t.sonuc);
          drafts[`${k}::yorum`] = t.yorum || "";
          drafts[`${k}::testAdi`] = t.testAdi || "";
          drafts[`${k}::referans`] = t.referans || "";
        }
        setEditDrafts(drafts);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 4000);
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    let rubric = vaka?.rubric;
    try {
      if (rubricJson.trim()) rubric = JSON.parse(rubricJson);
    } catch {
      setError("Rubrik JSON geçersiz.");
      return;
    }
    if (rubric) {
      rubric = {
        ...rubric,
        kabulEdilenTani: meta.kabulEdilenTani
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hastalikAdi: meta.hastalikAdi,
        anaSikayet: meta.anaSikayet,
        egitimNotu: meta.egitimNotu,
        seviye: meta.seviye,
        durum: meta.durum,
        etiketler: meta.etiketler
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        yasAraligi: [Number(meta.yasMin), Number(meta.yasMax)],
        cinsiyetTercih: meta.cinsiyetTercih,
        ozetBilgiler: meta.ozetBilgiler
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        rubric,
        uzmanOnayi: meta.uzmanOnayi,
        uzmanOnaylayan: meta.uzmanOnayi ? "admin" : undefined,
        uzmanOnayTarihi: meta.uzmanOnayi ? Date.now() : undefined,
        surum: Number(meta.surum) || 1,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Kayıt hatası");
      return;
    }
    notify("Vaka bilgileri kaydedildi.");
    load();
  }

  async function saveTestField(testKey: string, field: string, raw: string) {
    let value: unknown = raw;
    if (field === "sonuc") {
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw; // text sonuc
      }
    }
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/tests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testKey, field, value }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Test güncellenemedi");
      return;
    }
    notify(d.log?.message || "Test güncellendi.");
    if (d.backup) notify(`Otomatik yedek alındı: ${d.backup.id}`);
    load();
  }

  function selectCatalogTest(key: string) {
    const item = birlesikTestKatalogu.find((t) => t.key === key);
    if (!item) return;
    const def = defaultSonucForKey(key);
    setNewTest({
      testKey: item.key,
      testAdi: item.ad,
      tip: def.tip,
      sonuc: def.sonuc,
      yorum: "",
    });
  }

  async function addTestFromCatalog(key: string, e?: FormEvent) {
    e?.preventDefault();
    const item = birlesikTestKatalogu.find((t) => t.key === key);
    if (!item) {
      setError("Katalogdan test seçin.");
      return;
    }
    if (vaka?.statikTestler?.[key]) {
      setError("Bu test zaten vakada var — aşağıdan düzenleyin.");
      return;
    }
    const def = defaultSonucForKey(key);
    const tip = newTest.testKey === key ? newTest.tip : def.tip;
    let sonucRaw = newTest.testKey === key ? newTest.sonuc : def.sonuc;
    let sonuc: unknown = sonucRaw;
    try {
      sonuc = JSON.parse(sonucRaw);
    } catch {
      /* text */
    }
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testKey: item.key,
        testAdi: item.ad,
        tip,
        sonuc,
        yorum: newTest.testKey === key ? newTest.yorum : "",
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Eklenemedi");
      return;
    }
    notify(d.log?.message || `${item.ad} eklendi.`);
    setNewTest({
      testKey: "",
      testAdi: "",
      tip: "numeric",
      sonuc: '{"deger":0,"birim":"","referansAralik":""}',
      yorum: "",
    });
    load();
  }

  async function addTest(e: FormEvent) {
    e.preventDefault();
    if (!newTest.testKey) {
      setError("Listeden bir test seçin.");
      return;
    }
    await addTestFromCatalog(newTest.testKey, e);
  }

  async function deleteTest(testKey: string) {
    if (!confirm(`${testKey} silinsin mi?`)) return;
    const res = await fetch(
      `/api/admin/cases/${encodeURIComponent(id)}/tests?testKey=${encodeURIComponent(testKey)}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Silinemedi");
      return;
    }
    notify(d.log?.message || "Test silindi.");
    load();
  }

  async function deleteCase() {
    if (!confirm("Bu vaka kalıcı olarak silinsin mi? (log ile geri alınabilir)")) return;
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Silinemedi");
      return;
    }
    router.push("/admin/panel/vakalar");
  }

  const tests = Object.values(vaka?.statikTestler || {});
  const mevcutKeys = useMemo(
    () => new Set(Object.keys(vaka?.statikTestler || {})),
    [vaka?.statikTestler]
  );

  const katalogGruplu = useMemo(() => {
    const q = katalogFiltre.trim().toLowerCase();
    const list = birlesikTestKatalogu.filter(
      (t) =>
        !q ||
        t.ad.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.kategori.toLowerCase().includes(q)
    );
    const map = new Map<string, { key: string; ad: string; kategori: string }[]>();
    for (const t of list) {
      if (!map.has(t.kategori)) map.set(t.kategori, []);
      map.get(t.kategori)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [katalogFiltre]);

  if (error && !vaka) {
    return (
      <div>
        <p className="text-clinical-red">{error}</p>
        <Link href="/admin/panel/vakalar" className="text-sm text-steel">
          ← Vakalar
        </Link>
      </div>
    );
  }

  if (!vaka) {
    return <p className="text-sm text-steel">Yükleniyor…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/panel/vakalar" className="text-sm text-steel hover:text-ink">
            ← Vakalar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            {vaka.poliklinikIcon} {vaka.hastalikAdi}
          </h1>
          <p className="text-sm text-muted">
            {vaka.poliklinikAd} · {vaka.id} · {vaka.durum || "aktif"} · v{vaka.surum ?? 1}
            {vaka.uzmanOnayi ? " · ✓ onaylı" : ""}
          </p>
        </div>
        <Link
          href={`/admin/panel/oyna/${encodeURIComponent(id)}`}
          className="btn-accent text-sm"
        >
          🎮 Debug ile oyna
        </Link>
      </div>

      {flash && (
        <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{flash}</div>
      )}
      {error && (
        <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">{error}</div>
      )}

      <form onSubmit={saveMeta} className="rounded-xl border border-hairline bg-canvas p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Vaka editörü</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">Hastalık adı</label>
            <input
              className="input w-full"
              value={meta.hastalikAdi}
              onChange={(e) => setMeta({ ...meta, hastalikAdi: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Durum</label>
            <select
              className="input w-full"
              value={meta.durum}
              onChange={(e) => setMeta({ ...meta, durum: e.target.value })}
            >
              <option value="taslak">Taslak (öğrenciye kapalı)</option>
              <option value="aktif">Aktif</option>
              <option value="arsiv">Arşiv</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Seviye</label>
            <select
              className="input w-full"
              value={meta.seviye}
              onChange={(e) => setMeta({ ...meta, seviye: e.target.value })}
            >
              <option value="baslangic">Başlangıç</option>
              <option value="orta">Orta</option>
              <option value="ileri">İleri</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Cinsiyet tercihi</label>
            <select
              className="input w-full"
              value={meta.cinsiyetTercih}
              onChange={(e) => setMeta({ ...meta, cinsiyetTercih: e.target.value })}
            >
              <option value="herhangi">Herhangi</option>
              <option value="E">Erkek</option>
              <option value="K">Kadın</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">Yaş min</label>
            <input
              type="number"
              className="input w-full"
              value={meta.yasMin}
              onChange={(e) => setMeta({ ...meta, yasMin: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Yaş max</label>
            <input
              type="number"
              className="input w-full"
              value={meta.yasMax}
              onChange={(e) => setMeta({ ...meta, yasMax: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Sürüm</label>
            <input
              type="number"
              min={1}
              className="input w-full"
              value={meta.surum}
              onChange={(e) => setMeta({ ...meta, surum: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={meta.uzmanOnayi}
                onChange={(e) => setMeta({ ...meta, uzmanOnayi: e.target.checked })}
              />
              Uzman onayı
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">Etiketler (virgülle: OSCE, Acil, Poliklinik…)</label>
          <input
            className="input w-full"
            value={meta.etiketler}
            onChange={(e) => setMeta({ ...meta, etiketler: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">Ana şikayet</label>
          <input
            className="input w-full"
            value={meta.anaSikayet}
            onChange={(e) => setMeta({ ...meta, anaSikayet: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">Bilinen bilgiler (satır satır)</label>
          <textarea
            className="input w-full min-h-[70px]"
            value={meta.ozetBilgiler}
            onChange={(e) => setMeta({ ...meta, ozetBilgiler: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">Kabul edilen tanılar (virgülle)</label>
          <input
            className="input w-full"
            value={meta.kabulEdilenTani}
            onChange={(e) => setMeta({ ...meta, kabulEdilenTani: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">Eğitim notu</label>
          <textarea
            className="input w-full min-h-[80px]"
            value={meta.egitimNotu}
            onChange={(e) => setMeta({ ...meta, egitimNotu: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-muted">
            Rubrik editörü (JSON) — beklenen sorular / testler / red flag / gereksiz
          </label>
          <textarea
            className="input w-full min-h-[180px] font-mono text-xs"
            value={rubricJson}
            onChange={(e) => setRubricJson(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary text-sm">
            Bilgileri kaydet
          </button>
          <button type="button" className="btn-secondary text-sm text-clinical-red" onClick={deleteCase}>
            Vakayı sil
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">
            Test kataloğu ({birlesikTestKatalogu.length}) · vakada {tests.length}
          </h2>
          <input
            className="input max-w-xs text-sm"
            placeholder="Katalogda ara…"
            value={katalogFiltre}
            onChange={(e) => setKatalogFiltre(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted">
          Serbest test adı yazılmaz — listeden seçilir. Vakada olanlar düzenlenebilir; olmayanlar tek tıkla eklenir.
        </p>

        {/* Katalog listesi */}
        <div className="rounded-xl border border-hairline bg-canvas divide-y divide-hairline-soft max-h-[420px] overflow-y-auto">
          {katalogGruplu.map(([kategori, items]) => (
            <div key={kategori} className="p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {kategori}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const varMi = mevcutKeys.has(item.key);
                  const secili = newTest.testKey === item.key;
                  return (
                    <div
                      key={item.key}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                        secili
                          ? "border-brand bg-brand/5"
                          : varMi
                            ? "border-hairline bg-surface-soft"
                            : "border-hairline bg-canvas hover:bg-surface-soft"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          if (varMi) {
                            // scroll/focus existing - just select for info
                            selectCatalogTest(item.key);
                          } else {
                            selectCatalogTest(item.key);
                          }
                        }}
                      >
                        <div className="font-medium text-ink">{item.ad}</div>
                        <div className="text-[11px] text-muted">{item.key}</div>
                      </button>
                      {varMi ? (
                        <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-deep">
                          Vakada ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-accent text-xs shrink-0 py-1"
                          onClick={() => addTestFromCatalog(item.key)}
                        >
                          + Ekle
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {katalogGruplu.length === 0 && (
            <p className="p-4 text-sm text-muted">Aramaya uyan test yok.</p>
          )}
        </div>

        {/* Seçili test için sonuç formu (yeni ekleme öncesi) */}
        {newTest.testKey && !mevcutKeys.has(newTest.testKey) && (
          <form
            onSubmit={addTest}
            className="rounded-xl border border-brand/30 bg-brand/5 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-ink">
              Eklenecek: {katalogAdi(newTest.testKey)}
            </h3>
            <div className="text-xs text-muted">{newTest.testKey}</div>
            <div>
              <label className="text-xs text-muted">Tip</label>
              <select
                className="input w-full max-w-xs"
                value={newTest.tip}
                onChange={(e) => setNewTest({ ...newTest, tip: e.target.value })}
              >
                <option value="numeric">numeric</option>
                <option value="json">json</option>
                <option value="text">text</option>
                <option value="image">image</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Sonuç (JSON veya metin)</label>
              <textarea
                className="input w-full min-h-[100px] font-mono text-xs"
                value={newTest.sonuc}
                onChange={(e) => setNewTest({ ...newTest, sonuc: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Yorum</label>
              <input
                className="input w-full"
                value={newTest.yorum}
                onChange={(e) => setNewTest({ ...newTest, yorum: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-accent text-sm">
                Vakaya ekle
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() =>
                  setNewTest({
                    testKey: "",
                    testAdi: "",
                    tip: "numeric",
                    sonuc: "",
                    yorum: "",
                  })
                }
              >
                İptal
              </button>
            </div>
          </form>
        )}

        {/* Vakadaki testler — düzenleme */}
        <h3 className="text-base font-semibold text-ink pt-2">Vakadaki test sonuçları</h3>
        {tests.length === 0 && (
          <p className="text-sm text-muted">Henüz test yok — yukarıdaki katalogdan ekleyin.</p>
        )}
        {tests.map((t) => (
          <div key={t.testKey} className="rounded-xl border border-hairline bg-canvas p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-ink">{katalogAdi(t.testKey, t.testAdi)}</div>
                <div className="text-xs text-muted">
                  {t.testKey} · {t.tip}
                </div>
              </div>
              <button
                className="text-xs text-clinical-red hover:underline"
                onClick={() => deleteTest(t.testKey)}
              >
                Sil
              </button>
            </div>
            <div>
              <label className="text-xs text-muted">Sonuç (JSON veya metin)</label>
              <textarea
                className="input w-full min-h-[100px] font-mono text-xs"
                value={editDrafts[`${t.testKey}::sonuc`] ?? ""}
                onChange={(e) =>
                  setEditDrafts((d) => ({ ...d, [`${t.testKey}::sonuc`]: e.target.value }))
                }
              />
              <button
                className="btn-secondary text-xs mt-2"
                type="button"
                onClick={() =>
                  saveTestField(t.testKey, "sonuc", editDrafts[`${t.testKey}::sonuc`] ?? "")
                }
              >
                Sonucu kaydet
              </button>
            </div>
            <div>
              <label className="text-xs text-muted">Yorum</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={editDrafts[`${t.testKey}::yorum`] ?? ""}
                  onChange={(e) =>
                    setEditDrafts((d) => ({ ...d, [`${t.testKey}::yorum`]: e.target.value }))
                  }
                />
                <button
                  className="btn-secondary text-xs"
                  type="button"
                  onClick={() =>
                    saveTestField(t.testKey, "yorum", editDrafts[`${t.testKey}::yorum`] ?? "")
                  }
                >
                  Kaydet
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted">Referans</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={editDrafts[`${t.testKey}::referans`] ?? ""}
                  onChange={(e) =>
                    setEditDrafts((d) => ({ ...d, [`${t.testKey}::referans`]: e.target.value }))
                  }
                />
                <button
                  className="btn-secondary text-xs"
                  type="button"
                  onClick={() =>
                    saveTestField(t.testKey, "referans", editDrafts[`${t.testKey}::referans`] ?? "")
                  }
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
