"use client";

import { useEffect, useState } from "react";

interface BackupMeta {
  id: string;
  timestamp: number;
  reason: string;
  changeCountAtBackup: number;
  caseCount: number;
}

export default function AdminYedeklerPage() {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [nextAutoAt, setNextAutoAt] = useState(10);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/admin/backups")
      .then((r) => r.json())
      .then((d) => {
        setBackups(d.backups || []);
        setChangeCount(d.changeCount || 0);
        setNextAutoAt(d.nextAutoAt || 10);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function createManual() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/backups", { method: "POST" });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(d.error || "Yedek alınamadı");
      return;
    }
    setMsg(`Yedek alındı: ${d.backup.id}`);
    load();
  }

  async function restore(id: string) {
    if (
      !confirm(
        "Bu yedek geri yüklensin mi? Mevcut depo üzerine yazılır (önce otomatik güvenlik yedeği alınır)."
      )
    ) {
      return;
    }
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/backups/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(d.error || "Geri yükleme başarısız");
      return;
    }
    setMsg(`Yedek geri yüklendi: ${id}`);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Yedekler</h1>
      <p className="mt-1 text-sm text-steel">
        Her 10 değişiklikte otomatik tam vaka yedeği alınır. Manuel yedek de alabilirsiniz.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-canvas p-4">
        <div>
          <div className="text-xs uppercase text-muted">Değişiklik sayacı</div>
          <div className="text-2xl font-semibold">{changeCount}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted">Sonraki otomatik yedek</div>
          <div className="text-2xl font-semibold">{nextAutoAt}</div>
        </div>
        <button className="btn-primary text-sm ml-auto" onClick={createManual} disabled={busy}>
          Manuel yedek al
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-brand-deep">{msg}</p>}
      {err && <p className="mt-3 text-sm text-clinical-red">{err}</p>}

      <div className="mt-6 space-y-3">
        {backups.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium text-ink">{b.id}</div>
              <div className="text-xs text-muted">
                {new Date(b.timestamp).toLocaleString("tr-TR")} · {b.reason} · {b.caseCount}{" "}
                vaka · changeCount={b.changeCountAtBackup}
              </div>
            </div>
            <button
              className="btn-secondary text-xs"
              disabled={busy}
              onClick={() => restore(b.id)}
            >
              Geri yükle
            </button>
          </div>
        ))}
        {backups.length === 0 && (
          <p className="text-sm text-steel">Henüz yedek yok. 10 değişiklik sonra otomatik oluşur.</p>
        )}
      </div>
    </div>
  );
}
