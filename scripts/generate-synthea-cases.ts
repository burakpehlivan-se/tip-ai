/**
 * Synthea → PostgreSQL vaka üretici.
 *
 * Synthea hastalarını okur, her birini CDM v1 taslağına çevirir, isteğe bağlı
 * Gemini zenginleştirmesi uygular ve `clinical_cases` tablosuna yazar.
 * JSON vaka deposuna dokunmaz; runtime `CASE_STORE=postgres` ile bu tabloyu okur.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/generate-synthea-cases.ts \
 *     [--dry] [--wipe] [--publish] [--no-ai] [--limit N] [--all-diseases]
 *
 * --dry      : yalnızca üretir + doğrular, DB'ye yazmaz.
 * --wipe     : yazmadan önce clinical_cases + yayın sürümleri + audit'i temizler.
 * --publish  : doğrulamadan geçenleri "aktif" yapar (varsayılan "taslak").
 * --no-ai    : Gemini zenginleştirmesini atlar.
 * --limit N  : yalnızca ilk N hastayı işler.
 * --all-diseases : Her farklı Synthea tanı kodu için bir temsilî vaka üretir.
 */

import process from "node:process";
import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import {
  clinicalCaseAuditLogs,
  clinicalCases,
  publishedClinicalCaseVersions,
  syntheaCaseSources,
} from "../src/lib/auth/schema";
import { caseContentChecksum } from "../src/lib/admin/case-integrity";
import { cdmToAdminVaka, validateCdmReadiness } from "../src/lib/cdm";
import { enrichSyntheaCase } from "../src/lib/etl/synthea/enrich";
import { etlSyntheaPatientToCdm } from "../src/lib/etl/synthea/pipeline";
import {
  listSyntheaConditionRepresentatives,
  listSyntheaPatientIds,
  loadSyntheaPatient,
} from "../src/lib/etl/synthea/synthea-db";

interface Args {
  dry: boolean;
  wipe: boolean;
  publish: boolean;
  noAi: boolean;
  allDiseases: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dry: false, wipe: false, publish: false, noAi: false, allDiseases: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry") args.dry = true;
    else if (argv[i] === "--wipe") args.wipe = true;
    else if (argv[i] === "--publish") args.publish = true;
    else if (argv[i] === "--no-ai") args.noAi = true;
    else if (argv[i] === "--all-diseases") args.allDiseases = true;
    else if (argv[i] === "--limit") {
      const value = argv[++i];
      if (!value || Number.isNaN(Number(value))) {
        throw new Error("--limit sayısal bir değer gerektirir.");
      }
      args.limit = Number(value);
    } else {
      throw new Error(`Bilinmeyen argüman: ${argv[i]}`);
    }
  }
  return args;
}

interface Report {
  totalPatients: number;
  generated: number;
  skipped: number;
  enriched: number;
  published: number;
  keptDraft: number;
  invalid: number;
  dist: Record<string, number>;
}

export async function generateSyntheaCases(args: Args): Promise<Report> {
  const db = getDb();
  const candidates = args.allDiseases
    ? await listSyntheaConditionRepresentatives(db)
    : (await listSyntheaPatientIds(db)).map((patientId) => ({ patientId, code: undefined }));
  const target = args.limit != null ? candidates.slice(0, args.limit) : candidates;

  const report: Report = {
    totalPatients: target.length,
    generated: 0,
    skipped: 0,
    enriched: 0,
    published: 0,
    keptDraft: 0,
    invalid: 0,
    dist: {},
  };

  if (args.wipe && !args.dry) {
    await db.execute(
      sql`TRUNCATE TABLE clinical_case_audit_logs, published_clinical_case_versions, clinical_cases CASCADE`
    );
  }

  for (const candidate of target) {
    const bundle = await loadSyntheaPatient(candidate.patientId, db);
    if (!bundle) {
      report.skipped += 1;
      continue;
    }

    const etl = etlSyntheaPatientToCdm(
      bundle,
      candidate.code ? { primaryConditionCode: candidate.code } : undefined
    );
    if (!etl) {
      report.skipped += 1;
      continue;
    }

    let doc = etl.vaka;
    if (!args.noAi) {
      const enriched = await enrichSyntheaCase(doc);
      doc = enriched.vaka;
      if (enriched.basarili) report.enriched += 1;
    }

    let durum = doc.meta.durum;
    if (args.publish) {
      const readiness = validateCdmReadiness(doc);
      if (readiness.errors.length === 0) {
        durum = "aktif";
        report.published += 1;
      } else {
        report.keptDraft += 1;
      }
    } else {
      report.keptDraft += 1;
    }

    const vaka = cdmToAdminVaka({ ...doc, meta: { ...doc.meta, durum } });
    vaka.contentChecksum = caseContentChecksum(vaka);

    if (!args.dry) {
      await db
        .insert(clinicalCases)
        .values({
          caseId: vaka.id,
          poliklinikKey: vaka.poliklinikKey,
          status: vaka.durum,
          reviewStatus: vaka.incelemeDurumu || "legacy",
          version: vaka.surum,
          contentChecksum: vaka.contentChecksum,
          content: vaka,
          createdAt: new Date(vaka.createdAt),
          updatedAt: new Date(vaka.updatedAt),
        })
        .onConflictDoUpdate({
          target: clinicalCases.caseId,
          set: {
            poliklinikKey: vaka.poliklinikKey,
            status: vaka.durum,
            reviewStatus: vaka.incelemeDurumu || "legacy",
            version: vaka.surum,
            contentChecksum: vaka.contentChecksum,
            content: vaka,
            updatedAt: new Date(),
          },
        });
      await db
        .insert(syntheaCaseSources)
        .values({ caseId: vaka.id, patientId: candidate.patientId, source: "synthea" })
        .onConflictDoUpdate({
          target: syntheaCaseSources.caseId,
          set: { patientId: candidate.patientId, source: "synthea" },
        });
    }

    report.generated += 1;
    report.dist[vaka.hastalikKey] = (report.dist[vaka.hastalikKey] || 0) + 1;
  }

  return report;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await generateSyntheaCases(args);

  const dist = Object.entries(report.dist)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`);

  const lines = [
    `${args.dry ? "[dry] " : ""}Synthea vaka üretimi tamamlandı.`,
    args.allDiseases ? `  Tanı türleri: ${report.totalPatients}` : `  Hastalar: ${report.totalPatients}`,
    `  Üretilen vaka: ${report.generated}`,
    `  Atlandı (tanısız): ${report.skipped}`,
    `  AI zenginleştirildi: ${report.enriched}`,
    args.publish
      ? `  Yayınlandı (aktif): ${report.published} · Taslak kaldı: ${report.keptDraft}`
      : `  Durum: taslak (yayın için --publish)`,
  ];
  if (dist.length) {
    lines.push("  Dağılım:");
    for (const d of dist.slice(0, 25)) lines.push(`    ${d}`);
    if (dist.length > 25) lines.push(`    … +${dist.length - 25} hastalık`);
  }
  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
