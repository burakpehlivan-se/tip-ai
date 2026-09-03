import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

export type StorageRejectionReason =
  | "unsafe_storage_key"
  | "extension_not_allowed"
  | "file_not_found"
  | "outside_allowed_root"
  | "not_regular_file"
  | "file_too_large"
  | "invalid_png_magic"
  | "invalid_png_dimensions"
  | "invalid_png_structure"
  | "invalid_png_data";

export type RejectedStorageFile = { readonly kind: "rejected"; readonly reason: StorageRejectionReason };
export type ResolvedSourceDocument = {
  readonly kind: "resolved";
  readonly absolutePath: string;
  readonly byteLength: number;
  readonly mimeType: "text/csv" | "application/pdf" | "text/plain";
};
export type ResolvedDisplayAsset = {
  readonly kind: "resolved";
  readonly absolutePath: string;
  readonly byteLength: number;
  readonly mimeType: "image/png";
  readonly width: number;
  readonly height: number;
};

type FileRequest = { readonly storageKey: string; readonly roots: readonly string[] };
type DisplayRequest = FileRequest & { readonly limits?: { readonly maxBytes?: number; readonly maxDimension?: number } };

const DISPLAY_EXTENSIONS = new Set([".png"]);
const SOURCE_DOCUMENT_MIME = new Map<string, ResolvedSourceDocument["mimeType"]>([
  [".csv", "text/csv"],
  [".pdf", "application/pdf"],
  [".txt", "text/plain"],
]);
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_MAX_DISPLAY_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_DISPLAY_DIMENSION = 8_192;
const MAX_PNG_DECODED_BYTES = 64 * 1024 * 1024;
const MAX_PNG_CHUNKS = 10_000;
const MAX_PTBXL_SIGNAL_BYTES = 25 * 1024 * 1024;
const PTBXL_LEADS = new Set(["I", "II", "III", "AVR", "AVL", "AVF", "V1", "V2", "V3", "V4", "V5", "V6"]);

type RootResolution =
  | { readonly kind: "found"; readonly absolutePath: string; readonly byteLength: number }
  | RejectedStorageFile;

