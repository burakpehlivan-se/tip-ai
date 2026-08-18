"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Kalabaliklik = "az" | "orta" | "cok";

const KALABALIKLIK_SECENEKLERI: { deger: Kalabaliklik; ad: string; aciklama: string }[] = [
  { deger: "az", ad: "Sakin", aciklama: "1-2 hasta bekler" },
  { deger: "orta", ad: "Orta", aciklama: "2-3 hasta bekler" },
  { deger: "cok", ad: "Yoğun", aciklama: "4-5 hasta bekler" },
];

const POLIKLINIKLER: { key: string; ad: string; icon: string }[] = [
  { key: "kardiyoloji", ad: "Kardiyoloji", icon: "❤️" },
  { key: "endokrin", ad: "Endokrin", icon: "🩸" },
  { key: "solunum", ad: "Göğüs Hastalıkları", icon: "🫁" },
  { key: "nefroloji", ad: "Nefroloji", icon: "🧪" },
  { key: "onkoloji", ad: "Onkoloji", icon: "🎗️" },
  { key: "hematoloji", ad: "Hematoloji", icon: "🩸" },
  { key: "enfeksiyon", ad: "Enfeksiyon", icon: "🦠" },
  { key: "cerrahi", ad: "Genel Cerrahi", icon: "🏥" },
  { key: "goz", ad: "Göz Hastalıkları", icon: "👁️" },
  { key: "kbb", ad: "KBB", icon: "👂" },
  { key: "uroloji", ad: "Üroloji", icon: "🪨" },
  { key: "ortopedi", ad: "Ortopedi ve Travmatoloji", icon: "🦴" },
  { key: "kadin-dogum", ad: "Kadın Hastalıkları ve Doğum", icon: "🤰" },
  { key: "beyin-cerrahisi", ad: "Beyin ve Sinir Cerrahisi", icon: "🧠" },
  { key: "kvc", ad: "Kalp ve Damar Cerrahisi", icon: "🫀" },
  { key: "gogus-cerrahisi", ad: "Göğüs Cerrahisi", icon: "🫁" },
  { key: "plastik-cerrahi", ad: "Plastik Cerrahi", icon: "✂️" },
  { key: "cocuk-cerrahisi", ad: "Çocuk Cerrahisi", icon: "👶" },
];

