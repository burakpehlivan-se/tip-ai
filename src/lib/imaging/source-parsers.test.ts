import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { parseCxrMetadata, parsePtbxlMetadata } from "./source-parsers";
import {
  resolveDisplayAsset,
  resolveSourceDocument,
  validatePtbxlRecording,
} from "./storage";

const TEMPORARY_DIRECTORIES: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-imaging-"));
  TEMPORARY_DIRECTORIES.push(directory);
  return directory;
}

const TEST_SUBJECT_KEY = "a-32-byte-test-subject-key-secret";

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function png(
  width = 640,
  height = 480,
  options: { readonly rawData?: Buffer; readonly includeIdat?: boolean } = {},
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rawData = options.rawData ?? Buffer.alloc(Math.max(0, height) * (1 + Math.max(0, width) * 4));
  for (let row = 0; row < height && row * (width * 4 + 1) < rawData.length; row += 1) rawData[row * (width * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    ...(options.includeIdat === false ? [] : [pngChunk("IDAT", deflateSync(rawData))]),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function adam7Png(): Buffer {
  const width = 4;
  const height = 3;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[12] = 1;
  const rawScanlines: Buffer[] = [];
  for (const [startX, startY, stepX, stepY] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]) {
    const passWidth = width > startX ? Math.ceil((width - startX) / stepX) : 0;
    const passHeight = height > startY ? Math.ceil((height - startY) / stepY) : 0;
    if (passWidth === 0 || passHeight === 0) continue;
    for (let row = 0; row < passHeight; row += 1) rawScanlines.push(Buffer.alloc(1 + passWidth * 4));
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rawScanlines))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function validCxrCsv(row = '"00000001_000.png","Effusion|Mass","","123",55,"F","PA","1024,1024","0.143\\\\0.143"'): string {
  return [
    'Image Index,Finding Labels,Follow-up #,Patient ID,Patient Age,Patient Sex,View Position,"OriginalImage[Width,Height]","OriginalImagePixelSpacing[x,y]"',
    row,
  ].join("\n");
}

function validPtbxlCsv(row = `1,999,52,F,"hidden report","{'NORM': 100.0, 'SR': 0.0}","hidden nurse","hidden site","hidden device",records100/00000/00001_lr`): string {
  return [
    "ecg_id,patient_id,age,sex,report,scp_codes,nurse,site,device,filename_lr",
    row,
  ].join("\n");
}

function scpStatementsCsv(): string {
  return [
    "scp_code,description,diagnostic,form,rhythm,diagnostic_class,diagnostic_subclass",
    "NORM,Normal ECG,1,0,0,NORM,NORM",
    "SR,Sinus rhythm,0,0,1,,",
  ].join("\n");
}

function writeValidPtbxlPair(root: string, name = "records100/00000/00001_lr"): void {
  const base = path.join(root, name);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  const leads = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];
  const header = [
    "00001_lr 12 100 10",
    ...leads.map((lead) => `00001_lr.dat 16 1000(0)/mV 16 0 0 0 ${lead}`),
  ].join("\n");
  fs.writeFileSync(`${base}.hea`, header);
  fs.writeFileSync(`${base}.dat`, Buffer.alloc(12 * 10 * 2));
}

afterEach(() => {
  for (const directory of TEMPORARY_DIRECTORIES.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("direct-source metadata parsers", () => {
  it("parses quoted CXR rows by official Patient Sex headers and separates multi-labels", () => {
    // Given
    const csv = validCxrCsv();

    // When
    const result = parseCxrMetadata({ csv, subjectKeySecret: TEST_SUBJECT_KEY, subjectKeyVersion: "v1" });

    // Then
    expect(result.records).toEqual([
      expect.objectContaining({
        sourceRecordId: "00000001_000.png",
        ageYears: 55,
        sex: "F",
        viewPosition: "PA",
        sourceLabels: ["Effusion", "Mass"],
        originalWidth: 1024,
        originalHeight: 1024,
      }),
    ]);
    expect(result.records[0]?.sourceSubjectKey).toBe(createHmac("sha256", TEST_SUBJECT_KEY).update("123").digest("hex"));
  });

  it("preserves CXR dimensions from the official comma-split header fields", () => {
    // Given
    const csv = [
      "Image Index,Finding Labels,Follow-up #,Patient ID,Patient Age,Patient Sex,View Position,OriginalImage[Width,Height],OriginalImagePixelSpacing[x,y]",
      '"00000001_000.png","Mass","","123",55,"F","AP",1024,768,0.143,0.143',
    ].join("\n");

    // When
    const result = parseCxrMetadata({ csv, subjectKeySecret: TEST_SUBJECT_KEY, subjectKeyVersion: "v1" });

    // Then
    expect(result.records).toEqual([expect.objectContaining({ originalWidth: 1024, originalHeight: 768, pixelSpacingX: 0.143, pixelSpacingY: 0.143 })]);
  });

  it("reports a CXR No Finding multi-label conflict without publishing the record", () => {
    // Given
    const csv = validCxrCsv('"00000001_000.png","No Finding|Mass","","123",55,"F","PA","1024,1024","0.143\\\\0.143"');

    // When
    const result = parseCxrMetadata({ csv, subjectKeySecret: TEST_SUBJECT_KEY, subjectKeyVersion: "v1" });

    // Then
    expect(result.records).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "invalid_source_label_set" }));
  });

  it("rejects CXR CSV without the official Patient Sex header", () => {
    // Given
    const csv = validCxrCsv().replace("Patient Sex", "Patient Gender");

    // When
    const result = parseCxrMetadata({ csv, subjectKeySecret: TEST_SUBJECT_KEY, subjectKeyVersion: "v1" });

    // Then
    expect(result.records).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "missing_required_header" }));
  });

  it("reports malformed quoted CXR rows", () => {
    // Given
    const csv = validCxrCsv('"00000001_000.png","Mass","","123",55,"F","PA');

    // When
    const result = parseCxrMetadata({ csv, subjectKeySecret: TEST_SUBJECT_KEY, subjectKeyVersion: "v1" });

    // Then
    expect(result.records).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "malformed_csv" }));
  });

  it("parses quoted PTB-XL SCP codes and keeps only active safe diagnostic metadata", () => {
    // Given
    const database = validPtbxlCsv();

    // When
    const result = parsePtbxlMetadata({ databaseCsv: database, scpStatementsCsv: scpStatementsCsv() });

    // Then
    expect(result.records).toEqual([
      expect.objectContaining({
        sourceRecordId: "1",
        ageYears: 52,
        sex: "F",
        filenameLr: "records100/00000/00001_lr",
        activeScpCodes: ["NORM"],
        labels: [expect.objectContaining({ code: "NORM", description: "Normal ECG", diagnosticClass: "NORM" })],
      }),
    ]);
    expect(JSON.stringify(result.records)).not.toContain("999");
  });

  it("reports a duplicate PTB source identifier", () => {
    // Given
    const database = `${validPtbxlCsv()}\n${validPtbxlCsv().split("\n")[1]}`;

    // When
    const result = parsePtbxlMetadata({ databaseCsv: database, scpStatementsCsv: scpStatementsCsv() });

    // Then
    expect(result.records).toHaveLength(1);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "duplicate_source_record" }));
  });

  it("rejects a PTB-XL row when no active SCP code maps to a source statement", () => {
    // A removed mapped-label guard would publish an ungradable ECG.
    const database = validPtbxlCsv(`1,999,52,F,"hidden report","{'UNKNOWN': 100.0}","hidden nurse","hidden site","hidden device",records100/00000/00001_lr`);

    const result = parsePtbxlMetadata({ databaseCsv: database, scpStatementsCsv: scpStatementsCsv() });

    expect(result.records).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "unavailable_source_label", line: 2 }));
  });

  it("fails closed when the CXR subject HMAC secret is too short or its key version is unsafe", () => {
    // Removing either boundary check would publish stable patient linkability with weak key material.
    const csv = validCxrCsv();

    const shortSecret = parseCxrMetadata({ csv, subjectKeySecret: "too-short", subjectKeyVersion: "v1" });
    const unsafeVersion = parseCxrMetadata({ csv, subjectKeySecret: TEST_SUBJECT_KEY, subjectKeyVersion: "v1/../../old" });

    expect(shortSecret.records).toEqual([]);
    expect(shortSecret.issues).toContainEqual(expect.objectContaining({ kind: "invalid_subject_key_configuration", line: null }));
    expect(unsafeVersion.records).toEqual([]);
    expect(unsafeVersion.issues).toContainEqual(expect.objectContaining({ kind: "invalid_subject_key_configuration", line: null }));
  });

  it("uses a decoded 32-byte HMAC key rather than the encoded configuration text", () => {
    // Hashing the `hex:` prefix instead of decoded key bytes would silently change every patient key.
    const decodedKey = Buffer.from("ab".repeat(32), "hex");
    const result = parseCxrMetadata({ csv: validCxrCsv(), subjectKeySecret: `hex:${decodedKey.toString("hex")}`, subjectKeyVersion: "v2" });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.sourceSubjectKey).toBe(createHmac("sha256", decodedKey).update("123").digest("hex"));
  });
});

