import { createHash } from "node:crypto";
import type { AdminVaka } from "./types";

/** Öğrenci denemesine bağlanan sürüm damgası. */
export type CaseVersionStamp = {
  version: number;
  checksum: string;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Nesne anahtarlarını sıralayan deterministik JSON serileştirme. */
function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("Vaka checksum'ı için desteklenmeyen değer.");
}

/**
 * Yayın/audit alanlarını değil, öğrencinin gördüğü veya skorunu etkileyen vaka
 * içeriğini özetler. Böylece yalnızca zaman damgası ya da reviewer adı değişince
 * geçmiş denemelerin içerik kimliği değişmez.
 */
function contentForChecksum(vaka: AdminVaka): JsonValue {
  return {
    schema: "tip-ai-case-content-v1",
    id: vaka.id,
    poliklinikKey: vaka.poliklinikKey,
    hastalikKey: vaka.hastalikKey,
    hastalikAdi: vaka.hastalikAdi,
    seviye: vaka.seviye,
    yasAraligi: vaka.yasAraligi,
    cinsiyetTercih: vaka.cinsiyetTercih,
    anaSikayet: vaka.anaSikayet,
    ozetBilgiler: vaka.ozetBilgiler,
    semptomSablon: vaka.semptomSablon,
    rubric: vaka.rubric,
    statikTestler: vaka.statikTestler,
    generatedTests: vaka.generatedTests || {},
    testOverrides: vaka.testOverrides || {},
    hastaYanitlari: vaka.hastaYanitlari,
    idealYol: vaka.idealYol,
    egitimNotu: vaka.egitimNotu,
    cdmVersion: vaka.cdmVersion || null,
    patientProfil: vaka.patientProfil || null,
    vitals: vaka.vitals || null,
    conditions: vaka.conditions || [],
    tedavi: vaka.tedavi || null,
  } as unknown as JsonValue;
}

export function caseContentChecksum(vaka: AdminVaka): string {
  return createHash("sha256").update(stableJson(contentForChecksum(vaka))).digest("hex");
}

export function caseVersionStamp(vaka: AdminVaka): CaseVersionStamp {
  return { version: vaka.surum, checksum: caseContentChecksum(vaka) };
}