function isSafeStorageKey(storageKey: string): boolean {
  if (storageKey.length === 0 || storageKey.includes("\0") || storageKey.includes("\\") || path.isAbsolute(storageKey)) return false;
  const parts = storageKey.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function insideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function locateRegularFile(request: FileRequest, extensions: ReadonlySet<string>): RootResolution {
  if (!isSafeStorageKey(request.storageKey)) return { kind: "rejected", reason: "unsafe_storage_key" };
  if (!extensions.has(path.extname(request.storageKey).toLowerCase())) return { kind: "rejected", reason: "extension_not_allowed" };
  for (const configuredRoot of request.roots) {
    let root: string;
    try {
      root = fs.realpathSync(configuredRoot);
    } catch {
      continue;
    }
    const candidate = path.resolve(root, request.storageKey);
    if (!insideRoot(root, candidate)) return { kind: "rejected", reason: "outside_allowed_root" };
    try {
      const absolutePath = fs.realpathSync(candidate);
      if (!insideRoot(root, absolutePath)) return { kind: "rejected", reason: "outside_allowed_root" };
      const stats = fs.statSync(absolutePath);
      if (!stats.isFile()) return { kind: "rejected", reason: "not_regular_file" };
      return { kind: "found", absolutePath, byteLength: stats.size };
    } catch {
      // A missing file in one allowed root may exist in the next root.
    }
  }
  return { kind: "rejected", reason: "file_not_found" };
}

type PngLayout = { readonly scanlineLengths: readonly number[]; readonly decodedByteLength: number };

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validBitDepth(colorType: number, bitDepth: number): boolean {
  return (
    (colorType === 0 && [1, 2, 4, 8, 16].includes(bitDepth)) ||
    (colorType === 2 && [8, 16].includes(bitDepth)) ||
    (colorType === 3 && [1, 2, 4, 8].includes(bitDepth)) ||
    (colorType === 4 && [8, 16].includes(bitDepth)) ||
    (colorType === 6 && [8, 16].includes(bitDepth))
  );
}

function channelsForColorType(colorType: number): number {
  return colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
}

function scanlineByteLength(width: number, channels: number, bitDepth: number): number | null {
  const bits = BigInt(width) * BigInt(channels) * BigInt(bitDepth);
  const bytes = (bits + BigInt(7)) / BigInt(8);
  return bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : null;
}

function pngLayout(width: number, height: number, channels: number, bitDepth: number, interlace: number): PngLayout | null {
  const passes = interlace === 0 ? [[0, 0, 1, 1]] : [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
  const scanlineLengths: number[] = [];
  let decodedByteLength = 0;
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = width > startX ? Math.ceil((width - startX) / stepX) : 0;
    const passHeight = height > startY ? Math.ceil((height - startY) / stepY) : 0;
    if (passWidth === 0 || passHeight === 0) continue;
    const scanlineLength = scanlineByteLength(passWidth, channels, bitDepth);
    if (scanlineLength === null) return null;
    const passByteLength = BigInt(scanlineLength + 1) * BigInt(passHeight);
    if (passByteLength > BigInt(MAX_PNG_DECODED_BYTES) || BigInt(decodedByteLength) + passByteLength > BigInt(MAX_PNG_DECODED_BYTES)) return null;
    for (let row = 0; row < passHeight; row += 1) scanlineLengths.push(scanlineLength);
    decodedByteLength += Number(passByteLength);
  }
  return { scanlineLengths, decodedByteLength };
}

function pngValidation(buffer: Buffer, maxDimension: number): { readonly width: number; readonly height: number } | RejectedStorageFile {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) return { kind: "rejected", reason: "invalid_png_magic" };
  let offset = 8;
  let chunkCount = 0;
  let ihdr: Buffer | null = null;
  let idatSeen = false;
  let idatClosed = false;
  let paletteSeen = false;
  let iendSeen = false;
  const compressedParts: Buffer[] = [];
  while (offset < buffer.length) {
    if (chunkCount >= MAX_PNG_CHUNKS || buffer.length - offset < 12) return { kind: "rejected", reason: "invalid_png_structure" };
    const dataLength = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > buffer.length || chunkEnd < offset) return { kind: "rejected", reason: "invalid_png_structure" };
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) return { kind: "rejected", reason: "invalid_png_structure" };
    const data = buffer.subarray(offset + 8, offset + 8 + dataLength);
    if (buffer.readUInt32BE(offset + 8 + dataLength) !== crc32(buffer.subarray(offset + 4, offset + 8 + dataLength))) {
      return { kind: "rejected", reason: "invalid_png_structure" };
    }
    chunkCount += 1;
    if (chunkCount === 1) {
      if (type !== "IHDR" || dataLength !== 13) return { kind: "rejected", reason: "invalid_png_structure" };
      ihdr = data;
    } else if (type === "IHDR") {
      return { kind: "rejected", reason: "invalid_png_structure" };
    } else if (type === "PLTE") {
      if (!ihdr || idatSeen || paletteSeen || dataLength === 0 || dataLength % 3 !== 0 || dataLength > 768) return { kind: "rejected", reason: "invalid_png_structure" };
      paletteSeen = true;
    } else if (type === "IDAT") {
      if (!ihdr || idatClosed) return { kind: "rejected", reason: "invalid_png_structure" };
      idatSeen = true;
      compressedParts.push(data);
    } else {
      if (idatSeen) idatClosed = true;
      if (type === "IEND") {
        if (!idatSeen || dataLength !== 0 || iendSeen || chunkEnd !== buffer.length) return { kind: "rejected", reason: "invalid_png_structure" };
        iendSeen = true;
        break;
      }
      if (type.charCodeAt(0) >= 65 && type.charCodeAt(0) <= 90) return { kind: "rejected", reason: "invalid_png_structure" };
    }
    offset = chunkEnd;
  }
  if (!ihdr || !idatSeen || !iendSeen) return { kind: "rejected", reason: "invalid_png_structure" };
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8] ?? -1;
  const colorType = ihdr[9] ?? -1;
  const compressionMethod = ihdr[10] ?? -1;
  const filterMethod = ihdr[11] ?? -1;
  const interlace = ihdr[12] ?? -1;
  if (width === 0 || height === 0 || width > maxDimension || height > maxDimension) return { kind: "rejected", reason: "invalid_png_dimensions" };
  if (!validBitDepth(colorType, bitDepth) || compressionMethod !== 0 || filterMethod !== 0 || (interlace !== 0 && interlace !== 1)) {
    return { kind: "rejected", reason: "invalid_png_structure" };
  }
  if ((colorType === 3 && !paletteSeen) || ((colorType === 0 || colorType === 4) && paletteSeen)) return { kind: "rejected", reason: "invalid_png_structure" };
  const layout = pngLayout(width, height, channelsForColorType(colorType), bitDepth, interlace);
  if (layout === null) return { kind: "rejected", reason: "invalid_png_data" };
  let decoded: Buffer;
  try {
    decoded = inflateSync(Buffer.concat(compressedParts), { maxOutputLength: layout.decodedByteLength + 1 });
  } catch {
    return { kind: "rejected", reason: "invalid_png_data" };
  }
  if (decoded.length !== layout.decodedByteLength) return { kind: "rejected", reason: "invalid_png_data" };
  let decodedOffset = 0;
  for (const scanlineLength of layout.scanlineLengths) {
    if ((decoded[decodedOffset] ?? 255) > 4) return { kind: "rejected", reason: "invalid_png_data" };
    decodedOffset += scanlineLength + 1;
  }
  return decodedOffset === decoded.length ? { width, height } : { kind: "rejected", reason: "invalid_png_data" };
}

