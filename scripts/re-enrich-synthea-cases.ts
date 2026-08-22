/**
 * Synthea vakalarında AI zenginleştirmesi eksik/uyarıyla kalanları tespit eder
 * ve isteğe bağlı olarak yeniden dener. Her aday için enrichSyntheaCase
 * uyarılarını raporlar — 22 vakalık "basarili: false" kümesinin kök nedenini
 * görmek için kullanılır.
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://... npx tsx scripts/re-enrich-synthea-cases.ts \
 *     [--write] [--limit N] [--case-id ID]
 *
 * --dry (varsayılan): yalnızca adayları listeler, uyarıları yazdırır, DB güncellemez.
 * --write : başarılı (veya kısmi) sonuçları presentation + hastaYanitlari alanlarına uygular.
 */

import process from "node:process";
import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/auth/db";
import { clinicalCases } from "../src/lib/auth/schema";
import { caseContentChecksum } from "../src/lib/admin/case-integrity";
import { adminVakaToCdm } from "../src/lib/cdm/convert";
import type { AdminVaka } from "../src/lib/admin/types";
import { enrichSyntheaCase } from "../src/lib/etl/synthea/enrich";

interface Args {
  write: boolean;
  limit?: number;
  caseId?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { write: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--write") args.write = true;
    else if (argv[i] === "--limit") {
      const value = argv[++i];
      if (!value || Number.isNaN(Number(value))) throw new Error("--limit sayısal değer gerektirir.");
      args.limit = Number(value);
    } else if (argv[i] === "--case-id") {
      args.caseId = argv[++i];
    } else {
      throw new Error(`Bilinmeyen argüman: ${argv[i]}`);
    }
  }
  return args;
}

/** Zenginleştirilmemiş içerik işaretleri — pipeline/enrich placeholder'ları. */
const ISARETLER = ["Synthea iskeleti", "AI/uzman dolduracak"];

async function findCandidates(caseId?: string, limit?: number): Promise<string[]> {
  const db = getDb();
  const kosul = caseId
    ? sql`${clinicalCases.caseId} = ${caseId}`
    : sql`(${clinicalCases.content}::text LIKE ${"%" + ISARETLER[0] + "%"}
        OR ${clinicalCases.content}::text LIKE ${"%" + ISARETLER[1] + "%"})`;

  const rows = await db
    .select({ caseId: clinicalCases.caseId })
    .from(clinicalCases)
    .where(sql`${kosul} AND ${clinicalCases.status} = 'aktif'`)
    .limit(limit ?? 500);
  return rows.map((r) => r.caseId);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const db = getDb();
  const candidates = await findCandidates(args.caseId, args.limit);

  process.stdout.write(`Aday vaka sayısı: ${candidates.length}\n`);
  let duzeltilen = 0;
  let kismi = 0;
  let hatali = 0;

  for (const id of candidates) {
    const [row] = await db
      .select({ content: clinicalCases.content })
      .from(clinicalCases)
      .where(sql`${clinicalCases.caseId} = ${id}`);
    if (!row) continue;

    const vaka = row.content as unknown as AdminVaka;
    try {
      const sonuc = await enrichSyntheaCase(adminVakaToCdm(vaka));
      if (sonuc.basarili) {
        process.stdout.write(`✓ ${id} · temiz üretim\n`);
        duzeltilen += 1;
      } else {
        kismi += 1;
        process.stdout.write(`⚠ ${id} · uyarılar:\n`);
        for (const u of sonuc.rapor.uyarilar) process.stdout.write(`   - ${u}\n`);
      }

      if (args.write) {
        // Yalnızca enrichment'in dokunduğu alanlar uygulanır (roundtrip kaybı yok).
        vaka.anaSikayet = sonuc.vaka.presentation.anaSikayet || vaka.anaSikayet;
        if (sonuc.vaka.presentation.ozetBilgiler?.length) {
          vaka.ozetBilgiler = [...sonuc.vaka.presentation.ozetBilgiler];
        }
        vaka.hastaYanitlari = { ...vaka.hastaYanitlari, ...sonuc.vaka.hastaYanitlari };
        const checksum = caseContentChecksum(vaka);
        await db
          .update(clinicalCases)
          .set({
            content: vaka,
            contentChecksum: checksum,
            updatedAt: new Date(),
          })
          .where(sql`${clinicalCases.caseId} = ${id}`);
      }
    } catch (hata) {
      hatali += 1;
      process.stdout.write(`✗ ${id} · hata: ${hata instanceof Error ? hata.message : String(hata)}\n`);
    }
  }

  process.stdout.write(
    `\nÖzet · aday: ${candidates.length} · temiz: ${duzeltilen} · uyarılı: ${kismi} · hata: ${hatali} · mod: ${args.write ? "WRITE" : "DRY"}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
