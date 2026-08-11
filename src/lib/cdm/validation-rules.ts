import { TipAiCdmDocument } from "./types";

export interface CdmShapeIssue {
  path: string;
  message: string;
}

const LEVELS = new Set<TipAiCdmDocument["meta"]["seviye"]>([
  "baslangic",
  "orta",
  "ileri",
]);
const STATUSES = new Set<TipAiCdmDocument["meta"]["durum"]>([
  "taslak",
  "aktif",
  "arsiv",
]);
const GENDERS = new Set<TipAiCdmDocument["patient"]["cinsiyetTercih"]>([
  "E",
  "K",
  "herhangi",
]);

export function isCdmRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCdmLevel(value: unknown): value is TipAiCdmDocument["meta"]["seviye"] {
  return typeof value === "string" && LEVELS.has(value as TipAiCdmDocument["meta"]["seviye"]);
}

export function isCdmStatus(value: unknown): value is TipAiCdmDocument["meta"]["durum"] {
  return typeof value === "string" && STATUSES.has(value as TipAiCdmDocument["meta"]["durum"]);
}

export function isCdmGender(value: unknown): value is TipAiCdmDocument["patient"]["cinsiyetTercih"] {
  return typeof value === "string" && GENDERS.has(value as TipAiCdmDocument["patient"]["cinsiyetTercih"]);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function add(issues: CdmShapeIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function validateActionList(value: unknown, path: string, issues: CdmShapeIssue[]) {
  if (!Array.isArray(value)) {
    add(issues, path, "Aksiyon listesi olmalı.");
    return;
  }
  value.forEach((action, index) => {
    if (!isCdmRecord(action) || !hasText(action.key) || !hasText(action.etiket)) {
      add(issues, `${path}[${index}]`, "Aksiyon key ve etiket içermeli.");
    }
  });
}

/**
 * İçe aktarılabilir belge için yalnızca şema/taşıma güvenliği.
 * Klinik yeterlilik ve öğrencide yayın kararı bu katmanın sorumluluğu değildir.
 */
export function validateCdmShape(raw: unknown): CdmShapeIssue[] {
  const issues: CdmShapeIssue[] = [];
  if (!isCdmRecord(raw)) {
    return [{ path: "", message: "Kök nesne gerekli." }];
  }

  if (!hasText(raw.id)) add(issues, "id", "id zorunlu.");

  const meta = raw.meta;
  if (!isCdmRecord(meta)) {
    add(issues, "meta", "meta bloğu zorunlu.");
  } else {
    for (const field of ["poliklinikKey", "poliklinikAd", "hastalikKey", "hastalikAdi"]) {
      if (!hasText(meta[field])) add(issues, `meta.${field}`, `${field} zorunlu.`);
    }
    if (!isCdmLevel(meta.seviye)) add(issues, "meta.seviye", "Geçerli seviye zorunlu.");
    if (!isCdmStatus(meta.durum)) add(issues, "meta.durum", "Geçerli durum zorunlu.");
  }

  const patient = raw.patient;
  if (!isCdmRecord(patient)) {
    add(issues, "patient", "patient bloğu zorunlu.");
  } else {
    const ageRange = patient.yasAraligi;
    if (
      !Array.isArray(ageRange) ||
      ageRange.length !== 2 ||
      !Number.isInteger(ageRange[0]) ||
      !Number.isInteger(ageRange[1]) ||
      ageRange[0] < 0 ||
      ageRange[1] > 120 ||
      ageRange[0] > ageRange[1]
    ) {
      add(issues, "patient.yasAraligi", "[min, max] yaş aralığı olmalı.");
    }
    if (!isCdmGender(patient.cinsiyetTercih)) {
      add(issues, "patient.cinsiyetTercih", "Geçerli cinsiyet tercihi zorunlu.");
    }
  }

  const presentation = raw.presentation;
  if (!isCdmRecord(presentation)) {
    add(issues, "presentation", "presentation bloğu zorunlu.");
  } else {
    if (!hasText(presentation.anaSikayet)) {
      add(issues, "presentation.anaSikayet", "Ana şikayet zorunlu.");
    }
    if (!Array.isArray(presentation.ozetBilgiler) || !presentation.ozetBilgiler.every(hasText)) {
      add(issues, "presentation.ozetBilgiler", "Metin listesi olmalı.");
    }
  }

  const rubric = raw.rubric;
  if (!isCdmRecord(rubric)) {
    add(issues, "rubric", "rubric bloğu zorunlu.");
  } else {
    validateActionList(rubric.beklenenSorular, "rubric.beklenenSorular", issues);
    validateActionList(rubric.beklenenTestler, "rubric.beklenenTestler", issues);
    if (!Array.isArray(rubric.kabulEdilenTani) || !rubric.kabulEdilenTani.every(hasText)) {
      add(issues, "rubric.kabulEdilenTani", "Tanı metinleri listesi olmalı.");
    }
  }

  const labs = raw.labs;
  if (!isCdmRecord(labs) || !isCdmRecord(labs.statikTestler)) {
    add(issues, "labs.statikTestler", "statikTestler nesnesi zorunlu.");
  } else {
    for (const [key, result] of Object.entries(labs.statikTestler)) {
      if (!isCdmRecord(result) || result.sonuc === undefined) {
        add(issues, `labs.statikTestler.${key}`, "Test sonucu nesnesi ve sonuc alanı zorunlu.");
      }
    }
  }

  if (!isCdmRecord(raw.hastaYanitlari)) {
    add(issues, "hastaYanitlari", "hastaYanitlari nesnesi zorunlu.");
  }
  if (!isCdmRecord(raw.management)) {
    add(issues, "management", "management bloğu zorunlu.");
  }

  return issues;
}