export function resolveDisplayAsset(request: DisplayRequest): ResolvedDisplayAsset | RejectedStorageFile {
  const located = locateRegularFile(request, DISPLAY_EXTENSIONS);
  if (located.kind === "rejected") return located;
  const maxBytes = request.limits?.maxBytes ?? DEFAULT_MAX_DISPLAY_BYTES;
  const maxDimension = request.limits?.maxDimension ?? DEFAULT_MAX_DISPLAY_DIMENSION;
  if (located.byteLength > maxBytes) return { kind: "rejected", reason: "file_too_large" };
  const dimensions = pngValidation(fs.readFileSync(located.absolutePath), maxDimension);
  if ("kind" in dimensions) return dimensions;
  if (dimensions.width === 0 || dimensions.height === 0 || dimensions.width > maxDimension || dimensions.height > maxDimension) {
    return { kind: "rejected", reason: "invalid_png_dimensions" };
  }
  return { kind: "resolved", absolutePath: located.absolutePath, byteLength: located.byteLength, mimeType: "image/png", ...dimensions };
}

export function resolveSourceDocument(request: FileRequest): ResolvedSourceDocument | RejectedStorageFile {
  const located = locateRegularFile(request, new Set(SOURCE_DOCUMENT_MIME.keys()));
  if (located.kind === "rejected") return located;
  const mimeType = SOURCE_DOCUMENT_MIME.get(path.extname(request.storageKey).toLowerCase());
  if (!mimeType) return { kind: "rejected", reason: "extension_not_allowed" };
  return { kind: "resolved", absolutePath: located.absolutePath, byteLength: located.byteLength, mimeType };
}

export type PtbxlRecordingValidation =
  | { readonly kind: "valid"; readonly nSig: 12; readonly samplingFrequencyHz: 100; readonly signalLength: number; readonly leadNames: readonly string[] }
  | { readonly kind: "invalid"; readonly reason: "unsafe_record_name" | "missing_file" | "outside_allowed_root" | "invalid_header" | "unexpected_nsig" | "unexpected_sampling_frequency" | "invalid_signal_definition" | "unexpected_dat_length" };

