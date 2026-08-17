import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveRadiologyImagePath } from "./radiology-image";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("radiology image path resolution", () => {
  it("resolves an indexed PNG from the configured image directory", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-radiology-image-"));
    tempDirectories.push(directory);
    fs.writeFileSync(path.join(directory, "00000001_000.png"), "png-fixture");

    expect(resolveRadiologyImagePath("nested/00000001_000.png", [directory])).toBe(
      path.join(directory, "00000001_000.png")
    );
  });

  it("rejects non-PNG indexes and missing files", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-radiology-image-"));
    tempDirectories.push(directory);

    expect(resolveRadiologyImagePath("00000001_000.jpg", [directory])).toBeNull();
    expect(resolveRadiologyImagePath("00000001_000.png", [directory])).toBeNull();
  });
});
