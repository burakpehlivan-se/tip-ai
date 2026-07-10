import fs from "fs";
import path from "path";
import {
  AdminVaka,
  AuditLog,
  AuditPatch,
  BackupMeta,
  BackupsIndex,
  CasesStore,
  LogsStore,
} from "./types";
import {
  backupsDir,
  backupsIndexPath,
  casesPath,
  logsPath,
} from "./paths";
import { seedCasesFromTemplates } from "./seed";

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, data: unknown): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function loadCasesStore(): CasesStore {
  const empty: CasesStore = {
    version: 1,
    seededAt: 0,
    updatedAt: 0,
    changeCount: 0,
    cases: [],
  };
  let store = readJson<CasesStore>(casesPath(), empty);
  if (!store.cases || store.cases.length === 0) {
    const seeded = seedCasesFromTemplates();
    store = {
      version: 1,
      seededAt: Date.now(),
      updatedAt: Date.now(),
      changeCount: 0,
      cases: seeded,
    };
    writeJsonAtomic(casesPath(), store);
    appendLog({
      action: "seed",
      actor: "system",
      message: `Vaka deposu şablonlardan seed edildi (${seeded.length} vaka).`,
      patches: [],
    });
  }
  return store;
}

export function saveCasesStore(store: CasesStore): void {
  store.updatedAt = Date.now();
  writeJsonAtomic(casesPath(), store);
}

export function loadLogsStore(): LogsStore {
  return readJson<LogsStore>(logsPath(), { version: 1, logs: [] });
}

export function saveLogsStore(store: LogsStore): void {
  writeJsonAtomic(logsPath(), store);
}

export function appendLog(input: {
  action: AuditLog["action"];
  actor: string;
  message: string;
  patches: AuditPatch[];
  undoOf?: string;
}): AuditLog {
  const store = loadLogsStore();
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    actor: input.actor,
    action: input.action,
    message: input.message,
    patches: input.patches,
    undone: false,
    undoOf: input.undoOf,
  };
  store.logs.unshift(log);
  // saklama limiti
  if (store.logs.length > 5000) store.logs = store.logs.slice(0, 5000);
  saveLogsStore(store);
  return log;
}

export function getCaseById(id: string): AdminVaka | undefined {
  return loadCasesStore().cases.find((c) => c.id === id);
}

export function listCasesGrouped(): {
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  cases: AdminVaka[];
}[] {
  const store = loadCasesStore();
  const map = new Map<
    string,
    {
      poliklinikKey: string;
      poliklinikAd: string;
      poliklinikIcon: string;
      cases: AdminVaka[];
    }
  >();
  for (const c of store.cases) {
    if (!map.has(c.poliklinikKey)) {
      map.set(c.poliklinikKey, {
        poliklinikKey: c.poliklinikKey,
        poliklinikAd: c.poliklinikAd,
        poliklinikIcon: c.poliklinikIcon,
        cases: [],
      });
    }
    map.get(c.poliklinikKey)!.cases.push(c);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.poliklinikAd.localeCompare(b.poliklinikAd, "tr")
  );
}

