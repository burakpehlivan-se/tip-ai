import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { discoverCxrDataset, discoverPtbxlDataset } from "./catalogue-discovery";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function root(): string { const value = fs.mkdtempSync(path.join(os.tmpdir(), "tip-ai-discovery-")); roots.push(value); return value; }
function writePtb(rootDir: string): void {
  const base = path.join(rootDir, "ptbxl/records100/00000/00001_lr"); fs.mkdirSync(path.dirname(base), { recursive: true });
  const leads = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];
  fs.writeFileSync(`${base}.hea`, [`00001_lr 12 100 1`, ...leads.map((lead) => `00001_lr.dat 16 1000(0)/mV 16 0 0 0 0 ${lead}`)].join("\n")); fs.writeFileSync(`${base}.dat`, Buffer.alloc(24));
}
describe("mounted-source catalogue discovery", () => {
  it("reports only a valid CXR PNG intersection and a valid PTB-XL WFDB pair", async () => {
    const data = root(); fs.mkdirSync(path.join(data, "chestxray/images_001/images"), { recursive: true }); fs.mkdirSync(path.join(data, "ptbxl"), { recursive: true });
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2"/></svg>')).png().toFile(path.join(data, "chestxray/images_001/images/00000001_000.png"));
    fs.writeFileSync(path.join(data, "chestxray/Data_Entry_2017_v2020.csv"), "Image Index,Finding Labels,Patient ID,Patient Age,Patient Sex,View Position\n00000001_000.png,Mass,42,55,M,PA\n00000002_000.png,Mass,43,56,F,PA\n");
    fs.writeFileSync(path.join(data, "chestxray/README_CHESTXRAY.pdf"), "docs"); writePtb(data);
    fs.writeFileSync(path.join(data, "ptbxl/ptbxl_database.csv"), "ecg_id,age,sex,scp_codes,filename_lr\n1,55,M,\"{'NORM': 100.0}\",records100/00000/00001_lr\n");
    fs.writeFileSync(path.join(data, "ptbxl/scp_statements.csv"), "scp_code,description,diagnostic_class,diagnostic_subclass\nNORM,Normal,Normal,Normal\n");
    const cxr = discoverCxrDataset({ rawRoot: data, version: "v2020", subjectKeySecret: "x".repeat(32), subjectKeyVersion: "v1" }); const ptb = discoverPtbxlDataset({ rawRoot: data, version: "1.0.3" });
    expect(cxr.records).toHaveLength(1); expect(cxr.records[0]?.labels[0]?.provenance).toBe("nih_cxr14_report_nlp"); expect(cxr.skipped).toBeGreaterThan(0);
    expect(ptb.records).toHaveLength(1); expect(ptb.records[0]?.labels[0]?.provenance).toBe("ptbxl_scp_statement");
  });
});
