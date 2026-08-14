import fs from "fs";
import path from "path";
import { KISILIK_TIPLERI, KisilikTipiKey } from "../ai/kisilik-tipleri";
import {
  AdminVaka,
  AnalyticsStore,
  AuditLog,
  AuditPatch,
  BackupMeta,
  BackupsIndex,
  CasesStore,
  DEFAULT_CEMICEGEK,
  FeedbackStore,
  HastaTipi,
  HastaTipleriStore,
  LogsStore,
  PlaySession,
  SystemSettings,
  VakaFeedback,
  PublishedCaseVersion,
  normalizeAdminVaka,
} from "./types";
import {
  analyticsPath,
  backupsDir,
  backupsIndexPath,
  casesPath,
  feedbackPath,
  hastaTipleriPath,
  logsPath,
  settingsPath,
} from "./paths";
import { seedCasesFromTemplates } from "./seed";
import { upgradeAllCasesToCdm } from "../cdm/migrate";
import { quarantineCorruptJson } from "./json-recovery";
import { logger } from "../logger";
import { withJsonStoreLock, writeJsonAtomic } from "./json-store";

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (error) {
    quarantineCorruptJson(file, error, "JSON veri deposu");
    return fallback;
  }
}

// ─── Yazma serileştirme ───
// JSON file-store tek süreç için tasarlanmıştır. Mutasyonlar (load → mutate → write)
// senkron olduğu için Node tek iş parçacığında kendiliğinden atomiktir; kilit,
// gelecekteki async mutasyonları ve compound operasyonları (undo/backup) güvenceye alır.
// DİKKAT: Çok işlemli (cluster / çok replika) çalıştırma bu store ile güvenli DEĞİLDİR —
// dosya kilidi (flock) veya SQLite geçişi gerekir.
export function withStoreLock<T>(fn: () => T | Promise<T>): Promise<T> {
  return withJsonStoreLock(fn);
}

