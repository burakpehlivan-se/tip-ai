/**
 * Mevcut PostgreSQL vaka şablonlarını, kaynak Synthea hastasıyla yeniden bağlar.
 * Vaka kimliğindeki opak hasta özeti üzerinden eşleştirme yapar; ham hasta
 * kimliği asla çıktı olarak yazılmaz.
 */

import { createHash } from "node:crypto";
import process from "node:process";
import { getDb } from "../src/lib/auth/db";
import { clinicalCases, syntheaCaseSources, syntheaPatients } from "../src/lib/auth/schema";

const TOKEN_SUFFIX = /-synthea-([0-9a-f]{16})$/i;
const BATCH_SIZE = 2_000;

function patientToken(patientId: string): string {
  return createHash("sha256").update(`synthea:${patientId}`).digest("hex").slice(0, 16);
}

async function main(): Promise<void> {
  const db = getDb();
  const [cases, patients] = await Promise.all([
    db.select({ caseId: clinicalCases.caseId }).from(clinicalCases),
    db.select({ id: syntheaPatients.id }).from(syntheaPatients),
  ]);
  const patientByToken = new Map(patients.map((patient) => [patientToken(patient.id), patient.id]));
  const rows = cases.flatMap((item) => {
    const match = item.caseId.match(TOKEN_SUFFIX);
    const patientId = match ? patientByToken.get(match[1].toLowerCase()) : null;
    return patientId ? [{ caseId: item.caseId, patientId, source: "synthea" }] : [];
  });

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await db
      .insert(syntheaCaseSources)
      .values(rows.slice(index, index + BATCH_SIZE))
      .onConflictDoNothing();
  }

  process.stdout.write(`Synthea vaka kaynağı eşlemesi tamamlandı: ${rows.length}/${cases.length} vaka eşlendi.\n`);
}

main().catch(() => {
  process.stderr.write("Synthea vaka kaynağı eşlemesi başarısız oldu.\n");
  process.exitCode = 1;
});