/** path: cases.<caseId>.statikTestler.<testKey>.[field...]  veya cases.<caseId>.<field> */
export function getByPath(store: CasesStore, pathStr: string): unknown {
  const parts = pathStr.split(".");
  if (parts[0] !== "cases" || parts.length < 2) return undefined;
  const caseId = parts[1];
  const vaka = store.cases.find((c) => c.id === caseId);
  if (!vaka) return undefined;
  let cur: any = vaka;
  for (let i = 2; i < parts.length; i++) {
    if (cur == null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

export function setByPath(store: CasesStore, pathStr: string, value: unknown): boolean {
  const parts = pathStr.split(".");
  if (parts[0] !== "cases" || parts.length < 3) return false;
  const caseId = parts[1];
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx < 0) return false;
  let cur: any = store.cases[idx];
  for (let i = 2; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (value === undefined) {
    delete cur[last];
  } else {
    cur[last] = value;
  }
  store.cases[idx].updatedAt = Date.now();
  return true;
}

export function deleteByPath(store: CasesStore, pathStr: string): boolean {
  return setByPath(store, pathStr, undefined);
}

/**
 * Seçici undo: yalnızca bu log'un patch'lerini tersine çevirir.
 * Sonraki log'lar (farklı alanlar) etkilenmez.
 */
export function undoLog(logId: string, actor: string): { ok: boolean; error?: string; log?: AuditLog } {
  const logsStore = loadLogsStore();
  const log = logsStore.logs.find((l) => l.id === logId);
  if (!log) return { ok: false, error: "Log bulunamadı." };
  if (log.undone) return { ok: false, error: "Bu işlem zaten geri alınmış." };
  if (log.action === "undo" || log.action === "seed" || log.action === "restore_backup") {
    return { ok: false, error: "Bu log türü geri alınamaz." };
  }
  if (!log.patches.length) return { ok: false, error: "Geri alınacak patch yok." };

  const cases = loadCasesStore();
  const reversePatches: AuditPatch[] = [];

  for (const p of log.patches) {
    // Özel: case silme/ekleme
    if (p.path.startsWith("__case_create__:")) {
      const caseId = p.path.replace("__case_create__:", "");
      const beforeCase = cases.cases.find((c) => c.id === caseId);
      cases.cases = cases.cases.filter((c) => c.id !== caseId);
      reversePatches.push({
        path: p.path,
        caseId,
        before: beforeCase ?? null,
        after: null,
      });
      continue;
    }
    if (p.path.startsWith("__case_delete__:")) {
      const restored = p.before as AdminVaka | null;
      if (restored) {
        cases.cases.push(restored);
        reversePatches.push({
          path: p.path,
          caseId: restored.id,
          before: null,
          after: restored,
        });
      }
      continue;
    }

    const current = getByPath(cases, p.path);
    // before'a geri dön
    setByPath(cases, p.path, clone(p.before));
    reversePatches.push({
      path: p.path,
      caseId: p.caseId,
      testKey: p.testKey,
      field: p.field,
      before: current,
      after: clone(p.before),
    });
  }

  // changeCount undo için de artar (yedek sayacı)
  cases.changeCount += 1;
  saveCasesStore(cases);

  log.undone = true;
  const undoLogEntry = appendLog({
    action: "undo",
    actor,
    message: `Geri alındı: ${log.message}`,
    patches: reversePatches,
    undoOf: log.id,
  });
  log.undoneBy = undoLogEntry.id;
  // appendLog yeniden yazdı; undone flag'i kaydet
  const again = loadLogsStore();
  const target = again.logs.find((l) => l.id === logId);
  if (target) {
    target.undone = true;
    target.undoneBy = undoLogEntry.id;
    saveLogsStore(again);
  }

  maybeAutoBackup(cases, actor, "auto-every-10");
  return { ok: true, log: undoLogEntry };
}

export function loadBackupsIndex(): BackupsIndex {
  return readJson<BackupsIndex>(backupsIndexPath(), { version: 1, backups: [] });
}

export function createBackup(reason: string, actor: string): BackupMeta {
  const cases = loadCasesStore();
  const id = `bak_${Date.now()}`;
  const filename = `${id}.json`;
  const file = path.join(backupsDir(), filename);
  writeJsonAtomic(file, cases);
  const meta: BackupMeta = {
    id,
    timestamp: Date.now(),
    reason,
    changeCountAtBackup: cases.changeCount,
    caseCount: cases.cases.length,
    filename,
  };
  const index = loadBackupsIndex();
  index.backups.unshift(meta);
  if (index.backups.length > 100) {
    // eski yedek dosyalarını sil
    for (const old of index.backups.slice(100)) {
      try {
        fs.unlinkSync(path.join(backupsDir(), old.filename));
      } catch {
        /* ignore */
      }
    }
    index.backups = index.backups.slice(0, 100);
  }
  writeJsonAtomic(backupsIndexPath(), index);
  appendLog({
    action: "create_backup",
    actor,
    message: `Yedek alındı (${reason}): ${id} · ${cases.cases.length} vaka · changeCount=${cases.changeCount}`,
    patches: [],
  });
  return meta;
}

export function maybeAutoBackup(store: CasesStore, actor: string, reason = "auto-every-10"): BackupMeta | null {
  if (store.changeCount > 0 && store.changeCount % 10 === 0) {
    return createBackup(reason, actor);
  }
  return null;
}

export function restoreBackup(backupId: string, actor: string): { ok: boolean; error?: string } {
  const index = loadBackupsIndex();
  const meta = index.backups.find((b) => b.id === backupId);
  if (!meta) return { ok: false, error: "Yedek bulunamadı." };
  const file = path.join(backupsDir(), meta.filename);
  if (!fs.existsSync(file)) return { ok: false, error: "Yedek dosyası eksik." };

  // restore öncesi güvenlik yedeği
  createBackup("pre-restore", actor);

  const snapshot = readJson<CasesStore>(file, null as unknown as CasesStore);
  if (!snapshot || !Array.isArray(snapshot.cases)) {
    return { ok: false, error: "Yedek bozuk." };
  }
  const beforeCount = loadCasesStore().cases.length;
  snapshot.updatedAt = Date.now();
  // changeCount'u koru / arttır
  snapshot.changeCount = (loadCasesStore().changeCount || 0) + 1;
  saveCasesStore(snapshot);
  appendLog({
    action: "restore_backup",
    actor,
    message: `Yedek geri yüklendi: ${backupId} (${meta.caseCount} vaka, önceki ${beforeCount}).`,
    patches: [
      {
        path: "__full_store__",
        before: { note: "full snapshot restored", backupId },
        after: { caseCount: snapshot.cases.length },
      },
    ],
  });
  return { ok: true };
}

export function recordMutation(
  actor: string,
  action: AuditLog["action"],
  message: string,
  patches: AuditPatch[],
  mutate: (store: CasesStore) => void
): { store: CasesStore; log: AuditLog; backup: BackupMeta | null } {
  const store = loadCasesStore();
  mutate(store);
  store.changeCount += 1;
  store.updatedAt = Date.now();
  saveCasesStore(store);
  const log = appendLog({ action, actor, message, patches });
  const backup = maybeAutoBackup(store, actor);
  return { store, log, backup };
}

/** Deep clone helper */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
