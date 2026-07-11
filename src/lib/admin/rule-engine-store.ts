import fs from "fs";
import path from "path";
import { adminDataDir } from "./paths";
import {
  RuleEngineStore,
  RuleEntry,
  DiseaseAlias,
  DEFAULT_RULES,
  DEFAULT_ALIASES,
} from "./rule-engine-types";

function rulesPath(): string {
  return path.join(adminDataDir(), "rule-engine.json");
}

function readJsonAtomic<T>(file: string, fallback: T): T {
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

export function loadRuleEngineStore(): RuleEngineStore {
  const empty: RuleEngineStore = {
    version: 1,
    updatedAt: Date.now(),
    rules: DEFAULT_RULES,
    aliases: DEFAULT_ALIASES,
  };
  return readJsonAtomic(rulesPath(), empty);
}

export function saveRuleEngineStore(store: RuleEngineStore): void {
  store.updatedAt = Date.now();
  writeJsonAtomic(rulesPath(), store);
}

export function getActiveRules(): { testKey: string; diseaseKey: string; tendency: "yuksek" | "dusuk"; factor: number }[] {
  const store = loadRuleEngineStore();
  return store.rules
    .filter((r) => r.active)
    .map((r) => ({ testKey: r.testKey, diseaseKey: r.diseaseKey, tendency: r.tendency, factor: r.factor }));
}

export function getActiveAliases(): Record<string, string> {
  const store = loadRuleEngineStore();
  const map: Record<string, string> = {};
  for (const a of store.aliases) {
    map[a.alias] = a.target;
  }
  return map;
}

export function addRule(rule: Omit<RuleEntry, "id" | "createdAt" | "updatedAt">): RuleEntry {
  const store = loadRuleEngineStore();
  const id = `${rule.testKey}::${rule.diseaseKey}`;
  const existing = store.rules.find((r) => r.id === id);
  if (existing) throw new Error(`Kural zaten var: ${id}`);

  const now = Date.now();
  const entry: RuleEntry = { ...rule, id, createdAt: now, updatedAt: now };
  store.rules.push(entry);
  saveRuleEngineStore(store);
  return entry;
}

export function updateRule(
  id: string,
  patch: Partial<Pick<RuleEntry, "tendency" | "factor" | "description" | "active">>
): RuleEntry {
  const store = loadRuleEngineStore();
  const idx = store.rules.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Kural bulunamadı: ${id}`);

  store.rules[idx] = { ...store.rules[idx], ...patch, updatedAt: Date.now() };
  saveRuleEngineStore(store);
  return store.rules[idx];
}

export function deleteRule(id: string): void {
  const store = loadRuleEngineStore();
  store.rules = store.rules.filter((r) => r.id !== id);
  saveRuleEngineStore(store);
}

export function addAlias(alias: DiseaseAlias): DiseaseAlias {
  const store = loadRuleEngineStore();
  const existing = store.aliases.find((a) => a.alias === alias.alias);
  if (existing) throw new Error(`Alias zaten var: ${alias.alias}`);
  store.aliases.push(alias);
  saveRuleEngineStore(store);
  return alias;
}

export function deleteAlias(alias: string): void {
  const store = loadRuleEngineStore();
  store.aliases = store.aliases.filter((a) => a.alias !== alias);
  saveRuleEngineStore(store);
}

export function resetToDefaults(): RuleEngineStore {
  const store: RuleEngineStore = {
    version: 1,
    updatedAt: Date.now(),
    rules: DEFAULT_RULES,
    aliases: DEFAULT_ALIASES,
  };
  saveRuleEngineStore(store);
  return store;
}
