import path from "path";
import fs from "fs";

export function adminDataDir(): string {
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
