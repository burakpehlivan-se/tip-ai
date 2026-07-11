import { TestSonucu, ClinicalProfile } from "./types";
import referenceLibrary from "./lab-reference-library.json";

export type TestTip = "numeric" | "json" | "text";

export interface NumericRange {
  min: number;
  max: number;
  tipikDeger: number;
}

export interface JsonDefault {
  [key: string]: number | string;
}

export interface VarsayilanBlok {
  erkek?: NumericRange | JsonDefault;
  kadin?: NumericRange | JsonDefault;
  tumHastalar?: NumericRange | JsonDefault;
}

export interface KritikEsik {
  alt?: number;
  ust?: number;
}

export interface TestReferenceEntry {
  testAdi: string;
  tip: TestTip;
  birim: string;
  kategori: string;
  varsayilanDeger: VarsayilanBlok;
  kritikEsikler?: KritikEsik;
  yorumMetni: string;
}

interface ReferenceLibraryJson {
  tests: Record<string, TestReferenceEntry>;
}

const library = referenceLibrary as unknown as ReferenceLibraryJson;

export function getReferenceEntry(testKey: string): TestReferenceEntry | undefined {
  return library.tests[testKey];
}

export function getAllTestKeys(): string[] {
  return Object.keys(library.tests);
}

export function getTestTip(testKey: string): TestTip | undefined {
  return library.tests[testKey]?.tip;
}

function pickDemographic(
  blok: VarsayilanBlok,
  sex: "E" | "K"
): NumericRange | JsonDefault | undefined {
  if (sex === "E" && blok.erkek) return blok.erkek;
  if (sex === "K" && blok.kadin) return blok.kadin;
  return blok.tumHastalar;
}

function getNumericDefault(
  entry: TestReferenceEntry,
  sex: "E" | "K"
): NumericRange | undefined {
  const def = pickDemographic(entry.varsayilanDeger, sex);
  if (!def || typeof (def as NumericRange).tipikDeger !== "number") return undefined;
  return def as NumericRange;
}

function sampleNumeric(range: NumericRange): number {
  const mid = range.tipikDeger;
  const spread = (range.max - range.min) * 0.15;
  const val = mid + (Math.random() - 0.5) * 2 * spread;
  return Math.round(Math.min(range.max, Math.max(range.min, val)) * 100) / 100;
}

function buildRefText(entry: TestReferenceEntry, sex: "E" | "K"): string {
  const def = getNumericDefault(entry, sex);
  if (!def) return `${entry.testAdi} — normal`;
  if (entry.birim) {
    return `${def.min}-${def.max} ${entry.birim}`;
  }
  return `${def.min}-${def.max}`;
}

function interpolateYorum(
  template: string,
  deger: string | number,
  refText: string
): string {
  return template
    .replace(/\{deger\}/g, String(deger))
    .replace(/\{ref\}/g, refText);
}

export function generateNormalValue(
  testKey: string,
  sex: "E" | "K" = "E"
): TestSonucu | null {
  const entry = library.tests[testKey];
  if (!entry) return null;

  const baseRefText = buildRefText(entry, sex);

  if (entry.tip === "numeric") {
    const numericDef = getNumericDefault(entry, sex);
    if (!numericDef) return null;

    const deger = sampleNumeric(numericDef);
    return {
      testKey,
      testAdi: entry.testAdi,
      tip: "numeric",
      sonuc: {
        deger,
        birim: entry.birim,
        referansAralik: baseRefText,
      },
      referans: "TIP-AI Lab Referans Kütüphanesi",
      yorum: interpolateYorum(entry.yorumMetni, deger, baseRefText),
      source: "synthetic",
    };
  }

  if (entry.tip === "json") {
    const panelDef = pickDemographic(entry.varsayilanDeger, sex);
    if (!panelDef || typeof (panelDef as JsonDefault).tipikDeger === "number") return null;

    return {
      testKey,
      testAdi: entry.testAdi,
      tip: "json",
      sonuc: { ...panelDef } as Record<string, unknown>,
      referans: "TIP-AI Lab Referans Kütüphanesi",
      yorum: entry.yorumMetni,
      source: "synthetic",
    };
  }

  if (entry.tip === "text") {
    const textDef = pickDemographic(entry.varsayilanDeger, sex);
    const textValue =
      typeof textDef === "string" ? textDef : (textDef as unknown as string) || `${entry.testAdi} — normal bulgular`;

    return {
      testKey,
      testAdi: entry.testAdi,
      tip: "text",
      sonuc: String(textValue),
      referans: "TIP-AI Lab Referans Kütüphanesi",
      yorum: entry.yorumMetni,
      source: "synthetic",
    };
  }

  return null;
}

export function generateAbnormalValue(
  testKey: string,
  sex: "E" | "K",
  tendency: "yuksek" | "dusuk",
  factor?: number
): TestSonucu | null {
  const entry = library.tests[testKey];
  if (!entry || entry.tip !== "numeric") return null;

  const numericDef = getNumericDefault(entry, sex);
  if (!numericDef) return null;

  const { min, max } = numericDef;
  const range = max - min;
  const f = factor || 3;

  let deger: number;
  if (tendency === "yuksek") {
    deger = max + range * f * (0.7 + Math.random() * 0.6);
  } else {
    deger = min - range * f * (0.7 + Math.random() * 0.6);
  }
  deger = Math.round(deger * 100) / 100;

  const statusText = tendency === "yuksek" ? "yüksek" : "düşük";

  return {
    testKey,
    testAdi: entry.testAdi,
    tip: "numeric",
    sonuc: {
      deger,
      birim: entry.birim,
      referansAralik: buildRefText(entry, sex),
    },
    referans: "TIP-AI Lab Referans Kütüphanesi",
    yorum: `${entry.testAdi} ${statusText}: ${deger} ${entry.birim} (Normal: ${buildRefText(entry, sex)}).`,
    source: "synthetic",
  };
}
