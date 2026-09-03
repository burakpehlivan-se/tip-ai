import { createHmac } from "node:crypto";
import { csvCell, headerPositions, parseCsv } from "./csv";

export type SourceIssueKind =
  | "malformed_csv"
  | "missing_required_header"
  | "malformed_row"
  | "invalid_source_label_set"
  | "unavailable_source_label"
  | "invalid_subject_key_configuration"
  | "duplicate_source_record";

export type SourceParseIssue = {
  readonly kind: SourceIssueKind;
  readonly line: number | null;
  readonly detail: string;
};

export type CxrSourceRecord = {
  readonly sourceRecordId: string;
  readonly sourceSubjectKey: string;
  readonly sourceSubjectKeyVersion: string;
  readonly ageYears: number | null;
  readonly sex: "M" | "F" | null;
  readonly viewPosition: string | null;
  readonly sourceLabels: readonly string[];
  readonly originalWidth: number | null;
  readonly originalHeight: number | null;
  readonly pixelSpacingX: number | null;
  readonly pixelSpacingY: number | null;
};

export type PtbxlLabel = {
  readonly code: string;
  readonly description: string | null;
  readonly diagnosticClass: string | null;
  readonly diagnosticSubclass: string | null;
};

export type PtbxlSourceRecord = {
  readonly sourceRecordId: string;
  readonly ageYears: number | null;
  readonly sex: "M" | "F" | null;
  readonly filenameLr: string;
  readonly activeScpCodes: readonly string[];
  readonly labels: readonly PtbxlLabel[];
};

export type CxrParseResult = {
  readonly records: readonly CxrSourceRecord[];
  readonly issues: readonly SourceParseIssue[];
};

export type PtbxlParseResult = {
  readonly records: readonly PtbxlSourceRecord[];
  readonly issues: readonly SourceParseIssue[];
};

type CxrInput = {
  readonly csv: string;
  readonly subjectKeySecret: string;
  readonly subjectKeyVersion: string;
};

type PtbxlInput = {
  readonly databaseCsv: string;
  readonly scpStatementsCsv: string;
};

const CXR_REQUIRED_HEADERS = [
  "Image Index",
  "Finding Labels",
  "Patient ID",
  "Patient Age",
  "Patient Sex",
  "View Position",
] as const;

const PTBXL_REQUIRED_HEADERS = ["ecg_id", "age", "sex", "scp_codes", "filename_lr"] as const;
const SCP_REQUIRED_HEADERS = ["scp_code", "description", "diagnostic_class", "diagnostic_subclass"] as const;

function missingHeaders(headers: ReadonlyMap<string, number>, required: readonly string[]): readonly string[] {
  return required.filter((header) => !headers.has(header));
}

function safeAge(value: string): number | null {
  if (!/^\d{1,3}$/.test(value)) return null;
  const age = Number(value);
  return age >= 0 && age <= 120 ? age : null;
}

function safeSex(value: string): "M" | "F" | null {
  return value === "M" || value === "F" ? value : null;
}

