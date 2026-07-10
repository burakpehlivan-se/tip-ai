import { TipAiCdmDocument, TIP_AI_CDM_VERSION } from "./types";
import {
  canonicalizeTestKey,
  knownTestKeys,
  OSCE_SECTION_CHECKLIST,
  CONDITION_VOCAB,
} from "./vocabulary";

export interface CdmValidationIssue {
  level: "error" | "warn" | "info";
  path: string;
  message: string;
}

export interface CdmValidationResult {
  ok: boolean;
  errors: CdmValidationIssue[];
  warnings: CdmValidationIssue[];
  infos: CdmValidationIssue[];
  /** Canonicalize sonrası önerilen düzeltmeler */
  testKeyRemap: Record<string, string>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** CDM belgesini doğrula (error = import engellenmeli) */
export function validateCdmDocument(raw: unknown): CdmValidationResult {
  const errors: CdmValidationIssue[] = [];
  const warnings: CdmValidationIssue[] = [];
  const infos: CdmValidationIssue[] = [];
  const testKeyRemap: Record<string, string> = {};
  const known = knownTestKeys();

  if (!isObj(raw)) {
    return {
      ok: false,
      errors: [{ level: "error", path: "", message: "Kök nesne gerekli." }],
      warnings: [],
      infos: [],
      testKeyRemap,
    };
  }

  const doc = raw as Partial<TipAiCdmDocument>;

  if (doc.cdmVersion && doc.cdmVersion !== TIP_AI_CDM_VERSION) {
    warnings.push({
      level: "warn",
      path: "cdmVersion",
      message: `Beklenen ${TIP_AI_CDM_VERSION}, gelen: ${doc.cdmVersion}. Yine de deneniyor.`,
    });
  }
  if (!doc.cdmVersion) {
    infos.push({
      level: "info",
      path: "cdmVersion",
      message: `cdmVersion yok; ${TIP_AI_CDM_VERSION} varsayılacak.`,
    });
  }

  if (!doc.id || typeof doc.id !== "string") {
    errors.push({ level: "error", path: "id", message: "id zorunlu (örn. poliklinik::hastalik)." });
  }

  const meta = doc.meta;
  if (!isObj(meta)) {
    errors.push({ level: "error", path: "meta", message: "meta bloğu zorunlu." });
  } else {
    for (const f of ["poliklinikKey", "poliklinikAd", "hastalikKey", "hastalikAdi"] as const) {
      if (!meta[f] || typeof meta[f] !== "string") {
        errors.push({ level: "error", path: `meta.${f}`, message: `${f} zorunlu.` });
      }
    }
    if (meta.seviye && !["baslangic", "orta", "ileri"].includes(String(meta.seviye))) {
      errors.push({ level: "error", path: "meta.seviye", message: "baslangic | orta | ileri olmalı." });
    }
  }

  const patient = doc.patient;
  if (!isObj(patient)) {
    errors.push({ level: "error", path: "patient", message: "patient bloğu zorunlu." });
  } else {
    const ya = patient.yasAraligi as unknown;
    if (!Array.isArray(ya) || ya.length !== 2 || typeof ya[0] !== "number" || typeof ya[1] !== "number") {
      errors.push({
        level: "error",
        path: "patient.yasAraligi",
        message: "[min, max] sayı çifti olmalı.",
      });
    } else if (ya[0] > ya[1] || ya[0] < 0 || ya[1] > 120) {
      warnings.push({
        level: "warn",
        path: "patient.yasAraligi",
        message: "Yaş aralığı olağandışı görünüyor.",
      });
    }
    const c = patient.cinsiyetTercih;
    if (c && !["E", "K", "herhangi"].includes(String(c))) {
      errors.push({
        level: "error",
        path: "patient.cinsiyetTercih",
        message: "E | K | herhangi olmalı.",
      });
    }
  }

  const presentation = doc.presentation;
  if (!isObj(presentation)) {
    errors.push({ level: "error", path: "presentation", message: "presentation bloğu zorunlu." });
  } else {
    if (!presentation.anaSikayet) {
      errors.push({
        level: "error",
        path: "presentation.anaSikayet",
        message: "Ana şikayet zorunlu.",
      });
    }
    if (!Array.isArray(presentation.ozetBilgiler) || presentation.ozetBilgiler.length === 0) {
      warnings.push({
        level: "warn",
        path: "presentation.ozetBilgiler",
        message: "ozetBilgiler boş — OSCE HPI zayıf kalır.",
      });
    }
  }

  const conditions = doc.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    warnings.push({
      level: "warn",
      path: "conditions",
      message: "conditions yok — OMOP condition listesi önerilir.",
    });
  } else {
    conditions.forEach((c, i) => {
      if (!c?.code) {
        errors.push({ level: "error", path: `conditions[${i}].code`, message: "code zorunlu." });
      } else if (!CONDITION_VOCAB[c.code] && !c.ad) {
        warnings.push({
          level: "warn",
          path: `conditions[${i}]`,
          message: `Bilinmeyen condition code "${c.code}" — ad alanı doldurun veya CONDITION_VOCAB’a ekleyin.`,
        });
      }
    });
  }

