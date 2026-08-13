import { Rubric, RubrikAksiyon, Seviye, TestSonucu, TestSonucTipi } from "../types";
import {
  AdminCondition,
  AdminPatientProfil,
  AdminTedavi,
  AdminVaka,
  AdminVitals,
  VakaDurum,
} from "./types";

export interface InputIssue {
  field: string;
  message: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: InputIssue[] };

export type CreateCaseInput = Pick<
  AdminVaka,
  "poliklinikKey" | "hastalikKey" | "hastalikAdi"
> &
  Partial<AdminVaka>;

type JsonRecord = Record<string, unknown>;

const CASE_KEY = /^[a-z0-9-]{2,80}$/;
const ACTION_KEY = /^[A-Za-z0-9_-]{1,80}$/;
const TEST_TYPES: TestSonucTipi[] = ["numeric", "text", "json", "image"];
const DURUMLAR: VakaDurum[] = ["taslak", "aktif", "arsiv"];
const SEVIYELER: Seviye[] = ["baslangic", "orta", "ileri"];
const CINSIYETLER: AdminVaka["cinsiyetTercih"][] = ["E", "K", "herhangi"];
const KOD_SISTEMLERI: NonNullable<AdminCondition["system"]>[] = [
  "local",
  "icd9",
  "icd10",
  "snomed",
  "atc",
  "loinc",
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(issues: InputIssue[], field: string, message: string) {
  issues.push({ field, message });
}

function text(
  value: unknown,
  field: string,
  issues: InputIssue[],
  options: { max?: number; required?: boolean } = {}
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    issue(issues, field, "Metin olmalı.");
    return undefined;
  }
  const normalized = value.trim();
  if (options.required && !normalized) issue(issues, field, "Boş bırakılamaz.");
  if (options.max && normalized.length > options.max) {
    issue(issues, field, `En fazla ${options.max} karakter olmalı.`);
  }
  return normalized;
}

function stringList(value: unknown, field: string, issues: InputIssue[], maxItems = 100): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) {
    issue(issues, field, `En fazla ${maxItems} metinden oluşan liste olmalı.`);
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    const itemText = text(item, `${field}[${index}]`, issues, { max: 2_000 });
    if (itemText !== undefined) result.push(itemText);
  });
  return result;
}

function enumValue<T extends string>(
  value: unknown,
  field: string,
  choices: readonly T[],
  issues: InputIssue[]
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !choices.includes(value as T)) {
    issue(issues, field, `Geçerli değer: ${choices.join(" | ")}.`);
    return undefined;
  }
  return value as T;
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
    issue(issues, field, "[min, max] sayı çifti olmalı.");
    return undefined;
  }
  return [value[0], value[1]];
}

function parseActionList(value: unknown, field: string, issues: InputIssue[]): RubrikAksiyon[] | undefined {
  if (!Array.isArray(value) || value.length > 100) {
    issue(issues, field, "En fazla 100 aksiyondan oluşan liste olmalı.");
    return undefined;
  }
  return value.flatMap((item, index) => {
    const path = `${field}[${index}]`;
    if (!isRecord(item)) {
      issue(issues, path, "Aksiyon nesnesi olmalı.");
      return [];
    }
    const key = text(item.key, `${path}.key`, issues, { required: true, max: 80 });
    const etiket = text(item.etiket, `${path}.etiket`, issues, { required: true, max: 200 });
    const aciklama = text(item.aciklama, `${path}.aciklama`, issues, { max: 2_000 }) || "";
    const kategori = text(item.kategori, `${path}.kategori`, issues, { max: 64 });
    if (!key || !etiket || !ACTION_KEY.test(key)) {
      if (key && !ACTION_KEY.test(key)) issue(issues, `${path}.key`, "Geçerli aksiyon anahtarı olmalı.");
      return [];
    }
    return [{ key, etiket, aciklama, kategori }];
  });
}