const HASTALIKLAR: { key: string; ad: string }[] = [
  { key: "abh", ad: "Akut Böbrek Hasarı" },
  { key: "akciger-ca", ad: "Akciğer Kanseri" },
  { key: "akciger-kanseri-cerrahi", ad: "Akciğer Kanseri (Cerrahi)" },
  { key: "akut-apandisit", ad: "Akut Apandisit" },
  { key: "akut-bronsit", ad: "Akut Bronşit" },
  { key: "akut-glokom", ad: "Akut Glokom" },
  { key: "akut-tonsillit", ad: "Akut Tonsillit" },
  { key: "aort-anevrizmasi", ad: "Abdominal Aort Anevrizması" },
  { key: "astim", ad: "Astım Atağı" },
  { key: "atriyal-fibrilasyon", ad: "Atriyal Fibrilasyon" },
  { key: "basi-yarasi", ad: "Bası Yarası (Evre 2)" },
  { key: "bph", ad: "Benign Prostat Hiperplazisi" },
  { key: "ckd-ev3", ad: "KBH Evre 3" },
  { key: "dcis", ad: "DCIS" },
  { key: "demir-eksikligi-anemisi", ad: "Demir Eksikliği Anemisi" },
  { key: "diyabetik-noropati", ad: "Diyabetik Nöropati" },
  { key: "diz-osteoartrit", ad: "Diz Osteoartriti" },
  { key: "ektopik-gebelik", ad: "Ektopik Gebelik" },
  { key: "el-tendon-yaralanmasi", ad: "El Tendon Yaralanması" },
  { key: "endometriozis", ad: "Endometriozis" },
  { key: "epistaksis", ad: "Epistaksis (Burun Kanaması)" },
  { key: "gastroenterit", ad: "Akut Gastroenterit" },
  { key: "hemofili-a", ad: "Hemofili A" },
  { key: "hepatit-b", ad: "Akut Hepatit B" },
  { key: "hipertiroidi", ad: "Hipertiroidi" },
  { key: "hipoglisemi", ad: "Hipoglisemi (Diyabetik)" },
  { key: "hipotiroidi", ad: "Hipotiroidi" },
  { key: "invajinasyon", ad: "İnvajinasyon" },
  { key: "iye", ad: "İdrar Yolu Enfeksiyonu" },
  { key: "kafa-travmasi", ad: "Kafa Travması (Hafif)" },
  { key: "kalca-kirigi", ad: "Kalça Kırığı" },
  { key: "kalp-yetmezligi", ad: "Kalp Yetmezliği" },
  { key: "kasik-fitigi-cocuk", ad: "Çocuk Kasık Fıtığı" },
  { key: "katarakt", ad: "Senil Katarakt" },
  { key: "kbh", ad: "Kronik Böbrek Hastalığı" },
  { key: "koah-eks", ad: "KOAH Akut Ekspazerbasyonu" },
  { key: "kolon-ca", ad: "Kolon Kanseri" },
  { key: "konjonktivit", ad: "Bakteriyel Konjonktivit" },
  { key: "lomber-disk-hernisi", ad: "Lomber Disk Hernisi" },
  { key: "meme-ca", ad: "Meme Kanseri" },
  { key: "meniskus-yirtigi", ad: "Menisküs Yırtığı" },
  { key: "nefrotik-sendrom", ad: "Nefrotik Sendrom" },
  { key: "nstemi", ad: "Non-ST Elevasyonlu MI (NSTEMI)" },
  { key: "otitis-media", ad: "Akut Otitis Media" },
  { key: "periferik-arter", ad: "Periferik Arter Hastalığı" },
  { key: "pilor-stenozu", ad: "Hipertrofik Pilor Stenozu" },
  { key: "plevral-efuzyon", ad: "Plevral Efüzyon" },
  { key: "pnomotoraks", ad: "Spontan Pnömotoraks" },
  { key: "pnömoni", ad: "Toplum Kazanılmış Pnömoni" },
  { key: "preeklampsi", ad: "Preeklampsi" },
  { key: "prostat-ca", ad: "Prostat Kanseri" },
  { key: "stabil-angina", ad: "Stabil Angina" },
  { key: "stemi", ad: "ST Elevasyonlu MI" },
  { key: "subdural-hematom", ad: "Kronik Subdural Hematom" },
  { key: "tbc", ad: "Akciğer Tüberkülozu" },
  { key: "tip2-dm", ad: "Tip 2 Diyabet" },
  { key: "trombositopeni", ad: "İmmün Trombositopeni" },
  { key: "urolitiazis", ad: "Ürolitiazis" },
  { key: "varis", ad: "Kronik Venöz Yetmezlik (Varis)" },
  { key: "yanik", ad: "2. Derece Yanık" },
];

const POLIKLINIK_AD = new Map(POLIKLINIKLER.map((p) => [p.key, p.ad]));
const HASTALIK_AD = new Map(HASTALIKLAR.map((h) => [h.key, h.ad]));

interface CemicegekForm {
  kalabaliklik: Kalabaliklik;
  geriDonusMin: number;
  geriDonusMax: number;
  aktifPoliklinikler: string[];
  aktifHastaliklar: string[];
}

const DEFAULT_FORM: CemicegekForm = {
  kalabaliklik: "orta",
  geriDonusMin: 2,
  geriDonusMax: 3,
  aktifPoliklinikler: [],
  aktifHastaliklar: [],
};

