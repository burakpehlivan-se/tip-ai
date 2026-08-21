/**
 * EKG kaynağı üretici — EKG testi olan vakaları (cases.json) gerçek PTB-XL
 * kayıtlarına tanı + yaş + cinsiyet ile deterministik eşleştirir, EKG'yi
 * PNG'ye render eder ve `ekg_sources` tablosuna yazar.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/build-ekg-sources.ts [--dry]
 *
 * Vaka tanımları `data/admin/cases.json`'dan okunur (radyolojiden farklı olarak
 * DB'den okumaz — EKG eşleme kuralı caseId bazlıdır). Yerelde indirilmiş
 * kayıtlarla eşleşir; idempotent upsert.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { getDb } from "../src/lib/auth/db";
import { ekgSources } from "../src/lib/auth/schema";
import {
  CASE_TO_EKG_RULE,
  matchEkg,
  PTBXL_UNKNOWN_AGE,
  type PtbxlRow,
} from "../src/lib/etl/ptbxl/matching";
import { renderEkgPng, readSignalsMv, parseHea } from "../src/lib/etl/ptbxl/render";

const PTBXL_CANDIDATES = [
  "data/raw/ptb-xl/physionet.org/files/ptb-xl/1.0.3",
  "data/raw/ptbxl",
  "/app/data/raw/ptbxl",
  "data/raw/ptbxl/physionet.org/files/ptb-xl/1.0.3",
];
function resolvePtbxlDir(): string {
  const argDir = process.argv.find((a) => a.startsWith("--dir="))?.split("=")[1];
  if (argDir && fs.existsSync(argDir)) return argDir;
  for (const p of PTBXL_CANDIDATES) if (fs.existsSync(path.join(p, "ptbxl_database.csv"))) return p;
  return PTBXL_CANDIDATES[0];
}
const PTBXL_DIR = resolvePtbxlDir();
const CASES_JSON = "data/admin/cases.json";
const EKG_OUT_DIR = "data/raw/ptbxl/rendered";

type GenderPref = "herhangi" | "K" | "E";

interface CaseWithEkg {
  caseId: string;
  ageRange: [number, number];
  gender: GenderPref;
}

async function loadCases(casesPath: string): Promise<CaseWithEkg[]> {
  // Postgres-only: try DB first, fallback to legacy JSON for local dev
  try {
    const { loadPostgresCasesStore } = await import("../src/lib/admin/postgres-case-store");
    const store = await loadPostgresCasesStore();
    const out: CaseWithEkg[] = [];
    for (const c of store.cases) {
      if (!c.statikTestler || !(c.statikTestler as Record<string, unknown>).EKG) continue;
      const gender: GenderPref = c.cinsiyetTercih === "K" || c.cinsiyetTercih === "E" ? c.cinsiyetTercih : "herhangi";
      out.push({ caseId: c.id, ageRange: c.yasAraligi ?? [20, 90], gender });
    }
    if (out.length) return out;
  } catch {}
  if (!fs.existsSync(casesPath)) return [];
  const raw = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.cases;
  const out: CaseWithEkg[] = [];
  for (const c of list) {
    if (!c.statikTestler || !c.statikTestler.EKG) continue;
    const gender: GenderPref =
      c.cinsiyetTercih === "K" || c.cinsiyetTercih === "E" ? c.cinsiyetTercih : "herhangi";
    out.push({ caseId: c.id, ageRange: c.yasAraligi ?? [20, 90], gender });
  }
  return out;
}

/** CSV'deki scp_codes sütunu (report alanı virgül içerebildiği için regex ile). */
function scpCodesOf(line: string): Record<string, number> | null {
  const m = line.match(/\{.*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0].replace(/'/g, '"'));
  } catch {
    return null;
  }
}

export function loadPtbxlRows(csvPath: string): PtbxlRow[] {
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean);
  const rows: PtbxlRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const codes = scpCodesOf(line);
    if (!codes) continue;
    const parts = line.split(",");
    const filename = parts[parts.length - 2];
    if (!filename || !filename.includes("records100")) continue;
    const ageRaw = Number(parts[2]);
    const sex = Number(parts[3]);
    rows.push({
      ecgId: Number(parts[0]),
      codes,
      age: ageRaw === PTBXL_UNKNOWN_AGE ? null : ageRaw,
      gender: sex === 1 ? "F" : "M",
      filename,
    });
  }
  return rows;
}

