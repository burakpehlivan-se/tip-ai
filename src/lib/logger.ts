type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg, ...meta };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
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
};
