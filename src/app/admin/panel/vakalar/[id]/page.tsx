"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { birlesikTestKatalogu } from "@/lib/data";
import { CHIP_HAVUZU } from "@/lib/data/chip-havuzu";
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
  | "management"
  | "ai";

interface RubrikAksiyon {
  key: string;
  etiket: string;
  aciklama: string;
  kategori?: string;
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
  incelemeDurumu?: "taslak" | "incelemede" | "onayli" | "degisiklik_istendi" | "legacy";
  incelemeNotu?: string;
  uzmanOnaylayan?: string;
  contentChecksum?: string;
  klinikKaynak?: string;
  klinikKaynakTarihi?: string;
  egitimHedefleri?: string[];
  sonKlinikGozdenGecirmeTarihi?: number;
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
    ilaclar?: Array<{
      ad: string;
      doz: string;
      yol: string;
      siklik?: string;
      sure?: string;
      endikasyon: string;
      code?: string;
    }>;
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

function slugifyKey(s: string): string {
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
            className={`grid gap-2 rounded-lg border border-hairline-soft bg-surface-soft p-2 ${
              showCategory
                ? "sm:grid-cols-[1fr_1fr_1.2fr_0.9fr_auto]"
                : "sm:grid-cols-[1fr_1fr_1.4fr_auto]"
            }`}
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
                next[i] = {
                  ...row,
                  etiket: e.target.value,
                  key: row.key || slugifyKey(e.target.value),
                };
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
  const [reviewing, setReviewing] = useState(false);

  // ── form state (CDM sections) ──
  const [meta, setMeta] = useState({
    hastalikAdi: "",
    seviye: "orta",
    durum: "taslak",
    etiketler: "",
    surum: 1,
    uzmanOnayi: false,
    klinikKaynak: "",
    klinikKaynakTarihi: "",
    egitimHedefleri: "",
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
    semptomSablon: "",
  });
  const [ozetBilgilerList, setOzetBilgilerList] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [kabulEdilenTani, setKabulEdilenTani] = useState("");
  const [beklenenSorular, setBeklenenSorular] = useState<RubrikAksiyon[]>([]);
  const [beklenenTestler, setBeklenenTestler] = useState<RubrikAksiyon[]>([]);
  const [gereksizTestler, setGereksizTestler] = useState<RubrikAksiyon[]>([]);
  const [redFlagler, setRedFlagler] = useState<RubrikAksiyon[]>([]);
  const [vitals, setVitals] = useState({
    tansiyonSistolik: "",
    tansiyonDiyastolik: "",
    nabiz: "",
    ates: "",
    spo2: "",
    solunum: "",
  });
  const [yanitlarList, setYanitlarList] = useState<{ key: string; value: string }[]>([]);
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

  // ── AI entegrasyonu ──
  const [hastaTipleri, setHastaTipleri] = useState<{ id: string; ad: string }[]>([]);
  const [seciliTipler, setSeciliTipler] = useState<string[]>([]);
  const [aiEslestirme, setAiEslestirme] = useState(false);
  const [aiUretiliyor, setAiUretiliyor] = useState(false);
  const [aiRapor, setAiRapor] = useState("");
  const [aiSonuclar, setAiSonuclar] = useState<
    Array<{ tipId?: string; tipAd: string; cevaplar: Record<string, string>; basarili?: boolean; uyarilar?: string[] }>
  >([]);

  const hydrate = useCallback((c: AdminVaka) => {
    setVaka(c);
    setMeta({
      hastalikAdi: c.hastalikAdi || "",
      seviye: c.seviye || "orta",
      durum: c.durum || "taslak",
      etiketler: (c.etiketler || []).join(", "),
      surum: c.surum ?? 1,
      uzmanOnayi: !!c.uzmanOnayi,
      klinikKaynak: c.klinikKaynak || "",
      klinikKaynakTarihi: c.klinikKaynakTarihi || "",
      egitimHedefleri: (c.egitimHedefleri || []).join("\n"),
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
      semptomSablon: c.semptomSablon || "",
    });
    setOzetBilgilerList(c.ozetBilgiler || []);
    setConditions(c.conditions?.length ? c.conditions : []);
    setKabulEdilenTani((c.rubric?.kabulEdilenTani || []).join(", "));
    setBeklenenSorular(c.rubric?.beklenenSorular || []);
    setBeklenenTestler(c.rubric?.beklenenTestler || []);
    setGereksizTestler(c.rubric?.gereksizTestler || []);
    setRedFlagler(c.rubric?.redFlagler || []);
    const tansiyonRaw = c.vitals?.tansiyon || c.hastaYanitlari?.VITAL_TANSIYON || "";
    const [sistolik, diyastolik] = tansiyonRaw.split("/").map((s) => s.trim());
    setVitals({
      tansiyonSistolik: sistolik || "",
      tansiyonDiyastolik: diyastolik || "",
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
    // Soru-cevap listesi
    setYanitlarList(
      Object.entries(c.hastaYanitlari || {}).map(([k, v]) => ({ key: k, value: v }))
    );
    setIdealYol((c.idealYol || []).join("\n"));
    setEgitimNotu(c.egitimNotu || "");
    setTedaviIlaclar(
      (c.tedavi?.ilaclar || [])
        .map((i) => [i.ad, i.doz, i.yol, i.siklik || "", i.sure || "", i.endikasyon].join(" | "))
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

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setAiEslestirme(Boolean(d.settings?.ai?.eslestirme)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/hasta-tipleri")
      .then((r) => r.json())
      .then((d) => setHastaTipleri(d.tipler || []))
      .catch(() => {});
  }, []);

  async function aiUret() {
    if (!vaka) return;
    setAiUretiliyor(true);
    setError("");
    setAiRapor("Başlatılıyor…");
    setAiSonuclar([]);
    try {
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vaka.id,
          tipIds: seciliTipler,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || "AI üretimi başarısız.");
        return;
      }
      if (!res.body) {
        setError("Sunucudan akış alınamadı.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let tampon = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        tampon += decoder.decode(value, { stream: true });
        let ayrac: number;
        while ((ayrac = tampon.indexOf("\n\n")) !== -1) {
          const blok = tampon.slice(0, ayrac);
          tampon = tampon.slice(ayrac + 2);
          const dataSatiri = blok.split("\n").find((l) => l.startsWith("data:"));
          if (!dataSatiri) continue;
          let olay: Record<string, unknown>;
          try {
            olay = JSON.parse(dataSatiri.slice(5).trim());
          } catch {
            continue;
          }
          if (olay.tip === "tip-basla") {
            setAiRapor(`${String(olay.tipAd || olay.tipId || "")} üretiliyor…`);
          } else if (olay.tip === "ilerleme") {
            const tur = olay.tur === "grup" ? `Grup ${olay.tamamlanan}/${olay.toplam}` : `Tamamlama ${olay.tamamlanan}/${olay.toplam}`;
            setAiRapor(`${tur} üretiliyor…`);
          } else if (olay.tip === "tip-tamam") {
            const cevaplar = (olay.cevaplar ?? {}) as Record<string, string>;
            const rapor = olay.rapor as { cevaplananSoru?: number; toplamSoru?: number; uyarilar?: string[] } | undefined;
            setAiSonuclar((s) => [
              ...s,
              {
                tipId: typeof olay.tipId === "string" ? olay.tipId : undefined,
                tipAd: String(olay.tipAd || olay.tipId || "Varsayılan"),
                cevaplar,
                basarili: Boolean(olay.basarili),
                uyarilar: Array.isArray(rapor?.uyarilar) ? rapor.uyarilar : [],
              },
            ]);
          } else if (olay.tip === "tamam") {
            // Tek koşu (hasta tipi seçilmedi)
            const cevaplar = (olay.cevaplar ?? {}) as Record<string, string>;
            const rapor = olay.rapor as { uyarilar?: string[] } | undefined;
            setAiSonuclar((s) => [
              ...s,
              {
                tipId: undefined,
                tipAd: "Varsayılan",
                cevaplar,
                basarili: Boolean(olay.basarili),
                uyarilar: Array.isArray(rapor?.uyarilar) ? rapor.uyarilar : [],
              },
            ]);
          } else if (olay.tip === "bitti") {
            setAiRapor("Tüm tipler için üretim tamamlandı.");
            notify("AI cevapları üretildi. Sonuçları aşağıdan gözden geçirip yanıtlara uygulayın.");
          } else if (olay.tip === "hata") {
            setError(typeof olay.mesaj === "string" ? olay.mesaj : "AI üretimi başarısız.");
          }
        }
      }
    } catch {
      setError("AI üretimi başarısız.");
    } finally {
      setAiUretiliyor(false);
    }
  }

  async function aiEslestirmeToggle() {
    const yeni = !aiEslestirme;
    setAiEslestirme(yeni);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai: { eslestirme: yeni } }),
      });
    } catch {
      setError("Eşleştirme ayarı kaydedilemedi.");
    }
  }

  function parseIlaclar(text: string) {
    return linesToList(text).map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        ad: parts[0] || "",
        doz: parts[1] || "",
        yol: parts[2] || "PO",
        siklik: parts[3] || undefined,
        sure: parts[4] || undefined,
        endikasyon: parts[5] || "",
      };
    }).filter((i) => i.ad);
  }

  function yanitEtiketi(key: string): string {
    const chip = CHIP_HAVUZU.find((c) => c.aksiyon === key);
    if (chip) return chip.etiket;
    const r = beklenenSorular.find((s) => s.key === key);
    if (r?.etiket) return r.etiket;
    return key ? humanizeKey(key) : "";
  }

  async function saveAll(e?: FormEvent) {
    e?.preventDefault();
    if (!vaka) return;
    setSaving(true);
    setError("");

    const hastaYanitlari: Record<string, string> = {};
    for (const y of yanitlarList) {
      const k = y.key.trim();
      if (k) hastaYanitlari[k] = y.value;
    }
    if (!hastaYanitlari.OZEL) hastaYanitlari.OZEL = "Anlamadım";
    // vitals → yanıt senkron
    const tansiyon = [vitals.tansiyonSistolik, vitals.tansiyonDiyastolik]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/");
    if (tansiyon) hastaYanitlari.VITAL_TANSIYON = tansiyon;
    if (vitals.nabiz) hastaYanitlari.VITAL_NABIZ = vitals.nabiz;
    if (vitals.ates) hastaYanitlari.VITAL_ATES = vitals.ates;
    if (vitals.spo2) hastaYanitlari.VITAL_SPO2 = vitals.spo2;
    if (vitals.solunum) hastaYanitlari.VITAL_SOLUNUM = vitals.solunum;

    const cleanAksiyon = (list: RubrikAksiyon[]) => {
      const seen = new Set<string>();
      return list
        .map((a) => ({
          key: a.key.trim(),
          etiket: a.etiket.trim() || humanizeKey(a.key.trim()),
          aciklama: a.aciklama.trim(),
          kategori: a.kategori?.trim() || undefined,
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
      etiketler: csvToList(meta.etiketler),
      klinikKaynak: meta.klinikKaynak,
      klinikKaynakTarihi: meta.klinikKaynakTarihi,
      egitimHedefleri: linesToList(meta.egitimHedefleri),
      yasAraligi: [Number(patient.yasMin), Number(patient.yasMax)] as [number, number],
      cinsiyetTercih: patient.cinsiyetTercih,
      patientProfil: {
        bmi: patient.bmi ? Number(patient.bmi) : undefined,
        sigara: patient.sigara || undefined,
        komorbiditeler: csvToList(patient.komorbiditeler),
      },
      anaSikayet: presentation.anaSikayet,
      ozetBilgiler: ozetBilgilerList.map((s) => s.trim()).filter(Boolean),
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
        tansiyon: tansiyon || undefined,
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
        body: JSON.stringify({ ...body, expectedUpdatedAt: vaka.updatedAt }),
      });
      const d = await res.json();
      if (!res.ok) {
        const issues = Array.isArray(d.issues) && d.issues.length > 0
          ? d.issues.map((i: { field?: string; message?: string }) => `${i.field}: ${i.message}`).join(" · ")
          : "";
        setError(issues ? `${d.error || "Kayıt hatası"} — ${issues}` : d.error || "Kayıt hatası");
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

  async function reviewCase(action: "submit" | "approve" | "request_changes") {
    if (!vaka) return;
    setReviewing(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cases/${encodeURIComponent(id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedUpdatedAt: vaka.updatedAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İnceleme işlemi başarısız.");
        return;
      }
      hydrate(data.case);
      notify(data.log?.message || "İnceleme durumu güncellendi.");
    } catch {
      setError("İnceleme işlemi başarısız.");
    } finally {
      setReviewing(false);
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
          {vaka.incelemeDurumu !== "incelemede" && vaka.durum !== "aktif" && (
            <button type="button" className="btn-secondary text-sm" disabled={reviewing} onClick={() => void reviewCase("submit")}>
              {reviewing ? "İşleniyor…" : "İncelemeye gönder"}
            </button>
          )}
          {vaka.incelemeDurumu === "incelemede" && (
            <>
              <button type="button" className="btn-secondary text-sm" disabled={reviewing} onClick={() => void reviewCase("request_changes")}>
                Değişiklik iste
              </button>
              <button type="button" className="btn-primary text-sm" disabled={reviewing} onClick={() => void reviewCase("approve")}>
                Bağımsız onayla
              </button>
            </>
          )}
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
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-hairline pb-px scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
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
          title="Kimlik & yayın"
          hint="Hastalık adı ve yayın durumu. poliklinikKey / hastalikKey depoda sabittir; yayın ve onay bağımsız inceleme akışından yönetilir."
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
              <label className="text-xs text-muted">Hastalık anahtarı (salt okunur)</label>
              <input className="input w-full bg-surface-soft" value={vaka.hastalikKey} readOnly />
            </div>
            <div>
              <label className="text-xs text-muted">Yayın / inceleme</label>
              <div className="input flex min-h-10 items-center bg-surface-soft text-sm">
                {vaka.durum} · {vaka.incelemeDurumu || "legacy"}
              </div>
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
              <div className="input flex min-h-10 items-center bg-surface-soft text-sm">v{vaka.surum}</div>
            </div>
            <div className="flex items-end pb-2 text-sm text-steel">
              {vaka.uzmanOnayi ? `✓ Reviewer: ${vaka.uzmanOnaylayan || "kayıtlı"}` : "Reviewer onayı bekleniyor"}
            </div>
            <div>
              <label className="text-xs text-muted">Klinik kaynak</label>
              <input className="input w-full" value={meta.klinikKaynak} onChange={(e) => setMeta({ ...meta, klinikKaynak: e.target.value })} placeholder="Kılavuz, yayın veya kurum protokolü" />
            </div>
            <div>
              <label className="text-xs text-muted">Kaynak tarihi</label>
              <input type="date" className="input w-full" value={meta.klinikKaynakTarihi} onChange={(e) => setMeta({ ...meta, klinikKaynakTarihi: e.target.value })} />
            </div>
          </div>
          {vaka.incelemeNotu && <p className="mt-2 text-sm text-steel">Reviewer notu: {vaka.incelemeNotu}</p>}
          <div>
            <label className="text-xs text-muted">Etiketler (virgülle)</label>
            <input
              className="input w-full"
              value={meta.etiketler}
              onChange={(e) => setMeta({ ...meta, etiketler: e.target.value })}
              placeholder="OSCE, Poliklinik, Orta seviye"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Eğitim hedefleri (satır başına bir hedef)</label>
            <textarea className="input h-24 w-full resize-y" value={meta.egitimHedefleri} onChange={(e) => setMeta({ ...meta, egitimHedefleri: e.target.value })} placeholder="Örn. Göğüs ağrısında red flag taraması yapar." />
          </div>
          {vaka.sonKlinikGozdenGecirmeTarihi && <p className="text-xs text-steel">Son klinik gözden geçirme: {new Date(vaka.sonKlinikGozdenGecirmeTarihi).toLocaleDateString("tr-TR")}</p>}
        </Section>
      )}

      {tab === "patient" && (
        <Section
          title="Hasta — demografi & profil"
          hint="Yaş aralığı, cinsiyet ve ek hastalık öyküsü."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Yaş (min)</label>
              <input
                type="number"
                className="input w-full"
                value={patient.yasMin}
                onChange={(e) => setPatient({ ...patient, yasMin: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Yaş (max)</label>
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
              <label className="text-xs text-muted">Ek hastalıklar (virgülle)</label>
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
          title="Başvuru — şikayet & öykü"
          hint="Ana şikayet + öykü (HPI) özeti + semptom şablonu."
        >
          <div>
            <label className="text-xs text-muted">Ana şikayet (chief complaint)</label>
            <input
              className="input w-full"
              value={presentation.anaSikayet}
              onChange={(e) =>
                setPresentation({ ...presentation, anaSikayet: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted">Özet bilgiler (öykü — birden fazla ekleyin)</label>
            <div className="space-y-2">
              {ozetBilgilerList.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    value={b}
                    onChange={(e) => {
                      const next = [...ozetBilgilerList];
                      next[i] = e.target.value;
                      setOzetBilgilerList(next);
                    }}
                    placeholder="Örn. 2 haftadır baş ağrısı"
                  />
                  <button
                    type="button"
                    className="text-xs text-clinical-red hover:underline"
                    onClick={() => setOzetBilgilerList(ozetBilgilerList.filter((_, j) => j !== i))}
                  >
                    Sil
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-brand-deep hover:underline"
                onClick={() => setOzetBilgilerList((l) => [...l, ""])}
              >
                + Özet bilgi ekle
              </button>
            </div>
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
          title="Tanılar (OMOP condition_occurrence)"
          hint="Kod + tanı adı. Örn. CKD_G3, T2DM, HTN. En az bir 'birincil tanı' işaretleyin."
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
              + Tanı ekle
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
                  placeholder="KOD"
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
                  Birincil tanı
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
              <p className="text-xs text-muted">Tanı yok — kabul edilen tanılardan da dolabilir.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted">
              Kabul edilen tanılar (virgülle)
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
          title="Puanlama — OSCE kriterleri"
          hint="Öğrenciden beklenen sorular, testler ve kaçınılması gerekenler. Test anahtarları katalogla uyumlu olmalı (KREATININ, IDRAR…)."
        >
          <RubrikListEditor
            label="Beklenen sorular (öğrencinin sormalı)"
            items={beklenenSorular}
            onChange={setBeklenenSorular}
            keyPlaceholder="ODEM_SURE"
            showCategory
          />
          <RubrikListEditor
            label="Beklenen testler (öğrencinin istemeli)"
            items={beklenenTestler}
            onChange={setBeklenenTestler}
            keyPlaceholder="KREATININ"
            keySuggestions={birlesikTestKatalogu.map((t) => t.key)}
          />
          <RubrikListEditor
            label="Gereksiz testler (ceza)"
            items={gereksizTestler}
            onChange={setGereksizTestler}
            keyPlaceholder="BT_TORAKS"
            keySuggestions={birlesikTestKatalogu.map((t) => t.key)}
          />
          <RubrikListEditor
            label="Kırmızı bayraklar (red flags)"
            items={redFlagler}
            onChange={setRedFlagler}
            keyPlaceholder="HIPERKALEMI"
          />
        </Section>
      )}

      {tab === "labs" && (
        <Section
          title="Laboratuvar — ölçümler"
          hint="Sadece birleşik test kataloğundan eklenir. Anahtarlar kanoniktir (IDRAR, GLUKOZ…)."
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

          <h3 className="text-sm font-semibold text-ink pt-2">Vakadaki laboratuvar sonuçları</h3>
          {tests.length === 0 && (
            <p className="text-xs text-muted">Henüz laboratuvar sonucu yok — katalogdan ekleyin.</p>
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
          title="Yaşamsal bulgular"
          hint="Kaydedilince VITAL_* hasta yanıtlarına da yazılır."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs text-muted">Tansiyon — büyük (sistolik)</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                className="input w-full"
                value={vitals.tansiyonSistolik}
                onChange={(e) => setVitals({ ...vitals, tansiyonSistolik: e.target.value })}
                placeholder="120"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Tansiyon — küçük (diyastolik)</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                className="input w-full"
                value={vitals.tansiyonDiyastolik}
                onChange={(e) => setVitals({ ...vitals, tansiyonDiyastolik: e.target.value })}
                placeholder="80"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Nabız (/dk)</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                className="input w-full"
                value={vitals.nabiz}
                onChange={(e) => setVitals({ ...vitals, nabiz: e.target.value })}
                placeholder="72"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Ateş (°C)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                className="input w-full"
                value={vitals.ates}
                onChange={(e) => setVitals({ ...vitals, ates: e.target.value })}
                placeholder="36.5"
              />
            </div>
            <div>
              <label className="text-xs text-muted">SpO₂ (%)</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                className="input w-full"
                value={vitals.spo2}
                onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                placeholder="97"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Solunum (/dk)</label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                className="input w-full"
                value={vitals.solunum}
                onChange={(e) => setVitals({ ...vitals, solunum: e.target.value })}
                placeholder="16"
              />
            </div>
          </div>
        </Section>
      )}

      {tab === "yanitlar" && (
        <Section
          title="Hasta yanıtları — simüle cevaplar"
          hint="Her soru için simüle hastanın verdiği cevap. OZEL anahtarı, anlaşılmayan sorular için fallback olarak zorunludur."
        >
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-brand-deep hover:underline"
              onClick={() => setYanitlarList((l) => [...l, { key: "", value: "" }])}
            >
              + Soru / cevap ekle
            </button>
          </div>
          <datalist id="yanit-key-suggestions">
            {CHIP_HAVUZU.map((c) => (
              <option key={c.aksiyon} value={c.aksiyon}>
                {c.etiket}
              </option>
            ))}
          </datalist>
          {yanitlarList.length === 0 && (
            <p className="text-xs text-muted">Henüz cevap yok — ekleyin veya AI ile üretin.</p>
          )}
          <div className="space-y-2">
            {yanitlarList.map((y, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border border-hairline-soft bg-surface-soft p-2 sm:grid-cols-[200px_1fr_auto]"
              >
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    Soru anahtarı
                  </label>
                  <input
                    className="input text-xs font-mono"
                    placeholder="ODEM_SURE"
                    list="yanit-key-suggestions"
                    value={y.key}
                    onChange={(e) => {
                      const next = [...yanitlarList];
                      next[i] = { ...y, key: e.target.value };
                      setYanitlarList(next);
                    }}
                  />
                  <div className="mt-0.5 truncate text-[10px] text-steel">
                    {yanitEtiketi(y.key)}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    Hasta cevabı
                  </label>
                  <textarea
                    className="input min-h-[48px] w-full resize-y text-sm"
                    value={y.value}
                    onChange={(e) => {
                      const next = [...yanitlarList];
                      next[i] = { ...y, value: e.target.value };
                      setYanitlarList(next);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="self-start text-xs text-clinical-red hover:underline"
                  onClick={() => setYanitlarList(yanitlarList.filter((_, j) => j !== i))}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "management" && (
        <Section
          title="Yönetim — ideal yol & tedavi"
          hint="OSCE Değerlendirme ve Plan (A&P). İlaç satırı: ad | doz | yol | endikasyon"
        >
          <div>
            <label className="text-xs text-muted">İdeal klinik yol (satır satır)</label>
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
            <label className="text-xs text-muted">
              İlaçlar (ad | doz | yol | sıklık | süre | endikasyon)
            </label>
            <textarea
              className="input w-full min-h-[80px] font-mono text-xs"
              value={tedaviIlaclar}
              onChange={(e) => setTedaviIlaclar(e.target.value)}
              placeholder="Ramipril | 5 mg | PO | Günde 1 kez | Uzun dönem | Proteinürili KBH"
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

      {tab === "ai" && (
        <Section
          title="AI — hasta cevapları üretimi"
          hint="Bir veya birden fazla hasta tipi seçin; AI her tip için ayrı ayrı (ard arda) cevap üretir. Üretim kaydetmez; gözden geçirip yanıtlara uygulayın."
        >
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-hairline bg-surface-soft p-4">
              <div>
                <div className="mb-1 text-xs font-medium text-muted">
                  Hasta tipi seçin (birden fazla olabilir)
                </div>
                {hastaTipleri.length === 0 ? (
                  <p className="text-xs text-steel">Hasta tipi yok — önce Hasta Tipleri ekranından ekleyin.</p>
                ) : (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {hastaTipleri.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={seciliTipler.includes(t.id)}
                          onChange={(e) =>
                            setSeciliTipler((s) =>
                              e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)
                            )
                          }
                        />
                        <span className="truncate">{t.ad}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={aiUretiliyor}
                  onClick={() => void aiUret()}
                >
                  {aiUretiliyor ? "Üretiliyor…" : "AI ile cevapları üret"}
                </button>
                {seciliTipler.length > 0 && (
                  <span className="text-xs text-steel">{seciliTipler.length} tip seçildi</span>
                )}
              </div>
              {aiRapor && (
                <pre className="whitespace-pre-wrap text-xs font-mono text-steel">{aiRapor}</pre>
              )}

              {aiSonuclar.map((s, i) => (
                <div key={`${s.tipId || "default"}-${i}`} className="rounded-lg border border-hairline bg-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-ink">{s.tipAd}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() =>
                          setYanitlarList(Object.entries(s.cevaplar).map(([k, v]) => ({ key: k, value: v })))
                        }
                      >
                        Yanıtlara uygula
                      </button>
                    </div>
                  </div>
                  {s.uyarilar && s.uyarilar.length > 0 && (
                    <div className="mt-2 rounded-md border border-clinical-orange/30 bg-clinical-orange/5 p-2">
                      <div className="mb-1 text-[11px] font-semibold text-clinical-orange">
                        Uyarılar ({s.uyarilar.length})
                      </div>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-ink">
                        {s.uyarilar.map((u, j) => (
                          <li key={j}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted">
                      {Object.keys(s.cevaplar).length} cevap — görüntüle
                    </summary>
                    <div className="mt-2 max-h-72 space-y-1 overflow-auto rounded-md bg-surface-soft p-2">
                      {Object.entries(s.cevaplar).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="font-mono font-medium text-brand-deep">{k}</span>
                          <span className="text-muted">: </span>
                          <span className="text-ink">{v}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-lg border border-hairline bg-surface-soft p-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={aiEslestirme}
                  onChange={() => void aiEslestirmeToggle()}
                />
                Serbest metin AI eşleştirme (öğrenci akışı)
              </label>
              <p className="text-[11px] text-muted">
                Açıkken sözlükte bulunamayan serbest metin sorular DeepSeek ile en yakın
                chip'e eşleştirilir. Global ayardır; tüm vakalarda geçerlidir.
              </p>
            </div>
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
