"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

interface TestSonucu {
  testKey: string;
  testAdi: string;
  tip: string;
  sonuc: unknown;
  referans?: string;
  yorum?: string;
}

interface AdminVaka {
  id: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  hastalikKey: string;
  hastalikAdi: string;
  seviye: string;
  anaSikayet: string;
  ozetBilgiler: string[];
  egitimNotu: string;
  idealYol: string[];
  statikTestler: Record<string, TestSonucu>;
  updatedAt: number;
}

function pretty(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

export default function AdminVakaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const [vaka, setVaka] = useState<AdminVaka | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [meta, setMeta] = useState({ hastalikAdi: "", anaSikayet: "", egitimNotu: "" });
  const [newTest, setNewTest] = useState({
    testKey: "",
    testAdi: "",
    tip: "numeric",
    sonuc: '{"deger":0,"birim":"","referansAralik":""}',
    yorum: "",
  });
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});

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
        });
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
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
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

  async function addTest(e: FormEvent) {
    e.preventDefault();
    let sonuc: unknown = newTest.sonuc;
    try {
      sonuc = JSON.parse(newTest.sonuc);
    } catch {
      /* text */
    }
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testKey: newTest.testKey,
        testAdi: newTest.testAdi || newTest.testKey,
        tip: newTest.tip,
        sonuc,
        yorum: newTest.yorum,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Eklenemedi");
      return;
    }
    notify(d.log?.message || "Test eklendi.");
    setNewTest({
      testKey: "",
      testAdi: "",
      tip: "numeric",
      sonuc: '{"deger":0,"birim":"","referansAralik":""}',
      yorum: "",
    });
    load();
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

  const tests = Object.values(vaka.statikTestler || {});

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/panel/vakalar" className="text-sm text-steel hover:text-ink">
          ← Vakalar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {vaka.poliklinikIcon} {vaka.hastalikAdi}
        </h1>
        <p className="text-sm text-muted">
          {vaka.poliklinikAd} · {vaka.id}
        </p>
      </div>

      {flash && (
        <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{flash}</div>
      )}
      {error && (
        <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">{error}</div>
      )}

      <form onSubmit={saveMeta} className="rounded-xl border border-hairline bg-canvas p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Vaka bilgileri</h2>
        <div>
          <label className="text-xs text-muted">Hastalık adı</label>
          <input
            className="input w-full"
            value={meta.hastalikAdi}
            onChange={(e) => setMeta({ ...meta, hastalikAdi: e.target.value })}
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
          <label className="text-xs text-muted">Eğitim notu</label>
          <textarea
            className="input w-full min-h-[80px]"
            value={meta.egitimNotu}
            onChange={(e) => setMeta({ ...meta, egitimNotu: e.target.value })}
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
        <h2 className="text-lg font-semibold text-ink">Testler ({tests.length})</h2>
        {tests.map((t) => (
          <div key={t.testKey} className="rounded-xl border border-hairline bg-canvas p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-ink">{t.testAdi}</div>
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
              <label className="text-xs text-muted">Test adı</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={editDrafts[`${t.testKey}::testAdi`] ?? ""}
                  onChange={(e) =>
                    setEditDrafts((d) => ({ ...d, [`${t.testKey}::testAdi`]: e.target.value }))
                  }
                />
                <button
                  className="btn-secondary text-xs"
                  type="button"
                  onClick={() =>
                    saveTestField(t.testKey, "testAdi", editDrafts[`${t.testKey}::testAdi`] ?? "")
                  }
                >
                  Kaydet
                </button>
              </div>
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

      <form onSubmit={addTest} className="rounded-xl border border-dashed border-hairline bg-canvas p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Yeni test ekle</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">testKey</label>
            <input
              className="input w-full"
              placeholder="TROPONIN"
              value={newTest.testKey}
              onChange={(e) => setNewTest({ ...newTest, testKey: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted">Test adı</label>
            <input
              className="input w-full"
              value={newTest.testAdi}
              onChange={(e) => setNewTest({ ...newTest, testAdi: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Tip</label>
            <select
              className="input w-full"
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
            <label className="text-xs text-muted">Yorum</label>
            <input
              className="input w-full"
              value={newTest.yorum}
              onChange={(e) => setNewTest({ ...newTest, yorum: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">Sonuç</label>
          <textarea
            className="input w-full min-h-[80px] font-mono text-xs"
            value={newTest.sonuc}
            onChange={(e) => setNewTest({ ...newTest, sonuc: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-accent text-sm">
          Testi ekle
        </button>
      </form>
    </div>
  );
}