export function loadCasesStore(): CasesStore {
  const empty: CasesStore = {
    version: 1,
    seededAt: 0,
    updatedAt: 0,
    changeCount: 0,
    cases: [],
    publishedVersions: [],
  };
  let store = readJson<CasesStore>(casesPath(), empty);
  if (!store.cases || store.cases.length === 0) {
    const seededRaw = seedCasesFromTemplates().map((c) => normalizeAdminVaka(c));
    const { cases: seeded } = upgradeAllCasesToCdm(seededRaw);
    store = {
      version: 1,
      seededAt: Date.now(),
      updatedAt: Date.now(),
      changeCount: 0,
      cases: seeded,
      publishedVersions: [],
    };
    writeJsonAtomic(casesPath(), store);
    appendLog({
      action: "seed",
      actor: "system",
      message: `Vaka deposu şablonlardan seed edildi (${seeded.length} vaka, CDM v1).`,
      patches: [],
    });
  } else {
    // Eski kayıtlara yeni alanları ekle + TIP-AI CDM v1 yükseltmesi
    let dirty = false;
    const normalized = store.cases.map((c) => {
      const n = normalizeAdminVaka(c);
      if (
        (c as AdminVaka).durum === undefined ||
        (c as AdminVaka).etiketler === undefined ||
        (c as AdminVaka).surum === undefined ||
        (c as AdminVaka).incelemeDurumu === undefined ||
        (c as AdminVaka).cdmVersion === undefined
      ) {
        dirty = true;
      }
      return n;
    });
    const { cases: upgraded, upgradedCount, upgradedIds } = upgradeAllCasesToCdm(normalized);
    store.cases = upgraded;
    if (!Array.isArray(store.publishedVersions)) {
      store.publishedVersions = [];
      dirty = true;
    }
    if (dirty || upgradedCount > 0) {
      store.updatedAt = Date.now();
      writeJsonAtomic(casesPath(), store);
      if (upgradedCount > 0) {
        appendLog({
          action: "seed",
          actor: "system",
          message: `CDM v1 yükseltmesi: ${upgradedCount} vaka güncellendi (${upgradedIds.slice(0, 8).join(", ")}${upgradedIds.length > 8 ? "…" : ""}).`,
          patches: [],
        });
      }
    }
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
  metadata?: Record<string, unknown>;
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
    metadata: input.metadata,
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

/** Yayınlanmış vaka sürümleri append-only tutulur; yalnızca kopyası döndürülür. */
export function listPublishedCaseVersions(caseId: string): PublishedCaseVersion[] {
  return loadCasesStore()
    .publishedVersions
    .filter((item) => item.caseId === caseId)
    .sort((left, right) => right.version - left.version)
    .map((item) => clone(item));
}

export function getPublishedCaseVersion(caseId: string, version: number): PublishedCaseVersion | undefined {
  const record = loadCasesStore().publishedVersions.find(
    (item) => item.caseId === caseId && item.version === version
  );
  return record ? clone(record) : undefined;
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
export async function undoLog(
  logId: string,
  actor: string
): Promise<{ ok: boolean; error?: string; log?: AuditLog }> {
  return withStoreLock(() => {
    const logsStore = loadLogsStore();
    const log = logsStore.logs.find((l) => l.id === logId);
    if (!log) return { ok: false, error: "Log bulunamadı." };
    if (log.undone) return { ok: false, error: "Bu işlem zaten geri alınmış." };
    if (
      log.action === "undo" ||
      log.action === "seed" ||
      log.action === "restore_backup" ||
      log.action === "submit_case_review" ||
      log.action === "approve_case_review" ||
      log.action === "request_case_changes" ||
      log.action === "publish_case_version"
    ) {
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
  });
}

export function loadBackupsIndex(): BackupsIndex {
  return readJson<BackupsIndex>(backupsIndexPath(), { version: 1, backups: [] });
}

export function createBackup(reason: string, actor: string): BackupMeta {
  const cases = loadCasesStore();
  const hastaTipleri = loadHastaTipleriStore();
  const id = `bak_${Date.now()}`;
  const filename = `${id}.json`;
  const file = path.join(backupsDir(), filename);
  // Tam admin anlık görüntüsü: vakalar + hasta tipleri.
  writeJsonAtomic(file, { version: 1, cases, hastaTipleri });
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
      } catch (error) {
        logger.exception("Saklama limiti aşan yedek silinemedi", error, {
          backupId: old.id,
          filename: old.filename,
        });
      }
    }
    index.backups = index.backups.slice(0, 100);
  }
  writeJsonAtomic(backupsIndexPath(), index);
  appendLog({
    action: "create_backup",
    actor,
    message: `Yedek alındı (${reason}): ${id} · ${cases.cases.length} vaka · ${hastaTipleri.tipler.length} hasta tipi · changeCount=${cases.changeCount}`,
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

export async function restoreBackup(
  backupId: string,
  actor: string
): Promise<{ ok: boolean; error?: string }> {
  return withStoreLock(() => {
    const index = loadBackupsIndex();
    const meta = index.backups.find((b) => b.id === backupId);
    if (!meta) return { ok: false, error: "Yedek bulunamadı." };
    const file = path.join(backupsDir(), meta.filename);
    if (!fs.existsSync(file)) return { ok: false, error: "Yedek dosyası eksik." };

    // restore öncesi güvenlik yedeği
    createBackup("pre-restore", actor);

    const raw = readJson<unknown>(file, null);
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Yedek bozuk." };
    }
    const obj = raw as { cases?: unknown; hastaTipleri?: unknown };
    // Yeni format: { cases, hastaTipleri } sarmalayıcı. Eski format: düz CasesStore.
    const yeniFormat =
      typeof obj.cases === "object" &&
      obj.cases !== null &&
      Array.isArray((obj.cases as { cases?: unknown }).cases);
    const snapshot = (yeniFormat ? obj.cases : raw) as CasesStore;
    if (!snapshot || !Array.isArray(snapshot.cases)) {
      return { ok: false, error: "Yedek bozuk." };
    }
    const beforeCount = loadCasesStore().cases.length;
    snapshot.updatedAt = Date.now();
    // changeCount'u koru / arttır
    snapshot.changeCount = (loadCasesStore().changeCount || 0) + 1;
    saveCasesStore(snapshot);

    if (yeniFormat && obj.hastaTipleri && typeof obj.hastaTipleri === "object") {
      const ht = obj.hastaTipleri as HastaTipleriStore;
      if (Array.isArray(ht.tipler)) {
        ht.updatedAt = Date.now();
        saveHastaTipleriStore(ht);
      }
    }

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
  });
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
  if (v === undefined) return v;
  return JSON.parse(JSON.stringify(v)) as T;
}

// ─── Feedback (vaka + değerlerle birlikte) ───

export function loadFeedbackStore(): FeedbackStore {
  return readJson<FeedbackStore>(feedbackPath(), { version: 1, feedbacks: [] });
}

export function saveFeedbackStore(store: FeedbackStore): void {
  writeJsonAtomic(feedbackPath(), store);
}

export function listFeedbacks(caseId?: string): VakaFeedback[] {
  const all = loadFeedbackStore().feedbacks;
  if (!caseId) return all;
  return all.filter((f) => f.caseId === caseId);
}

export function addFeedback(
  input: Omit<VakaFeedback, "id" | "createdAt" | "updatedAt">,
  actor: string
): VakaFeedback {
  const store = loadFeedbackStore();
  const now = Date.now();
  const fb: VakaFeedback = {
    ...input,
    id: `fb_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  store.feedbacks.unshift(fb);
  if (store.feedbacks.length > 10000) store.feedbacks = store.feedbacks.slice(0, 10000);
  saveFeedbackStore(store);
  appendLog({
    action: "add_feedback",
    actor,
    message: `Feedback eklendi · vaka ${input.caseId}: ${input.metin.slice(0, 80)}${input.metin.length > 80 ? "…" : ""}`,
    patches: [
      {
        path: `__feedback__:${fb.id}`,
        caseId: input.caseId,
        before: null,
        after: clone(fb),
      },
    ],
  });
  return fb;
}

// ─── Settings ───

export function loadSettings(): SystemSettings {
  const fallback: SystemSettings = {
    version: 1,
    updatedAt: 0,
    cemicegek: { ...DEFAULT_CEMICEGEK },
  };
  const s = readJson<SystemSettings>(settingsPath(), fallback);
  if (!s.cemicegek) s.cemicegek = { ...DEFAULT_CEMICEGEK };
  return s;
}

export function saveSettings(settings: SystemSettings, actor: string): SystemSettings {
  const before = loadSettings();
  settings.updatedAt = Date.now();
  writeJsonAtomic(settingsPath(), settings);
  appendLog({
    action: "update_settings",
    actor,
    message: "Sistem / Çemiçgezek ayarları güncellendi.",
    patches: [
      {
        path: "__settings__",
        before: clone(before),
        after: clone(settings),
      },
    ],
  });
  return settings;
}

// ─── Hasta Tipleri ───

function seedHastaTipleri(): HastaTipi[] {
  const now = Date.now();
  return (Object.keys(KISILIK_TIPLERI) as KisilikTipiKey[]).map((k) => {
    const p = KISILIK_TIPLERI[k];
    return {
      id: k,
      ad: p.ad,
      aciklama: p.aciklama,
      yasAraligi: [30, 70] as [number, number],
      cinsiyetTercih: "herhangi" as const,
      komorbiditeler: [],
      kisilikTipi: k,
      konusmaKurallari: p.konusmaKurallari,
      konusmaOrnekleri: { ...p.ornekCevaplar },
      ornekCumleler: [],
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function loadHastaTipleriStore(): HastaTipleriStore {
  const empty: HastaTipleriStore = { version: 1, seededAt: 0, updatedAt: 0, tipler: [] };
  const store = readJson<HastaTipleriStore>(hastaTipleriPath(), empty);
  if (!Array.isArray(store.tipler)) store.tipler = [];
  if (!store.seededAt) {
    // İlk açılış: kişilik tiplerini seed et. Mevcut id'lerle çakışanlar atlanır.
    const existing = new Set(store.tipler.map((t) => t.id));
    store.tipler = [...store.tipler, ...seedHastaTipleri().filter((t) => !existing.has(t.id))];
    store.seededAt = Date.now();
    store.updatedAt = Date.now();
    writeJsonAtomic(hastaTipleriPath(), store);
  }
  return store;
}

export function saveHastaTipleriStore(store: HastaTipleriStore): void {
  store.updatedAt = Date.now();
  writeJsonAtomic(hastaTipleriPath(), store);
}

export function getHastaTipiById(id: string): HastaTipi | undefined {
  return loadHastaTipleriStore().tipler.find((t) => t.id === id);
}

// ─── Analytics ───

export function loadAnalytics(): AnalyticsStore {
  return readJson<AnalyticsStore>(analyticsPath(), { version: 1, sessions: [] });
}

export function saveAnalytics(store: AnalyticsStore): void {
  writeJsonAtomic(analyticsPath(), store);
}

export function recordPlaySession(
  session: Omit<PlaySession, "id" | "createdAt">,
  actor: string
): PlaySession {
  const store = loadAnalytics();
  const full: PlaySession = {
    ...session,
    id: `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  store.sessions.unshift(full);
  if (store.sessions.length > 20000) store.sessions = store.sessions.slice(0, 20000);
  saveAnalytics(store);
  appendLog({
    action: "play_session",
    actor,
    message: `Oyun oturumu · ${session.mode} · ${session.caseId} · puan ${session.toplamPuan}/${session.maxPuan}`,
    patches: [],
  });
  return full;
}

/** Vaka kaynağı runtime adapter'dan verilebildiği için içerik hesabı depodan ayrıdır. */
export function computeAnalyticsSummary(cases = loadCasesStore().cases) {
  const sessions = loadAnalytics().sessions;
  const byCase = new Map<
    string,
    {
      caseId: string;
      hastalikKey: string;
      poliklinikKey: string;
      ad: string;
      n: number;
      avgPuan: number;
      taniDogruOran: number;
      redFlags: Record<string, number>;
      gereksiz: Record<string, number>;
    }
  >();

  for (const s of sessions) {
    if (!byCase.has(s.caseId)) {
      const c = cases.find((x) => x.id === s.caseId);
      byCase.set(s.caseId, {
        caseId: s.caseId,
        hastalikKey: s.hastalikKey,
        poliklinikKey: s.poliklinikKey,
        ad: c?.hastalikAdi || s.hastalikKey,
        n: 0,
        avgPuan: 0,
        taniDogruOran: 0,
        redFlags: {},
        gereksiz: {},
      });
    }
    const row = byCase.get(s.caseId)!;
    row.n += 1;
    row.avgPuan += s.maxPuan > 0 ? (s.toplamPuan / s.maxPuan) * 100 : 0;
    if (s.taniDogru) row.taniDogruOran += 1;
    for (const rf of s.atlananRedFlagler || []) {
      row.redFlags[rf] = (row.redFlags[rf] || 0) + 1;
    }
    for (const g of s.gereksizTestler || []) {
      row.gereksiz[g] = (row.gereksiz[g] || 0) + 1;
    }
  }

  const caseStats = Array.from(byCase.values()).map((r) => ({
    ...r,
    avgPuan: r.n ? Math.round(r.avgPuan / r.n) : 0,
    taniDogruOran: r.n ? Math.round((r.taniDogruOran / r.n) * 100) : 0,
    topRedFlags: Object.entries(r.redFlags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => ({ etiket: k, n: v })),
    topGereksiz: Object.entries(r.gereksiz)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => ({ etiket: k, n: v })),
  }));

  const byPoli = new Map<string, { poliklinikKey: string; n: number; avgPuan: number }>();
  for (const s of sessions) {
    if (!byPoli.has(s.poliklinikKey)) {
      byPoli.set(s.poliklinikKey, { poliklinikKey: s.poliklinikKey, n: 0, avgPuan: 0 });
    }
    const p = byPoli.get(s.poliklinikKey)!;
    p.n += 1;
    p.avgPuan += s.maxPuan > 0 ? (s.toplamPuan / s.maxPuan) * 100 : 0;
  }

  return {
    totalSessions: sessions.length,
    caseStats: caseStats.sort((a, b) => b.n - a.n),
    poliStats: Array.from(byPoli.values())
      .map((p) => ({
        ...p,
        avgPuan: p.n ? Math.round(p.avgPuan / p.n) : 0,
      }))
      .sort((a, b) => b.n - a.n),
    recent: sessions.slice(0, 20),
  };
}
