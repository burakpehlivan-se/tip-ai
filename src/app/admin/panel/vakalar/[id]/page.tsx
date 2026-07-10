"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { birlesikTestKatalogu } from "@/lib/data";
import { humanizeKey } from "@/lib/types";

type TabId =
  | "meta"
  | "patient"
  | "presentation"
  | "conditions"
  | "rubric"
  | "labs"
  | "vitals"
  | "yanitlar"
  | "management";

interface RubrikAksiyon {
  key: string;
  etiket: string;
  aciklama: string;
}

interface Condition {
  code: string;
  ad: string;
  system?: string;
  primary?: boolean;
}

interface TestSonucu {
  testKey: string;
  testAdi: string;
  tip: string;
  sonuc: unknown;
  referans?: string;
  yorum?: string;
}

interface AdminVaka {
  id: string;
  poliklinikKey: string;
  poliklinikAd: string;
  poliklinikIcon: string;
  hastalikKey: string;
  hastalikAdi: string;
  seviye: string;
  yasAraligi: [number, number];
  cinsiyetTercih: string;
  anaSikayet: string;
  ozetBilgiler: string[];
  semptomSablon?: string;
  egitimNotu: string;
  idealYol: string[];
  statikTestler: Record<string, TestSonucu>;
  hastaYanitlari: Record<string, string>;
  durum: string;
  etiketler: string[];
  surum: number;
  uzmanOnayi: boolean;
  cdmVersion?: string;
  patientProfil?: { bmi?: number; sigara?: string; komorbiditeler?: string[] };
  vitals?: {
    tansiyon?: string;
    nabiz?: number;
    ates?: number;
    spo2?: number;
    solunum?: number;
  };
  conditions?: Condition[];
  tedavi?: {
    ilaclar?: Array<{ ad: string; doz: string; yol: string; endikasyon: string; code?: string }>;
    prosedurler?: string[];
    onemliNotlar?: string[];
    aciklama?: string;
  };
  rubric: {
    beklenenSorular: RubrikAksiyon[];
    beklenenTestler: RubrikAksiyon[];
    gereksizTestler: RubrikAksiyon[];
    redFlagler: RubrikAksiyon[];
    kabulEdilenTani: string[];
    puanlama: Record<string, number>;
  };
  updatedAt: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "meta", label: "1. Meta" },
  { id: "patient", label: "2. Patient" },
  { id: "presentation", label: "3. Presentation" },
  { id: "conditions", label: "4. Conditions" },
  { id: "rubric", label: "5. Rubric" },
  { id: "labs", label: "6. Labs" },
  { id: "vitals", label: "7. Vitals" },
  { id: "yanitlar", label: "8. Yanıtlar" },
  { id: "management", label: "9. Management" },
];

