import path from "path";
import fs from "fs";

/**
 * JSON tabanlı store paylaşılmış/multi-replica yazımı desteklemez. Bu açık
 * bildirimi runtime denetimine dönüştürür; ölçekleme gerektiğinde SQLite/
 * Postgres tabanlı store'a geçilmelidir.
 */
function assertSingleWriter() {
  const replicas = Number(process.env.TIP_AI_REPLICA_COUNT || "1");
  if (!Number.isInteger(replicas) || replicas < 1) {
    throw new Error("TIP_AI_REPLICA_COUNT pozitif bir tamsayı olmalıdır.");
  }
  if (replicas !== 1) {
    throw new Error(
      "JSON veri deposu çoklu replika ile çalıştırılamaz. TIP_AI_REPLICA_COUNT=1 kullanın veya veritabanı store'una geçin."
    );
  }
}

export function adminDataDir(): string {
  assertSingleWriter();
  // /data/ gitignore'da; runtime yazılabilir dizin
  const dir = path.join(process.cwd(), "data", "admin");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function casesPath(): string {
  return path.join(adminDataDir(), "cases.json");
}

export function logsPath(): string {
  return path.join(adminDataDir(), "logs.json");
}

export function backupsDir(): string {
  const dir = path.join(adminDataDir(), "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function backupsIndexPath(): string {
  return path.join(backupsDir(), "index.json");
}

export function feedbackPath(): string {
  return path.join(adminDataDir(), "feedback.json");
}

export function settingsPath(): string {
  return path.join(adminDataDir(), "settings.json");
}

export function hastaTipleriPath(): string {
  return path.join(adminDataDir(), "hasta-tipleri.json");
}

export function analyticsPath(): string {
  return path.join(adminDataDir(), "analytics.json");
}

export function questionsPath(): string {
  return path.join(adminDataDir(), "questions.json");
}

export function usersPath(): string {
  return path.join(adminDataDir(), "users.json");
}