describe("RFC4180 parser safety", () => {
  it("rejects quote-smuggled text after a closed field", () => {
    // Accepting this would turn malformed source rows into a different trusted label.
    const result = parseCsv('label\n"Mass"smuggled\n');

    expect(result.rows).toEqual([{ line: 1, values: ["label"] }, { line: 2, values: ["Masssmuggled"] }]);
    expect(result.failures).toContainEqual(expect.objectContaining({ line: 2, message: "unexpected text after closing quote" }));
  });
});

describe("imaging storage policy", () => {
  it("resolves a nested display PNG below its real root", () => {
    // Given
    const root = createTemporaryDirectory();
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "nested", "image.png"), png());

    // When
    const result = resolveDisplayAsset({ storageKey: "nested/image.png", roots: [root] });

    // Then
    expect(result).toEqual(expect.objectContaining({ kind: "resolved", width: 640, height: 480 }));
  });

  it("rejects traversal and a symlink that escapes a display root", () => {
    // Given
    const root = createTemporaryDirectory();
    const outside = createTemporaryDirectory();
    fs.writeFileSync(path.join(outside, "outside.png"), png());
    fs.symlinkSync(outside, path.join(root, "escaped"));

    // When
    const traversal = resolveDisplayAsset({ storageKey: "../outside.png", roots: [root] });
    const symlinkEscape = resolveDisplayAsset({ storageKey: "escaped/outside.png", roots: [root] });

    // Then
    expect(traversal).toEqual(expect.objectContaining({ kind: "rejected", reason: "unsafe_storage_key" }));
    expect(symlinkEscape).toEqual(expect.objectContaining({ kind: "rejected", reason: "outside_allowed_root" }));
  });

  it("keeps display assets and source documents in separate extension policies", () => {
    // Given
    const root = createTemporaryDirectory();
    fs.writeFileSync(path.join(root, "metadata.csv"), "header\n");
    fs.writeFileSync(path.join(root, "image.png"), png());

    // When
    const document = resolveSourceDocument({ storageKey: "metadata.csv", roots: [root] });
    const pngAsDocument = resolveSourceDocument({ storageKey: "image.png", roots: [root] });
    const csvAsDisplay = resolveDisplayAsset({ storageKey: "metadata.csv", roots: [root] });

    // Then
    expect(document).toEqual(expect.objectContaining({ kind: "resolved", mimeType: "text/csv" }));
    expect(pngAsDocument).toEqual(expect.objectContaining({ kind: "rejected", reason: "extension_not_allowed" }));
    expect(csvAsDisplay).toEqual(expect.objectContaining({ kind: "rejected", reason: "extension_not_allowed" }));
  });

  it("rejects invalid PNG magic, dimensions, and oversized display assets", () => {
    // Given
    const root = createTemporaryDirectory();
    fs.writeFileSync(path.join(root, "magic.png"), "not-a-png");
    fs.writeFileSync(path.join(root, "zero.png"), png(0, 10));
    fs.writeFileSync(path.join(root, "large.png"), Buffer.concat([png(), Buffer.alloc(100)]));

    // When
    const badMagic = resolveDisplayAsset({ storageKey: "magic.png", roots: [root] });
    const badDimensions = resolveDisplayAsset({ storageKey: "zero.png", roots: [root] });
    const oversized = resolveDisplayAsset({ storageKey: "large.png", roots: [root], limits: { maxBytes: 24 } });

    // Then
    expect(badMagic).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_magic" }));
    expect(badDimensions).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_dimensions" }));
    expect(oversized).toEqual(expect.objectContaining({ kind: "rejected", reason: "file_too_large" }));
  });

  it("requires a complete, CRC-valid, decodable PNG stream before resolving a display asset", () => {
    // Replacing decode validation with IHDR-only parsing would accept every one of these corrupt image bodies.
    const root = createTemporaryDirectory();
    const crcFailure = png();
    crcFailure[crcFailure.length - 1] ^= 0xff;
    const compressedFailure = png();
    const idatTypeOffset = compressedFailure.indexOf(Buffer.from("IDAT"));
    compressedFailure[idatTypeOffset + 4] ^= 0xff;
    const idatLength = compressedFailure.readUInt32BE(idatTypeOffset - 4);
    const idatCrcOffset = idatTypeOffset + 4 + idatLength;
    compressedFailure.writeUInt32BE(crc32(compressedFailure.subarray(idatTypeOffset, idatCrcOffset)), idatCrcOffset);
    fs.writeFileSync(path.join(root, "crc.png"), crcFailure);
    fs.writeFileSync(path.join(root, "compressed.png"), compressedFailure);
    fs.writeFileSync(path.join(root, "truncated.png"), png().subarray(0, -5));
    fs.writeFileSync(path.join(root, "no-idat.png"), png(2, 2, { includeIdat: false }));

    const crc = resolveDisplayAsset({ storageKey: "crc.png", roots: [root] });
    const compressed = resolveDisplayAsset({ storageKey: "compressed.png", roots: [root] });
    const truncated = resolveDisplayAsset({ storageKey: "truncated.png", roots: [root] });
    const missingIdat = resolveDisplayAsset({ storageKey: "no-idat.png", roots: [root] });

    expect(crc).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_structure" }));
    expect(compressed).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_data" }));
    expect(truncated).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_structure" }));
    expect(missingIdat).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_structure" }));
  });

  it("fully validates legal Adam7 scanline layout before resolving an interlaced PNG", () => {
    // A wrong Adam7 pass geometry rejects real, decodable interlaced source images.
    const root = createTemporaryDirectory();
    fs.writeFileSync(path.join(root, "interlaced.png"), adam7Png());

    const result = resolveDisplayAsset({ storageKey: "interlaced.png", roots: [root] });

    expect(result).toEqual(expect.objectContaining({ kind: "resolved", width: 4, height: 3 }));
  });

  it("rejects PNG pixel layouts whose declared decompression size exceeds the bounded decoder limit", () => {
    // Removing the decoded-byte limit makes a tiny compressed file consume unbounded memory.
    const root = createTemporaryDirectory();
    fs.writeFileSync(path.join(root, "bomb.png"), png(8192, 8192, { rawData: Buffer.alloc(0) }));

    const result = resolveDisplayAsset({ storageKey: "bomb.png", roots: [root] });

    expect(result).toEqual(expect.objectContaining({ kind: "rejected", reason: "invalid_png_data" }));
  });

  it("validates PTB-XL 12-lead 100 Hz file pairs and rejects malformed headers or data", () => {
    // Given
    const root = createTemporaryDirectory();
    writeValidPtbxlPair(root);

    // When
    const valid = validatePtbxlRecording({ root, filenameLr: "records100/00000/00001_lr" });
    fs.truncateSync(path.join(root, "records100/00000/00001_lr.dat"), 2);
    const truncated = validatePtbxlRecording({ root, filenameLr: "records100/00000/00001_lr" });

    // Then
    expect(valid).toEqual(expect.objectContaining({ kind: "valid", nSig: 12, samplingFrequencyHz: 100 }));
    expect(truncated).toEqual(expect.objectContaining({ kind: "invalid", reason: "unexpected_dat_length" }));
  });

  it.each([
    ["wrong_nsig", "00001_lr 11 100 10"],
    ["wrong_fs", "00001_lr 12 500 10"],
    ["nonfinite_gain", "00001_lr.dat 16 NaN(0)/mV 16 0 0 0 I"],
    ["invalid_lead", "00001_lr.dat 16 1000(0)/mV 16 0 0 0 BAD"],
  ])("rejects PTB-XL %s headers", (_name, replacement) => {
    // Given
    const root = createTemporaryDirectory();
    writeValidPtbxlPair(root);
    const headerPath = path.join(root, "records100/00000/00001_lr.hea");
    const header = fs.readFileSync(headerPath, "utf8");
    const lineIndex = replacement.startsWith("00001_lr ") ? 0 : 1;
    const lines = header.split("\n");
    lines[lineIndex] = replacement;
    fs.writeFileSync(headerPath, lines.join("\n"));

    // When
    const result = validatePtbxlRecording({ root, filenameLr: "records100/00000/00001_lr" });

    // Then
    expect(result).toEqual(expect.objectContaining({ kind: "invalid" }));
  });

  it("rejects a WFDB header whose record name does not match the requested DAT layout", () => {
    // Ignoring the record name permits a header for a different signal to authorize this DAT file.
    const root = createTemporaryDirectory();
    writeValidPtbxlPair(root);
    const headerPath = path.join(root, "records100/00000/00001_lr.hea");
    const lines = fs.readFileSync(headerPath, "utf8").split("\n");
    lines[0] = "different_lr 12 100 10";
    fs.writeFileSync(headerPath, lines.join("\n"));

    const result = validatePtbxlRecording({ root, filenameLr: "records100/00000/00001_lr" });

    expect(result).toEqual(expect.objectContaining({ kind: "invalid", reason: "invalid_header" }));
  });

  it.each([
    ["eight_bit", "00001_lr.dat 8 1000(0)/mV 16 0 0 0 I"],
    ["twenty_four_bit", "00001_lr.dat 24 1000(0)/mV 16 0 0 0 I"],
    ["wrong_dat_layout", "other.dat 16 1000(0)/mV 16 0 0 0 I"],
  ])("rejects PTB-XL %s WFDB signal layouts", (_name, replacement) => {
    // Treating every sample as 16-bit would accept a file with a wrong byte-length interpretation.
    const root = createTemporaryDirectory();
    writeValidPtbxlPair(root);
    const headerPath = path.join(root, "records100/00000/00001_lr.hea");
    const lines = fs.readFileSync(headerPath, "utf8").split("\n");
    lines[1] = replacement;
    fs.writeFileSync(headerPath, lines.join("\n"));

    const result = validatePtbxlRecording({ root, filenameLr: "records100/00000/00001_lr" });

    expect(result).toEqual(expect.objectContaining({ kind: "invalid", reason: "invalid_signal_definition" }));
  });

  it("rejects a PTB-XL pair with a missing dat file", () => {
    // Given
    const root = createTemporaryDirectory();
    writeValidPtbxlPair(root);
    fs.unlinkSync(path.join(root, "records100/00000/00001_lr.dat"));

    // When
    const result = validatePtbxlRecording({ root, filenameLr: "records100/00000/00001_lr" });

    // Then
    expect(result).toEqual(expect.objectContaining({ kind: "invalid", reason: "missing_file" }));
  });
});
