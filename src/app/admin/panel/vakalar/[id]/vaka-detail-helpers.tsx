"use client";

import { birlesikTestKatalogu } from "@/lib/data";
import { humanizeKey } from "@/lib/types";

export type TabId =
  | "meta"
  | "patient"
  | "presentation"
  | "conditions"
  | "rubric"
  | "labs"
  | "vitals"
  | "yanitlar"
  | "management"
  | "ai";

export interface RubrikAksiyon {
  key: string;
  etiket: string;
  aciklama: string;
  kategori?: string;
}

export const TABS: { id: TabId; label: string }[] = [
  { id: "meta", label: "1. Kimlik & Yayın" },
  { id: "patient", label: "2. Hasta" },
  { id: "presentation", label: "3. Başvuru" },
  { id: "conditions", label: "4. Tanılar" },
  { id: "rubric", label: "5. Puanlama" },
  { id: "labs", label: "6. Laboratuvar" },
  { id: "vitals", label: "7. Yaşamsal Bulgular" },
  { id: "yanitlar", label: "8. Hasta Yanıtları" },
  { id: "management", label: "9. Yönetim & Tedavi" },
  { id: "ai", label: "AI" },
];

export function pretty(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

export function linesToList(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function csvToList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function defaultSonucForKey(key: string): { tip: string; sonuc: string } {
  const jsonPanel: Record<string, string> = {
    CBC: JSON.stringify({ hemoglobin: "14.0 g/dL", lokosit: "8.5 K/uL", trombosit: "250 K/uL" }, null, 2),
    ELEKTROLIT: JSON.stringify({ sodyum: "140 mmol/L", potasyum: "4.2 mmol/L", klor: "102 mmol/L" }, null, 2),
    KOLESTEROL: JSON.stringify({ totalKolesterol: "180 mg/dL", ldl: "100 mg/dL", hdl: "50 mg/dL", trigliserit: "120 mg/dL" }, null, 2),
    IDRAR: JSON.stringify({ dansite: "1015", protein: "Negatif", glukoz: "Negatif", ph: 6.0 }, null, 2),
    ABG: JSON.stringify({ pH: "7.40", pCO2: "40 mmHg", pO2: "90 mmHg", HCO3: "24 mmol/L" }, null, 2),
    EKG: JSON.stringify({ ritim: "Sinüs", kalpHizi: "78", yorum: "Normal sinüs ritmi" }, null, 2),
    DEMIR: JSON.stringify({ serumDemir: "90 µg/dL", tdbk: "300 µg/dL", transferrinSaturasyonu: "30%" }, null, 2),
    PT: JSON.stringify({ PT: "12 sn", INR: "1.0" }, null, 2),
    KARACIGER_ENZIM: JSON.stringify({ AST: "25 U/L", ALT: "28 U/L" }, null, 2),
  };
  if (jsonPanel[key]) return { tip: "json", sonuc: jsonPanel[key] };

  const numericDefaults: Record<string, string> = {
    TROPONIN: JSON.stringify({ deger: 0.01, birim: "ng/mL", referansAralik: "<0.04" }, null, 2),
    BNP: JSON.stringify({ deger: 50, birim: "pg/mL", referansAralik: "<100" }, null, 2),
    GLUKOZ: JSON.stringify({ deger: 92, birim: "mg/dL", referansAralik: "70-100" }, null, 2),
    HBA1C: JSON.stringify({ deger: 5.4, birim: "%", referansAralik: "<5.7" }, null, 2),
    TSH: JSON.stringify({ deger: 2.1, birim: "mIU/L", referansAralik: "0.4-4.0" }, null, 2),
    T4: JSON.stringify({ deger: 1.2, birim: "ng/dL", referansAralik: "0.8-1.8" }, null, 2),
    CRP: JSON.stringify({ deger: 3, birim: "mg/L", referansAralik: "<5" }, null, 2),
    KREATININ: JSON.stringify({ deger: 0.9, birim: "mg/dL", referansAralik: "0.7-1.3" }, null, 2),
    URE: JSON.stringify({ deger: 14, birim: "mg/dL", referansAralik: "7-20" }, null, 2),
    AST: JSON.stringify({ deger: 22, birim: "U/L", referansAralik: "10-40" }, null, 2),
    ALT: JSON.stringify({ deger: 24, birim: "U/L", referansAralik: "10-41" }, null, 2),
    FERITIN: JSON.stringify({ deger: 80, birim: "ng/mL", referansAralik: "30-300" }, null, 2),
    D_DIMER: JSON.stringify({ deger: 200, birim: "ng/mL", referansAralik: "<500" }, null, 2),
    PTT: JSON.stringify({ deger: 30, birim: "sn", referansAralik: "25-35" }, null, 2),
    GOZ_BASINCI: JSON.stringify({ deger: 15, birim: "mmHg", referansAralik: "10-21" }, null, 2),
    KREATININ_KINAZ: JSON.stringify({ deger: 120, birim: "U/L", referansAralik: "30-200" }, null, 2),
    BHCG: JSON.stringify({ deger: 0, birim: "mIU/mL", referansAralik: "<5" }, null, 2),
  };
  if (numericDefaults[key]) return { tip: "numeric", sonuc: numericDefaults[key] };

  const imageLike = ["AKCIGER_GRAFISI", "BT_TORAKS", "MAMOGRAFI", "MEME_USG", "BT_ABDOMEN", "BT_KRANIYAL", "USG_ABDOMEN", "PELVIK_USG"];
  if (imageLike.includes(key)) {
    return { tip: "image", sonuc: "Görüntüleme: belirgin patoloji yok / klinik korelasyon önerilir." };
  }
  if (key === "BIYOPSI") {
    return { tip: "text", sonuc: "Patoloji raporu: bulgular klinik bağlamda değerlendirilmeli." };
  }
  return { tip: "text", sonuc: "Sonuç normal sınırlarda." };
}

export function katalogAdi(key: string, fallback?: string): string {
  return birlesikTestKatalogu.find((t) => t.key === key)?.ad || fallback || key;
}

export function emptyAksiyon(): RubrikAksiyon {
  return { key: "", etiket: "", aciklama: "" };
}

export function slugifyKey(s: string): string {
  const tr: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return s
    .trim()
    .toLocaleLowerCase("tr")
    .split("")
    .map((c) => tr[c] ?? c)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[11px] text-muted leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function RubrikListEditor({
  label,
  items,
  onChange,
  keyPlaceholder = "KEY",
  showCategory = false,
  keySuggestions,
}: {
  label: string;
  items: RubrikAksiyon[];
  onChange: (next: RubrikAksiyon[]) => void;
  keyPlaceholder?: string;
  showCategory?: boolean;
  keySuggestions?: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <button type="button" className="text-[11px] font-medium text-brand-deep hover:underline" onClick={() => onChange([...items, emptyAksiyon()])}>
          + Satır
        </button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted">Boş — satır ekleyin.</p>}
      <div className="space-y-2">
        {items.map((row, i) => (
          <div
            key={i}
            className={`grid gap-2 rounded-lg border border-hairline-soft bg-surface-soft p-2 ${showCategory ? "sm:grid-cols-[1fr_1fr_1.2fr_0.9fr_auto]" : "sm:grid-cols-[1fr_1fr_1.4fr_auto]"}`}
          >
            <input
              className="input text-xs font-mono"
              placeholder={keyPlaceholder}
              list={keySuggestions ? `rubrik-key-suggestions-${label}` : undefined}
              value={row.key}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...row, key: e.target.value };
                onChange(next);
              }}
            />
            {keySuggestions && (
              <datalist id={`rubrik-key-suggestions-${label}`}>
                {keySuggestions.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            )}
            <input
              className="input text-xs"
              placeholder="Etiket (görünen ad)"
              value={row.etiket}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...row, etiket: e.target.value, key: row.key || slugifyKey(e.target.value) };
                onChange(next);
              }}
            />
            <input
              className="input text-xs"
              placeholder="Açıklama (ipucu)"
              value={row.aciklama}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...row, aciklama: e.target.value };
                onChange(next);
              }}
            />
            {showCategory && (
              <select
                className="input text-xs"
                aria-label={`${label} soru kategorisi`}
                value={row.kategori || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...row, kategori: e.target.value || undefined };
                  onChange(next);
                }}
              >
                <option value="">Kategori seçin</option>
                <option value="Sikayet">Şikayet</option>
                <option value="HPI">HPI</option>
                <option value="Ozgecmis">Özgeçmiş</option>
                <option value="Ilac">İlaç</option>
                <option value="Aile">Aile</option>
                <option value="Sosyal">Sosyal</option>
                <option value="Sistem">Sistem</option>
                <option value="Fizik">Fizik muayene</option>
                <option value="Vital">Vital</option>
                <option value="RedFlag">Red flag</option>
                <option value="Diger">Diğer</option>
              </select>
            )}
            <button type="button" className="inline-flex min-h-9 items-center px-2 text-xs text-clinical-red hover:underline" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
