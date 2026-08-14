/**
 * AI cevap üretici — AdminVaka profilinden tüm chip yanıtlarını üretir.
 *
 * Akış:
 *   1. AdminVaka → metin profil
 *   2. Chip havuzu gruplara bölünür (truncation koruması)
 *   3. Her grup için DeepSeek'e tek seferde JSON istenç gönderilir
 *   4. Eksik anahtarlar ikinci bir tamamlama turuyla doldurulur
 *   5. Varsayılan negatif yanıtlarla birleştirilir, vitaller garantilenir
 *   6. Güvenlik kontrolünden geçirilir
 */

import { AdminVaka, HastaTipi } from "@/lib/admin/types";
import { SoruChipi } from "@/lib/types";
import { CHIP_HAVUZU } from "@/lib/data/case-generator";
import { buildDefaultYanitlar } from "@/lib/data/hasta-yanit-enrich";
import { deepseekChat, deepseekYapilandirilmisMi, jsonCikar } from "./deepseek";
import { KISILIK_TIPLERI, KisilikTipiKey } from "./kisilik-tipleri";

export interface UretimRaporu {
  toplamSoru: number;
  cevaplananSoru: number;
  eksikSoru: string[];
  uyarilar: string[];
}

export interface GrupDebug {
  index: number;
  chipSayisi: number;
  /** AI'ya gönderilen tam prompt. */
  prompt: string;
  /** AI'dan dönen ham içerik (content veya reasoning). */
  hamYanit: string;
  hata?: string;
}

export interface UretimDebug {
  /** Vakadan türetilen metin profil (AI girdisi). */
  profil: string;
  /** Grup bazında prompt + ham yanıt izleri. */
  gruplar: GrupDebug[];
}

export interface CevapUretimSonucu {
  basarili: boolean;
  cevaplar: Record<string, string>;
  rapor: UretimRaporu;
  debug: UretimDebug;
}

export interface UretimSecenekleri {
  kisilik?: boolean;
  kisilikTipi?: KisilikTipiKey;
  /** Seçilirse hastanın kişiliği + demografisi bu tipten gelir. */
  hastaTipi?: HastaTipi;
}

const GRUP_BOYU = 45;
const MAX_TAMAMLAMA_TURU = 2;

const TIBBI_TERIMLER = [
  "miyokard", "dispne", "sefalji", "hemiparezi", "intrakraniyal",
  "subdural", "epidural", "trombositopeni", "hiperglisemi",
  "melena", "hematemez", "hematokezya", "polidipsi", "pnömoni",
];

