"use client";

import { useEffect, useState } from "react";

interface BackupMeta {
  id: string;
  timestamp: number;
  reason: string;
  changeCountAtBackup: number;
  caseCount: number;
  filename: string;
  actor?: string;
  sizeBytes?: number;
  sizeLabel?: string;
}

interface RetentionInfo {
  max: number;
  threshold: number;
}

const REASON_LABELS: Record<string, { label: string; badge: string }> = {
  manual: { label: "Manuel", badge: "badge-brand" },
  "auto-every-10": { label: "Otomatik", badge: "badge-blue" },
  "pre-restore": { label: "Güvenlik", badge: "badge-orange" },
};

function reasonInfo(reason: string) {
  return REASON_LABELS[reason] ?? { label: reason, badge: "badge-steel" };
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminYedeklerPage() {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [nextAutoAt, setNextAutoAt] = useState(10);
  const [retention, setRetention] = useState<RetentionInfo>({ max: 100, threshold: 10 });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/backups")
      .then((r) => r.json())
      .then((d) => {
        setBackups(d.backups || []);
        setChangeCount(d.changeCount || 0);
        setNextAutoAt(d.nextAutoAt || 10);
        if (d.retention) setRetention(d.retention);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function createManual() {
    setBusy(true);
    setMsg("");
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
    setBusy(true);
    setErr("");
    setMsg("");
    setConfirmId(null);
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

  const progress = Math.min(100, Math.round((changeCount / nextAutoAt) * 100));
  const remaining = Math.max(0, nextAutoAt - changeCount);
  const confirmBackup = backups.find((b) => b.id === confirmId);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Yedekler</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-steel">
            Vakalar ve hasta tipleri her {retention.threshold} değişiklikte otomatik yedeklenir.
            İsterseniz manuel yedek de alabilirsiniz.
          </p>
        </div>
        <button className="btn-primary min-h-11 px-4 text-sm" onClick={createManual} disabled={busy}>
          {busy && !confirmId ? "Alınıyor…" : "Manuel yedek al"}
        </button>
      </div>

      {msg && (
        <p role="status" className="mt-4 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand-deep">
          {msg}
        </p>
      )}
      {err && (
        <p role="alert" className="mt-4 rounded-lg border border-clinical-red/25 bg-clinical-red/5 px-4 py-3 text-sm text-clinical-red">
          {err}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-hairline bg-canvas" aria-labelledby="next-auto-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-4 py-3 sm:px-5">
          <div>
            <h2 id="next-auto-title" className="text-base font-semibold text-ink">Sonraki otomatik yedek</h2>
            <p className="mt-0.5 text-sm text-steel">
              {remaining === 0
                ? "Bu eşiğe ulaşıldı — sonraki kayıtta otomatik yedek oluşur."
                : `${remaining} değişiklik sonra otomatik yedek alınacak.`}
            </p>
          </div>
          <span className="text-sm font-medium text-ink">
            {changeCount} / {nextAutoAt}
          </span>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={nextAutoAt}
            aria-valuenow={changeCount}
            aria-label="Otomatik yedek ilerlemesi"
          >
            <div className="h-full rounded-full bg-brand-deep transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Yedekler en fazla {retention.max} adet saklanır; eski yedekler otomatik temizlenir.
          </p>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="backup-list-title">
        <h2 id="backup-list-title" className="text-base font-semibold text-ink">Alınmış yedekler</h2>

        {backups.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-hairline bg-surface-soft px-6 py-10 text-center">
            <p aria-hidden className="text-3xl">💾</p>
            <h3 className="mt-3 text-base font-semibold text-ink">Henüz yedek alınmadı</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-steel">
              {retention.threshold} değişiklik yapıldığında otomatik yedek oluşur. Şimdi manuel
              yedek alarak vakalarınızı ve hasta tiplerinizi güvenceye alabilirsiniz.
            </p>
            <button className="btn-primary mt-5" onClick={createManual} disabled={busy}>
              Manuel yedek al
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {backups.map((b) => {
              const reason = reasonInfo(b.reason);
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas px-4 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="mt-0.5 text-lg">📦</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{b.id}</span>
                        <span className={`badge ${reason.badge}`}>{reason.label}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {formatDate(b.timestamp)}
                        {b.actor ? ` · ${b.actor}` : ""}
                        {b.sizeLabel ? ` · ${b.sizeLabel}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-steel">
                        {b.caseCount} vaka · değişiklik sayacı {b.changeCountAtBackup}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn-secondary text-xs"
                    disabled={busy}
                    onClick={() => setConfirmId(b.id)}
                  >
                    Geri yükle
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmBackup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-canvas p-5 shadow-xl">
            <h2 id="restore-dialog-title" className="text-lg font-semibold text-ink">
              Yedeği geri yükle
            </h2>
            <p className="mt-2 text-sm leading-6 text-steel">
              <span className="font-medium text-ink">{confirmBackup.id}</span> yedeği geri yüklenecek.
              Mevcut depo üzerine yazılır. Güvenlik için önce otomatik bir koruma yedeği alınır.
            </p>
            <p className="mt-2 rounded-lg bg-clinical-orange/10 px-3 py-2 text-sm text-clinical-orange">
              Bu işlem mevcut vakaları ve hasta tiplerini değiştirir.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setConfirmId(null)} disabled={busy}>
                Vazgeç
              </button>
              <button className="btn-primary" onClick={() => restore(confirmBackup.id)} disabled={busy}>
                {busy ? "Geri yükleniyor…" : "Geri yükle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}