function parseRubric(value: unknown, issues: InputIssue[]): Rubric | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issue(issues, "rubric", "Rubrik nesnesi olmalı.");
    return undefined;
  }
  const beklenenSorular = parseActionList(value.beklenenSorular ?? [], "rubric.beklenenSorular", issues);
  const beklenenTestler = parseActionList(value.beklenenTestler ?? [], "rubric.beklenenTestler", issues);
  const gereksizTestler = parseActionList(value.gereksizTestler ?? [], "rubric.gereksizTestler", issues);
  const redFlagler = parseActionList(value.redFlagler ?? [], "rubric.redFlagler", issues);
  const kabulEdilenTani = stringList(value.kabulEdilenTani ?? [], "rubric.kabulEdilenTani", issues);
  if (!isRecord(value.puanlama)) {
    issue(issues, "rubric.puanlama", "Puanlama nesnesi olmalı.");
    return undefined;
  }
  const puanlama: Record<string, number> = {};
  for (const [key, score] of Object.entries(value.puanlama)) {
    if (!ACTION_KEY.test(key) || typeof score !== "number" || !Number.isFinite(score)) {
      issue(issues, `rubric.puanlama.${key}`, "Sonlu sayısal puan olmalı.");
    } else {
      puanlama[key] = score;
    }
  }
  if (!beklenenSorular || !beklenenTestler || !gereksizTestler || !redFlagler || !kabulEdilenTani) return undefined;
  return { beklenenSorular, beklenenTestler, gereksizTestler, redFlagler, kabulEdilenTani, puanlama };
}

function jsonRecord(value: unknown, field: string, issues: InputIssue[], depth = 0): JsonRecord | undefined {
  if (!isRecord(value) || depth > 5 || Object.keys(value).length > 100) {
    issue(issues, field, "Sınırlı JSON nesnesi olmalı.");
    return undefined;
  }
  const result: JsonRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (!ACTION_KEY.test(key)) {
      issue(issues, `${field}.${key}`, "Geçerli alan adı olmalı.");
      continue;
    }
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      result[key] = item;
    } else if (isRecord(item)) {
      const nested = jsonRecord(item, `${field}.${key}`, issues, depth + 1);
      if (nested) result[key] = nested;
    } else {
      issue(issues, `${field}.${key}`, "JSON değeri olmalı.");
    }
  }
  return result;
}

function parseTests(value: unknown, issues: InputIssue[]): Record<string, TestSonucu> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).length > 200) {
    issue(issues, "statikTestler", "En fazla 200 testten oluşan nesne olmalı.");
    return undefined;
  }
  const tests: Record<string, TestSonucu> = {};
  for (const [key, raw] of Object.entries(value)) {
    const path = `statikTestler.${key}`;
    if (!ACTION_KEY.test(key) || !isRecord(raw)) {
      issue(issues, path, "Geçerli test nesnesi olmalı.");
      continue;
    }
    const testKey = text(raw.testKey, `${path}.testKey`, issues, { required: true, max: 80 });
    const testAdi = text(raw.testAdi, `${path}.testAdi`, issues, { required: true, max: 200 });
    const tip = enumValue(raw.tip, `${path}.tip`, TEST_TYPES, issues);
    const sonuc = typeof raw.sonuc === "string"
      ? text(raw.sonuc, `${path}.sonuc`, issues, { max: 8_000 })
      : jsonRecord(raw.sonuc, `${path}.sonuc`, issues);
    if (!testKey || !testAdi || !tip || !sonuc) continue;
    tests[key] = {
      testKey,
      testAdi,
      tip,
      sonuc,
      birim: text(raw.birim, `${path}.birim`, issues, { max: 80 }),
      referansAralik: text(raw.referansAralik, `${path}.referansAralik`, issues, { max: 200 }),
      referans: text(raw.referans, `${path}.referans`, issues, { max: 500 }),
      yorum: text(raw.yorum, `${path}.yorum`, issues, { max: 2_000 }),
    };
  }
  return tests;
}

