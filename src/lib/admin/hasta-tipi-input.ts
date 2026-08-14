import { KisilikTipiKey, KISILIK_TIPI_KEYLERI } from "@/lib/ai/kisilik-tipleri";
import { HastaTipi } from "./types";

export interface InputIssue {
  field: string;
  message: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: InputIssue[] };

const CINSIYETLER: HastaTipi["cinsiyetTercih"][] = ["E", "K", "herhangi"];
const TR_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

/** Ad → ASCII slug (URL/anahtar). Türkçe karakterleri katlar. */
export function hastaTipiSlug(ad: string): string {
  const lower = ad.trim().toLocaleLowerCase("tr");
  let out = "";
  for (const c of lower) out += TR_ASCII[c] ?? c;
  return out
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string, issues: InputIssue[], max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    issues.push({ field, message: "Metin olmalı." });
    return undefined;
  }
  const normalized = value.trim();
  if (max && normalized.length > max) {
    issues.push({ field, message: `En fazla ${max} karakter olmalı.` });
  }
  return normalized;
}

function ageRange(value: unknown, field: string, issues: InputIssue[]): [number, number] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isInteger(value[0]) ||
    !Number.isInteger(value[1]) ||
    value[0] < 0 ||
    value[1] > 120 ||
    value[0] > value[1]
  ) {
    issues.push({ field, message: "[min, max] sayı çifti olmalı." });
    return undefined;
  }
  return [value[0], value[1]];
}

function stringList(value: unknown, field: string, issues: InputIssue[], maxItems = 50): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) {
    issues.push({ field, message: `En fazla ${maxItems} metinden oluşan liste olmalı.` });
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    const parsed = text(item, `${field}[${index}]`, issues, 200);
    if (parsed) result.push(parsed);
  });
  return result;
}

function ornekCevaplar(value: unknown, issues: InputIssue[]): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).length > 200) {
    issues.push({ field: "ornekCevaplar", message: "En fazla 200 cevaptan oluşan nesne olmalı." });
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, answer] of Object.entries(value)) {
    const parsed = text(answer, `ornekCevaplar.${key}`, issues, 4000);
    if (parsed !== undefined) out[key] = parsed;
  }
  return out;
}

export function parseHastaTipiInput(
  raw: unknown,
  options: { requireAd: boolean } = { requireAd: false }
): ParseResult<Partial<HastaTipi>> {
  if (!isRecord(raw)) return { ok: false, issues: [{ field: "body", message: "JSON nesnesi gerekli." }] };
  const issues: InputIssue[] = [];
  const value: Partial<HastaTipi> = {};

  const ad = text(raw.ad, "ad", issues, 200);
  if (ad !== undefined) value.ad = ad;
  else if (options.requireAd) issues.push({ field: "ad", message: "Tip adı zorunlu." });

  const aciklama = text(raw.aciklama, "aciklama", issues, 4000);
  if (aciklama !== undefined) value.aciklama = aciklama;

  const yasAraligi = ageRange(raw.yasAraligi, "yasAraligi", issues);
  if (yasAraligi !== undefined) value.yasAraligi = yasAraligi;

  if (raw.cinsiyetTercih !== undefined) {
    if (typeof raw.cinsiyetTercih !== "string" || !CINSIYETLER.includes(raw.cinsiyetTercih as HastaTipi["cinsiyetTercih"])) {
      issues.push({ field: "cinsiyetTercih", message: `Geçerli değer: ${CINSIYETLER.join(" | ")}.` });
    } else {
      value.cinsiyetTercih = raw.cinsiyetTercih as HastaTipi["cinsiyetTercih"];
    }
  }

  const komorbiditeler = stringList(raw.komorbiditeler, "komorbiditeler", issues);
  if (komorbiditeler !== undefined) value.komorbiditeler = komorbiditeler;

  if (raw.kisilikTipi !== undefined) {
    if (typeof raw.kisilikTipi !== "string" || !KISILIK_TIPI_KEYLERI.includes(raw.kisilikTipi as KisilikTipiKey)) {
      issues.push({ field: "kisilikTipi", message: `Geçerli değer: ${KISILIK_TIPI_KEYLERI.join(" | ")}.` });
    } else {
      value.kisilikTipi = raw.kisilikTipi as KisilikTipiKey;
    }
  }

  const cevaplar = ornekCevaplar(raw.ornekCevaplar, issues);
  if (cevaplar !== undefined) value.ornekCevaplar = cevaplar;

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
