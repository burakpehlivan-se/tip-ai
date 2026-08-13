type LogLevel = "info" | "warn" | "error";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const SENSITIVE_META_KEY = /(password|passwd|secret|token|authorization|cookie|api[_-]?key|database|connection|hash|email|username|patient|clinical)/i;

function redactString(value: string): string {
  return value
    .replace(/\b(?:postgres(?:ql)?|mysql|redis):\/\/[^\s'"`]+/gi, "[redacted-connection-url]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(
      /\b(password|passwd|secret|token|authorization|cookie|api[_-]?key|database_url)\b\s*([=:])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1$2[redacted]"
    );
}

function sanitizeMeta(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_META_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMeta(item, "", depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 50).map(([childKey, childValue]) => [
        childKey,
        sanitizeMeta(childValue, childKey, depth + 1),
      ])
    );
  }
  return String(value);
}

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function serializeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message),
      // Stack trace yalnızca geliştirme/test ortamında tutulur; production
      // trace'leri sorgu parametresi veya hassas hata metni taşıyabilir.
      ...(error.stack && process.env.NODE_ENV !== "production" ? { stack: redactString(error.stack) } : {}),
    };
  }

  return { value: redactString(String(error)) };
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg: redactString(msg), ...(sanitizeMeta(meta) as Record<string, unknown>) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Returns an existing correlation id, or creates one for the current request. */
export function getRequestId(request: Pick<Request, "headers">): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  // Request id loglarda yer aldığı için kontrol karakterleri, aşırı uzun
  // değerler veya serbest metin kabul edilmez. Geçersiz kimlik yeni bir UUID
  // ile değiştirilir; istemci route logunu zehirleyemez.
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
}

export const logger = {
  info(msg: string, meta?: Record<string, unknown>) {
    emit("info", msg, meta);
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    emit("warn", msg, meta);
  },
  error(msg: string, meta?: Record<string, unknown>) {
    emit("error", msg, meta);
  },
  exception(msg: string, error: unknown, meta?: Record<string, unknown>) {
    emit("error", msg, {
      ...meta,
      error: serializeError(error),
    });
  },
};