function parseAnswers(value: unknown, issues: InputIssue[]): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).length > 300) {
    issue(issues, "hastaYanitlari", "En fazla 300 yanıttan oluşan nesne olmalı.");
    return undefined;
  }
  const answers: Record<string, string> = {};
  for (const [key, answer] of Object.entries(value)) {
    if (!ACTION_KEY.test(key)) issue(issues, `hastaYanitlari.${key}`, "Geçerli yanıt anahtarı olmalı.");
    const parsed = text(answer, `hastaYanitlari.${key}`, issues, { max: 4_000 });
    if (ACTION_KEY.test(key) && parsed !== undefined) answers[key] = parsed;
  }
  return answers;
}

function parsePatientProfile(value: unknown, issues: InputIssue[]): AdminPatientProfil | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issue(issues, "patientProfil", "Hasta profili nesnesi olmalı.");
    return undefined;
  }
  if (value.bmi !== undefined && (typeof value.bmi !== "number" || value.bmi < 10 || value.bmi > 80)) {
    issue(issues, "patientProfil.bmi", "10 ile 80 arasında sayı olmalı.");
  }
  const sigara = text(value.sigara, "patientProfil.sigara", issues, { max: 200 });
  const komorbiditeler = stringList(value.komorbiditeler, "patientProfil.komorbiditeler", issues, 50);
  return {
    bmi: typeof value.bmi === "number" ? value.bmi : undefined,
    sigara,
    komorbiditeler,
  };
}

function parseVitals(value: unknown, issues: InputIssue[]): AdminVitals | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issue(issues, "vitals", "Vital bulgular nesnesi olmalı.");
    return undefined;
  }
  const numberInRange = (name: keyof AdminVitals, min: number, max: number) => {
    const raw = value[name];
    if (raw === undefined) return undefined;
    if (typeof raw !== "number" || raw < min || raw > max) {
      issue(issues, `vitals.${name}`, `${min} ile ${max} arasında sayı olmalı.`);
      return undefined;
    }
    return raw;
  };
  return {
    tansiyon: text(value.tansiyon, "vitals.tansiyon", issues, { max: 32 }),
    nabiz: numberInRange("nabiz", 30, 220),
    ates: numberInRange("ates", 34, 43),
    spo2: numberInRange("spo2", 50, 100),
    solunum: numberInRange("solunum", 4, 60),
  };
}

function parseConditions(value: unknown, issues: InputIssue[]): AdminCondition[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20) {
    issue(issues, "conditions", "En fazla 20 tanıdan oluşan liste olmalı.");
    return undefined;
  }
  return value.flatMap((item, index) => {
    const path = `conditions[${index}]`;
    if (!isRecord(item)) {
      issue(issues, path, "Tanı nesnesi olmalı.");
      return [];
    }
    const code = text(item.code, `${path}.code`, issues, { required: true, max: 80 });
    const ad = text(item.ad, `${path}.ad`, issues, { required: true, max: 200 });
    const system = enumValue(item.system ?? "local", `${path}.system`, KOD_SISTEMLERI, issues);
    if (!code || !ad || !system || (item.primary !== undefined && typeof item.primary !== "boolean")) {
      if (item.primary !== undefined && typeof item.primary !== "boolean") issue(issues, `${path}.primary`, "Boolean olmalı.");
      return [];
    }
    return [{ code, ad, system, primary: item.primary === true }];
  });
}

