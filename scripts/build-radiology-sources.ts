/**
 * Göğüs röntgeni kaynağı üretici — sentetik Synthea vakalarını, NIH ChestX-ray14
 * görüntülerine bulgu etiketi + yaş + cinsiyet ile deterministik eşleştirip
 * `radiology_sources` tablosuna yazar.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/build-radiology-sources.ts [--dry]
 *
 * Yalnızca yerelde gerçekten indirilmiş görüntülerle eşleşir; daha fazla zip
 * indirildiğinde bu script yeniden çalıştırılır (idempotent upsert).
 */

import fs from "node:fs";
import process from "node:process";
import { notInArray } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import {
  radiologySources,
  syntheaCaseSources,
  syntheaPatients,
} from "../src/lib/auth/schema";
import {
  matchChestXray,
  primarySnomedForCaseId,
  type CxrRow,
} from "../src/lib/etl/chestxray/matching";

const CXR_CSV = "data/raw/chestxray/Data_Entry_2017_v2020.csv";
const IMAGES_DIR = "data/raw/chestxray/images_001/images";

function parseCxrCsv(csvPath: string): CxrRow[] {
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean);
  const out: CxrRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].replace(/\r$/, "").split(",");
    if (parts.length < 7) continue;
    const imageIndex = parts[0].trim();
    const labels = parts[1].split("|").map((s) => s.trim()).filter(Boolean);
    const age = Number(parts[4]);
    const gender: "M" | "F" = parts[5].trim() === "F" ? "F" : "M";
    if (!imageIndex || !labels.length || !Number.isFinite(age)) continue;
    out.push({ imageIndex, labels, gender, age });
  }
  return out;
}

function availableImages(dir: string): Set<string> {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".png")));
}

function ageYears(birthdate: Date | null): number | null {
  if (!birthdate) return null;
  return Math.floor((Date.now() - birthdate.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export interface RadiologyBuildResult {
  totalCases: number;
  matched: number;
  skippedNoSource: number;
  skippedNoLabel: number;
  skippedNoCandidate: number;
  byLabel: Record<string, number>;
}

export async function buildRadiologySources(args: { dry: boolean }): Promise<RadiologyBuildResult> {
  const allRows = parseCxrCsv(CXR_CSV);
  const available = availableImages(IMAGES_DIR);
  const rows = allRows.filter((r) => available.has(r.imageIndex));

  const db = getDb();
  const sources = await db.select({ caseId: syntheaCaseSources.caseId, patientId: syntheaCaseSources.patientId }).from(syntheaCaseSources);
  const patients = await db.select({ id: syntheaPatients.id, gender: syntheaPatients.gender, birthdate: syntheaPatients.birthdate }).from(syntheaPatients);
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const result: RadiologyBuildResult = {
    totalCases: sources.length,
    matched: 0,
    skippedNoSource: 0,
    skippedNoLabel: 0,
    skippedNoCandidate: 0,
    byLabel: {},
  };

  const matchedCaseIds: string[] = [];

  for (const { caseId, patientId } of sources) {
    const patient = patientMap.get(patientId);
    if (!patient) {
      result.skippedNoSource += 1;
      continue;
    }
    const snomedCodes = primarySnomedForCaseId(caseId);
    if (!snomedCodes || !snomedCodes.length) {
      result.skippedNoLabel += 1;
      continue;
    }
    const age = ageYears(patient.birthdate);
    if (age == null) {
      result.skippedNoSource += 1;
      continue;
    }
    const gender: "M" | "F" = patient.gender === "female" ? "F" : "M";
    const match = matchChestXray(rows, snomedCodes, age, gender, caseId);
    if (!match) {
      result.skippedNoCandidate += 1;
      continue;
    }

    result.matched += 1;
    result.byLabel[match.label] = (result.byLabel[match.label] || 0) + 1;
    matchedCaseIds.push(caseId);
    if (!args.dry) {
      await db
        .insert(radiologySources)
        .values({ caseId, imageIndex: match.imageIndex, findingLabel: match.label })
        .onConflictDoUpdate({
          target: radiologySources.caseId,
          set: { imageIndex: match.imageIndex, findingLabel: match.label },
        });
    }
  }

  // Yeni ana-tanı eşleştirmesiyle artık eşleşmeyen eski kayıtları temizle.
  // (Eski sürüm komorbidite kodlarını da kullanıyordu; o kayıtlar yanlış olabilir.)
  if (!args.dry && matchedCaseIds.length) {
    const stale = await db
      .select({ caseId: radiologySources.caseId })
      .from(radiologySources)
      .where(notInArray(radiologySources.caseId, matchedCaseIds));
    if (stale.length) {
      await db
        .delete(radiologySources)
        .where(notInArray(radiologySources.caseId, matchedCaseIds));
    }
  }

  return result;
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  const result = await buildRadiologySources({ dry });
  const lines = [
    `${dry ? "[dry] " : ""}Radyoloji kaynağı eşleştirmesi tamamlandı.`,
    `  Toplam vaka (kaynaklı): ${result.totalCases}`,
    `  Eşleşen: ${result.matched}`,
    `  Kaynak/hasta yok: ${result.skippedNoSource}`,
    `  CXR etiketi tanımsız: ${result.skippedNoLabel}`,
    `  Aday görüntü yok (yaş/cinsiyet): ${result.skippedNoCandidate}`,
    `  Etiket dağılımı: ${JSON.stringify(result.byLabel)}`,
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

if (/^build-radiology-sources\.(?:ts|js)$/.test(process.argv[1]?.split("/").at(-1) || "")) {
  main().catch((error) => {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
