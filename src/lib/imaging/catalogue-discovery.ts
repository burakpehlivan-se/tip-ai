import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseCxrMetadata, parsePtbxlMetadata, type CxrSourceRecord, type PtbxlSourceRecord } from "./source-parsers";
import { resolveDisplayAsset, resolveSourceDocument, validatePtbxlRecording } from "./storage";

export type IndexedDatasetDocument = { readonly documentKind: string; readonly storageKey: string; readonly checksumSha256: string; readonly mimeType: string; readonly title: string; readonly attribution: string };
export type IndexedImagingRecord = {
  readonly sourceRecordId: string; readonly sourceSubjectKey: string | null; readonly sourceAge: number | null; readonly sourceSex: "M" | "F" | null;
  readonly viewPosition: string | null; readonly protocol: string | null; readonly metadataChecksum: string; readonly storageKey: string;
  readonly assetChecksumSha256: string; readonly assetBytes: number; readonly width: number | null; readonly height: number | null; readonly samplingRateHz: number | null;
  readonly labels: readonly { readonly key: string; readonly code: string | null; readonly name: string; readonly category: string | null; readonly provenance: "nih_cxr14_report_nlp" | "ptbxl_scp_statement" }[];
};
export type DiscoveredDataset = { readonly datasetKey: "nih_chestxray14" | "ptbxl"; readonly version: string; readonly modality: "CXR" | "ECG"; readonly metadataChecksum: string; readonly manifestChecksum: string; readonly records: readonly IndexedImagingRecord[]; readonly documents: readonly IndexedDatasetDocument[]; readonly skipped: number };

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function stable(value: unknown): string { return JSON.stringify(value); }
function document(root: string, storageKey: string, documentKind: string, title: string, attribution: string): IndexedDatasetDocument | null {
  const resolved = resolveSourceDocument({ roots: [root], storageKey });
  if (resolved.kind !== "resolved") return null;
  return { documentKind, storageKey, checksumSha256: sha256(fs.readFileSync(resolved.absolutePath)), mimeType: resolved.mimeType, title, attribution };
}
function manifest(datasetKey: string, version: string, metadataChecksum: string, documents: readonly IndexedDatasetDocument[], records: readonly IndexedImagingRecord[]): string {
  return sha256(stable({ datasetKey, version, metadataChecksum, documents: [...documents].sort((a, b) => a.storageKey.localeCompare(b.storageKey)), records: records.map((record) => ({ id: record.sourceRecordId, metadata: record.metadataChecksum, asset: record.assetChecksumSha256 })).sort((a, b) => a.id.localeCompare(b.id)) }));
}
function cxrRecord(record: CxrSourceRecord, rawRoot: string): IndexedImagingRecord | null {
  const asset = resolveDisplayAsset({ roots: [path.join(rawRoot, "chestxray/images_001/images")], storageKey: record.sourceRecordId });
  if (asset.kind !== "resolved") return null;
  const storageKey = `chestxray/images_001/images/${record.sourceRecordId}`;
  const metadataChecksum = sha256(stable({ id: record.sourceRecordId, age: record.ageYears, sex: record.sex, view: record.viewPosition, width: record.originalWidth, height: record.originalHeight, x: record.pixelSpacingX, y: record.pixelSpacingY, labels: record.sourceLabels }));
  return { sourceRecordId: record.sourceRecordId, sourceSubjectKey: record.sourceSubjectKey, sourceAge: record.ageYears, sourceSex: record.sex, viewPosition: record.viewPosition, protocol: null, metadataChecksum, storageKey, assetChecksumSha256: sha256(fs.readFileSync(asset.absolutePath)), assetBytes: asset.byteLength, width: asset.width, height: asset.height, samplingRateHz: null, labels: record.sourceLabels.map((label, index) => ({ key: `nih_cxr14_report_nlp:${label}`, code: null, name: label, category: null, provenance: "nih_cxr14_report_nlp", ...(index === 0 ? {} : {}) })) };
}
function ptbRecord(record: PtbxlSourceRecord, rawRoot: string): IndexedImagingRecord | null {
  const validation = validatePtbxlRecording({ root: path.join(rawRoot, "ptbxl"), filenameLr: record.filenameLr });
  if (validation.kind !== "valid") return null;
  const dataPath = path.join(rawRoot, "ptbxl", `${record.filenameLr}.dat`);
  const storageKey = `ptbxl/${record.filenameLr}.dat`;
  const metadataChecksum = sha256(stable({ id: record.sourceRecordId, age: record.ageYears, sex: record.sex, filename: record.filenameLr, labels: record.labels }));
  return { sourceRecordId: record.sourceRecordId, sourceSubjectKey: null, sourceAge: record.ageYears, sourceSex: record.sex, viewPosition: null, protocol: "PTB-XL 100 Hz", metadataChecksum, storageKey, assetChecksumSha256: sha256(fs.readFileSync(dataPath)), assetBytes: fs.statSync(dataPath).size, width: null, height: null, samplingRateHz: validation.samplingFrequencyHz, labels: record.labels.map((label) => ({ key: `ptbxl_scp_statement:${label.code}`, code: label.code, name: label.description ?? label.code, category: label.diagnosticClass ?? label.diagnosticSubclass, provenance: "ptbxl_scp_statement" })) };
}

