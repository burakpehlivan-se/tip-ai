import { ChipKategorisi, SoruChipi } from "../types";
import { CHIP_HAVUZU as STATIC_CHIP_HAVUZU } from "../data/chip-havuzu";
import { questionsPath } from "./paths";
import { readJsonWithFallback, withJsonStoreLock, writeJsonAtomic } from "./json-store";

export type QuestionScope = "global" | "poliklinik";

export interface CustomQuestion extends SoruChipi {
  id: string;
  scope: QuestionScope;
  poliklinikKey?: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface QuestionsStore {
  version: 1;
  updatedAt: number;
  customQuestions: CustomQuestion[];
  disabledStaticIds: string[]; // aksiyon bazlı
  staticOverrides?: Record<string, Partial<Pick<SoruChipi, "etiket" | "kategori">>>;
}

const EMPTY: QuestionsStore = {
  version: 1,
  updatedAt: 0,
  customQuestions: [],
  disabledStaticIds: [],
  staticOverrides: {},
};

function loadRaw(): QuestionsStore {
  return readJsonWithFallback<QuestionsStore>(questionsPath(), EMPTY, "Sorular deposu");
}

export function loadQuestionsStore(): QuestionsStore {
  const s = loadRaw();
  if (!Array.isArray(s.customQuestions)) s.customQuestions = [];
  if (!Array.isArray(s.disabledStaticIds)) s.disabledStaticIds = [];
  if (!s.staticOverrides || typeof s.staticOverrides !== "object") s.staticOverrides = {};
  return s;
}

export function saveQuestionsStore(store: QuestionsStore): void {
  store.updatedAt = Date.now();
  writeJsonAtomic(questionsPath(), store);
}

/** Efektif havuz: static (disabled hariç, override'lı) + global custom + poliklinik custom */
export function getEffectiveChipHavuzu(poliklinikKey?: string | null): SoruChipi[] {
  const store = loadQuestionsStore();
  const disabled = new Set(store.disabledStaticIds);
  const overrides = store.staticOverrides || {};
  const effective: SoruChipi[] = [];

  for (const c of STATIC_CHIP_HAVUZU) {
    if (disabled.has(c.aksiyon)) continue;
    const ov = overrides[c.aksiyon];
    if (ov) {
      effective.push({
        etiket: ov.etiket ?? c.etiket,
        aksiyon: c.aksiyon,
        kategori: (ov.kategori as ChipKategorisi) ?? c.kategori,
      });
    } else {
      effective.push(c);
    }
  }
  for (const q of store.customQuestions) {
    if (q.scope === "global") effective.push({ etiket: q.etiket, aksiyon: q.aksiyon, kategori: q.kategori });
    else if (q.scope === "poliklinik" && q.poliklinikKey && poliklinikKey && q.poliklinikKey === poliklinikKey) {
      effective.push({ etiket: q.etiket, aksiyon: q.aksiyon, kategori: q.kategori });
    } else if (q.scope === "poliklinik" && !poliklinikKey) {
      // Poliklinik filtresi yoksa tüm custom'ları döndür (admin listeleme için)
      effective.push({ etiket: q.etiket, aksiyon: q.aksiyon, kategori: q.kategori });
    }
  }
  return effective;
}

export function listAllQuestions(): { chip: SoruChipi; source: "static" | "custom"; custom?: CustomQuestion; disabled?: boolean }[] {
  const store = loadQuestionsStore();
  const disabled = new Set(store.disabledStaticIds);
  const overrides = store.staticOverrides || {};
  const out: { chip: SoruChipi; source: "static" | "custom"; custom?: CustomQuestion; disabled?: boolean }[] = [];
  for (const c of STATIC_CHIP_HAVUZU) {
    const ov = overrides[c.aksiyon];
    const chip: SoruChipi = ov
      ? { etiket: ov.etiket ?? c.etiket, aksiyon: c.aksiyon, kategori: (ov.kategori as ChipKategorisi) ?? c.kategori }
      : c;
    out.push({ chip, source: "static", disabled: disabled.has(c.aksiyon) });
  }
  for (const q of store.customQuestions) {
    out.push({ chip: { etiket: q.etiket, aksiyon: q.aksiyon, kategori: q.kategori }, source: "custom", custom: q });
  }
  return out;
}

export async function addCustomQuestion(input: {
  etiket: string;
  aksiyon: string;
  kategori: ChipKategorisi;
  scope: QuestionScope;
  poliklinikKey?: string | null;
  createdBy?: string;
}): Promise<CustomQuestion> {
  return withJsonStoreLock(() => {
    const store = loadQuestionsStore();
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const q: CustomQuestion = {
      id,
      etiket: input.etiket.trim(),
      aksiyon: input.aksiyon.trim().toUpperCase().replace(/\s+/g, "_"),
      kategori: input.kategori,
      scope: input.scope,
      poliklinikKey: input.scope === "poliklinik" ? (input.poliklinikKey || null) : null,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };
    // Aksiyon benzersiz olmalı
    const existsStatic = STATIC_CHIP_HAVUZU.some((c) => c.aksiyon === q.aksiyon);
    const existsCustom = store.customQuestions.some((c) => c.aksiyon === q.aksiyon);
    if (existsStatic || existsCustom) throw new Error(`Aksiyon zaten var: ${q.aksiyon}`);
    store.customQuestions.push(q);
    saveQuestionsStore(store);
    return q;
  });
}

export async function updateCustomQuestion(
  id: string,
  patch: Partial<Pick<CustomQuestion, "etiket" | "kategori" | "scope" | "poliklinikKey">>
): Promise<CustomQuestion> {
  return withJsonStoreLock(() => {
    const store = loadQuestionsStore();
    const idx = store.customQuestions.findIndex((q) => q.id === id);
    if (idx < 0) throw new Error("Soru bulunamadı");
    const q = store.customQuestions[idx];
    if (patch.etiket !== undefined) q.etiket = patch.etiket.trim();
    if (patch.kategori !== undefined) q.kategori = patch.kategori;
    if (patch.scope !== undefined) {
      q.scope = patch.scope;
      q.poliklinikKey = patch.scope === "poliklinik" ? patch.poliklinikKey || null : null;
    } else if (patch.poliklinikKey !== undefined && q.scope === "poliklinik") {
      q.poliklinikKey = patch.poliklinikKey || null;
    }
    q.updatedAt = Date.now();
    saveQuestionsStore(store);
    return q;
  });
}

export async function deleteCustomQuestion(id: string): Promise<void> {
  return withJsonStoreLock(() => {
    const store = loadQuestionsStore();
    const before = store.customQuestions.length;
    store.customQuestions = store.customQuestions.filter((q) => q.id !== id);
    if (store.customQuestions.length === before) throw new Error("Soru bulunamadı");
    saveQuestionsStore(store);
  });
}

export async function toggleStaticQuestion(aksiyon: string, disabled: boolean): Promise<void> {
  return withJsonStoreLock(() => {
    const store = loadQuestionsStore();
    const set = new Set(store.disabledStaticIds);
    if (disabled) set.add(aksiyon);
    else set.delete(aksiyon);
    store.disabledStaticIds = Array.from(set);
    saveQuestionsStore(store);
  });
}

export async function updateStaticQuestion(
  aksiyon: string,
  patch: Partial<Pick<SoruChipi, "etiket" | "kategori">>
): Promise<void> {
  return withJsonStoreLock(() => {
    const store = loadQuestionsStore();
    const exists = STATIC_CHIP_HAVUZU.some((c) => c.aksiyon === aksiyon);
    if (!exists) throw new Error("Statik soru bulunamadı");
    if (!store.staticOverrides) store.staticOverrides = {};
    const current = store.staticOverrides[aksiyon] || {};
    const next: Partial<Pick<SoruChipi, "etiket" | "kategori">> = { ...current };
    if (patch.etiket !== undefined) {
      const v = patch.etiket.trim();
      if (v.length < 3 || v.length > 120) throw new Error("Soru metni 3-120 karakter olmalı");
      next.etiket = v;
    }
    if (patch.kategori !== undefined) next.kategori = patch.kategori;
    // Boş override temizlenir
    const base = STATIC_CHIP_HAVUZU.find((c) => c.aksiyon === aksiyon)!;
    const isSameEtiket = !next.etiket || next.etiket === base.etiket;
    const isSameKategori = !next.kategori || next.kategori === base.kategori;
    if (isSameEtiket && isSameKategori) {
      delete store.staticOverrides[aksiyon];
    } else {
      store.staticOverrides[aksiyon] = next;
    }
    saveQuestionsStore(store);
  });
}