function parseTreatment(value: unknown, issues: InputIssue[]): AdminTedavi | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issue(issues, "tedavi", "Tedavi planı nesnesi olmalı.");
    return undefined;
  }
  const drugs = value.ilaclar === undefined
    ? undefined
    : !Array.isArray(value.ilaclar) || value.ilaclar.length > 30
      ? (issue(issues, "tedavi.ilaclar", "En fazla 30 ilaçtan oluşan liste olmalı."), undefined)
      : value.ilaclar.flatMap((item, index) => {
          const path = `tedavi.ilaclar[${index}]`;
          if (!isRecord(item)) {
            issue(issues, path, "İlaç nesnesi olmalı.");
            return [];
          }
          const ad = text(item.ad, `${path}.ad`, issues, { required: true, max: 200 });
          const doz = text(item.doz, `${path}.doz`, issues, { required: true, max: 200 });
          const yol = text(item.yol, `${path}.yol`, issues, { required: true, max: 50 });
          const endikasyon = text(item.endikasyon, `${path}.endikasyon`, issues, { required: true, max: 1_000 });
          if (!ad || !doz || !yol || !endikasyon) return [];
          return [{
            code: text(item.code, `${path}.code`, issues, { max: 80 }),
            ad,
            doz,
            yol,
            siklik: text(item.siklik, `${path}.siklik`, issues, { max: 200 }),
            sure: text(item.sure, `${path}.sure`, issues, { max: 500 }),
            endikasyon,
          }];
        });
  return {
    ilaclar: drugs,
    prosedurler: stringList(value.prosedurler, "tedavi.prosedurler", issues, 50),
    onemliNotlar: stringList(value.onemliNotlar, "tedavi.onemliNotlar", issues, 50),
    aciklama: text(value.aciklama, "tedavi.aciklama", issues, { max: 4_000 }),
  };
}