/** Discovers only mounted, validated direct-source records; it never downloads. */
export function discoverCxrDataset(input: { readonly rawRoot: string; readonly version: string; readonly subjectKeySecret: string; readonly subjectKeyVersion: string }): DiscoveredDataset {
  const metadataPath = path.join(input.rawRoot, "chestxray/Data_Entry_2017_v2020.csv");
  const metadata = fs.readFileSync(metadataPath, "utf8"); const parsed = parseCxrMetadata({ csv: metadata, subjectKeySecret: input.subjectKeySecret, subjectKeyVersion: input.subjectKeyVersion });
  if (parsed.issues.some((issue) => issue.kind === "invalid_subject_key_configuration" || issue.kind === "missing_required_header" || issue.kind === "malformed_csv")) throw new Error("CXR metadata or HMAC configuration is invalid; import is fail-closed");
  const records = parsed.records.map((record) => cxrRecord(record, input.rawRoot)).filter((record): record is IndexedImagingRecord => record !== null);
  const documents = [document(input.rawRoot, "chestxray/README_CHESTXRAY.pdf", "data_use", "NIH ChestX-ray14 data-use and attribution", "NIH Clinical Center ChestX-ray14"), document(input.rawRoot, "chestxray/ARXIV_V5_CHESTXRAY.pdf", "citation", "ChestX-ray8/14 dataset paper", "Wang et al.")].filter((value): value is IndexedDatasetDocument => value !== null);
  const metadataChecksum = sha256(metadata);
  return { datasetKey: "nih_chestxray14", version: input.version, modality: "CXR", metadataChecksum, documents, records, skipped: parsed.records.length - records.length + parsed.issues.length, manifestChecksum: manifest("nih_chestxray14", input.version, metadataChecksum, documents, records) };
}

export function discoverPtbxlDataset(input: { readonly rawRoot: string; readonly version: string }): DiscoveredDataset {
  const databasePath = path.join(input.rawRoot, "ptbxl/ptbxl_database.csv"); const statementsPath = path.join(input.rawRoot, "ptbxl/scp_statements.csv");
  const database = fs.readFileSync(databasePath, "utf8"); const statements = fs.readFileSync(statementsPath, "utf8"); const parsed = parsePtbxlMetadata({ databaseCsv: database, scpStatementsCsv: statements });
  if (parsed.issues.some((issue) => issue.kind === "missing_required_header" || issue.kind === "malformed_csv")) throw new Error("PTB-XL metadata is invalid");
  const records = parsed.records.map((record) => ptbRecord(record, input.rawRoot)).filter((record): record is IndexedImagingRecord => record !== null);
  const documents = [document(input.rawRoot, "ptbxl/ptbxl_database.csv", "metadata", "PTB-XL metadata", "PTB-XL / PhysioNet"), document(input.rawRoot, "ptbxl/scp_statements.csv", "label_dictionary", "PTB-XL SCP statements", "PTB-XL / PhysioNet"), document(input.rawRoot, "ptbxl/LICENSE.txt", "license", "PTB-XL licence", "PTB-XL / PhysioNet")].filter((value): value is IndexedDatasetDocument => value !== null);
  const metadataChecksum = sha256(Buffer.concat([Buffer.from(database), Buffer.from(statements)]));
  return { datasetKey: "ptbxl", version: input.version, modality: "ECG", metadataChecksum, documents, records, skipped: parsed.records.length - records.length + parsed.issues.length, manifestChecksum: manifest("ptbxl", input.version, metadataChecksum, documents, records) };
}
