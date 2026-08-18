"use client";

import { useEffect, useMemo, useState } from "react";
import JsonViewer from "@/components/admin/JsonViewer";
import JsonDiff from "@/components/admin/JsonDiff";

interface AuditPatch {
  path: string;
  testKey?: string;
  field?: string;
  before: unknown;
  after: unknown;
}

interface AuditLog {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  message: string;
  patches: AuditPatch[];
  undone: boolean;
  undoOf?: string;
}

interface ActionMeta {
  icon: string;
  badge: string;
  border: string;
}

function actionMeta(action: string): ActionMeta {
  if (action.startsWith("delete_")) {
    return { icon: "🗑️", badge: "badge-red", border: "var(--color-clinical-red)" };
  }
  if (action === "undo") {
    return { icon: "↩️", badge: "badge-orange", border: "var(--color-clinical-orange)" };
  }
  if (action === "restore_backup") {
    return { icon: "🔄", badge: "badge-orange", border: "var(--color-clinical-orange)" };
  }
  if (action === "create_backup") {
    return { icon: "💾", badge: "badge-blue", border: "var(--color-clinical-blue)" };
  }
  if (action.endsWith("_login") || action.startsWith("register_")) {
    return { icon: "🔐", badge: "badge-blue", border: "var(--color-clinical-blue)" };
  }
  if (action === "seed" || action === "import_cdm") {
    return { icon: "🌱", badge: "badge-steel", border: "var(--color-muted)" };
  }
  if (action === "play_session") {
    return { icon: "▶️", badge: "badge-steel", border: "var(--color-muted)" };
  }
  if (
    action.startsWith("create_") ||
    action.startsWith("update_") ||
    action.startsWith("add_") ||
    action === "approve_case_review" ||
    action === "submit_case_review" ||
    action === "request_case_changes" ||
    action === "publish_case_version"
  ) {
    return { icon: "✏️", badge: "badge-brand", border: "var(--color-brand-deep)" };
  }
  if (action === "update_settings") {
    return { icon: "⚙️", badge: "badge-steel", border: "var(--color-muted)" };
  }
  if (action === "admin_diagnostics_viewed") {
    return { icon: "🩺", badge: "badge-steel", border: "var(--color-muted)" };
  }
  if (action.startsWith("student_") && action.includes("privacy")) {
    return { icon: "🔒", badge: "badge-steel", border: "var(--color-muted)" };
  }
  return { icon: "📝", badge: "badge-steel", border: "var(--color-hairline)" };
}

function patchPreview(patch: AuditPatch): string {
  if (patch.field) {
    const before = typeof patch.before === "object" ? JSON.stringify(patch.before) : String(patch.before ?? "—");
    const after = typeof patch.after === "object" ? JSON.stringify(patch.after) : String(patch.after ?? "—");
    return `${patch.field}: ${before} → ${after}`;
  }
  return patch.path;
}

function timeGroup(timestamp: number): string {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = now.getDay() || 7;
  const startWeek = startToday - (day - 1) * 86_400_000;
  if (timestamp >= startToday) return "Bugün";
  if (timestamp >= startToday - 86_400_000) return "Dün";
  if (timestamp >= startWeek) return "Bu hafta";
  if (timestamp >= startWeek - 7 * 86_400_000) return "Geçen hafta";
  return "Daha eski";
}

const GROUP_ORDER = ["Bugün", "Dün", "Bu hafta", "Geçen hafta", "Daha eski"];
const PAGE_SIZE = 25;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [filterAction, setFilterAction] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [filterText, setFilterText] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.action);
    return Array.from(set).sort();
  }, [logs]);

  const actors = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.actor);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const actor = filterActor.trim().toLowerCase();
    const list = logs.filter((l) => {
      if (filterAction && l.action !== filterAction) return false;
      if (actor && !l.actor.toLowerCase().includes(actor)) return false;
      if (q && !l.message.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => (sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp));
  }, [logs, filterAction, filterActor, filterText, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const grouped = useMemo(() => {
    const groups = new Map<string, AuditLog[]>();
    for (const item of pageItems) {
      const key = timeGroup(item.timestamp);
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => [g, groups.get(g)!] as const);
  }, [pageItems]);

  function load() {
    fetch("/api/admin/logs?limit=300")
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
      });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filterAction, filterActor, filterText, sortAsc]);

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Loglar</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-steel">
            Her değişiklik kayıt altına alınır. Seçici geri alma: yalnızca ilgili işlemin alanları
            eski haline döner.
          </p>
        </div>
        <span className="text-sm text-muted">{total} kayıt</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={onlyChanges}
            onChange={(e) => setOnlyChanges(e.target.checked)}
          />
          Sadece değişen alanları göster
        </label>
        <select
          className="input max-w-[200px] text-sm"
          aria-label="İşlem türüne göre filtrele"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="">Tüm işlemler</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          className="input max-w-[180px] text-sm"
          placeholder="Kullanıcı…"
          aria-label="Kullanıcıya göre filtrele"
          list="log-actor-list"
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
        />
        <datalist id="log-actor-list">
          {actors.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <input
          className="input min-w-[160px] flex-1 text-sm"
          placeholder="Mesajda ara…"
          aria-label="Mesaj metninde ara"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => setSortAsc((v) => !v)}
        >
          {sortAsc ? "↑ Eskiden yeniye" : "↓ Yeniden eskiye"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
          {error}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {filtered.length} sonuç gösteriliyor
            {filtered.length !== total ? ` (toplam ${total})` : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary min-h-9 px-3 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Önceki
            </button>
            <span>{safePage} / {totalPages}</span>
            <button
              className="btn-secondary min-h-9 px-3 text-xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-6">
        {grouped.map(([groupLabel, groupItems]) => (
          <section key={groupLabel} aria-label={groupLabel}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {groupLabel}
            </h2>
            <div className="mt-2 space-y-3">
              {groupItems.map((log) => {
                const meta = actionMeta(log.action);
                const canUndo =
                  !log.undone &&
                  log.action !== "undo" &&
                  log.action !== "seed" &&
                  log.action !== "restore_backup" &&
                  log.action !== "create_backup" &&
                  log.patches.length > 0;

                return (
                  <article
                    key={log.id}
                    className={`rounded-xl border bg-canvas p-4 ${
                      log.undone ? "border-hairline opacity-60" : "border-hairline"
                    }`}
                    style={{ borderLeft: `4px solid ${meta.border}` }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span aria-hidden className="text-base leading-none">{meta.icon}</span>
                          <span className="text-sm text-ink leading-relaxed">{log.message}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                          <span>👤 {log.actor}</span>
                          <span>🕐 {new Date(log.timestamp).toLocaleString("tr-TR")}</span>
                          <span className={`badge ${meta.badge}`}>{log.action}</span>
                          {log.undone && <span className="badge badge-orange">geri alındı</span>}
                          {log.undoOf && <span className="badge badge-blue">undo</span>}
                        </div>
                        {log.patches.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
                              Değişiklikler ({log.patches.length})
                            </summary>
                            <div className="mt-2 space-y-3">
                              {log.patches.map((p, i) => (
                                <div key={i} className="rounded-lg border border-hairline-soft bg-surface-soft p-3">
                                  <div className="mb-1 font-mono text-[11px] text-steel break-all">
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
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {filtered.length === 0 && <p className="text-sm text-steel">Henüz log yok.</p>}
      </div>
    </div>
  );
}