function TagInput({
  secili,
  tümü,
  onToggle,
  onEkle,
  onCikar,
  bosMetin,
  listeId,
}: {
  secili: string[];
  tümü: { key: string; ad: string; icon?: string }[];
  onToggle: (key: string) => void;
  onEkle: (key: string) => void;
  onCikar: (key: string) => void;
  bosMetin: string;
  listeId: string;
}) {
  const [draft, setDraft] = useState("");
  const [acik, setAcik] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtreli = useMemo(() => {
    const q = draft.trim().toLocaleLowerCase("tr");
    return tümü.filter((p) => !secili.includes(p.key) && (!q || p.ad.toLocaleLowerCase("tr").includes(q)));
  }, [tümü, secili, draft]);

  function keyBasildi(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = draft.trim();
      if (!q) return;
      onEkle(q);
      setDraft("");
      setAcik(false);
    } else if (e.key === "Backspace" && !draft && secili.length > 0) {
      onCikar(secili[secili.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-hairline bg-white px-2 py-1.5 focus-within:border-brand">
        {secili.map((key) => (
          <span key={key} className="inline-flex items-center gap-1 rounded-md bg-surface-soft px-2 py-1 text-xs font-medium text-ink">
            {tümü.find((p) => p.key === key)?.icon && (
              <span>{tümü.find((p) => p.key === key)!.icon}</span>
            )}
            {tümü.find((p) => p.key === key)?.ad || key}
            <button
              type="button"
              aria-label={`${key} kaldır`}
              onClick={() => onCikar(key)}
              className="text-muted transition-colors hover:text-clinical-red"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
          placeholder={secili.length === 0 ? bosMetin : "Ekle…"}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setAcik(true);
          }}
          onFocus={() => setAcik(true)}
          onBlur={() => setTimeout(() => setAcik(false), 120)}
          onKeyDown={keyBasildi}
          role="combobox"
          aria-expanded={acik}
          aria-controls={listeId}
          aria-autocomplete="list"
        />
      </div>

      {acik && filtreli.length > 0 && (
        <ul id={listeId} className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-hairline bg-white shadow-lg">
          {filtreli.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-soft"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onToggle(p.key);
                  setDraft("");
                  inputRef.current?.focus();
                }}
              >
                {p.icon && <span>{p.icon}</span>}
                <span>{p.ad}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {secili.length === 0 && filtreli.length === 0 && (
        <p className="mt-1 text-[11px] text-muted">{bosMetin === "Hepsi seçili" ? "Tümü aktif" : "Boş bırakılırsa tümü aktif olur."}</p>
      )}
    </div>
  );
}

export default function AdminAyarlarPage() {
  const [sekme, setSekme] = useState<"simulasyon" | "ai" | "hizli">("simulasyon");
  const [form, setForm] = useState<CemicegekForm>(DEFAULT_FORM);
  const [baslangic, setBaslangic] = useState<CemicegekForm>(DEFAULT_FORM);
  const [aiEslestirme, setAiEslestirme] = useState(false);
  const [baslangicAi, setBaslangicAi] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const dirty = useMemo(
    () => !yukleniyor && (JSON.stringify(form) !== JSON.stringify(baslangic) || aiEslestirme !== baslangicAi),
    [form, baslangic, aiEslestirme, baslangicAi, yukleniyor]
  );

  const minMaxGecersiz = form.geriDonusMin > form.geriDonusMax;

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const c = d.settings?.cemicegek;
        const deger = c
          ? {
              kalabaliklik: (c.kalabaliklik || "orta") as Kalabaliklik,
              geriDonusMin: c.geriDonusMin ?? 2,
              geriDonusMax: c.geriDonusMax ?? 3,
              aktifPoliklinikler: Array.isArray(c.aktifPoliklinikler) ? c.aktifPoliklinikler : [],
              aktifHastaliklar: Array.isArray(c.aktifHastaliklar) ? c.aktifHastaliklar : [],
            }
          : DEFAULT_FORM;
        setForm(deger);
        setBaslangic(deger);
        setAiEslestirme(d.settings?.ai?.eslestirme === true);
        setBaslangicAi(d.settings?.ai?.eslestirme === true);
        setYukleniyor(false);
      })
      .catch(() => setYukleniyor(false));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function kaydet(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (minMaxGecersiz) {
      setErr("Geri dönüş minimum değeri maksimumdan büyük olamaz.");
      return;
    }
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cemicegek: {
          kalabaliklik: form.kalabaliklik,
          geriDonusMin: form.geriDonusMin,
          geriDonusMax: form.geriDonusMax,
          aktifPoliklinikler: form.aktifPoliklinikler,
          aktifHastaliklar: form.aktifHastaliklar,
        },
        ai: { eslestirme: aiEslestirme },
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErr(d.error || "Kayıt hatası");
      return;
    }
    const kaydedilen = d.settings?.cemicegek;
    const yeniForm = kaydedilen
      ? {
          kalabaliklik: kaydedilen.kalabaliklik,
          geriDonusMin: kaydedilen.geriDonusMin,
          geriDonusMax: kaydedilen.geriDonusMax,
          aktifPoliklinikler: kaydedilen.aktifPoliklinikler || [],
          aktifHastaliklar: kaydedilen.aktifHastaliklar || [],
        }
      : form;
    setForm(yeniForm);
    setBaslangic(yeniForm);
    setBaslangicAi(d.settings?.ai?.eslestirme === true);
    setMsg("✓ Ayarlar kaydedildi. Yeni oturumlar bu ayarlarla başlayacak.");
  }

  function sifirla() {
    setForm(DEFAULT_FORM);
    setMsg("");
    setErr("");
  }

  function disaAktar() {
    const blob = new Blob(
      [JSON.stringify({ cemicegek: form, ai: { eslestirme: aiEslestirme } }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tip-ai-ayarlar-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const navItems = [
    { id: "simulasyon" as const, label: "Simülasyon Akışı" },
    { id: "ai" as const, label: "AI Servisi" },
    { id: "hizli" as const, label: "Hızlı Bakış" },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sistem Ayarları</h1>
      <p className="mt-1 text-sm text-steel">Simülasyon akışı ve AI servis parametreleri.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Ayarlar bölümleri" className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSekme(item.id)}
              aria-current={sekme === item.id ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                sekme === item.id ? "bg-surface-soft text-brand-deep" : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {item.label}
              {item.id === "simulasyon" && dirty && <span aria-hidden="true" className="ml-2 inline-block h-2 w-2 rounded-full bg-clinical-orange align-middle" />}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {yukleniyor ? (
            <div className="space-y-3" aria-busy="true" aria-label="Ayarlar yükleniyor">
              <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-soft" />
              <div className="h-40 animate-pulse rounded-xl border border-hairline bg-canvas" />
            </div>
          ) : (
            <>
              {sekme === "simulasyon" && (
                <form onSubmit={kaydet} className="space-y-4 rounded-xl border border-hairline bg-canvas p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-ink">Simülasyon Akışı</h2>
                      <p className="mt-0.5 text-xs text-muted">Bekleme odası ve laboratuvar akışı.</p>
                    </div>
                    {dirty && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-clinical-orange/10 px-2.5 py-1 text-[11px] font-medium text-clinical-orange">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clinical-orange" />
                        Kaydedilmemiş değişiklik
                      </span>
                    )}
                  </div>

                  <fieldset>
                    <legend className="text-xs font-medium text-muted">Bekleme odası kalabalıklığı</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {KALABALIKLIK_SECENEKLERI.map((opt) => (
                        <label
                          key={opt.deger}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                            form.kalabaliklik === opt.deger
                              ? "border-brand bg-surface-soft"
                              : "border-hairline bg-white hover:border-brand"
                          }`}
                        >
                          <input
                            type="radio"
                            name="kalabaliklik"
                            value={opt.deger}
                            checked={form.kalabaliklik === opt.deger}
                            onChange={() => setForm({ ...form, kalabaliklik: opt.deger })}
                            className="mt-0.5 accent-brand"
                          />
                          <span>
                            <span className="block text-sm font-medium text-ink">{opt.ad}</span>
                            <span className="block text-xs text-muted">{opt.aciklama}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted">Bekleme odasında aynı anda bekleyen hasta sayısını belirler.</p>
                  </fieldset>

                  <div>
                    <label className="text-xs font-medium text-muted">Laboratuvar geri dönüş süresi</label>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          min={1}
                          aria-label="Geri dönüş minimum hasta"
                          className={`input w-full ${minMaxGecersiz ? "border-clinical-red" : ""}`}
                          value={form.geriDonusMin}
                          onChange={(e) => setForm({ ...form, geriDonusMin: Math.max(1, Number(e.target.value) || 1) })}
                        />
                        <p className="mt-1 text-[11px] text-muted">Min (hasta)</p>
                      </div>
                      <span className="text-sm text-muted">–</span>
                      <div className="flex-1">
                        <input
                          type="number"
                          min={1}
                          aria-label="Geri dönüş maksimum hasta"
                          className={`input w-full ${minMaxGecersiz ? "border-clinical-red" : ""}`}
                          value={form.geriDonusMax}
                          onChange={(e) => setForm({ ...form, geriDonusMax: Math.max(1, Number(e.target.value) || 1) })}
                        />
                        <p className="mt-1 text-[11px] text-muted">Max (hasta)</p>
                      </div>
                    </div>
                    {minMaxGecersiz ? (
                      <p className="mt-2 text-[11px] font-medium text-clinical-red">
                        Min değer maksimumdan büyük olamaz. Örnek: 2-3 arası → 2. veya 3. hastadan sonra döner.
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted">
                        Hasta lab&apos;a gittikten sonra kaç hasta arayla döneceğini belirler. Örnek: 2-3 arası → 2. veya 3. hastadan sonra döner.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted">Aktif poliklinikler</label>
                    <div className="mt-2">
                      <TagInput
                        secili={form.aktifPoliklinikler}
                        tümü={POLIKLINIKLER}
                        onToggle={(key) =>
                          setForm({
                            ...form,
                            aktifPoliklinikler: form.aktifPoliklinikler.includes(key)
                              ? form.aktifPoliklinikler.filter((k) => k !== key)
                              : [...form.aktifPoliklinikler, key],
                          })
                        }
                        onEkle={(key) => {
                          if (!form.aktifPoliklinikler.includes(key)) {
                            setForm({ ...form, aktifPoliklinikler: [...form.aktifPoliklinikler, key] });
                          }
                        }}
                        onCikar={(key) => setForm({ ...form, aktifPoliklinikler: form.aktifPoliklinikler.filter((k) => k !== key) })}
                        bosMetin="Hepsi seçili"
                        listeId="poliklinik-onerileri"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">
                      {form.aktifPoliklinikler.length === 0
                        ? "Tüm poliklinikler aktif. Boş bırakmak = tümü."
                        : `${form.aktifPoliklinikler.length} / ${POLIKLINIKLER.length} poliklinik aktif.`}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted">Aktif hastalıklar (opsiyonel)</label>
                    <div className="mt-2">
                      <TagInput
                        secili={form.aktifHastaliklar}
                        tümü={HASTALIKLAR}
                        onToggle={(key) =>
                          setForm({
                            ...form,
                            aktifHastaliklar: form.aktifHastaliklar.includes(key)
                              ? form.aktifHastaliklar.filter((k) => k !== key)
                              : [...form.aktifHastaliklar, key],
                          })
                        }
                        onEkle={(key) => {
                          if (!form.aktifHastaliklar.includes(key)) {
                            setForm({ ...form, aktifHastaliklar: [...form.aktifHastaliklar, key] });
                          }
                        }}
                        onCikar={(key) => setForm({ ...form, aktifHastaliklar: form.aktifHastaliklar.filter((k) => k !== key) })}
                        bosMetin="Tümü seçili"
                        listeId="hastalik-onerileri"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">
                      {form.aktifHastaliklar.length === 0
                        ? "Tüm hastalıklar aktif."
                        : `${form.aktifHastaliklar.length} / ${HASTALIKLAR.length} hastalık aktif.`}
                    </p>
                  </div>

                  {msg && <p className="rounded-lg bg-brand-deep/5 px-3 py-2 text-sm text-brand-deep">{msg}</p>}
                  {err && <p className="rounded-lg bg-clinical-red/5 px-3 py-2 text-sm text-clinical-red">{err}</p>}

                  <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                    <button type="submit" className="btn-primary text-sm">
                      Kaydet
                    </button>
                    <button type="button" onClick={sifirla} className="btn-secondary text-sm">
                      Varsayılana Sıfırla
                    </button>
                    <button type="button" onClick={disaAktar} className="btn-secondary text-sm">
                      JSON dışa aktar
                    </button>
                    <span className="ml-auto text-[11px] text-muted">
                      <Link href="/admin/panel/logs" className="text-brand-deep underline-offset-2 hover:underline">
                        Değişiklik geçmişi →
                      </Link>
                    </span>
                  </div>
                </form>
              )}

              {sekme === "ai" && (
                <form onSubmit={kaydet} className="space-y-4 rounded-xl border border-hairline bg-canvas p-5">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">AI Servisi</h2>
                    <p className="mt-0.5 text-xs text-muted">Serbest metin soru eşleştirme ayarları.</p>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-white p-3 transition-colors hover:border-brand">
                    <input
                      type="checkbox"
                      checked={aiEslestirme}
                      onChange={(e) => setAiEslestirme(e.target.checked)}
                      className="mt-0.5 accent-brand"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">Serbest metin sorularını AI ile eşleştir</span>
                      <span className="block text-xs text-muted">
                        Öğrenci serbest metin yazdığında soru chip&apos;lerine AI (DeepSeek) ile eşlenir. Kapalıysa metin doğrudan değerlendirilir.
                      </span>
                    </span>
                  </label>

                  {msg && <p className="rounded-lg bg-brand-deep/5 px-3 py-2 text-sm text-brand-deep">{msg}</p>}
                  {err && <p className="rounded-lg bg-clinical-red/5 px-3 py-2 text-sm text-clinical-red">{err}</p>}

                  <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                    <button type="submit" className="btn-primary text-sm">
                      Kaydet
                    </button>
                    {dirty && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-clinical-orange">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clinical-orange" />
                        Kaydedilmemiş değişiklik
                      </span>
                    )}
                  </div>
                </form>
              )}

              {sekme === "hizli" && (
                <section aria-label="Yönetim kısayolları" className="grid gap-3 sm:grid-cols-2">
                  <Link href="/admin/panel/tibbi-goruntuler" className="rounded-xl border border-hairline bg-canvas p-4 transition-colors hover:border-brand hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <h3 className="text-sm font-semibold text-ink">Tıbbi Görüntüler</h3>
                    <p className="mt-1 text-xs leading-5 text-steel">Eşleşmiş radyoloji görüntülerini, bulgu etiketlerini ve bağlı vakaları incele.</p>
                    <span className="mt-3 inline-flex text-xs font-medium text-brand-deep">Yönet →</span>
                  </Link>
                  <Link href="/admin/panel/test-durumu" className="rounded-xl border border-hairline bg-canvas p-4 transition-colors hover:border-brand hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <h3 className="text-sm font-semibold text-ink">Test Durumu</h3>
                    <p className="mt-1 text-xs leading-5 text-steel">Vaka test kapsamını ve eksik sonuçları kontrol et.</p>
                    <span className="mt-3 inline-flex text-xs font-medium text-brand-deep">Kontrol et →</span>
                  </Link>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}