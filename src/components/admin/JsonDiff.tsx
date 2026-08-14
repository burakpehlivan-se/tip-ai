import JsonViewer from "./JsonViewer";

type DiffEntry = {
  key: string;
  type: "added" | "removed" | "changed" | "nested";
  before?: unknown;
  after?: unknown;
  children?: DiffEntry[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Sadece değişen anahtarları döndürür (eklenen / silinen / değişen / iç içe). */
export function diffEntries(before: unknown, after: unknown): DiffEntry[] {
  if (!isRecord(before) || !isRecord(after)) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: DiffEntry[] = [];
  for (const k of keys) {
    const hasB = k in before;
    const hasA = k in after;
    const b = before[k];
    const a = after[k];
    if (!hasB) {
      out.push({ key: k, type: "added", after: a });
    } else if (!hasA) {
      out.push({ key: k, type: "removed", before: b });
    } else if (JSON.stringify(b) === JSON.stringify(a)) {
      continue;
    } else if (isRecord(b) && isRecord(a)) {
      const children = diffEntries(b, a);
      out.push(children.length ? { key: k, type: "nested", children } : { key: k, type: "changed", before: b, after: a });
    } else {
      out.push({ key: k, type: "changed", before: b, after: a });
    }
  }
  return out;
}

function EntryRow({ entry }: { entry: DiffEntry }) {
  const key = <span className="font-mono text-clinical-blue">{entry.key}</span>;
  if (entry.type === "added") {
    return (
      <div>
        <span className="mr-1 text-brand-deep">+</span>
        {key}
        <span className="text-muted">: </span>
        <JsonViewer value={entry.after} />
      </div>
    );
  }
  if (entry.type === "removed") {
    return (
      <div>
        <span className="mr-1 text-clinical-red">−</span>
        {key}
        <span className="text-muted">: </span>
        <JsonViewer value={entry.before} />
      </div>
    );
  }
  if (entry.type === "changed") {
    return (
      <div className="font-mono text-xs break-all">
        <span className="mr-1 text-clinical-orange">~</span>
        {key}
        <span className="text-muted">: </span>
        <span className="text-clinical-red line-through">{JSON.stringify(entry.before)}</span>
        <span className="text-muted"> → </span>
        <span className="text-brand-deep">{JSON.stringify(entry.after)}</span>
      </div>
    );
  }
  return (
    <div>
      <span className="text-clinical-blue font-mono">{entry.key}</span>
      <div className="ml-3 border-l border-hairline pl-3">
        {(entry.children || []).map((c) => (
          <EntryRow key={c.key} entry={c} />
        ))}
      </div>
    </div>
  );
}

/** before/after arasındaki yalnızca değişen kısımları gösterir. */
export default function JsonDiff({ before, after }: { before: unknown; after: unknown }) {
  if (before == null && after == null) {
    return <p className="text-xs text-muted">Değişiklik yok.</p>;
  }
  if (before == null) {
    return <JsonViewer value={after} />;
  }
  if (after == null) {
    return <JsonViewer value={before} />;
  }
  if (!isRecord(before) || !isRecord(after)) {
    return (
      <div className="font-mono text-xs break-all">
        <span className="text-clinical-red line-through">{JSON.stringify(before)}</span>
        <span className="text-muted"> → </span>
        <span className="text-brand-deep">{JSON.stringify(after)}</span>
      </div>
    );
  }
  const entries = diffEntries(before, after);
  if (entries.length === 0) {
    return <p className="text-xs text-muted">Değişiklik yok.</p>;
  }
  return (
    <div className="space-y-1 font-mono text-xs leading-relaxed">
      {entries.map((e) => (
        <EntryRow key={e.key} entry={e} />
      ))}
    </div>
  );
}