export function parseCasePatchInput(raw: unknown): ParseResult<Partial<AdminVaka>> {
  if (!isRecord(raw)) return { ok: false, issues: [{ field: "body", message: "JSON nesnesi gerekli." }] };
  const issues: InputIssue[] = [];
  const value: Partial<AdminVaka> = {};
  const assignText = (field: "hastalikAdi" | "anaSikayet" | "semptomSablon" | "poliklinikAd" | "poliklinikIcon" | "poliklinikAciklama" | "egitimNotu" | "cdmVersion" | "klinikKaynak", max: number) => {
    const parsed = text(raw[field], field, issues, { max });
    if (parsed !== undefined) value[field] = parsed;
  };

  assignText("hastalikAdi", 200);
  assignText("anaSikayet", 500);
  assignText("semptomSablon", 2_000);
  assignText("poliklinikAd", 120);
  assignText("poliklinikIcon", 32);
  assignText("poliklinikAciklama", 1_000);
  assignText("egitimNotu", 20_000);
  assignText("cdmVersion", 64);
  assignText("klinikKaynak", 1_000);

  const seviye = enumValue(raw.seviye, "seviye", SEVIYELER, issues);
  const cinsiyetTercih = enumValue(raw.cinsiyetTercih, "cinsiyetTercih", CINSIYETLER, issues);
  const durum = enumValue(raw.durum, "durum", DURUMLAR, issues);
  const yasAraligi = ageRange(raw.yasAraligi, "yasAraligi", issues);
  const ozetBilgiler = stringList(raw.ozetBilgiler, "ozetBilgiler", issues, 10);
  const idealYol = stringList(raw.idealYol, "idealYol", issues, 30);
  const etiketler = stringList(raw.etiketler, "etiketler", issues, 30);
  const egitimHedefleri = stringList(raw.egitimHedefleri, "egitimHedefleri", issues, 10);
  const rubric = parseRubric(raw.rubric, issues);
  const statikTestler = parseTests(raw.statikTestler, issues);
  const hastaYanitlari = parseAnswers(raw.hastaYanitlari, issues);
  const patientProfil = parsePatientProfile(raw.patientProfil, issues);
  const vitals = parseVitals(raw.vitals, issues);
  const conditions = parseConditions(raw.conditions, issues);
  const tedavi = parseTreatment(raw.tedavi, issues);

  if (seviye !== undefined) value.seviye = seviye;
  if (cinsiyetTercih !== undefined) value.cinsiyetTercih = cinsiyetTercih;
  if (durum !== undefined) value.durum = durum;
  if (yasAraligi !== undefined) value.yasAraligi = yasAraligi;
  if (ozetBilgiler !== undefined) value.ozetBilgiler = ozetBilgiler;
  if (idealYol !== undefined) value.idealYol = idealYol;
  if (etiketler !== undefined) value.etiketler = etiketler;
  if (egitimHedefleri !== undefined) value.egitimHedefleri = egitimHedefleri;
  if (rubric !== undefined) value.rubric = rubric;
  if (statikTestler !== undefined) value.statikTestler = statikTestler;
  if (hastaYanitlari !== undefined) value.hastaYanitlari = hastaYanitlari;
  if (patientProfil !== undefined) value.patientProfil = patientProfil;
  if (vitals !== undefined) value.vitals = vitals;
  if (conditions !== undefined) value.conditions = conditions;
  if (tedavi !== undefined) value.tedavi = tedavi;

  if (raw.surum !== undefined) {
    if (typeof raw.surum !== "number" || !Number.isInteger(raw.surum) || raw.surum < 1 || raw.surum > 10_000) {
      issue(issues, "surum", "1 ile 10000 arasında tamsayı olmalı.");
    } else value.surum = raw.surum;
  }
  if (raw.uzmanOnayi !== undefined) {
    if (typeof raw.uzmanOnayi !== "boolean") issue(issues, "uzmanOnayi", "Boolean olmalı.");
    else value.uzmanOnayi = raw.uzmanOnayi;
  }
  if (raw.uzmanOnaylayan !== undefined) {
    const parsed = text(raw.uzmanOnaylayan, "uzmanOnaylayan", issues, { max: 120 });
    if (parsed !== undefined) value.uzmanOnaylayan = parsed;
  }
  if (raw.uzmanOnayTarihi !== undefined) {
    if (typeof raw.uzmanOnayTarihi !== "number" || !Number.isFinite(raw.uzmanOnayTarihi)) {
      issue(issues, "uzmanOnayTarihi", "Zaman damgası sayı olmalı.");
    } else value.uzmanOnayTarihi = raw.uzmanOnayTarihi;
  }
  if (raw.poliklinikKey !== undefined) {
    const key = text(raw.poliklinikKey, "poliklinikKey", issues, { required: true, max: 80 })?.toLowerCase();
    if (key && CASE_KEY.test(key)) value.poliklinikKey = key;
    else if (key) issue(issues, "poliklinikKey", "Küçük harf, sayı ve tireden oluşmalı.");
  }
  if (raw.klinikKaynakTarihi !== undefined) {
    if (typeof raw.klinikKaynakTarihi !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.klinikKaynakTarihi)) {
      issue(issues, "klinikKaynakTarihi", "YYYY-AA-GG formatında tarih olmalı.");
    } else value.klinikKaynakTarihi = raw.klinikKaynakTarihi;
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

export function parseCreateCaseInput(raw: unknown): ParseResult<CreateCaseInput> {
  const patch = parseCasePatchInput(raw);
  if (!patch.ok) return patch;
  if (!isRecord(raw)) return { ok: false, issues: [{ field: "body", message: "JSON nesnesi gerekli." }] };
  const issues: InputIssue[] = [];
  const poliklinikKey = text(raw.poliklinikKey, "poliklinikKey", issues, { required: true, max: 80 })?.toLowerCase();
  const hastalikKey = text(raw.hastalikKey, "hastalikKey", issues, { required: true, max: 80 })
    ?.toLowerCase()
    .replace(/\s+/g, "-");
  const hastalikAdi = text(raw.hastalikAdi, "hastalikAdi", issues, { required: true, max: 200 });
  if (poliklinikKey && !CASE_KEY.test(poliklinikKey)) issue(issues, "poliklinikKey", "Küçük harf, sayı ve tireden oluşmalı.");
  if (hastalikKey && !CASE_KEY.test(hastalikKey)) issue(issues, "hastalikKey", "Küçük harf, sayı ve tireden oluşmalı.");
  if (issues.length || !poliklinikKey || !hastalikKey || !hastalikAdi) return { ok: false, issues };
  return { ok: true, value: { ...patch.value, poliklinikKey, hastalikKey, hastalikAdi } };
}
