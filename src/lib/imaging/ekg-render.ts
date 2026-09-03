import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { resolveDisplayAsset, validatePtbxlRecording } from "./storage";

type RenderInput = {
  readonly sourceRoot: string;
  readonly outputRoot: string;
  readonly filenameLr: string;
  readonly sourceRecordId: string;
  readonly rendererVersion: string;
  readonly renderProfile: string;
};

export type RenderedDisplayImage = {
  readonly kind: "rendered" | "existing";
  readonly absolutePath: string;
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
  readonly width: number;
  readonly height: number;
};

function safePart(value: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(value); }
function sha256(file: string): string { return createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function inRoot(root: string, target: string): boolean { const relative = path.relative(root, target); return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative); }

/**
 * Creates output directories one component at a time and rejects symlinks.
 * Node does not expose mkdirat/openat for descriptor-relative traversal, so every
 * filesystem operation below re-checks the canonical parent immediately before it
 * writes, links, or unlinks. The output root itself is canonicalized first.
 */
function secureOutputDirectory(outputRoot: string, storageKey: string): { readonly outputRoot: string; readonly directory: string; readonly output: string } {
  fs.mkdirSync(outputRoot, { recursive: true, mode: 0o750 });
  const realOutputRoot = fs.realpathSync(outputRoot);
  const rootStats = fs.lstatSync(realOutputRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw new Error("renderer output root is not a directory");

  const components = storageKey.split("/");
  let directory = realOutputRoot;
  for (const component of components.slice(0, -1)) {
    const next = path.join(directory, component);
    if (!inRoot(realOutputRoot, next)) throw new Error("renderer output escapes controlled display root");
    try {
      const stats = fs.lstatSync(next);
      if (stats.isSymbolicLink()) throw new Error("renderer output directory contains a symlink");
      if (!stats.isDirectory()) throw new Error("renderer output path component is not a directory");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fs.mkdirSync(next, { mode: 0o750 });
      const created = fs.lstatSync(next);
      if (created.isSymbolicLink()) throw new Error("renderer output directory contains a symlink");
      if (!created.isDirectory()) throw new Error("renderer output path component is not a directory");
    }
    const resolved = fs.realpathSync(next);
    if (!inRoot(realOutputRoot, resolved)) throw new Error("renderer output directory escapes controlled display root");
    directory = resolved;
  }
  const filename = components.at(-1);
  if (!filename) throw new Error("renderer output filename is missing");
  const output = path.join(directory, filename);
  if (!inRoot(realOutputRoot, output)) throw new Error("renderer output escapes controlled display root");
  return { outputRoot: realOutputRoot, directory, output };
}

function assertSecureOutputDirectory(outputRoot: string, storageKey: string, expectedDirectory: string): void {
  const resolved = secureOutputDirectory(outputRoot, storageKey);
  if (resolved.directory !== expectedDirectory) throw new Error("renderer output directory changed during write");
}

function existingRegularOutput(output: string): boolean {
  try {
    const stats = fs.lstatSync(output);
    if (stats.isSymbolicLink()) throw new Error("renderer output file contains a symlink");
    if (!stats.isFile()) throw new Error("renderer output path is not a regular file");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function waveformSvg(samples: Int16Array, signalLength: number): string {
  const width = 1600; const height = 1120; const columns = 3; const rows = 4; const paneWidth = width / columns; const paneHeight = height / rows;
  const paths: string[] = [];
  for (let lead = 0; lead < 12; lead += 1) {
    const x0 = (lead % columns) * paneWidth; const y0 = Math.floor(lead / columns) * paneHeight;
    const points: string[] = [];
    for (let sample = 0; sample < signalLength; sample += 1) {
      const x = x0 + 20 + (sample / Math.max(1, signalLength - 1)) * (paneWidth - 40);
      const value = samples[sample * 12 + lead] ?? 0;
      const y = y0 + paneHeight / 2 - Math.max(-paneHeight * 0.36, Math.min(paneHeight * 0.36, value / 10));
      points.push(`${sample === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    paths.push(`<g><path d="M${x0},${y0 + paneHeight / 2}H${x0 + paneWidth}" stroke="#f2dede"/><path d="${points.join(" ")}" fill="none" stroke="#172554" stroke-width="1.5"/></g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${paths.join("")}</svg>`;
}

/** Render only from a validated mounted WFDB pair; no HTTP code imports this. */
export async function renderPtbxlDisplayImage(input: RenderInput): Promise<RenderedDisplayImage> {
  if (!safePart(input.sourceRecordId) || !safePart(input.rendererVersion) || !safePart(input.renderProfile)) throw new Error("unsafe renderer output identifier");
  const validated = validatePtbxlRecording({ root: input.sourceRoot, filenameLr: input.filenameLr });
  if (validated.kind !== "valid") throw new Error(`PTB-XL record is not renderable: ${validated.reason}`);
  const sourceRoot = fs.realpathSync(input.sourceRoot);
  const storageKey = `ptbxl/${input.sourceRecordId}/${input.rendererVersion}-${input.renderProfile}.png`;
  const secureOutput = secureOutputDirectory(input.outputRoot, storageKey);
  const { outputRoot, directory, output } = secureOutput;
  if (existingRegularOutput(output)) {
    const valid = resolveDisplayAsset({ storageKey, roots: [outputRoot] });
    if (valid.kind !== "resolved") throw new Error("refusing to overwrite display image with different checksum or invalid content");
    return { kind: "existing", absolutePath: output, storageKey, checksumSha256: sha256(output), sizeBytes: valid.byteLength, width: valid.width, height: valid.height };
  }
  const dataPath = path.join(sourceRoot, `${input.filenameLr}.dat`);
  const raw = fs.readFileSync(dataPath);
  const samples = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const png = await sharp(Buffer.from(waveformSvg(samples, validated.signalLength))).png({ compressionLevel: 9 }).toBuffer();
  assertSecureOutputDirectory(outputRoot, storageKey, directory);
  const temporary = `${output}.${process.pid}.${Date.now()}.tmp`;
  try {
    // O_EXCL prevents following a pre-existing temporary-path symlink.
    const descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(descriptor, png); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    // link(2) is create-only, unlike rename which can replace a racing file.
    try {
      assertSecureOutputDirectory(outputRoot, storageKey, directory);
      fs.linkSync(temporary, output);
      assertSecureOutputDirectory(outputRoot, storageKey, directory);
      fs.unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existingChecksum = sha256(output); const candidateChecksum = createHash("sha256").update(png).digest("hex");
      if (existingChecksum !== candidateChecksum) throw new Error("refusing to overwrite display image with different checksum");
      return { kind: "existing", absolutePath: output, storageKey, checksumSha256: existingChecksum, sizeBytes: fs.statSync(output).size, width: 1600, height: 1120 };
    }
  } finally {
    assertSecureOutputDirectory(outputRoot, storageKey, directory);
    if (existingRegularOutput(temporary)) fs.unlinkSync(temporary);
  }
  const validatedPng = resolveDisplayAsset({ storageKey, roots: [outputRoot] });
  if (validatedPng.kind !== "resolved") throw new Error("renderer produced an invalid PNG");
  return { kind: "rendered", absolutePath: output, storageKey, checksumSha256: sha256(output), sizeBytes: validatedPng.byteLength, width: validatedPng.width, height: validatedPng.height };
}
