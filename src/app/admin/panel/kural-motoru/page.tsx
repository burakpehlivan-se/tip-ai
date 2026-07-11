"use client";

import { useCallback, useEffect, useState } from "react";

interface RuleEntry {
  id: string;
  testKey: string;
  diseaseKey: string;
  tendency: "yuksek" | "dusuk";
  factor: number;
  description: string;
  active: boolean;
}

interface DiseaseAlias {
  alias: string;
  target: string;
}

interface RuleStore {
  version: number;
  rules: RuleEntry[];
  aliases: DiseaseAlias[];
}

interface FormState {
  testKey: string;
  diseaseKey: string;
  tendency: "yuksek" | "dusuk";
  factor: string;
  description: string;
}

const ALL_TEST_KEYS = [
  "TROPONIN","BNP","CKMB","MYOGLOBIN","KREATININ_KINAZ",
  "GLUKOZ","HBA1C","LACTATE","AMMONIA",
  "KREATININ","BUN","URE","GFR","URIC_ACID",
  "NA","K","CL","CA","MG","PHOS",
  "ALT","AST","ALP","GGT","TBIL","DBIL","ALBUMIN",
  "CHOL","LDL","HDL","TRIG",
  "CRP","ESR","PROCT","FERITIN",
  "AMILAZ","LIPAZ",
  "TSH","FT4","FT3",
  "WBC","RBC","HGB","HCT","MCV","PLT","NEUT","LYMPH","EOS",
  "PT","PTT","INR","FIBRINOGEN","DDIMER",
  "PH","PCO2","PO2","HCO3",
  "U_PH","U_SG","U_PROTEIN","U_GLUKOZ",
  "DEMIR","BHCG","GOZ_BASINCI",
];

const emptyForm = (): FormState => ({
  testKey: "",
  diseaseKey: "",
  tendency: "yuksek",
  factor: "",
  description: "",
});

