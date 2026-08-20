"use client";

export const ALL_TEST_KEYS = [
  "TROPONIN","BNP","CKMB","MYOGLOBIN","KREATININ_KINAZ",
  "GLUKOZ","HBA1C","LACTATE","AMMONIA",
  "KREATININ","BUN","URE","GFR","URIC_ACID",
  "NA","K","CL","CA","MG","PHOS",
  "ALT","AST","ALP","GGT","TBIL","DBIL","ALBUMIN",
  "CHOL","LDL","HDL","TRIG",
  "CRP","ESR","PROCT","FERITIN",
  "AMILAZ","LIPAZ",
  "TSH","FT4","FT3",
  "WBC","RBC","HGB","HCT","MCV","PLT","NEUT","LYMPH","EOS",
  "PT","PTT","INR","FIBRINOGEN","DDIMER",
  "PH","PCO2","PO2","HCO3",
  "U_PH","U_SG","U_PROTEIN","U_GLUKOZ",
  "DEMIR","BHCG","GOZ_BASINCI",
];

export interface FormState {
  testKey: string;
  diseaseKey: string;
  tendency: "yuksek" | "dusuk";
  factor: string;
  description: string;
}

export const emptyForm = (): FormState => ({
  testKey: "",
  diseaseKey: "",
  tendency: "yuksek",
  factor: "",
  description: "",
});

export function yonEtiketi(tendency: "yuksek" | "dusuk", factor: number) {
  return tendency === "yuksek" ? `↑ ×${factor}` : `↓ ×${factor}`;
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
    </div>
  );
}