function recordFile(root: string, relativePath: string): { readonly kind: "file"; readonly path: string; readonly byteLength: number } | Extract<PtbxlRecordingValidation, { readonly kind: "invalid" }> {
  if (!isSafeStorageKey(relativePath)) return { kind: "invalid", reason: "unsafe_record_name" };
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    return { kind: "invalid", reason: "missing_file" };
  }
  const candidate = path.resolve(realRoot, relativePath);
  if (!insideRoot(realRoot, candidate)) return { kind: "invalid", reason: "outside_allowed_root" };
  try {
    const realFile = fs.realpathSync(candidate);
    if (!insideRoot(realRoot, realFile)) return { kind: "invalid", reason: "outside_allowed_root" };
    const stats = fs.statSync(realFile);
    if (!stats.isFile()) return { kind: "invalid", reason: "missing_file" };
    return { kind: "file", path: realFile, byteLength: stats.size };
  } catch {
    return { kind: "invalid", reason: "missing_file" };
  }
}

function finiteNumber(value: string): number | null {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateSignalLine(line: string, expectedDatName: string): string | null {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== expectedDatName || parts[1] !== "16") return null;
  const gain = parts[2]?.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\(([+-]?(?:\d+(?:\.\d*)?|\.\d+))\))?\/(?:[a-zA-Z]+)?$/);
  const baseline = gain?.[2] ?? parts[4] ?? "";
  const lead = parts.at(-1)?.toUpperCase() ?? "";
  if (!gain || !finiteNumber(gain[1] ?? "") || (finiteNumber(gain[1] ?? "") ?? 0) <= 0 || finiteNumber(baseline) === null || !PTBXL_LEADS.has(lead)) return null;
  return lead;
}

/** Validates a PTB-XL low-resolution WFDB pair before any rendering occurs. */
export function validatePtbxlRecording(input: { readonly root: string; readonly filenameLr: string }): PtbxlRecordingValidation {
  if (!/^records100\/[0-9]{5}\/[0-9]{5}_lr$/.test(input.filenameLr)) return { kind: "invalid", reason: "unsafe_record_name" };
  const headerFile = recordFile(input.root, `${input.filenameLr}.hea`);
  const dataFile = recordFile(input.root, `${input.filenameLr}.dat`);
  if (headerFile.kind === "invalid") return headerFile;
  if (dataFile.kind === "invalid") return dataFile;
  const lines = fs.readFileSync(headerFile.path, "utf8").split(/\r?\n/).filter((line) => line.trim().length > 0 && !line.startsWith("#"));
  const head = lines[0]?.trim().split(/\s+/) ?? [];
  if (head[0] !== path.basename(input.filenameLr)) return { kind: "invalid", reason: "invalid_header" };
  const nSig = Number(head[1]);
  const samplingFrequencyHz = Number((head[2] ?? "").split("/")[0]);
  const signalLength = Number(head[3]);
  if (!Number.isSafeInteger(nSig) || !Number.isSafeInteger(samplingFrequencyHz) || !Number.isSafeInteger(signalLength) || signalLength <= 0) return { kind: "invalid", reason: "invalid_header" };
  if (nSig !== 12) return { kind: "invalid", reason: "unexpected_nsig" };
  if (samplingFrequencyHz !== 100) return { kind: "invalid", reason: "unexpected_sampling_frequency" };
  if (lines.length < nSig + 1) return { kind: "invalid", reason: "invalid_header" };
  const expectedDatName = `${path.basename(input.filenameLr)}.dat`;
  const leadNames = lines.slice(1, nSig + 1).map((line) => validateSignalLine(line, expectedDatName));
  if (leadNames.some((lead) => lead === null) || new Set(leadNames).size !== nSig) return { kind: "invalid", reason: "invalid_signal_definition" };
  const expectedByteLength = signalLength * nSig * 2;
  if (!Number.isSafeInteger(expectedByteLength) || expectedByteLength > MAX_PTBXL_SIGNAL_BYTES || dataFile.byteLength !== expectedByteLength) {
    return { kind: "invalid", reason: "unexpected_dat_length" };
  }
  return { kind: "valid", nSig: 12, samplingFrequencyHz: 100, signalLength, leadNames: leadNames.filter((lead): lead is string => lead !== null) };
}
