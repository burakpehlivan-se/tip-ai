export type CsvRow = {
  readonly line: number;
  readonly values: readonly string[];
};

export type CsvParseFailure = {
  readonly line: number;
  readonly message: string;
};

export type CsvParseResult = {
  readonly rows: readonly CsvRow[];
  readonly failures: readonly CsvParseFailure[];
};

/** Parses RFC4180-style data without treating quoted commas as delimiters. */
export function parseCsv(input: string): CsvParseResult {
  const rows: CsvRow[] = [];
  const failures: CsvParseFailure[] = [];
  let values: string[] = [];
  let value = "";
  let quoted = false;
  let closedQuotedField = false;
  let line = 1;
  let rowLine = 1;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? "";
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuotedField = true;
        }
      } else {
        value += character;
        if (character === "\n") line += 1;
      }
      continue;
    }

    if (closedQuotedField) {
      if (character === ",") {
        values.push(value);
        value = "";
        closedQuotedField = false;
      } else if (character === "\n") {
        values.push(value.replace(/\r$/, ""));
        if (values.some((entry) => entry.length > 0)) rows.push({ line: rowLine, values });
        values = [];
        value = "";
        closedQuotedField = false;
        line += 1;
        rowLine = line;
      } else if (character === "\r" && input[index + 1] === "\n") {
        // The newline branch consumes this CRLF pair.
      } else {
        failures.push({ line, message: "unexpected text after closing quote" });
        value += character;
        closedQuotedField = false;
      }
    } else if (character === '"') {
      if (value.length > 0) {
        failures.push({ line, message: "quote must begin a field" });
      } else {
        quoted = true;
      }
    } else if (character === ",") {
      values.push(value);
      value = "";
    } else if (character === "\n") {
      values.push(value.replace(/\r$/, ""));
      if (values.some((entry) => entry.length > 0)) rows.push({ line: rowLine, values });
      values = [];
      value = "";
      line += 1;
      rowLine = line;
    } else if (character === "\r" && input[index + 1] === "\n") {
      // The newline branch consumes this CRLF pair.
    } else {
      value += character;
    }
  }

  if (quoted) failures.push({ line: rowLine, message: "unterminated quoted field" });
  if (!quoted && (value.length > 0 || values.length > 0)) {
    values.push(value.replace(/\r$/, ""));
    if (values.some((entry) => entry.length > 0)) rows.push({ line: rowLine, values });
  }
  return { rows, failures };
}

export function headerPositions(header: readonly string[]): ReadonlyMap<string, number> {
  return new Map(header.map((name, index) => [name.trim(), index]));
}

export function csvCell(row: CsvRow, headers: ReadonlyMap<string, number>, header: string): string | null {
  const position = headers.get(header);
  if (position === undefined) return null;
  return row.values[position]?.trim() ?? "";
}
