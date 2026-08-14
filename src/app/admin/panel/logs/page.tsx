"use client";

import { useEffect, useState } from "react";
import JsonViewer from "@/components/admin/JsonViewer";
import JsonDiff from "@/components/admin/JsonDiff";

interface AuditLog {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  message: string;
  patches: { path: string; testKey?: string; field?: string; before: unknown; after: unknown }[];
  undone: boolean;
  undoOf?: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(false);

  function load() {
    fetch("/api/admin/logs?limit=300")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []));
  }

  useEffect(() => {
    load();
  }, []);

  async function undo(id: string) {
    if (!confirm("Bu işlemi geri al? Yalnızca bu logdaki alanlar eski haline döner; sonraki işlemler etkilenmez.")) {
      return;
    }
    setBusy(id);
    setError("");
    const res = await fetch(`/api/admin/logs/${encodeURIComponent(id)}/undo`, { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(d.error || "Geri alınamadı");
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Loglar</h1>
      <p className="mt-1 text-sm text-steel">
        Her değişiklik kayıt altına alınır. Seçici geri alma: yalnızca ilgili işlemin alanları
        eski haline döner.
      </p>

      <label className="mt-3 flex w-fit items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={onlyChanges}
          onChange={(e) => setOnlyChanges(e.target.checked)}
        />
        Sadece değişen alanları göster
      </label>

      {error && (
        <div className="mt-4 rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {logs.map((log) => {
          const canUndo =
            !log.undone &&
            log.action !== "undo" &&
            log.action !== "seed" &&
            log.action !== "restore_backup" &&
            log.action !== "create_backup" &&
            log.patches.length > 0;

          return (
            <div
              key={log.id}
              className={`rounded-xl border bg-canvas p-4 ${
                log.undone ? "border-hairline opacity-60" : "border-hairline"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink leading-relaxed">{log.message}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                    <span>{new Date(log.timestamp).toLocaleString("tr-TR")}</span>
                    <span>·</span>
                    <span>{log.actor}</span>
                    <span>·</span>
                    <span className="badge badge-steel">{log.action}</span>
                    {log.undone && <span className="badge badge-orange">geri alındı</span>}
                    {log.undoOf && <span className="badge badge-blue">undo</span>}
                  </div>
                  {log.patches.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted">
                        {log.patches.length} patch — JSON görüntüle
                      </summary>
                      <div className="mt-2 space-y-3">
                        {log.patches.map((p, i) => (
                          <div key={i} className="rounded-lg border border-hairline-soft bg-surface-soft p-3">
                            <div className="mb-2 font-mono text-[11px] text-steel break-all">
                              {p.path}
                              {p.field ? <span className="text-muted"> · {p.field}</span> : null}
                            </div>
                            {onlyChanges ? (
                              <JsonDiff before={p.before} after={p.after} />
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="min-w-0">
                                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">önce</div>
                                  <JsonViewer value={p.before} />
                                </div>
                                <div className="min-w-0">
                                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">sonra</div>
                                  <JsonViewer value={p.after} />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                {canUndo && (
                  <button
                    className="btn-secondary text-xs shrink-0"
                    disabled={busy === log.id}
                    onClick={() => undo(log.id)}
                  >
                    {busy === log.id ? "…" : "Geri al"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {logs.length === 0 && <p className="text-sm text-steel">Henüz log yok.</p>}
      </div>
    </div>
  );
}
