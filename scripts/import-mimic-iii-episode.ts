/**
 * Güvenli ortamda üretilen tek MIMIC-III epizod export'unu CDM taslağına çevirir.
 * Ham MIMIC dosyaları ve çıktılar proje deposunun dışında olmalıdır.
 */

import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import {
  buildMimicIIIEpisode,
  etlMimicEpisodeToCdm,
  MimicIIITables,
} from "../src/lib/etl/mimic";

interface Arguments {
  input: string;
  output: string;
  manifest?: string;
}

function usage(): never {
  throw new Error(
    "Usage: npm run etl:mimic-iii:episode -- --input /secure/episode.json --output /secure/case.json [--manifest /secure/case.manifest.json]"
  );
}

function parseArgs(args: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) usage();
    values.set(key.slice(2), value);
  }
  const input = values.get("input");
  const output = values.get("output");
  if (!input || !output || values.size < 2 || values.size > 3) usage();
  return { input, output, manifest: values.get("manifest") };
}

function requireOutsideRepository(filePath: string, label: string): string {
  const resolved = path.resolve(filePath);
  const repository = path.resolve(process.cwd());
  if (resolved === repository || resolved.startsWith(`${repository}${path.sep}`)) {
    throw new Error(`${label} must be outside the repository to protect credentialed health data`);
  }
  return resolved;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const input = requireOutsideRepository(args.input, "Input");
  const output = requireOutsideRepository(args.output, "Output");
  const raw = JSON.parse(fs.readFileSync(input, "utf8")) as MimicIIITables & {
    selection?: { subjectId: string | number; hadmId: string | number };
  };
  if (!raw.selection) throw new Error("Input JSON must include a selection object");

  const { bundle, quality } = buildMimicIIIEpisode(raw, raw.selection);
  const result = etlMimicEpisodeToCdm(bundle, { durum: "taslak" });
  if (result.validation.status === "invalid") {
    throw new Error("CDM validation failed; no output was written");
  }

  writeJson(output, result.vaka);
  if (args.manifest) {
    const manifest = requireOutsideRepository(args.manifest, "Manifest");
    const outputHash = createHash("sha256").update(JSON.stringify(result.vaka)).digest("hex");
    writeJson(manifest, {
      source: "mimic-iii",
      datasetVersion: "1.4",
      episodeId: result.meta.episodeId,
      outputSha256: outputHash,
      validation: result.validation.status,
      quality,
      reviewRequired: true,
    });
  }
}

main();