function genderFilter(pref: GenderPref): "M" | "F" | null {
  if (pref === "K") return "F";
  if (pref === "E") return "M";
  return null;
}

export interface EkgBuildResult {
  totalCases: number;
  matched: number;
  skippedNoRule: number;
  skippedNoCandidate: number;
  skippedNotOnDisk: number;
  rendered: number;
  byLabel: Record<string, number>;
}

export async function buildEkgSources(args: { dry: boolean }): Promise<EkgBuildResult> {
  const rows = loadPtbxlRows(path.join(PTBXL_DIR, "ptbxl_database.csv"));
  const available = new Set(
    fs.existsSync(path.join(PTBXL_DIR, "records100"))
      ? collectDatFiles(path.join(PTBXL_DIR, "records100")).map((f) => path.basename(f))
      : []
  );
  const diskRows = rows.filter((r) => available.has(path.basename(r.filename) + ".dat"));
  const cases = await loadCases(CASES_JSON);

  fs.mkdirSync(EKG_OUT_DIR, { recursive: true });

  const result: EkgBuildResult = {
    totalCases: cases.length,
    matched: 0,
    skippedNoRule: 0,
    skippedNoCandidate: 0,
    skippedNotOnDisk: 0,
    rendered: 0,
    byLabel: {},
  };

  const db = args.dry ? null : getDb();
  const writes: Array<{ caseId: string; ecgId: number; scpCodes: Record<string, number>; findingLabel: string }> = [];

  for (const c of cases) {
    const rule = CASE_TO_EKG_RULE[c.caseId];
    if (!rule) {
      result.skippedNoRule += 1;
      continue;
    }
    const match = matchEkg(diskRows, rule, genderFilter(c.gender), c.ageRange, c.caseId);
    if (!match) {
      result.skippedNoCandidate += 1;
      continue;
    }
    const row = diskRows.find((r) => r.ecgId === match.ecgId);
    if (!row) {
      result.skippedNotOnDisk += 1;
      continue;
    }

    result.matched += 1;
    result.byLabel[match.label] = (result.byLabel[match.label] || 0) + 1;
    writes.push({ caseId: c.caseId, ecgId: match.ecgId, scpCodes: row.codes, findingLabel: match.label });

  if (!args.dry && db) {
      const datPath = path.join(PTBXL_DIR, row.filename + ".dat");
      if (fs.existsSync(datPath)) {
        const heaPath = datPath.replace(/\.dat$/, ".hea");
        const header = await parseHea(heaPath);
        const signals = await readSignalsMv(datPath, header);
        const png = await renderEkgPng(signals, header.names, header.fs);
        const imageIndex = `${match.ecgId}.png`;
        fs.writeFileSync(path.join(EKG_OUT_DIR, imageIndex), png);
        result.rendered += 1;
      }
    }
  }

  if (!args.dry && db) {
    for (const w of writes) {
      await db
        .insert(ekgSources)
        .values({
          caseId: w.caseId,
          ecgId: w.ecgId,
          imageIndex: `${w.ecgId}.png`,
          scpCodes: w.scpCodes,
          findingLabel: w.findingLabel,
        })
        .onConflictDoUpdate({
          target: ekgSources.caseId,
          set: { ecgId: w.ecgId, imageIndex: `${w.ecgId}.png`, scpCodes: w.scpCodes, findingLabel: w.findingLabel },
        });
    }
  }

  return result;
}

function collectDatFiles(dir: string): string[] {
  const out: string[] = [];
  for (const sub of fs.readdirSync(dir)) {
    const full = path.join(dir, sub);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.endsWith(".dat")) out.push(path.join(sub, f));
    }
  }
  return out;
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  const result = await buildEkgSources({ dry });
  const lines = [
    `${dry ? "[dry] " : ""}EKG kaynağı eşleştirmesi tamamlandı.`,
    `  EKG testli vaka: ${result.totalCases}`,
    `  Eşleşen: ${result.matched}`,
    `  Eşleme kuralı yok: ${result.skippedNoRule}`,
    `  Aday kayıt yok: ${result.skippedNoCandidate}`,
    `  Diskte kayıt yok: ${result.skippedNotOnDisk}`,
    `  PNG render edilen: ${result.rendered}`,
    `  Etiket dağılımı: ${JSON.stringify(result.byLabel)}`,
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

if (/^build-ekg-sources\.(?:ts|js)$/.test(process.argv[1]?.split("/").at(-1) || "")) {
  main().catch((error) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}