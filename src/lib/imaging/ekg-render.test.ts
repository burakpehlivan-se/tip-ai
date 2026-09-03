import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderPtbxlDisplayImage } from "./ekg-render";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function fixture(): { root: string; output: string; filename: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-render-source-")); const output = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-render-output-")); dirs.push(root, output);
  const relative = "records100/00000/00001_lr"; const base = path.join(root, relative); fs.mkdirSync(path.dirname(base), { recursive: true });
  const leads = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];
  fs.writeFileSync(`${base}.hea`, [`00001_lr 12 100 4`, ...leads.map((lead) => `00001_lr.dat 16 1000(0)/mV 16 0 0 0 0 ${lead}`)].join("\n"));
  const signal = Buffer.alloc(4 * 12 * 2); for (let i = 0; i < 48; i++) signal.writeInt16LE(i * 7, i * 2); fs.writeFileSync(`${base}.dat`, signal);
  return { root, output, filename: relative };
}

describe("PTB-XL display renderer", () => {
  it("writes an atomically validated PNG and refuses a different existing result", async () => {
    const input = fixture();
    const first = await renderPtbxlDisplayImage({ sourceRoot: input.root, outputRoot: input.output, filenameLr: input.filename, sourceRecordId: "1", rendererVersion: "v1", renderProfile: "standard" });
    expect(first.kind).toBe("rendered"); if (first.kind !== "rendered") return;
    expect(fs.existsSync(first.absolutePath)).toBe(true); expect(first.width).toBeGreaterThan(100);
    const second = await renderPtbxlDisplayImage({ sourceRoot: input.root, outputRoot: input.output, filenameLr: input.filename, sourceRecordId: "1", rendererVersion: "v1", renderProfile: "standard" });
    expect(second.kind).toBe("existing");
    fs.writeFileSync(first.absolutePath, "different");
    await expect(renderPtbxlDisplayImage({ sourceRoot: input.root, outputRoot: input.output, filenameLr: input.filename, sourceRecordId: "1", rendererVersion: "v1", renderProfile: "standard" })).rejects.toThrow("different checksum");
  });

  it("has one writer under concurrent duplicate work and leaves no temporary artifact", async () => {
    const input = fixture();
    const args = { sourceRoot: input.root, outputRoot: input.output, filenameLr: input.filename, sourceRecordId: "2", rendererVersion: "v1", renderProfile: "standard" };
    const outputs = await Promise.all([renderPtbxlDisplayImage(args), renderPtbxlDisplayImage(args)]);
    expect(outputs.map((result) => result.kind).sort()).toEqual(["existing", "rendered"]);
    const targetDir = path.join(input.output, "ptbxl/2");
    expect(fs.readdirSync(targetDir).every((name) => !name.endsWith(".tmp"))).toBe(true);
  });

  it("rejects a symlinked intermediate output directory before anything can escape the display root", async () => {
    const input = fixture();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-render-outside-"));
    dirs.push(outside);
    fs.symlinkSync(outside, path.join(input.output, "ptbxl"), "dir");

    await expect(renderPtbxlDisplayImage({
      sourceRoot: input.root,
      outputRoot: input.output,
      filenameLr: input.filename,
      sourceRecordId: "1",
      rendererVersion: "v1",
      renderProfile: "standard",
    })).rejects.toThrow("renderer output directory contains a symlink");

    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.existsSync(path.join(outside, "1"))).toBe(false);
  });
});