function pretty(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

function linesToList(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function csvToList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function defaultSonucForKey(key: string): { tip: string; sonuc: string } {
  const jsonPanel: Record<string, string> = {
    CBC: JSON.stringify(
      { hemoglobin: "14.0 g/dL", lokosit: "8.5 K/uL", trombosit: "250 K/uL" },
      null,
      2
    ),
    ELEKTROLIT: JSON.stringify(
      { sodyum: "140 mmol/L", potasyum: "4.2 mmol/L", klor: "102 mmol/L" },
      null,
      2
    ),
    KOLESTEROL: JSON.stringify(
      { totalKolesterol: "180 mg/dL", ldl: "100 mg/dL", hdl: "50 mg/dL", trigliserit: "120 mg/dL" },
      null,
      2
    ),
    IDRAR: JSON.stringify(
      { dansite: "1015", protein: "Negatif", glukoz: "Negatif", ph: 6.0 },
      null,
      2
    ),
    ABG: JSON.stringify(
      { pH: "7.40", pCO2: "40 mmHg", pO2: "90 mmHg", HCO3: "24 mmol/L" },
      null,
      2
    ),
    EKG: JSON.stringify({ ritim: "Sinüs", kalpHizi: "78", yorum: "Normal sinüs ritmi" }, null, 2),
    DEMIR: JSON.stringify(
      { serumDemir: "90 µg/dL", tdbk: "300 µg/dL", transferrinSaturasyonu: "30%" },
      null,
      2
    ),
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

  const imageLike = [
    "AKCIGER_GRAFISI",
    "BT_TORAKS",
    "MAMOGRAFI",
    "MEME_USG",
    "BT_ABDOMEN",
    "BT_KRANIYAL",
    "USG_ABDOMEN",
    "PELVIK_USG",
  ];
  if (imageLike.includes(key)) {
    return {
      tip: "image",
      sonuc: "Görüntüleme: belirgin patoloji yok / klinik korelasyon önerilir.",
    };
  }
  if (key === "BIYOPSI") {
    return { tip: "text", sonuc: "Patoloji raporu: bulgular klinik bağlamda değerlendirilmeli." };
  }
  return { tip: "text", sonuc: "Sonuç normal sınırlarda." };
}

function katalogAdi(key: string, fallback?: string): string {
  return birlesikTestKatalogu.find((t) => t.key === key)?.ad || fallback || key;
}

function emptyAksiyon(): RubrikAksiyon {
  return { key: "", etiket: "", aciklama: "" };
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

function RubrikListEditor({
  label,
  items,
  onChange,
  keyPlaceholder = "KEY",
}: {
  label: string;
  items: RubrikAksiyon[];
  onChange: (next: RubrikAksiyon[]) => void;
  keyPlaceholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <button
          type="button"
          className="text-[11px] font-medium text-brand-deep hover:underline"
          onClick={() => onChange([...items, emptyAksiyon()])}
        >
          + Satır
        </button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted">Boş — satır ekleyin.</p>}
      <div className="space-y-2">
        {items.map((row, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-lg border border-hairline-soft bg-surface-soft p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
          >
            <input
              className="input text-xs font-mono"
              placeholder={keyPlaceholder}
              value={row.key}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...row, key: e.target.value };
                onChange(next);
              }}
            />
            <input
              className="input text-xs"
              placeholder="Etiket"
              value={row.etiket}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...row, etiket: e.target.value };
                onChange(next);
              }}
            />
            <input
              className="input text-xs"
              placeholder="Açıklama"
              value={row.aciklama}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...row, aciklama: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="text-xs text-clinical-red hover:underline"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminVakaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const [vaka, setVaka] = useState<AdminVaka | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [tab, setTab] = useState<TabId>("meta");
  const [saving, setSaving] = useState(false);

  // ── form state (CDM sections) ──
  const [meta, setMeta] = useState({
    hastalikAdi: "",
    seviye: "orta",
    durum: "aktif",
    etiketler: "",
    surum: 1,
    uzmanOnayi: false,
  });
  const [patient, setPatient] = useState({
    yasMin: 30,
    yasMax: 70,
    cinsiyetTercih: "herhangi",
    bmi: "",
    sigara: "",
    komorbiditeler: "",
  });
  const [presentation, setPresentation] = useState({
    anaSikayet: "",
    ozetBilgiler: "",
    semptomSablon: "",
  });
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [kabulEdilenTani, setKabulEdilenTani] = useState("");
  const [beklenenSorular, setBeklenenSorular] = useState<RubrikAksiyon[]>([]);
  const [beklenenTestler, setBeklenenTestler] = useState<RubrikAksiyon[]>([]);
  const [gereksizTestler, setGereksizTestler] = useState<RubrikAksiyon[]>([]);
  const [redFlagler, setRedFlagler] = useState<RubrikAksiyon[]>([]);
  const [vitals, setVitals] = useState({
    tansiyon: "",
    nabiz: "",
    ates: "",
    spo2: "",
    solunum: "",
  });
  const [yanitlarText, setYanitlarText] = useState("");
  const [idealYol, setIdealYol] = useState("");
  const [egitimNotu, setEgitimNotu] = useState("");
  const [tedaviIlaclar, setTedaviIlaclar] = useState("");
  const [tedaviProsedurler, setTedaviProsedurler] = useState("");
  const [tedaviNotlar, setTedaviNotlar] = useState("");

  const [newTest, setNewTest] = useState({
    testKey: "",
    testAdi: "",
    tip: "numeric",
    sonuc: "",
    yorum: "",
  });
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [katalogFiltre, setKatalogFiltre] = useState("");

  const hydrate = useCallback((c: AdminVaka) => {
    setVaka(c);
    setMeta({
      hastalikAdi: c.hastalikAdi || "",
      seviye: c.seviye || "orta",
      durum: c.durum || "aktif",
      etiketler: (c.etiketler || []).join(", "),
      surum: c.surum ?? 1,
      uzmanOnayi: !!c.uzmanOnayi,
    });
    setPatient({
      yasMin: c.yasAraligi?.[0] ?? 30,
      yasMax: c.yasAraligi?.[1] ?? 70,
      cinsiyetTercih: c.cinsiyetTercih || "herhangi",
      bmi: c.patientProfil?.bmi != null ? String(c.patientProfil.bmi) : "",
      sigara: c.patientProfil?.sigara || "",
      komorbiditeler: (c.patientProfil?.komorbiditeler || []).join(", "),
    });
    setPresentation({
      anaSikayet: c.anaSikayet || "",
      ozetBilgiler: (c.ozetBilgiler || []).join("\n"),
      semptomSablon: c.semptomSablon || "",
    });
    setConditions(c.conditions?.length ? c.conditions : []);
    setKabulEdilenTani((c.rubric?.kabulEdilenTani || []).join(", "));
    setBeklenenSorular(c.rubric?.beklenenSorular || []);
    setBeklenenTestler(c.rubric?.beklenenTestler || []);
    setGereksizTestler(c.rubric?.gereksizTestler || []);
    setRedFlagler(c.rubric?.redFlagler || []);
    setVitals({
      tansiyon: c.vitals?.tansiyon || c.hastaYanitlari?.VITAL_TANSIYON || "",
      nabiz:
        c.vitals?.nabiz != null
          ? String(c.vitals.nabiz)
          : c.hastaYanitlari?.VITAL_NABIZ || "",
      ates:
        c.vitals?.ates != null ? String(c.vitals.ates) : c.hastaYanitlari?.VITAL_ATES || "",
      spo2:
        c.vitals?.spo2 != null ? String(c.vitals.spo2) : c.hastaYanitlari?.VITAL_SPO2 || "",
      solunum: c.vitals?.solunum != null ? String(c.vitals.solunum) : "",
    });
    // KEY=value satırları
    const yLines = Object.entries(c.hastaYanitlari || {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    setYanitlarText(yLines);
    setIdealYol((c.idealYol || []).join("\n"));
    setEgitimNotu(c.egitimNotu || "");
    setTedaviIlaclar(
      (c.tedavi?.ilaclar || [])
        .map((i) => [i.ad, i.doz, i.yol, i.endikasyon].join(" | "))
        .join("\n")
    );
    setTedaviProsedurler((c.tedavi?.prosedurler || []).join("\n"));
    setTedaviNotlar((c.tedavi?.onemliNotlar || []).join("\n"));

    const drafts: Record<string, string> = {};
    for (const [k, t] of Object.entries(c.statikTestler || {}) as [string, TestSonucu][]) {
      drafts[`${k}::sonuc`] = pretty(t.sonuc);
      drafts[`${k}::yorum`] = t.yorum || "";
      drafts[`${k}::referans`] = t.referans || "";
    }
    setEditDrafts(drafts);
  }, []);

  const load = useCallback(() => {
    fetch(`/api/admin/cases/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        hydrate(d.case);
      })
      .catch((e) => setError(e.message));
  }, [id, hydrate]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 4000);
  }

  function parseYanitlar(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (k) out[k] = v;
    }
    if (!out.OZEL) out.OZEL = "Anlamadım";
    return out;
  }

  function parseIlaclar(text: string) {
    return linesToList(text).map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        ad: parts[0] || "",
        doz: parts[1] || "",
        yol: parts[2] || "PO",
        endikasyon: parts[3] || "",
      };
    }).filter((i) => i.ad);
  }

  async function saveAll(e?: FormEvent) {
    e?.preventDefault();
    if (!vaka) return;
    setSaving(true);
    setError("");

    const hastaYanitlari = parseYanitlar(yanitlarText);
    // vitals → yanıt senkron
    if (vitals.tansiyon) hastaYanitlari.VITAL_TANSIYON = vitals.tansiyon;
    if (vitals.nabiz) hastaYanitlari.VITAL_NABIZ = vitals.nabiz;
    if (vitals.ates) hastaYanitlari.VITAL_ATES = vitals.ates;
    if (vitals.spo2) hastaYanitlari.VITAL_SPO2 = vitals.spo2;

    const cleanAksiyon = (list: RubrikAksiyon[]) => {
      const seen = new Set<string>();
      return list
        .map((a) => ({
          key: a.key.trim(),
          etiket: a.etiket.trim() || humanizeKey(a.key.trim()),
          aciklama: a.aciklama.trim(),
        }))
        .filter((a) => {
          if (!a.key || seen.has(a.key)) return false;
          seen.add(a.key);
          return true;
        });
    };

    const body = {
      cdmVersion: "tip-ai-cdm-v1",
      hastalikAdi: meta.hastalikAdi,
      seviye: meta.seviye,
      durum: meta.durum,
      etiketler: csvToList(meta.etiketler),
      surum: Number(meta.surum) || 1,
      uzmanOnayi: meta.uzmanOnayi,
      uzmanOnaylayan: meta.uzmanOnayi ? "admin" : undefined,
      uzmanOnayTarihi: meta.uzmanOnayi ? Date.now() : undefined,
      yasAraligi: [Number(patient.yasMin), Number(patient.yasMax)] as [number, number],
      cinsiyetTercih: patient.cinsiyetTercih,
      patientProfil: {
        bmi: patient.bmi ? Number(patient.bmi) : undefined,
        sigara: patient.sigara || undefined,
        komorbiditeler: csvToList(patient.komorbiditeler),
      },
      anaSikayet: presentation.anaSikayet,
      ozetBilgiler: linesToList(presentation.ozetBilgiler),
      semptomSablon: presentation.semptomSablon,
      conditions: conditions
        .map((c) => ({
          code: c.code.trim(),
          ad: c.ad.trim(),
          system: (c.system as "local") || "local",
          primary: !!c.primary,
        }))
        .filter((c) => c.code && c.ad),
      rubric: {
        ...(vaka.rubric || {}),
        beklenenSorular: cleanAksiyon(beklenenSorular),
        beklenenTestler: cleanAksiyon(beklenenTestler),
        gereksizTestler: cleanAksiyon(gereksizTestler),
        redFlagler: cleanAksiyon(redFlagler),
        kabulEdilenTani: csvToList(kabulEdilenTani),
        puanlama: vaka.rubric?.puanlama || {},
      },
      vitals: {
        tansiyon: vitals.tansiyon || undefined,
        nabiz: vitals.nabiz ? Number(vitals.nabiz) : undefined,
        ates: vitals.ates ? Number(vitals.ates) : undefined,
        spo2: vitals.spo2 ? Number(vitals.spo2) : undefined,
        solunum: vitals.solunum ? Number(vitals.solunum) : undefined,
      },
      hastaYanitlari,
      idealYol: linesToList(idealYol),
      egitimNotu,
      tedavi: {
        ilaclar: parseIlaclar(tedaviIlaclar),
        prosedurler: linesToList(tedaviProsedurler),
        onemliNotlar: linesToList(tedaviNotlar),
      },
    };

    try {
      const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Kayıt hatası");
        return;
      }
      notify("CDM vaka kaydedildi.");
      hydrate(d.case);
    } catch {
      setError("Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTestField(testKey: string, field: string, raw: string) {
    let value: unknown = raw;
    if (field === "sonuc") {
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw;
      }
    }
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/tests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testKey, field, value }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Test güncellenemedi");
      return;
    }
    notify(d.log?.message || "Test güncellendi.");
    load();
  }

  function selectCatalogTest(key: string) {
    const item = birlesikTestKatalogu.find((t) => t.key === key);
    if (!item) return;
    const def = defaultSonucForKey(key);
    setNewTest({
      testKey: item.key,
      testAdi: item.ad,
      tip: def.tip,
      sonuc: def.sonuc,
      yorum: "",
    });
  }

  async function addTestFromCatalog(key: string) {
    const item = birlesikTestKatalogu.find((t) => t.key === key);
    if (!item) return;
    if (vaka?.statikTestler?.[key]) {
      setError("Bu test zaten vakada var.");
      return;
    }
    const def = defaultSonucForKey(key);
    const tip = newTest.testKey === key ? newTest.tip : def.tip;
    let sonucRaw = newTest.testKey === key ? newTest.sonuc : def.sonuc;
    let sonuc: unknown = sonucRaw;
    try {
      sonuc = JSON.parse(sonucRaw);
    } catch {
      /* text */
    }
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testKey: item.key,
        testAdi: item.ad,
        tip,
        sonuc,
        yorum: newTest.testKey === key ? newTest.yorum : "",
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Eklenemedi");
      return;
    }
    notify(`${item.ad} eklendi.`);
    setNewTest({ testKey: "", testAdi: "", tip: "numeric", sonuc: "", yorum: "" });
    load();
  }

  async function deleteTest(testKey: string) {
    if (!confirm(`${testKey} silinsin mi?`)) return;
    const res = await fetch(
      `/api/admin/cases/${encodeURIComponent(id)}/tests?testKey=${encodeURIComponent(testKey)}`,
      { method: "DELETE" }
    );
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Silinemedi");
      return;
    }
    notify("Test silindi.");
    load();
  }

  async function deleteCase() {
    if (!confirm("Bu vaka kalıcı olarak silinsin mi?")) return;
    const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Silinemedi");
      return;
    }
    router.push("/admin/panel/vakalar");
  }

  const tests = Object.values(vaka?.statikTestler || {});
  const mevcutKeys = useMemo(
    () => new Set(Object.keys(vaka?.statikTestler || {})),
    [vaka?.statikTestler]
  );

  const katalogGruplu = useMemo(() => {
    const q = katalogFiltre.trim().toLowerCase();
    const list = birlesikTestKatalogu.filter(
      (t) =>
        !q ||
        t.ad.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.kategori.toLowerCase().includes(q)
    );
    const map = new Map<string, { key: string; ad: string; kategori: string }[]>();
    for (const t of list) {
      if (!map.has(t.kategori)) map.set(t.kategori, []);
      map.get(t.kategori)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [katalogFiltre]);

  if (error && !vaka) {
    return (
      <div>
        <p className="text-clinical-red">{error}</p>
        <Link href="/admin/panel/vakalar" className="text-sm text-steel">
          ← Vakalar
        </Link>
      </div>
    );
  }

  if (!vaka) {
    return <p className="text-sm text-steel">Yükleniyor…</p>;
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/panel/vakalar" className="text-sm text-steel hover:text-ink">
            ← Vakalar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            {vaka.poliklinikIcon} {vaka.hastalikAdi}
          </h1>
          <p className="text-sm text-muted">
            {vaka.poliklinikAd} · {vaka.id} ·{" "}
            <span className="text-brand-deep font-medium">
              {vaka.cdmVersion || "legacy → CDM"}
            </span>
            {" · "}v{vaka.surum ?? 1}
            {vaka.uzmanOnayi ? " · ✓ onaylı" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/panel/oyna/${encodeURIComponent(id)}`}
            className="btn-secondary text-sm"
          >
            🎮 Oyna
          </Link>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={saving}
            onClick={() => saveAll()}
          >
            {saving ? "Kaydediliyor…" : "CDM kaydet"}
          </button>
        </div>
      </div>

      {flash && (
        <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{flash}</div>
      )}
      {error && (
        <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
          {error}
        </div>
      )}

      {/* CDM tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-hairline pb-px scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-canvas border border-b-canvas border-hairline text-ink -mb-px"
                : "text-steel hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "meta" && (
        <Section
          title="meta — kimlik & yayın"
          hint="poliklinikKey / hastalikKey depoda sabit; burada klinik ad, seviye, durum, etiket."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Hastalık adı</label>
              <input
                className="input w-full"
                value={meta.hastalikAdi}
                onChange={(e) => setMeta({ ...meta, hastalikAdi: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">hastalikKey (salt okunur)</label>
              <input className="input w-full bg-surface-soft" value={vaka.hastalikKey} readOnly />
            </div>
            <div>
              <label className="text-xs text-muted">Durum</label>
              <select
                className="input w-full"
                value={meta.durum}
                onChange={(e) => setMeta({ ...meta, durum: e.target.value })}
              >
                <option value="taslak">Taslak</option>
                <option value="aktif">Aktif</option>
                <option value="arsiv">Arşiv</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Seviye</label>
              <select
                className="input w-full"
                value={meta.seviye}
                onChange={(e) => setMeta({ ...meta, seviye: e.target.value })}
              >
                <option value="baslangic">Başlangıç</option>
                <option value="orta">Orta</option>
                <option value="ileri">İleri</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">Sürüm</label>
              <input
                type="number"
                min={1}
                className="input w-full"
                value={meta.surum}
                onChange={(e) => setMeta({ ...meta, surum: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={meta.uzmanOnayi}
                  onChange={(e) => setMeta({ ...meta, uzmanOnayi: e.target.checked })}
                />
                Uzman onayı
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Etiketler (virgülle)</label>
            <input
              className="input w-full"
              value={meta.etiketler}
              onChange={(e) => setMeta({ ...meta, etiketler: e.target.value })}
              placeholder="OSCE, Poliklinik, Orta seviye"
            />
          </div>
        </Section>
      )}

      {tab === "patient" && (
        <Section
          title="patient — demografi & profil"
          hint="OMOP person + profil (BMI, sigara, komorbidite kodları)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Yaş min</label>
              <input
                type="number"
                className="input w-full"
                value={patient.yasMin}
                onChange={(e) => setPatient({ ...patient, yasMin: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Yaş max</label>
              <input
                type="number"
                className="input w-full"
                value={patient.yasMax}
                onChange={(e) => setPatient({ ...patient, yasMax: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Cinsiyet tercihi</label>
              <select
                className="input w-full"
                value={patient.cinsiyetTercih}
                onChange={(e) => setPatient({ ...patient, cinsiyetTercih: e.target.value })}
              >
                <option value="herhangi">Herhangi</option>
                <option value="E">Erkek</option>
                <option value="K">Kadın</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted">BMI</label>
              <input
                className="input w-full"
                value={patient.bmi}
                onChange={(e) => setPatient({ ...patient, bmi: e.target.value })}
                placeholder="28"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Sigara</label>
              <input
                className="input w-full"
                value={patient.sigara}
                onChange={(e) => setPatient({ ...patient, sigara: e.target.value })}
                placeholder="Eski içici / Hiç / Aktif"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Komorbiditeler (kod, virgülle)</label>
              <input
                className="input w-full"
                value={patient.komorbiditeler}
                onChange={(e) => setPatient({ ...patient, komorbiditeler: e.target.value })}
                placeholder="HTN, T2DM"
              />
            </div>
          </div>
        </Section>
      )}

      {tab === "presentation" && (
        <Section
          title="presentation — OSCE başvuru"
          hint="Chief complaint + HPI özet + semptom şablonu."
        >
          <div>
            <label className="text-xs text-muted">Ana şikayet</label>
            <input
              className="input w-full"
              value={presentation.anaSikayet}
              onChange={(e) =>
                setPresentation({ ...presentation, anaSikayet: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted">Özet bilgiler (satır satır)</label>
            <textarea
              className="input w-full min-h-[100px]"
              value={presentation.ozetBilgiler}
              onChange={(e) =>
                setPresentation({ ...presentation, ozetBilgiler: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted">Semptom şablonu</label>
            <input
              className="input w-full"
              value={presentation.semptomSablon}
              onChange={(e) =>
                setPresentation({ ...presentation, semptomSablon: e.target.value })
              }
              placeholder="{{yas}} yaş {{cinsiyet}}, …"
            />
          </div>
        </Section>
      )}

      {tab === "conditions" && (
        <Section
          title="conditions — tanılar (OMOP condition_occurrence)"
          hint="Sabit kod + ad. Örn. CKD_G3, T2DM, HTN. En az bir primary işaretleyin."
        >
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-brand-deep hover:underline"
              onClick={() =>
                setConditions([
                  ...conditions,
                  { code: "", ad: "", system: "local", primary: conditions.length === 0 },
                ])
              }
            >
              + Condition
            </button>
          </div>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border border-hairline-soft bg-surface-soft p-2 sm:grid-cols-[1fr_1.5fr_auto_auto]"
              >
                <input
                  className="input text-xs font-mono"
                  placeholder="CODE"
                  value={c.code}
                  onChange={(e) => {
                    const next = [...conditions];
                    next[i] = { ...c, code: e.target.value };
                    setConditions(next);
                  }}
                />
                <input
                  className="input text-xs"
                  placeholder="Tanı adı"
                  value={c.ad}
                  onChange={(e) => {
                    const next = [...conditions];
                    next[i] = { ...c, ad: e.target.value };
                    setConditions(next);
                  }}
                />
                <label className="flex items-center gap-1 text-[11px] text-steel">
                  <input
                    type="checkbox"
                    checked={!!c.primary}
                    onChange={(e) => {
                      const next = conditions.map((x, j) =>
                        j === i ? { ...x, primary: e.target.checked } : { ...x, primary: false }
                      );
                      setConditions(next);
                    }}
                  />
                  primary
                </label>
                <button
                  type="button"
                  className="text-xs text-clinical-red"
                  onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                >
                  Sil
                </button>
              </div>
            ))}
            {conditions.length === 0 && (
              <p className="text-xs text-muted">Condition yok — kabul edilen tanılardan da dolabilir.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted">
              rubric.kabulEdilenTani (virgülle — scoring eşleşmesi)
            </label>
            <input
              className="input w-full"
              value={kabulEdilenTani}
              onChange={(e) => setKabulEdilenTani(e.target.value)}
            />
          </div>
        </Section>
      )}

      {tab === "rubric" && (
        <Section
          title="rubric — OSCE scoring"
          hint="Beklenen sorular/testler sabit key ile. Test key’leri katalogla hizalı olmalı (KREATININ, IDRAR…)."
        >
          <RubrikListEditor
            label="beklenenSorular"
            items={beklenenSorular}
            onChange={setBeklenenSorular}
            keyPlaceholder="ODEM_SURE"
          />
          <RubrikListEditor
            label="beklenenTestler"
            items={beklenenTestler}
            onChange={setBeklenenTestler}
            keyPlaceholder="KREATININ"
          />
          <RubrikListEditor
            label="gereksizTestler"
            items={gereksizTestler}
            onChange={setGereksizTestler}
            keyPlaceholder="BT_TORAKS"
          />
          <RubrikListEditor
            label="redFlagler"
            items={redFlagler}
            onChange={setRedFlagler}
            keyPlaceholder="HIPERKALEMI"
          />
        </Section>
      )}

      {tab === "labs" && (
        <Section
          title="labs — measurement (statikTestler)"
          hint="Sadece birleşik test kataloğundan eklenir. Anahtarlar kanonik (IDRAR, GLUKOZ…)."
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-muted">
              Katalog {birlesikTestKatalogu.length} · vakada {tests.length}
            </p>
            <input
              className="input max-w-xs text-sm"
              placeholder="Katalogda ara…"
              value={katalogFiltre}
              onChange={(e) => setKatalogFiltre(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-hairline divide-y divide-hairline-soft max-h-[320px] overflow-y-auto">
            {katalogGruplu.map(([kategori, items]) => (
              <div key={kategori} className="p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {kategori}
                </div>
                <div className="space-y-1">
                  {items.map((item) => {
                    const varMi = mevcutKeys.has(item.key);
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 text-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => selectCatalogTest(item.key)}
                        >
                          <div className="font-medium text-ink">{item.ad}</div>
                          <div className="text-[11px] font-mono text-muted">{item.key}</div>
                        </button>
                        {varMi ? (
                          <span className="text-[10px] text-brand-deep">Vakada ✓</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-accent text-xs py-1"
                            onClick={() => addTestFromCatalog(item.key)}
                          >
                            + Ekle
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {newTest.testKey && !mevcutKeys.has(newTest.testKey) && (
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 space-y-2">
              <div className="text-sm font-semibold">
                Eklenecek: {katalogAdi(newTest.testKey)}
              </div>
              <select
                className="input w-full max-w-xs"
                value={newTest.tip}
                onChange={(e) => setNewTest({ ...newTest, tip: e.target.value })}
              >
                <option value="numeric">numeric</option>
                <option value="json">json</option>
                <option value="text">text</option>
                <option value="image">image</option>
              </select>
              <textarea
                className="input w-full min-h-[90px] font-mono text-xs"
                value={newTest.sonuc}
                onChange={(e) => setNewTest({ ...newTest, sonuc: e.target.value })}
              />
              <input
                className="input w-full"
                placeholder="Yorum"
                value={newTest.yorum}
                onChange={(e) => setNewTest({ ...newTest, yorum: e.target.value })}
              />
              <button
                type="button"
                className="btn-accent text-sm"
                onClick={() => addTestFromCatalog(newTest.testKey)}
              >
                Vakaya ekle
              </button>
            </div>
          )}

          <h3 className="text-sm font-semibold text-ink pt-2">Vakadaki lab sonuçları</h3>
          {tests.length === 0 && (
            <p className="text-xs text-muted">Henüz lab yok — katalogdan ekleyin.</p>
          )}
          {tests.map((t) => (
            <div
              key={t.testKey}
              className="rounded-xl border border-hairline bg-surface-soft p-4 space-y-2"
            >
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium text-ink">
                    {katalogAdi(t.testKey, t.testAdi)}
                  </div>
                  <div className="text-[11px] font-mono text-muted">
                    {t.testKey} · {t.tip}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-clinical-red"
                  onClick={() => deleteTest(t.testKey)}
                >
                  Sil
                </button>
              </div>
              <textarea
                className="input w-full min-h-[80px] font-mono text-xs"
                value={editDrafts[`${t.testKey}::sonuc`] ?? ""}
                onChange={(e) =>
                  setEditDrafts((d) => ({ ...d, [`${t.testKey}::sonuc`]: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  saveTestField(t.testKey, "sonuc", editDrafts[`${t.testKey}::sonuc`] ?? "")
                }
              >
                Sonucu kaydet
              </button>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  placeholder="Yorum"
                  value={editDrafts[`${t.testKey}::yorum`] ?? ""}
                  onChange={(e) =>
                    setEditDrafts((d) => ({ ...d, [`${t.testKey}::yorum`]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() =>
                    saveTestField(t.testKey, "yorum", editDrafts[`${t.testKey}::yorum`] ?? "")
                  }
                >
                  Yorum
                </button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {tab === "vitals" && (
        <Section
          title="vitals — yaşamsal bulgular"
          hint="Kaydedilince VITAL_* hasta yanıtlarına da yazılır."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["tansiyon", "Tansiyon (örn. 150/95)"],
                ["nabiz", "Nabız"],
                ["ates", "Ateş °C"],
                ["spo2", "SpO₂"],
                ["solunum", "Solunum /dk"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label className="text-xs text-muted">{label}</label>
                <input
                  className="input w-full"
                  value={vitals[k]}
                  onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "yanitlar" && (
        <Section
          title="hastaYanitlari — simüle cevaplar"
          hint="Her satır: KEY=metin  (örn. ODEM_SURE=Yaklaşık 1 haftadır). OZEL fallback zorunlu."
        >
          <textarea
            className="input w-full min-h-[240px] font-mono text-xs"
            value={yanitlarText}
            onChange={(e) => setYanitlarText(e.target.value)}
            placeholder={"ODEM_SURE=...\nDIYABET=...\nOZEL=Anlamadım"}
          />
        </Section>
      )}

      {tab === "management" && (
        <Section
          title="management — ideal yol & tedavi"
          hint="OSCE Assessment & Plan. İlaç satırı: ad | doz | yol | endikasyon"
        >
          <div>
            <label className="text-xs text-muted">idealYol (satır satır)</label>
            <textarea
              className="input w-full min-h-[120px]"
              value={idealYol}
              onChange={(e) => setIdealYol(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Eğitim notu</label>
            <textarea
              className="input w-full min-h-[100px]"
              value={egitimNotu}
              onChange={(e) => setEgitimNotu(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted">İlaçlar (ad | doz | yol | endikasyon)</label>
            <textarea
              className="input w-full min-h-[80px] font-mono text-xs"
              value={tedaviIlaclar}
              onChange={(e) => setTedaviIlaclar(e.target.value)}
              placeholder="Ramipril | 5 mg/gün | PO | Proteinürili KBH"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Prosedürler / öneriler (satır)</label>
            <textarea
              className="input w-full min-h-[70px]"
              value={tedaviProsedurler}
              onChange={(e) => setTedaviProsedurler(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted">Önemli notlar (satır)</label>
            <textarea
              className="input w-full min-h-[70px]"
              value={tedaviNotlar}
              onChange={(e) => setTedaviNotlar(e.target.value)}
            />
          </div>
        </Section>
      )}

      {/* sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <span className="text-[11px] text-muted">
            TIP-AI CDM v1 · sekme: {TABS.find((t) => t.id === tab)?.label}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary text-xs text-clinical-red"
              onClick={deleteCase}
            >
              Sil
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={saving}
              onClick={() => saveAll()}
            >
              {saving ? "…" : "CDM kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