function safeFiniteNumber(value: string): number | null {
  if (value.length === 0 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function pixelSpacing(value: string): readonly [number | null, number | null] {
  const values = value.split("\\").map((entry) => safeFiniteNumber(entry.trim()));
  return [values[0] ?? null, values[1] ?? null];
}

function dimensions(value: string): readonly [number | null, number | null] {
  const values = value.split(",").map((entry) => safePositiveInteger(entry.trim()));
  return [values[0] ?? null, values[1] ?? null];
}

function cxrDimensions(row: Parameters<typeof csvCell>[0], headers: ReadonlyMap<string, number>): readonly [number | null, number | null] {
  const joined = csvCell(row, headers, "OriginalImage[Width,Height]");
  if (joined !== null) return dimensions(joined);
  return [
    safePositiveInteger(csvCell(row, headers, "OriginalImage[Width") ?? ""),
    safePositiveInteger(csvCell(row, headers, "Height]") ?? ""),
  ];
}

function cxrPixelSpacing(row: Parameters<typeof csvCell>[0], headers: ReadonlyMap<string, number>): readonly [number | null, number | null] {
  const joined = csvCell(row, headers, "OriginalImagePixelSpacing[x,y]");
  if (joined !== null) return pixelSpacing(joined);
  return [
    safeFiniteNumber(csvCell(row, headers, "OriginalImagePixelSpacing[x") ?? ""),
    safeFiniteNumber(csvCell(row, headers, "y]") ?? ""),
  ];
}

function isSafeSourceFileName(value: string): boolean {
  return /^[0-9]{8}_[0-9]{3}\.png$/.test(value);
}

const SUBJECT_KEY_VERSION = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/;
const MINIMUM_SUBJECT_KEY_BYTES = 32;

function decodedSubjectKeySecret(value: string): Buffer | null {
  if (value.startsWith("hex:")) {
    const encoded = value.slice("hex:".length);
    if (encoded.length === 0 || encoded.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(encoded)) return null;
    return Buffer.from(encoded, "hex");
  }
  if (value.startsWith("base64:")) {
    const encoded = value.slice("base64:".length);
    if (encoded.length === 0 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
    const decoded = Buffer.from(encoded, "base64");
    return decoded.toString("base64") === encoded ? decoded : null;
  }
  return Buffer.from(value, "utf8");
}

function validSubjectKeyConfiguration(input: CxrInput): Buffer | null {
  if (!SUBJECT_KEY_VERSION.test(input.subjectKeyVersion)) return null;
  const secret = decodedSubjectKeySecret(input.subjectKeySecret);
  return secret !== null && secret.byteLength >= MINIMUM_SUBJECT_KEY_BYTES ? secret : null;
}

/** Parses NIH ChestX-ray14 v2020 metadata by its official column names. */
export function parseCxrMetadata(input: CxrInput): CxrParseResult {
  const subjectKeySecret = validSubjectKeyConfiguration(input);
  if (subjectKeySecret === null) {
    return {
      records: [],
      issues: [{ kind: "invalid_subject_key_configuration", line: null, detail: "subject key material or version is invalid" }],
    };
  }
  const parsed = parseCsv(input.csv);
  const issues: SourceParseIssue[] = parsed.failures.map((failure) => ({
    kind: "malformed_csv",
    line: failure.line,
    detail: failure.message,
  }));
  const header = parsed.rows[0];
  if (!header || parsed.failures.length > 0) return { records: [], issues };
  const headers = headerPositions(header.values);
  const missing = missingHeaders(headers, CXR_REQUIRED_HEADERS);
  if (missing.length > 0) {
    return {
      records: [],
      issues: [...issues, { kind: "missing_required_header", line: header.line, detail: missing.join(", ") }],
    };
  }

  const records: CxrSourceRecord[] = [];
  const recordIds = new Set<string>();
  for (const row of parsed.rows.slice(1)) {
    const imageIndex = csvCell(row, headers, "Image Index");
    const labelsValue = csvCell(row, headers, "Finding Labels");
    const patientId = csvCell(row, headers, "Patient ID");
    const age = csvCell(row, headers, "Patient Age");
    const sex = csvCell(row, headers, "Patient Sex");
    const viewPosition = csvCell(row, headers, "View Position");
    if (!imageIndex || !labelsValue || !patientId || age === null || sex === null || viewPosition === null || !isSafeSourceFileName(imageIndex)) {
      issues.push({ kind: "malformed_row", line: row.line, detail: "CXR row has missing or unsafe required fields" });
      continue;
    }
    if (recordIds.has(imageIndex)) {
      issues.push({ kind: "duplicate_source_record", line: row.line, detail: imageIndex });
      continue;
    }
    const sourceLabels = [...new Set(labelsValue.split("|").map((label) => label.trim()).filter(Boolean))];
    if (sourceLabels.length === 0 || (sourceLabels.includes("No Finding") && sourceLabels.length !== 1)) {
      issues.push({ kind: "invalid_source_label_set", line: row.line, detail: imageIndex });
      continue;
    }
    const [originalWidth, originalHeight] = cxrDimensions(row, headers);
    const [pixelSpacingX, pixelSpacingY] = cxrPixelSpacing(row, headers);
    records.push({
      sourceRecordId: imageIndex,
      sourceSubjectKey: createHmac("sha256", subjectKeySecret).update(patientId).digest("hex"),
      sourceSubjectKeyVersion: input.subjectKeyVersion,
      ageYears: safeAge(age),
      sex: safeSex(sex),
      viewPosition: viewPosition || null,
      sourceLabels,
      originalWidth,
      originalHeight,
      pixelSpacingX,
      pixelSpacingY,
    });
    recordIds.add(imageIndex);
  }
  return { records, issues };
}

type ScpStatement = {
  readonly description: string | null;
  readonly diagnosticClass: string | null;
  readonly diagnosticSubclass: string | null;
};

function parseScpStatements(input: string): { readonly statements: ReadonlyMap<string, ScpStatement>; readonly issues: readonly SourceParseIssue[] } {
  const parsed = parseCsv(input);
  const issues: SourceParseIssue[] = parsed.failures.map((failure) => ({ kind: "malformed_csv", line: failure.line, detail: failure.message }));
  const header = parsed.rows[0];
  if (!header || parsed.failures.length > 0) return { statements: new Map(), issues };
  const headers = headerPositions(header.values);
  const missing = missingHeaders(headers, SCP_REQUIRED_HEADERS);
  if (missing.length > 0) {
    return { statements: new Map(), issues: [...issues, { kind: "missing_required_header", line: header.line, detail: missing.join(", ") }] };
  }
  const statements = new Map<string, ScpStatement>();
  for (const row of parsed.rows.slice(1)) {
    const code = csvCell(row, headers, "scp_code");
    if (!code) {
      issues.push({ kind: "malformed_row", line: row.line, detail: "missing scp_code" });
      continue;
    }
    statements.set(code, {
      description: csvCell(row, headers, "description") || null,
      diagnosticClass: csvCell(row, headers, "diagnostic_class") || null,
      diagnosticSubclass: csvCell(row, headers, "diagnostic_subclass") || null,
    });
  }
  return { statements, issues };
}

function parseScpCodes(value: string): ReadonlyMap<string, number> | null {
  const source = value.trim();
  if (!source.startsWith("{") || !source.endsWith("}")) return null;
  const body = source.slice(1, -1);
  const codes = new Map<string, number>();
  const pattern = /\s*'([^']+)'\s*:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(?:,|$)/gy;
  let position = 0;
  while (position < body.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(body);
    if (!match) return null;
    const code = match[1];
    const score = Number(match[2]);
    if (!code || !Number.isFinite(score)) return null;
    codes.set(code, score);
    position = pattern.lastIndex;
  }
  return codes;
}

function isSafePtbxlFilename(value: string): boolean {
  return /^records100\/[0-9]{5}\/[0-9]{5}_lr$/.test(value);
}

/** Parses PTB-XL metadata while intentionally omitting raw patient/report/site/device fields. */
export function parsePtbxlMetadata(input: PtbxlInput): PtbxlParseResult {
  const database = parseCsv(input.databaseCsv);
  const statementsResult = parseScpStatements(input.scpStatementsCsv);
  const issues: SourceParseIssue[] = [
    ...database.failures.map((failure) => ({ kind: "malformed_csv" as const, line: failure.line, detail: failure.message })),
    ...statementsResult.issues,
  ];
  const header = database.rows[0];
  if (!header || database.failures.length > 0 || statementsResult.issues.some((issue) => issue.kind === "missing_required_header")) {
    return { records: [], issues };
  }
  const headers = headerPositions(header.values);
  const missing = missingHeaders(headers, PTBXL_REQUIRED_HEADERS);
  if (missing.length > 0) {
    return { records: [], issues: [...issues, { kind: "missing_required_header", line: header.line, detail: missing.join(", ") }] };
  }
  const records: PtbxlSourceRecord[] = [];
  const recordIds = new Set<string>();
  for (const row of database.rows.slice(1)) {
    const sourceRecordId = csvCell(row, headers, "ecg_id");
    const filenameLr = csvCell(row, headers, "filename_lr");
    const codes = csvCell(row, headers, "scp_codes");
    if (!sourceRecordId || !/^\d+$/.test(sourceRecordId) || !filenameLr || !codes || !isSafePtbxlFilename(filenameLr)) {
      issues.push({ kind: "malformed_row", line: row.line, detail: "PTB-XL row has missing or unsafe required fields" });
      continue;
    }
    if (recordIds.has(sourceRecordId)) {
      issues.push({ kind: "duplicate_source_record", line: row.line, detail: sourceRecordId });
      continue;
    }
    const parsedCodes = parseScpCodes(codes);
    if (!parsedCodes) {
      issues.push({ kind: "malformed_row", line: row.line, detail: "invalid scp_codes" });
      continue;
    }
    const activeScpCodes = [...parsedCodes.entries()]
      .filter(([, score]) => score > 0)
      .map(([code]) => code)
      .sort();
    const labels = activeScpCodes.flatMap((code) => {
      const statement = statementsResult.statements.get(code);
      return statement
        ? [{ code, description: statement.description, diagnosticClass: statement.diagnosticClass, diagnosticSubclass: statement.diagnosticSubclass }]
        : [];
    });
    if (labels.length === 0) {
      issues.push({ kind: "unavailable_source_label", line: row.line, detail: sourceRecordId });
      continue;
    }
    records.push({
      sourceRecordId,
      ageYears: safeAge(csvCell(row, headers, "age") ?? ""),
      sex: safeSex(csvCell(row, headers, "sex") ?? ""),
      filenameLr,
      activeScpCodes,
      labels,
    });
    recordIds.add(sourceRecordId);
  }
  return { records, issues };
}