function bosDegil(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** AdminVaka → vitals yanıt haritası (tutarlılık garantisi) */
function vitalsHaritasi(vaka: AdminVaka): Record<string, string> {
  const v = vaka.vitals || {};
  const y = vaka.hastaYanitlari || {};
  const out: Record<string, string> = {};
  const al = (key: string) => bosDegil(v[key as keyof typeof v]) || bosDegil(y[key]) || undefined;

  if (al("tansiyon")) out.VITAL_TANSIYON = al("tansiyon")!;
  if (al("nabiz")) out.VITAL_NABIZ = al("nabiz")!;
  if (al("ates")) out.VITAL_ATES = al("ates")!;
  if (al("spo2")) out.VITAL_SPO2 = al("spo2")!;
  if (al("solunum")) out.VITAL_SOLUNUM = al("solunum")!;
  if (bosDegil(y.VITAL_KILO)) out.VITAL_KILO = y.VITAL_KILO;
  if (bosDegil(y.VITAL_BOY)) out.VITAL_BOY = y.VITAL_BOY;
  return out;
}

/** AdminVaka → metin profil bloğu */
export function profilOlustur(vaka: AdminVaka): string {
  const satirlar: string[] = [];

  satirlar.push(`Hastalık: ${vaka.hastalikAdi}`);
  satirlar.push(`Yaş aralığı: ${vaka.yasAraligi?.[0] ?? "?"} - ${vaka.yasAraligi?.[1] ?? "?"}`);
  satirlar.push(
    `Cinsiyet: ${vaka.cinsiyetTercih === "E" ? "Erkek" : vaka.cinsiyetTercih === "K" ? "Kadın" : "Belirtilmemiş"}`
  );
  satirlar.push(`Ana şikayet: ${vaka.anaSikayet || "—"}`);

  if (vaka.ozetBilgiler?.length) {
    satirlar.push("Öykü / HPI:");
    for (const b of vaka.ozetBilgiler) satirlar.push(`- ${b}`);
  }
  if (bosDegil(vaka.semptomSablon)) {
    satirlar.push(`Semptom şablonu: ${vaka.semptomSablon}`);
  }

  const tanilar = (vaka.conditions || []).map((c) => c.ad).filter(Boolean);
  if (tanilar.length) satirlar.push(`Tanılar: ${tanilar.join(", ")}`);

  const komorbid = vaka.patientProfil?.komorbiditeler || [];
  if (komorbid.length) satirlar.push(`Komorbiditeler: ${komorbid.join(", ")}`);
  if (bosDegil(vaka.patientProfil?.sigara)) satirlar.push(`Sigara: ${vaka.patientProfil!.sigara}`);

  const ilaclar = (vaka.tedavi?.ilaclar || []).map((i) => `${i.ad}${i.doz ? " " + i.doz : ""}`).filter(Boolean);
  if (ilaclar.length) satirlar.push(`Kullandığı ilaçlar: ${ilaclar.join(", ")}`);

  const vitals = vitalsHaritasi(vaka);
  if (Object.keys(vitals).length) {
    satirlar.push("Vital bulgular:");
    if (vitals.VITAL_TANSIYON) satirlar.push(`- Tansiyon: ${vitals.VITAL_TANSIYON}`);
    if (vitals.VITAL_NABIZ) satirlar.push(`- Nabız: ${vitals.VITAL_NABIZ}`);
    if (vitals.VITAL_ATES) satirlar.push(`- Ateş: ${vitals.VITAL_ATES}`);
    if (vitals.VITAL_SPO2) satirlar.push(`- SpO2: ${vitals.VITAL_SPO2}`);
    if (vitals.VITAL_SOLUNUM) satirlar.push(`- Solunum: ${vitals.VITAL_SOLUNUM}`);
  }

  const beklenen = vaka.rubric?.beklenenSorular || [];
  if (beklenen.length) {
    satirlar.push("Muayenede beklenen (pozitif olabilecek) bulgular:");
    for (const s of beklenen) {
      satirlar.push(`- ${s.etiket}${s.aciklama ? ` (${s.aciklama})` : ""}`);
    }
  }

  return satirlar.join("\n");
}

/** AdminVaka + isteğe bağlı HastaTipi → tüm alanları içeren JSON profil (AI girdisi). */
export function profilJson(vaka: AdminVaka, tip?: HastaTipi): Record<string, unknown> {
  return {
    hastalik: {
      ad: vaka.hastalikAdi,
      anaSikayet: vaka.anaSikayet,
      ozetBilgiler: vaka.ozetBilgiler || [],
      semptomSablon: vaka.semptomSablon,
      yasAraligi: vaka.yasAraligi,
      cinsiyetTercih: vaka.cinsiyetTercih,
      tanilar: (vaka.conditions || []).map((c) => ({ code: c.code, ad: c.ad, primary: !!c.primary })),
      komorbiditeler: vaka.patientProfil?.komorbiditeler || [],
      sigara: vaka.patientProfil?.sigara,
      vitals: vaka.vitals || {},
      ilaclar: (vaka.tedavi?.ilaclar || []).map((i) => `${i.ad}${i.doz ? " " + i.doz : ""}`),
      beklenenSorular: (vaka.rubric?.beklenenSorular || []).map((s) => ({
        key: s.key,
        etiket: s.etiket,
        aciklama: s.aciklama,
      })),
      beklenenTestler: (vaka.rubric?.beklenenTestler || []).map((t) => t.etiket),
      gereksizTestler: (vaka.rubric?.gereksizTestler || []).map((t) => t.etiket),
      redFlagler: (vaka.rubric?.redFlagler || []).map((r) => r.etiket),
    },
    hastaTipi: tip
      ? {
          ad: tip.ad,
          aciklama: tip.aciklama,
          yasAraligi: tip.yasAraligi,
          cinsiyetTercih: tip.cinsiyetTercih,
          komorbiditeler: tip.komorbiditeler || [],
          konusmaKurallari: tip.konusmaKurallari,
          konusmaOrnekleri: tip.konusmaOrnekleri,
          ornekCumleler: tip.ornekCumleler,
        }
      : undefined,
  };
}

interface KonusmaProfili {
  ad?: string;
  aciklama?: string;
  kurallar?: string;
  ornekler?: { pozitif: string; negatif: string; belirsiz: string };
  cumleler?: string[];
}

/** Hasta tipi (öncelikli) veya kişilik anahtarından konuşma profili çıkarır. */
function konusmaProfili(tip?: HastaTipi, kisilikKey?: KisilikTipiKey): KonusmaProfili {
  if (tip && (tip.konusmaKurallari || tip.konusmaOrnekleri)) {
    return {
      ad: tip.ad,
      aciklama: tip.aciklama,
      kurallar: tip.konusmaKurallari,
      ornekler: tip.konusmaOrnekleri,
      cumleler: tip.ornekCumleler,
    };
  }
  if (kisilikKey) {
    const k = KISILIK_TIPLERI[kisilikKey];
    return { ad: k.ad, aciklama: k.aciklama, kurallar: k.konusmaKurallari, ornekler: k.ornekCevaplar };
  }
  return {};
}
function chipGruplari(chips: SoruChipi[]): SoruChipi[][] {
  const gruplar: SoruChipi[][] = [];
  for (let i = 0; i < chips.length; i += GRUP_BOYU) {
    gruplar.push(chips.slice(i, i + GRUP_BOYU));
  }
  return gruplar;
}

function promptBasligi(profilJsonStr: string, konusma: KonusmaProfili): string {
  let baslik = `Sen bir tıp eğitimi simülasyon sistemi için hasta cevapları üreten bir uzmansın.
Sana bir hasta profili (JSON) ve bir soru listesi vereceğim. Her soru için bu hastanın vereceği cevabı yazacaksın.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HASTA PROFİLİ (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profilJsonStr}
`;

  if (konusma.ad || konusma.kurallar || konusma.ornekler) {
    baslik += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KONUŞMA PROFİLİ: ${konusma.ad || "Hasta"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${konusma.aciklama || ""}
${konusma.kurallar ? `\nKonuşma kuralları:\n${konusma.kurallar}` : ""}
${konusma.ornekler ? `
Örnek cevaplar:
- Pozitif: "${konusma.ornekler.pozitif}"
- Negatif: "${konusma.ornekler.negatif}"
- Belirsiz: "${konusma.ornekler.belirsiz}"` : ""}
${konusma.cumleler?.length ? `\nEk örnek cümleler:\n${konusma.cumleler.map((c) => `- ${c}`).join("\n")}` : ""}
`;
  } else {
    baslik += `
KONUŞMA PROFİLİ: Doğal, sakin ve işbirlikçi bir hasta. Kısa, net cevaplar verir.
`;
  }

  baslik += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CEVAP KURALLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. HASTA GİBİ KONUŞ: Tıbbi terim kullanma. "Dispne" değil "nefes darlığı", "sefalji" değil "baş ağrısı". Halk dilinde konuş.
2. TUTARLI OL: Profilde var olan semptomlar için pozitif, olmayanlar için negatif cevap ver. Belirsiz olanlar için "bilmiyorum" tarzında.
3. HASTALIK + HASTA TİPİ: Hastalığın yaş/cinsiyet beklentisiyle hasta tipinin yaş/cinsiyetini birlikte değerlendir; çelişki varsa hastalık bilgisi önceliklidir.
4. ANA ŞİKAYET AĞRI İSE: Genel ağrı sorularını ana şikayete göre, spesifik bölge sorularını o bölgede ağrı yoksa "yok" diyerek cevapla.
5. VİTAL BULGULAR: Sorulunca yukarıdaki değerleri söyle, sadece sayıyı ver.
6. Her cevap 1-3 cümle olsun.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aşağıdaki her soru için cevabı JSON formatında döndür. Anahtarları (chip key) AYNI yaz.

{
  "cevaplar": {
    "CHIP_KEY": "Hasta cevabı burada",
    ...
  }
}

SADECE JSON döndür, başka açıklama yazma. Hiçbir soruyu atlama.`;
  return baslik;
}

function soruListesiMetni(chips: SoruChipi[]): string {
  return chips
    .map((c) => `- ${c.aksiyon}: "${c.etiket}" (kategori: ${c.kategori})`)
    .join("\n");
}

function chipKeyKumesi(): Set<string> {
  return new Set(CHIP_HAVUZU.map((c) => c.aksiyon));
}

/** Bir grup için tek DeepSeek çağrısı → cevap haritası + debug izi */
async function grupUret(
  profilJsonStr: string,
  index: number,
  chips: SoruChipi[],
  konusma: KonusmaProfili
): Promise<{ cevaplar: Record<string, string>; debug: GrupDebug }> {
  const prompt = `${promptBasligi(profilJsonStr, konusma)}\n\nSORULAR:\n${soruListesiMetni(chips)}`;

  try {
    const yanit = await deepseekChat({
      messages: [
        { role: "system", content: "Sen JSON formatında hasta cevapları üreten bir sistemsin." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 16000,
    });

    const hamYanit = yanit.content || yanit.reasoningContent || "";
    const parsed = jsonCikar(hamYanit) as { cevaplar?: Record<string, unknown> } | null;
    const debug: GrupDebug = { index, chipSayisi: chips.length, prompt, hamYanit };
    if (!parsed) return { cevaplar: {}, debug };

    const kaynak = parsed.cevaplar && typeof parsed.cevaplar === "object" ? parsed.cevaplar : (parsed as Record<string, unknown>);
    const cikti: Record<string, string> = {};
    for (const [k, v] of Object.entries(kaynak)) {
      if (typeof v === "string" && v.trim()) cikti[k] = v.trim();
    }
    return { cevaplar: cikti, debug };
  } catch (hata) {
    // Tek grubun hata vermesi tüm üretimi durdurmasın; eksikler tamamlama turunda doldurulur.
    return {
      cevaplar: {},
      debug: { index, chipSayisi: chips.length, prompt, hamYanit: "", hata: hata instanceof Error ? hata.message : String(hata) },
    };
  }
}
/** İlerleme olayı — SSE akışı ve CLI için ortak. */
export interface UretimIlerleme {
  tip: "grup" | "tamamla";
  tamamlanan: number;
  toplam: number;
}

/** Vaka profilinden tüm chip yanıtlarını üretir. */
export async function vakaCevaplariniUret(
  vaka: AdminVaka,
  secenekler: UretimSecenekleri = {},
  onProgress?: (ilerleme: UretimIlerleme) => void
): Promise<CevapUretimSonucu> {
  const profil = JSON.stringify(profilJson(vaka, secenekler.hastaTipi), null, 2);

  if (!deepseekYapilandirilmisMi()) {
    return {
      basarili: false,
      cevaplar: {},
      rapor: {
        toplamSoru: CHIP_HAVUZU.length,
        cevaplananSoru: 0,
        eksikSoru: CHIP_HAVUZU.map((c) => c.aksiyon),
        uyarilar: ["DEEPSEEK_API_KEY tanımlı değil. Sunucu ortamında .env/.env.local yüklenmediyse uygulamayı yeniden başlatın."],
      },
      debug: { profil, gruplar: [] },
    };
  }

  const konusma = konusmaProfili(
    secenekler.hastaTipi,
    secenekler.kisilik ? secenekler.kisilikTipi || "sakin" : undefined
  );
  const anahtarlar = chipKeyKumesi();
  const gruplar = chipGruplari(CHIP_HAVUZU);

  const cevaplar: Record<string, string> = {};
  const debugGruplar: GrupDebug[] = [];

  // Sıralı üretim — reasoning modeli eşzamanlı isteklerde sunucu tarafı yavaşlatılıyor.
  for (let i = 0; i < gruplar.length; i++) {
    const { cevaplar: uretilen, debug } = await grupUret(profil, i, gruplar[i], konusma);
    debugGruplar.push(debug);
    for (const [k, v] of Object.entries(uretilen)) {
      if (anahtarlar.has(k)) cevaplar[k] = v;
    }
    onProgress?.({ tip: "grup", tamamlanan: i + 1, toplam: gruplar.length });
  }

  // Eksikleri tamamlama turu
  for (let tur = 0; tur < MAX_TAMAMLAMA_TURU; tur++) {
    const eksik = CHIP_HAVUZU.filter((c) => !cevaplar[c.aksiyon]);
    if (eksik.length === 0) break;
    const { cevaplar: uretilen, debug } = await grupUret(profil, gruplar.length + tur, eksik, konusma);
    debugGruplar.push(debug);
    let kazanim = 0;
    for (const [k, v] of Object.entries(uretilen)) {
      if (anahtarlar.has(k) && !cevaplar[k]) {
        cevaplar[k] = v;
        kazanim += 1;
      }
    }
    onProgress?.({ tip: "tamamla", tamamlanan: tur + 1, toplam: MAX_TAMAMLAMA_TURU });
    if (kazanim === 0) break;
  }

  // Varsayılan negatif yanıtlarla birleştir + vitalleri garantile
  const birlestirilmis = { ...buildDefaultYanitlar(CHIP_HAVUZU), ...cevaplar, ...vitalsHaritasi(vaka) };
  if (!birlestirilmis.OZEL) {
    birlestirilmis.OZEL = "Bunu tam anlayamadım; başka şekilde sorabilir misiniz?";
  }

  const eksikSoru = CHIP_HAVUZU.filter((c) => !birlestirilmis[c.aksiyon]).map((c) => c.aksiyon);
  const uyarilar = guvenlikKontrolu(birlestirilmis, vaka);

  return {
    basarili: eksikSoru.length === 0,
    cevaplar: birlestirilmis,
    rapor: {
      toplamSoru: CHIP_HAVUZU.length,
      cevaplananSoru: CHIP_HAVUZU.length - eksikSoru.length,
      eksikSoru,
      uyarilar,
    },
    debug: { profil, gruplar: debugGruplar },
  };
}

function guvenlikKontrolu(cevaplar: Record<string, string>, vaka: AdminVaka): string[] {
  const uyarilar: string[] = [];

  for (const [chipKey, cevap] of Object.entries(cevaplar)) {
    const alt = cevap.toLowerCase();
    for (const terim of TIBBI_TERIMLER) {
      if (alt.includes(terim)) {
        uyarilar.push(`${chipKey}: tıbbi terim kullanılmış → "${terim}"`);
        break;
      }
    }
  }

  const anaSikayet = (vaka.anaSikayet || "").toLowerCase();
  if (anaSikayet.includes("ağrı") || anaSikayet.includes("agri") || anaSikayet.includes("baskı")) {
    const agriYer = (cevaplar.AGRI_YER || "").toLowerCase();
    if (agriYer && /ağrım yok|agrim yok|belirgin bir ağrı|ağrı yok/.test(agriYer)) {
      uyarilar.push("AGRI_YER: ana şikayette ağrı var ama yanıt negatif görünüyor.");
    }
  }

  return uyarilar;
}
