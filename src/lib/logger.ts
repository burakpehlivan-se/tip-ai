type LogLevel = "info" | "warn" | "error";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

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
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  return { value: String(error) };
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg, ...meta };
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
