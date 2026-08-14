function Primitive({ value }: { value: unknown }) {
  if (value === undefined) return <span className="italic text-muted">undefined</span>;
  if (value === null) return <span className="italic text-rose-600">null</span>;
  if (typeof value === "string") return <span className="text-emerald-700">"{value}"</span>;
  if (typeof value === "number") return <span className="text-amber-700">{value}</span>;
  if (typeof value === "boolean") return <span className="text-violet-700">{String(value)}</span>;
  return <span className="text-ink">{String(value)}</span>;
}

function JsonNode({ name, value }: { name?: string; value: unknown }) {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;

  if (!isArray && !isObject) {
    return (
      <div className="break-all">
        {name !== undefined && (
          <>
            <span className="text-sky-700">{name}</span>
            <span className="text-muted">: </span>
          </>
        )}
        <Primitive value={value} />
      </div>
    );
  }

  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const open = entries.length <= 5;
  const label = isArray ? `[ ${entries.length} ]` : `{ ${entries.length} }`;

  return (
    <details open={open}>
      <summary className="cursor-pointer select-none text-muted hover:text-ink">
        {name !== undefined && <span className="text-sky-700">{name}</span>}
        {name !== undefined && <span className="text-muted">: </span>}
        <span>{label}</span>
      </summary>
      <div className="ml-3 border-l border-hairline pl-3">
        {entries.map(([k, v]) => (
          <JsonNode key={k} name={isArray ? k : `"${k}"`} value={v} />
        ))}
      </div>
    </details>
  );
}

/** Bağımlılıksız, katlanabilir, renklendirilmiş JSON görüntüleyici. */
export default function JsonViewer({ value }: { value: unknown }) {
  return (
    <div className="font-mono text-xs leading-relaxed text-ink">
      <JsonNode value={value} />
    </div>
  );
}