  const rubric = doc.rubric;
  if (!isObj(rubric)) {
    errors.push({ level: "error", path: "rubric", message: "rubric bloğu zorunlu." });
  } else {
    if (!Array.isArray(rubric.beklenenSorular) || rubric.beklenenSorular.length === 0) {
      warnings.push({
        level: "warn",
        path: "rubric.beklenenSorular",
        message: "Beklenen soru yok.",
      });
    } else {
      rubric.beklenenSorular.forEach((s, i) => {
        if (!s?.key || !s?.etiket) {
          errors.push({
            level: "error",
            path: `rubric.beklenenSorular[${i}]`,
            message: "key ve etiket zorunlu.",
          });
        }
      });
    }
    if (!Array.isArray(rubric.beklenenTestler) || rubric.beklenenTestler.length === 0) {
      warnings.push({
        level: "warn",
        path: "rubric.beklenenTestler",
        message: "Beklenen test yok.",
      });
    } else {
      rubric.beklenenTestler.forEach((t, i) => {
        if (!t?.key) {
          errors.push({
            level: "error",
            path: `rubric.beklenenTestler[${i}].key`,
            message: "key zorunlu.",
          });
          return;
        }
        const canon = canonicalizeTestKey(t.key);
        if (canon !== t.key) testKeyRemap[`rubric.beklenenTestler.${t.key}`] = canon;
        if (!known.has(canon)) {
          warnings.push({
            level: "warn",
            path: `rubric.beklenenTestler[${i}].key`,
            message: `"${t.key}" birleşik test kataloğunda yok. Kanonik sözlüğe ekleyin veya alias tanımlayın.`,
          });
        }
      });
    }
    if (!Array.isArray(rubric.kabulEdilenTani) || rubric.kabulEdilenTani.length === 0) {
      errors.push({
        level: "error",
        path: "rubric.kabulEdilenTani",
        message: "En az bir kabul edilen tanı gerekli.",
      });
    }
    if (!Array.isArray(rubric.redFlagler) || rubric.redFlagler.length === 0) {
      warnings.push({
        level: "warn",
        path: "rubric.redFlagler",
        message: "Red flag tanımlı değil.",
      });
    }
  }

  const labs = doc.labs;
  if (!isObj(labs) || !isObj(labs.statikTestler as object)) {
    warnings.push({
      level: "warn",
      path: "labs.statikTestler",
      message: "statikTestler yok — patoloji lab’ları boş kalacak.",
    });
  } else {
    for (const [rawKey, val] of Object.entries(labs.statikTestler as Record<string, unknown>)) {
      const canon = canonicalizeTestKey(rawKey);
      if (canon !== rawKey) testKeyRemap[`labs.${rawKey}`] = canon;
      if (!known.has(canon)) {
        warnings.push({
          level: "warn",
          path: `labs.statikTestler.${rawKey}`,
          message: `"${rawKey}" → "${canon}" katalogda yok.`,
        });
      }
      if (!isObj(val)) {
        errors.push({
          level: "error",
          path: `labs.statikTestler.${rawKey}`,
          message: "Test sonucu nesne olmalı.",
        });
        continue;
      }
      if (val.sonuc === undefined) {
        errors.push({
          level: "error",
          path: `labs.statikTestler.${rawKey}.sonuc`,
          message: "sonuc zorunlu.",
        });
      }
    }
  }

  if (!isObj(doc.hastaYanitlari)) {
    warnings.push({
      level: "warn",
      path: "hastaYanitlari",
      message: "hastaYanitlari yok.",
    });
  } else if (!("OZEL" in (doc.hastaYanitlari as object))) {
    infos.push({
      level: "info",
      path: "hastaYanitlari.OZEL",
      message: "OZEL fallback yanıtı eklenecek.",
    });
  }

  if (!isObj(doc.management)) {
    warnings.push({
      level: "warn",
      path: "management",
      message: "management bloğu yok.",
    });
  } else {
    const m = doc.management as Record<string, unknown>;
    if (!Array.isArray(m.idealYol) || m.idealYol.length === 0) {
      warnings.push({
        level: "warn",
        path: "management.idealYol",
        message: "idealYol boş.",
      });
    }
  }

  // OSCE checklist soft score
  let filled = 0;
  for (const s of OSCE_SECTION_CHECKLIST) {
    // basit varlık kontrolü — path string
    const parts = s.id.split(".");
    let cur: unknown = doc;
    for (const p of parts) {
      if (!isObj(cur) && !Array.isArray(cur)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    const has =
      cur != null &&
      (typeof cur === "string"
        ? cur.trim().length > 0
        : Array.isArray(cur)
          ? cur.length > 0
          : typeof cur === "object"
            ? Object.keys(cur as object).length > 0
            : true);
    if (has) filled++;
  }
  infos.push({
    level: "info",
    path: "osce",
    message: `OSCE başlık doluluk: ${filled}/${OSCE_SECTION_CHECKLIST.length}`,
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    infos,
    testKeyRemap,
  };
}