export default function KuralMotoruPage() {
  const [store, setStore] = useState<RuleStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [filterTest, setFilterTest] = useState("");
  const [filterDisease, setFilterDisease] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [newAlias, setNewAlias] = useState({ alias: "", target: "" });
  const [showAlias, setShowAlias] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rule-engine");
      if (!res.ok) throw new Error("Yüklenemedi");
      setStore(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function api(action: string, body: Record<string, unknown>) {
    setError("");
    setMsg("");
    const res = await fetch("/api/admin/rule-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "API hatası");
    return json;
  }

  async function handleAdd() {
    try {
      await api("add-rule", {
        testKey: form.testKey,
        diseaseKey: form.diseaseKey.toLowerCase().replace(/\s+/g, "-"),
        tendency: form.tendency,
        factor: Number(form.factor) || 1,
        description: form.description,
      });
      setMsg("Kural eklendi.");
      setForm(emptyForm());
      setShowAdd(false);
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleUpdate(id: string) {
    try {
      await api("update-rule", {
        id,
        tendency: form.tendency,
        factor: Number(form.factor) || 1,
        description: form.description,
      });
      setMsg("Kural güncellendi.");
      setEditingId(null);
      setForm(emptyForm());
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await api("update-rule", { id, active: !currentActive });
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;
    try {
      await api("delete-rule", { id });
      setMsg("Kural silindi.");
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleAddAlias() {
    try {
      await api("add-alias", {
        alias: newAlias.alias.toLowerCase().trim(),
        target: newAlias.target.toLowerCase().trim(),
      });
      setMsg("Alias eklendi.");
      setNewAlias({ alias: "", target: "" });
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteAlias(alias: string) {
    try {
      await api("delete-alias", { alias });
      setMsg("Alias silindi.");
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleReset() {
    if (!confirm("Tüm kuralları varsayılana sıfırla? Bu işlem geri alınamaz.")) return;
    try {
      await api("reset", {});
      setMsg("Kurallar varsayılana sıfırlandı.");
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  function startEdit(rule: RuleEntry) {
    setEditingId(rule.id);
    setForm({
      testKey: rule.testKey,
      diseaseKey: rule.diseaseKey,
      tendency: rule.tendency,
      factor: String(rule.factor),
      description: rule.description,
    });
    setShowAdd(false);
  }

  if (loading) return <p className="text-sm text-steel">Yükleniyor…</p>;
  if (!store) return <p className="text-clinical-red">{error || "Veri yok"}</p>;

  const rules = store.rules;
  const filteredRules = rules.filter((r) => {
    if (filterTest && r.testKey !== filterTest) return false;
    if (filterDisease && !r.diseaseKey.includes(filterDisease.toLowerCase())) return false;
    return true;
  });

  const allTests = Array.from(new Set(rules.map((r) => r.testKey))).sort();
  const allDiseases = Array.from(new Set(rules.map((r) => r.diseaseKey))).sort();
  const activeCount = rules.filter((r) => r.active).length;
  const inactiveCount = rules.length - activeCount;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Hastalık Kontrol Motoru
          </h1>
          <p className="mt-1 text-sm text-steel">
            Testlerin hastalığa göre anormal değer üretme kurallarını yönetin.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" onClick={load}>
            Yenile
          </button>
          <button
            className="btn-accent text-xs"
            onClick={() => { setShowAdd(true); setEditingId(null); setForm(emptyForm()); }}
          >
            + Kural ekle
          </button>
        </div>
      </div>

      {/* Özet */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Toplam kural" value={rules.length} />
        <StatCard label="Aktif" value={activeCount} tone="good" />
        <StatCard label="Pasif" value={inactiveCount} tone="warn" />
        <StatCard label="Hastalık alias" value={store.aliases.length} />
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-clinical-red/30 bg-clinical-red/5 p-3 text-sm text-clinical-red">
          {error}
          <button className="ml-2 underline" onClick={() => setError("")}>Kapat</button>
        </div>
      )}
      {msg && (
        <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm text-brand-deep">
          {msg}
          <button className="ml-2 underline" onClick={() => setMsg("")}>Kapat</button>
        </div>
      )}

      {/* Filtreler */}
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          className="input text-xs"
          value={filterTest}
          onChange={(e) => setFilterTest(e.target.value)}
        >
          <option value="">Tüm testler</option>
          {allTests.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          className="input text-xs"
          placeholder="Hastalık ara..."
          value={filterDisease}
          onChange={(e) => setFilterDisease(e.target.value)}
        />
        <button className="btn-secondary text-xs" onClick={handleReset}>
          Varsayılana sıfırla
        </button>
      </div>

      {/* Kural ekleme/düzenleme formu */}
      {(showAdd || editingId) && (
        <div className="mt-4 rounded-xl border border-hairline bg-canvas p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">
            {editingId ? `Düzenle: ${editingId}` : "Yeni kural"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!editingId && (
              <div>
                <label className="text-xs text-muted">Test anahtarı</label>
                <select
                  className="input w-full text-sm"
                  value={form.testKey}
                  onChange={(e) => setForm({ ...form, testKey: e.target.value })}
                >
                  <option value="">Seçin</option>
                  {ALL_TEST_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            )}
            {!editingId && (
              <div>
                <label className="text-xs text-muted">Hastalık anahtarı</label>
                <input
                  className="input w-full text-sm"
                  placeholder="örn: stemi, hipotiroidi"
                  value={form.diseaseKey}
                  onChange={(e) => setForm({ ...form, diseaseKey: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted">Yön</label>
              <select
                className="input w-full text-sm"
                value={form.tendency}
                onChange={(e) => setForm({ ...form, tendency: e.target.value as "yuksek" | "dusuk" })}
              >
                <option value="yuksek">yuksek (artmış)</option>
                <option value="dusuk">dusuk (azalmış)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Faktör (çarpan)</label>
              <input
                className="input w-full text-sm"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="örn: 3"
                value={form.factor}
                onChange={(e) => setForm({ ...form, factor: e.target.value })}
              />
            </div>
            <div className={editingId ? "sm:col-span-2" : "sm:col-span-4"}>
              <label className="text-xs text-muted">Açıklama</label>
              <input
                className="input w-full text-sm"
                placeholder="örn: STEMI → Troponin belirgin yüksek"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-accent text-sm" onClick={editingId ? () => handleUpdate(editingId) : handleAdd}>
              {editingId ? "Güncelle" : "Ekle"}
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() => { setShowAdd(false); setEditingId(null); setForm(emptyForm()); }}
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Kural tablosu */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-hairline bg-canvas">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft text-left">
              <th className="px-3 py-2 text-xs font-medium text-muted">Test</th>
              <th className="px-3 py-2 text-xs font-medium text-muted">Hastalık</th>
              <th className="px-3 py-2 text-xs font-medium text-muted">Yön</th>
              <th className="px-3 py-2 text-xs font-medium text-muted">Faktör</th>
              <th className="px-3 py-2 text-xs font-medium text-muted">Açıklama</th>
              <th className="px-3 py-2 text-xs font-medium text-muted">Durum</th>
              <th className="px-3 py-2 text-xs font-medium text-muted w-28">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((r) => (
              <tr key={r.id} className={`border-b border-hairline-soft ${!r.active ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs">{r.testKey}</td>
                <td className="px-3 py-2">{r.diseaseKey}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    r.tendency === "yuksek"
                      ? "bg-clinical-red/10 text-clinical-red"
                      : "bg-brand/10 text-brand-deep"
                  }`}>
                    {r.tendency === "yuksek" ? "↑ YÜKSEK" : "↓ DÜŞÜK"}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">×{r.factor}</td>
                <td className="px-3 py-2 text-xs text-steel max-w-xs truncate">{r.description}</td>
                <td className="px-3 py-2">
                  <button
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer ${
                      r.active ? "bg-brand/10 text-brand-deep" : "bg-surface text-steel"
                    }`}
                    onClick={() => handleToggle(r.id, r.active)}
                  >
                    {r.active ? "aktif" : "pasif"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      className="text-xs text-brand-deep hover:underline"
                      onClick={() => startEdit(r)}
                    >
                      Düzenle
                    </button>
                    <button
                      className="text-xs text-clinical-red hover:underline"
                      onClick={() => handleDelete(r.id)}
                    >
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-steel">
                  Bu filtrede kural yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Alias yönetimi */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">Hastalık Alias&apos;ları</h3>
          <button
            className="btn-secondary text-xs"
            onClick={() => setShowAlias(!showAlias)}
          >
            {showAlias ? "Gizle" : "Alias yönet"}
          </button>
        </div>
        <p className="mt-1 text-xs text-steel">
          Alias&apos;lar, farklı yazılan hastalık isimlerini kanonik anahtara eşler (örn: diyabet → tip2-dm).
        </p>

        {showAlias && (
          <>
            <div className="mt-3 flex gap-2">
              <input
                className="input text-sm w-40"
                placeholder="Alias (örn: diyabet)"
                value={newAlias.alias}
                onChange={(e) => setNewAlias({ ...newAlias, alias: e.target.value })}
              />
              <span className="text-steel self-center">→</span>
              <input
                className="input text-sm w-40"
                placeholder="Hedef (örn: tip2-dm)"
                value={newAlias.target}
                onChange={(e) => setNewAlias({ ...newAlias, target: e.target.value })}
              />
              <button className="btn-accent text-xs" onClick={handleAddAlias}>
                Ekle
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {store.aliases.map((a) => (
                <span
                  key={a.alias}
                  className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-xs"
                >
                  <span className="text-steel">{a.alias}</span>
                  <span className="text-muted">→</span>
                  <span className="font-mono text-ink">{a.target}</span>
                  <button
                    className="ml-1 text-clinical-red hover:underline text-[10px]"
                    onClick={() => handleDeleteAlias(a.alias)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Rehber */}
      <div className="mt-8 rounded-xl border border-hairline bg-surface-soft p-5">
        <h3 className="text-lg font-semibold text-ink mb-3">Kural Motoru Yönetim Rehberi</h3>
        <div className="space-y-6 text-sm text-steel leading-relaxed">

          {/* 1. Genel Bakış */}
          <section>
            <h4 className="font-semibold text-ink mb-2">1. Genel Bakış</h4>
            <p>
              Kural Motoru, tıp_ai simülasyonunda <strong>hastalığa özgü anormal laboratuvar değerleri</strong> üretmekten sorumludur.
              Bir öğrenci vakada test istediğinde, sistem hastalık profilini inceler ve eşleşen kurallara göre test sonucunu anormal ya da normal olarak belirler.
            </p>
            <p className="mt-2">
              Motor <strong>4 katmanlı</strong> çalışır. Her katman sırayla denenir, ilk eşleşen sonuç döner:
            </p>
            <div className="mt-2 ml-4 space-y-2">
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="rounded-full bg-clinical-red/10 px-2 py-0.5 text-[10px] font-semibold text-clinical-red">Katman 1</span>
                <span className="ml-2 font-medium text-ink">Statik Testler (Override)</span>
                <p className="mt-1 text-xs">
                  Vaka yazarı <code>statikTestler</code> alanına özel bir sonuç girmişse doğrudan o değer döner.
                  Bu katman <strong>kural motorundan önce</strong> çalışır ve tüm kuralları bypass eder.
                  Rapor tipi testler (EKG, BT, USG) ve vaka özel durumlar için kullanılır.
                </p>
              </div>
              <div className="rounded-lg border border-brand/30 bg-canvas p-3">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">Katman 2</span>
                <span className="ml-2 font-medium text-ink">Kural Motoru</span>
                <p className="mt-1 text-xs">
                  Bu sayfada yönettiğiniz kurallar. Vakanın <code>hastalikKey</code> değeri bir kuralla eşleşirse,
                  belirtilen yön ve faktöre göre <strong>anormal değer</strong> üretilir.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-steel">Katman 3</span>
                <span className="ml-2 font-medium text-ink">Referans Kütüphanesi</span>
                <p className="mt-1 text-xs">
                  Hiçbir kural eşleşmezse, referans aralığı içinde rastgele bir <strong>normal değer</strong> üretilir.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">Katman 4</span>
                <span className="ml-2 font-medium text-ink">Bilinmeyen Test</span>
                <p className="mt-1 text-xs">
                  Test referans kütüphanesinde tanımlı değilse <code>null</code> döner ve konsola uyarı loglanır.
                  Bu testler için <code>lab-reference-library.json</code> dosyasına giriş eklenmelidir.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Kural Yapısı */}
          <section>
            <h4 className="font-semibold text-ink mb-2">2. Kural Yapısı (Veri Modeli)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    <th className="px-3 py-2 text-muted font-medium">Alan</th>
                    <th className="px-3 py-2 text-muted font-medium">Tür</th>
                    <th className="px-3 py-2 text-muted font-medium">Açıklama</th>
                    <th className="px-3 py-2 text-muted font-medium">Örnek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  <tr>
                    <td className="px-3 py-2 font-mono text-ink">testKey</td>
                    <td className="px-3 py-2">string</td>
                    <td className="px-3 py-2">Hangi laboratuvar testini etkileyeceği</td>
                    <td className="px-3 py-2 font-mono">TROPONIN, TSH, GLUKOZ</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-ink">diseaseKey</td>
                    <td className="px-3 py-2">string</td>
                    <td className="px-3 py-2">Hangi hastalıkta tetikleneceği — vakanın <code>hastalikKey</code> değeriyle eşleşir</td>
                    <td className="px-3 py-2 font-mono">stemi, hipotiroidi, tip2-dm</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-ink">tendency</td>
                    <td className="px-3 py-2">enum</td>
                    <td className="px-3 py-2"><code>yuksek</code> = referans üstüne çıkar, <code>dusuk</code> = altına iner</td>
                    <td className="px-3 py-2"><span className="text-clinical-red">yuksek</span> / <span className="text-brand-deep">dusuk</span></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-ink">factor</td>
                    <td className="px-3 py-2">number</td>
                    <td className="px-3 py-2">Normal referans aralığının kaç katı sapacağı. Örn: TROPONIN üst sınır 0.04 × factor 20 = 0.80</td>
                    <td className="px-3 py-2 font-mono">20, 3, 0.5, 0.08</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-ink">description</td>
                    <td className="px-3 py-2">string</td>
                    <td className="px-3 py-2">İnsan tarafından okunabilir açıklama</td>
                    <td className="px-3 py-2">STEMI → Troponin belirgin yüksek</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-ink">active</td>
                    <td className="px-3 py-2">boolean</td>
                    <td className="px-3 py-2">Pasif kurallar göz ardı edilir, normal değer döner</td>
                    <td className="px-3 py-2">true / false</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-lg border border-clinical-orange/20 bg-clinical-orange/5 p-3">
              <span className="text-xs font-semibold text-clinical-orange">⚠ Kural ID&apos;si</span>
              <p className="mt-1 text-xs">
                Her kuralın ID&apos;si otomatik olarak <code className="font-mono">testKey::diseaseKey</code> formatında oluşturulur (örn: <code className="font-mono">TROPONIN::stemi</code>).
                Aynı test-hastalık çifti için iki kural olamaz — sistem hata verir.
              </p>
            </div>
          </section>

          {/* 3. Faktör Seçim Rehberi */}
          <section>
            <h4 className="font-semibold text-ink mb-2">3. Faktör Seçim Rehberi</h4>
            <p>
              Faktör, testin normal referans aralığından <strong>kaç kat sapacağını</strong> belirler.
              Doğru faktör seçimi, simülasyonun gerçekçiliği için kritiktir.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    <th className="px-3 py-2 text-muted font-medium">Klinik Durum</th>
                    <th className="px-3 py-2 text-muted font-medium">Önerilen Faktör</th>
                    <th className="px-3 py-2 text-muted font-medium">Mekanizma</th>
                    <th className="px-3 py-2 text-muted font-medium">Örnek</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  <tr>
                    <td className="px-3 py-2 font-medium text-ink">Belirgin patoloji</td>
                    <td className="px-3 py-2 font-mono text-clinical-red">10–20</td>
                    <td className="px-3 py-2">Test değeri normalin çok üstünde, tanı koydurucu düzeyde</td>
                    <td className="px-3 py-2">STEMI → Troponin 20× · Pnömoni → CRP 15×</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-ink">Orta patoloji</td>
                    <td className="px-3 py-2 font-mono text-clinical-orange">3–8</td>
                    <td className="px-3 py-2">Anormal ama ekarte edilebilir seviyede</td>
                    <td className="px-3 py-2">Sepsis → Laktat 3× · Pankreatit → Lipaz 8×</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-ink">Hafif sapma</td>
                    <td className="px-3 py-2 font-mono text-amber-600">1.2–2.5</td>
                    <td className="px-3 py-2">Kronik hastalık göstergesi, sınırda değer</td>
                    <td className="px-3 py-2">KBH → Kreatinin 2× · ABH → K 1.3×</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-ink">Baskılanma</td>
                    <td className="px-3 py-2 font-mono text-steel">0.05–0.5</td>
                    <td className="px-3 py-2">Test normalin altına iner (hormon baskılanması vb.)</td>
                    <td className="px-3 py-2">Hipertiroidi → TSH 0.08× · DEA → Ferritin 0.3×</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
              <span className="text-xs font-semibold text-brand-deep">💡 Faktör hesabı</span>
              <p className="mt-1 text-xs">
                <code className="font-mono">yuksek</code> için: üretilen değer = referans üst sınırı × faktör (veya referans aralığın ortası + aralık × faktör).<br />
                <code className="font-mono">dusuk</code> için: üretilen değer = referans alt sınırı ÷ faktör (veya referans aralığın ortası − aralık × faktör).<br />
                Örnek: CRP için referans 0–0.5 mg/dL, faktör 15 → yaklaşık 7.5 mg/dL civarı üretilir.
              </p>
            </div>
          </section>

          {/* 4. Adım Adım Kılavuz */}
          <section>
            <h4 className="font-semibold text-ink mb-2">4. Adım Adım Kılavuz</h4>

            <div className="space-y-4">
              <div className="rounded-lg border border-hairline-soft bg-canvas p-4">
                <h5 className="font-medium text-ink text-xs">4.1. Yeni Hastalık İçin Kural Ekleme</h5>
                <ol className="mt-2 space-y-2 text-xs ml-5 list-decimal">
                  <li>
                    <strong>Hastalığın hangi testleri etkileyeceğini belirleyin.</strong>
                    <br />Örn: Menenjit → CRP (↑), WBC (↑), Laktat (↑), Prokalsitonin (↑). Tıbbi referanslara dayanın.
                  </li>
                  <li>
                    <strong>Her test için "+ Kural ekle" butonuyla kural oluşturun.</strong>
                    <br />Test anahtarını dropdown&apos;dan seçin, hastalık anahtarını lowercase ve tireli girin.
                  </li>
                  <li>
                    <strong>Yön ve faktör belirleyin.</strong>
                    <br />Yukarıdaki faktör seçim rehberini kullanın.
                  </li>
                  <li>
                    <strong>Açıklama yazın.</strong>
                    <br />Kısa ve net: "Menenjit → CRP yüksek".
                  </li>
                  <li>
                    <strong>Gerekirse alias ekleyin.</strong>
                    <br />Hastalık farklı yazılabiliyorsa (örn: <code>bakteriyel-menenjit → menenjit</code>) alias tanımlayın.
                  </li>
                  <li>
                    <strong>Vakanın <code>hastalikKey</code> değerini kuralla aynı yapın.</strong>
                    <br />Vaka düzenleyicide hastalık anahtarını girin. Kuraldaki diseaseKey ile birebir aynı olmalı.
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-hairline-soft bg-canvas p-4">
                <h5 className="font-medium text-ink text-xs">4.2. Mevcut Kuralı Düzenleme</h5>
                <ol className="mt-2 space-y-2 text-xs ml-5 list-decimal">
                  <li>Tabloda kuralın <strong>"Düzenle"</strong> butonuna tıklayın.</li>
                  <li>Form alanları kuralın mevcut değerleriyle dolar. Test ve hastalık anahtarı değiştirilemez (ID&apos;yi oluşturdukları için).</li>
                  <li>Yön, faktör veya açıklamayı değiştirip <strong>"Güncelle"</strong> butonuna tıklayın.</li>
                  <li>Değişiklik anında etki eder — sayfa yenilemeye gerek yoktur.</li>
                </ol>
              </div>

              <div className="rounded-lg border border-hairline-soft bg-canvas p-4">
                <h5 className="font-medium text-ink text-xs">4.3. Kuralı Geçici Olarak Devre Dışı Bırakma</h5>
                <p className="mt-1 text-xs">
                  Bir kuralı silmeden geçici olarak kapatmak için tablodaki <strong>aktif/pasif</strong> badge&apos;ine tıklayın.
                  Pasif kurallar göz ardı edilir — ilgili test için normal değer döner.
                  Tekrar tıklayarak aktif edebilirsiniz.
                </p>
              </div>

              <div className="rounded-lg border border-hairline-soft bg-canvas p-4">
                <h5 className="font-medium text-ink text-xs">4.4. Kural Silme</h5>
                <p className="mt-1 text-xs">
                  Tablodaki <strong>"Sil"</strong> butonuna tıklayın. Onay diyaloğunu kabul edin.
                  Silme işlemi geri alınamaz. Kuralı tekrar eklemek için "+ Kural ekle" ile yeniden oluşturmanız gerekir.
                </p>
              </div>

              <div className="rounded-lg border border-hairline-soft bg-canvas p-4">
                <h5 className="font-medium text-ink text-xs">4.5. Varsayılana Sıfırlama</h5>
                <p className="mt-1 text-xs">
                  <strong>"Varsayılana sıfırla"</strong> butonu tüm kuralları ve alias&apos;ları fabrika ayarlarına döndürür.
                  73 varsayılan kural ve 7 alias geri yüklenir, tüm özel değişiklikleriniz silinir.
                  Bu işlem <strong>geri alınamaz</strong> — kullanmadan önce emin olun.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Alias Sistemi */}
          <section>
            <h4 className="font-semibold text-ink mb-2">5. Alias Sistemi</h4>
            <p>
              Alias&apos;lar, <strong>farklı yazılan hastalık isimlerini</strong> kanonik anahtara eşler.
              Vaka yazarı <code>hastalikKey</code> olarak farklı bir isim girmişse, alias sayesinde doğru kural eşleşir.
            </p>
            <div className="mt-3 rounded-lg border border-hairline-soft bg-canvas p-3">
              <h5 className="text-xs font-semibold text-ink">Nasıl çalışır?</h5>
              <pre className="mt-2 rounded bg-surface p-2 text-[11px] font-mono text-steel">
{`// Alias tanımı:  "diyabet" → "tip2-dm"
// Vaka:          hastalikKey: "diyabet"
// Sonuç:         "diyabet" alias'ı "tip2-dm"e çözümlenir
//                → TIP2-DM kuralları (GLUKOZ↑, HBA1C↑) uygulanır`}
              </pre>
            </div>
            <p className="mt-3 text-xs">
              Alias eklemek için sayfanın altındaki <strong>"Alias yönet"</strong> butonuna tıklayın,
              sol kutuya farklı yazımı (örn: <code>pnömoni</code>), sağ kutuya kanonik anahtarı (örn: <code>pnömoni</code>) girin,
              <strong>"Ekle"</strong> butonuna tıklayın. Mevcut 7 varsayılan alias:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ["tip-2-diyabet", "tip2-dm"],
                ["tip2dm", "tip2-dm"],
                ["diyabet", "tip2-dm"],
                ["enfeksiyon", "iye"],
                ["pankreatit", "akut-pankreatit"],
                ["anemi", "demir-eksikligi-anemisi"],
                ["sok", "sepsis"],
              ].map(([a, t]) => (
                <span key={a} className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[10px]">
                  <span className="text-steel">{a}</span>
                  <span className="mx-1 text-muted">→</span>
                  <span className="font-mono text-ink">{t}</span>
                </span>
              ))}
            </div>
          </section>

          {/* 6. Hastalık Eşleştirme Mantığı */}
          <section>
            <h4 className="font-semibold text-ink mb-2">6. Hastalık Eşleştirme Mantığı</h4>
            <p>
              Sistem, vakanın klinik profilindeki hastalık bilgisini <strong>üç kaynaktan</strong> sırayla arar:
            </p>
            <ol className="mt-2 ml-5 space-y-2 text-xs list-decimal">
              <li>
                <strong><code>hastalikKey</code></strong> — Vakanın doğrudan belirttiği hastalık anahtarı. En spesifik ve öncelikli kaynak.
              </li>
              <li>
                <strong><code>diagnoses[]</code></strong> — Vakanın tanı listesi. <code>hastalikKey</code> eşleşmezse burada aranır.
                Alias çözümlemesi yapılır, ayrıca substring eşleştirme de denenir.
              </li>
              <li>
                <strong><code>comorbidities[]</code></strong> — Komorbidite listesi. Tanılardan sonra bakılır.
              </li>
            </ol>
            <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3">
              <span className="text-xs font-semibold text-brand-deep">💡 İpucu</span>
              <p className="mt-1 text-xs">
                Bir vakanın hem ana hastalığı hem komorbiditesi için kural varsa, <strong>ilk eşleşen</strong> kullanılır.
                Bu yüzden <code>hastalikKey</code> her zaman en doğru eşleşmeyi verir. Belirsizlik durumunda vakanın <code>hastalikKey</code> değerini netleştirin.
              </p>
            </div>
          </section>

          {/* 7. Sık Karşılaşılan Senaryolar */}
          <section>
            <h4 className="font-semibold text-ink mb-2">7. Sık Karşılaşılan Senaryolar</h4>
            <div className="space-y-3">
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="text-xs font-semibold text-brand-deep">🆕 Yeni vaka, mevcut hastalık</span>
                <p className="mt-1 text-xs">
                  Hastalık zaten kurallı. Vakanın <code>hastalikKey</code> değerini mevcut diseaseKey ile aynı yapın — kurallar otomatik çalışır.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="text-xs font-semibold text-clinical-orange">🆕 Yeni vaka, yeni hastalık</span>
                <p className="mt-1 text-xs">
                  <strong>Önce bu sayfadan kuralları ekleyin, sonra vakayı oluşturun.</strong> Kural yoksa tüm testler normal değer döner,
                  öğrenci hastalığı tespit edemez.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="text-xs font-semibold text-clinical-red">🔧 Mevcut vaka, yanlış değer</span>
                <p className="mt-1 text-xs">
                  Faktör çok düşük veya çok yüksek olabilir. Kuralı düzenleyip faktörü ayarlayın. Değişiklik hemen yansır,
                  sayfa yenilemeye gerek yoktur.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="text-xs font-semibold text-steel">🖼️ Görüntüleme testleri (BT, USG, EKG, MR)</span>
                <p className="mt-1 text-xs">
                  Kural motoru <strong>sadece numerik laboratuvar testlerini</strong> etkiler. Rapor tipi testler için
                  vaka düzenleyicide <code>statikTestler</code> bölümüne özel override girmelisiniz.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <span className="text-xs font-semibold text-steel">📊 Panel testler (CBC, ELEKTROLIT, ABG)</span>
                <p className="mt-1 text-xs">
                  Kural motoru şu anda panel testlerin alt bileşenlerini (örn: CBC içindeki WBC, HGB, PLT)
                  toplu olarak değiştiremez. Her alt bileşen için <strong>ayrı kural</strong> eklemeniz gerekir.
                  Örn: "WBC::pnömoni", "CRP::pnömoni" şeklinde iki ayrı kural.
                </p>
              </div>
            </div>
          </section>

          {/* 8. Sorun Giderme */}
          <section>
            <h4 className="font-semibold text-ink mb-2">8. Sorun Giderme</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    <th className="px-3 py-2 text-muted font-medium w-1/3">Sorun</th>
                    <th className="px-3 py-2 text-muted font-medium">Olası Neden</th>
                    <th className="px-3 py-2 text-muted font-medium">Çözüm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  <tr>
                    <td className="px-3 py-2 font-medium text-clinical-red">Kural çalışmıyor, test normal dönüyor</td>
                    <td className="px-3 py-2">Kural <strong>pasif</strong> olabilir veya vakanın <code>hastalikKey</code> değeri eşleşmiyor</td>
                    <td className="px-3 py-2">Kuralın aktif olduğunu kontrol edin. Vaka düzenleyicide <code>hastalikKey</code> değerini kuraldaki diseaseKey ile birebir aynı yapın</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-clinical-orange">Değerler çok uç veya çok normal</td>
                    <td className="px-3 py-2">Faktör değeri uygun olmayabilir</td>
                    <td className="px-3 py-2">Faktör seçim rehberini kontrol edin, faktörü ayarlayın</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-clinical-red">Test hiç sonuç dönmüyor (null)</td>
                    <td className="px-3 py-2">Test referans kütüphanesinde tanımlı değil</td>
                    <td className="px-3 py-2"><code>lab-reference-library.json</code> dosyasına test eklenmeli. Geliştirici müdahalesi gerekir</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-clinical-orange">Aynı test-hastalık için kural eklenemiyor</td>
                    <td className="px-3 py-2">Bu ikili için zaten bir kural var (ID çakışması)</td>
                    <td className="px-3 py-2">Mevcut kuralı düzenleyin veya silip yeniden ekleyin</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-steel">Farklı yazılan hastalık eşleşmiyor</td>
                    <td className="px-3 py-2">Alias tanımlanmamış</td>
                    <td className="px-3 py-2">Alias ekleyin: farklı yazım → kanonik anahtar</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 9. Teknik Detaylar */}
          <section>
            <h4 className="font-semibold text-ink mb-2">9. Teknik Detaylar</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <h5 className="text-xs font-semibold text-ink">💾 Depolama</h5>
                <p className="mt-1 text-xs">
                  Kurallar <code className="font-mono">data/admin/rule-engine.json</code> dosyasında JSON formatında saklanır.
                  Atomik yazma (temp + rename) ile veri bütünlüğü korunur.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <h5 className="text-xs font-semibold text-ink">🔄 Fallback</h5>
                <p className="mt-1 text-xs">
                  JSON dosyası bozuksa veya okunamazsa, <code className="font-mono">lab-motor.ts</code> içindeki
                  <code className="font-mono">FALLBACK_RULES</code> kullanılır. Sistem her zaman çalışır durumda kalır.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <h5 className="text-xs font-semibold text-ink">📊 Toplam Kural</h5>
                <p className="mt-1 text-xs">
                  Şu anda <strong>73 varsayılan kural</strong> ve <strong>7 alias</strong> ile gelir.
                  Yeni kurallar ekledikçe sayı artar.
                </p>
              </div>
              <div className="rounded-lg border border-hairline-soft bg-canvas p-3">
                <h5 className="text-xs font-semibold text-ink">🔐 Yetki</h5>
                <p className="mt-1 text-xs">
                  Kural motoru sadece <strong>admin</strong> rolü tarafından yönetilebilir.
                  Doktor rolü bu sayfaya erişemez. API <code>system.migrate</code> yetkisi gerektirir.
                </p>
              </div>
            </div>
          </section>

          {/* 10. Mevcut Varsayılan Kurallar */}
          <section>
            <h4 className="font-semibold text-ink mb-2">10. Mevcut Varsayılan Kurallar (Özet)</h4>
            <p className="text-xs">
              Sistem <strong>73 varsayılan kural</strong> ile kurulur. En sık kullanılan test-hastalık eşleşmeleri aşağıda gruplanmıştır.
              Tam listeyi yukarıdaki tablodan görebilirsiniz.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { group: "Kardiyak", rules: ["TROPONIN → stemi, nstemi, kalp-yetmezligi", "BNP → kalp-yetmezligi, stemi, nstemi"] },
                { group: "Endokrin", rules: ["GLUKOZ/HBA1C → tip2-dm, diyabetik-*", "TSH/FT4 → hipotiroidi, hipertiroidi"] },
                { group: "Enfeksiyon", rules: ["CRP → pnömoni, apandisit, kolesistit, pankreatit, KOAH, İYE", "WBC → pnömoni, apandisit, kolesistit, pankreatit", "PROCT → pnömoni", "LACTATE → sepsis, pnömoni"] },
                { group: "Böbrek", rules: ["KREATININ/BUN/K/GFR → kbh, abh, ckd-ev3", "U_PROTEIN → kbh, preeklampsi"] },
                { group: "Gastro/Hepatobilier", rules: ["AMILAZ/LIPAZ → akut-pankreatit", "ALT/AST/TBIL/GGT → hepatit, kolesistit, koledokolitiazis", "ALP → koledokolitiazis"] },
                { group: "Hematoloji", rules: ["HGB/HCT/MCV/FERITIN → demir-eksikligi-anemisi", "DDIMER → dvt", "PLT → preeklampsi"] },
                { group: "Kan Gazı", rules: ["PH/PO2/PCO2 → KOAH, pnömoni, astım"] },
                { group: "Diğer", rules: ["CA → meme-ca, akciger-ca", "ALBUMIN → hepatit", "U_SG → iye"] },
              ].map((g) => (
                <div key={g.group} className="rounded-lg border border-hairline-soft bg-canvas p-3">
                  <h5 className="text-xs font-semibold text-ink">{g.group}</h5>
                  <ul className="mt-1.5 space-y-1">
                    {g.rules.map((r) => (
                      <li key={r} className="text-[10px] text-steel leading-relaxed">{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

        </div>
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
  tone?: "good" | "warn";
}) {
  const ring = tone === "warn" ? "border-clinical-orange/30" : tone === "good" ? "border-brand/30" : "border-hairline";
  const color = tone === "good" ? "text-brand-deep" : tone === "warn" ? "text-clinical-orange" : "text-ink";
  return (
    <div className={`rounded-xl border ${ring} bg-canvas p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
