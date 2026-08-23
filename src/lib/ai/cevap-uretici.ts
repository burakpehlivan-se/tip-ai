/**
 * AI cevap üretici — AdminVaka profilinden tüm chip yanıtlarını üretir.
 *
 * Akış:
 *   1. AdminVaka → metin profil
 *   2. Chip havuzu gruplara bölünür (truncation koruması)
 *   3. Her grup için Gemini'ye tek seferde JSON istenç gönderilir
 *   4. Eksik anahtarlar ikinci bir tamamlama turuyla doldurulur
 *   5. Varsayılan negatif yanıtlarla birleştirilir, vitaller garantilenir
 *   6. Güvenlik kontrolünden geçirilir
 */

import { AdminVaka, HastaTipi } from "@/lib/admin/types";
import { SoruChipi } from "@/lib/types";
import { CHIP_HAVUZU } from "@/lib/data/case-generator";
import { buildDefaultYanitlar } from "@/lib/data/hasta-yanit-enrich";
import { geminiChat, geminiYapilandirilmisMi, jsonCikar } from "./gemini";
import { KISILIK_TIPLERI, KisilikTipiKey } from "./kisilik-tipleri";
import { hastaDilineCevir, yuksekTibbiTerimVarMi } from "./hasta-dili";
import { auditSyntheaClinicalHistoryAccess, getSyntheaClinicalHistory } from "@/lib/clinical-history/synthea-history";
import type { ClinicalHistory } from "@/lib/clinical-history/types";

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
  /** Geçmiş erişiminin denetlenmesi için yalnızca sunucuda kullanılan aktör. */
  actor?: string;
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

function testleriPromptIcinHazirla(testler: Record<string, AdminVaka["statikTestler"][string]>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(testler).map(([key, test]) => [key, {
    ad: test.testAdi,
    tip: test.tip,
    sonuc: test.sonuc,
    birim: test.birim,
    referans: test.referansAralik || test.referans,
    yorum: test.yorum,
  }]));
}

function gecmisPromptIcinHazirla(history: ClinicalHistory | null): Record<string, unknown> | undefined {
  if (!history) return undefined;
  return {
    zamanCizelgesi: history.timeline,
    alerjiler: history.allergies,
    asilar: history.immunizations,
    laboratuvarEgilimleri: history.labTrends,
  };
}

/** Kimliksiz vaka bağlamı; isim, adres, telefon, kaynak hasta kimliği veya ham FHIR gövdesi içermez. */
export function profilJson(vaka: AdminVaka, tip?: HastaTipi, history: ClinicalHistory | null = null): Record<string, unknown> {
  const tumTestler = { ...vaka.statikTestler, ...(vaka.generatedTests || {}), ...(vaka.testOverrides || {}) };
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
      tedavi: {
        aciklama: vaka.tedavi?.aciklama,
        ilaclar: vaka.tedavi?.ilaclar || [],
        prosedurler: vaka.tedavi?.prosedurler || [],
        notlar: vaka.tedavi?.onemliNotlar || [],
      },
      testSonuclari: testleriPromptIcinHazirla(tumTestler),
      dahaOnceKaydedilmisHastaYanitlari: vaka.hastaYanitlari || {},
      idealIzlemYolu: vaka.idealYol || [],
      egitimNotu: vaka.egitimNotu,
      beklenenSorular: (vaka.rubric?.beklenenSorular || []).map((s) => ({
        key: s.key,
        etiket: s.etiket,
        aciklama: s.aciklama,
      })),
      beklenenTestler: (vaka.rubric?.beklenenTestler || []).map((t) => t.etiket),
      gereksizTestler: (vaka.rubric?.gereksizTestler || []).map((t) => t.etiket),
      redFlagler: (vaka.rubric?.redFlagler || []).map((r) => r.etiket),
      klinikGecmis: gecmisPromptIcinHazirla(history),
    },
    hastaTipi: tip
      ? {
          ad: tip.ad,
          aciklama: tip.aciklama,
          yasAraligi: tip.yasAraligi,
          cinsiyetTercih: tip.cinsiyetTercih,
          komorbiditeler: tip.komorbiditeler || [],
          kisilikTipi: tip.kisilikTipi,
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
  const kisilik = kisilikKey ? KISILIK_TIPLERI[kisilikKey] : undefined;
  if (tip && (tip.konusmaKurallari || tip.konusmaOrnekleri)) {
    return {
      ad: kisilik ? `${tip.ad} · ${kisilik.ad}` : tip.ad,
      aciklama: [tip.aciklama, kisilik?.aciklama].filter(Boolean).join("\n"),
      kurallar: [kisilik?.konusmaKurallari, tip.konusmaKurallari].filter(Boolean).join("\n"),
      ornekler: tip.konusmaOrnekleri || kisilik?.ornekCevaplar,
      cumleler: tip.ornekCumleler,
    };
  }
  if (kisilik) {
    return { ad: kisilik.ad, aciklama: kisilik.aciklama, kurallar: kisilik.konusmaKurallari, ornekler: kisilik.ornekCevaplar };
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
1. HASTA GİBİ KONUŞ: Yalnızca gündelik Türkçe kullan. Tanı, işlem, test, laboratuvar, kod, kısaltma veya yüksek tıbbi terim kullanma. "Dispne" değil "nefes darlığı", "hipertansiyon" değil "yüksek tansiyon", "diyabet" değil "şeker hastalığı" de.
2. TIBBİ AD SORULURSA: Hastanın tıbbi adı bilmediğini söyle; bildiği günlük belirtiyi veya doktorun sade biçimde anlattığını ifade et. Örneğin "Kalp damarlarımla ilgili bir sorun olduğu söylenmişti, tam adını bilmiyorum." de.
3. TUTARLI OL: Profilde var olan semptomlar için pozitif, olmayanlar için negatif cevap ver. Belirsiz olanlar için "bilmiyorum" tarzında. Profilden bilgiyi kendiliğinden sıralama; yalnızca sorulan bilgiyi ver.
4. HASTALIK + HASTA TİPİ: Hastalığın yaş/cinsiyet beklentisiyle hasta tipinin yaş/cinsiyetini birlikte değerlendir; çelişki varsa hastalık bilgisi önceliklidir.
5. ANA ŞİKAYET AĞRI İSE: Genel ağrı sorularını ana şikayete göre, spesifik bölge sorularını o bölgede ağrı yoksa "yok" diyerek cevapla.
6. VİTAL BULGULAR: Sorulunca yukarıdaki değeri sade biçimde söyle; referans aralığı veya test yorumu yapma.
7. Her cevap 1-3 cümle olsun.

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

/** Bir grup için tek Gemini çağrısı → cevap haritası + debug izi */
async function grupUret(
  profilJsonStr: string,
  index: number,
  chips: SoruChipi[],
  konusma: KonusmaProfili
): Promise<{ cevaplar: Record<string, string>; debug: GrupDebug }> {
  const prompt = `${promptBasligi(profilJsonStr, konusma)}\n\nSORULAR:\n${soruListesiMetni(chips)}`;

  try {
    const yanit = await geminiChat({
      messages: [
        { role: "system", content: "Sen JSON formatında hasta cevapları üreten bir sistemsin." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 16000,
    });

    const hamYanit = yanit.content;
    const parsed = jsonCikar(hamYanit) as { cevaplar?: Record<string, unknown> } | null;
    const debug: GrupDebug = { index, chipSayisi: chips.length, prompt, hamYanit };
    if (!parsed) return { cevaplar: {}, debug };

    const kaynak = parsed.cevaplar && typeof parsed.cevaplar === "object" ? parsed.cevaplar : (parsed as Record<string, unknown>);
    const cikti: Record<string, string> = {};
    for (const [k, v] of Object.entries(kaynak)) {
      if (typeof v === "string" && v.trim()) cikti[k] = hastaDilineCevir(v);
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
  // Klinik geçmiş yalnızca yönetici tarafından başlatılan üretimde okunur ve
  // de-kimliklendirilmiş projeksiyon halinde harici modele gider. Kaynak hasta
  // kimliği/iletişim bilgisi veya ham FHIR hiçbir koşulda prompta eklenmez.
  let history: ClinicalHistory | null = null;
  if (secenekler.actor) {
    try {
      history = await getSyntheaClinicalHistory(vaka.id);
      if (history) await auditSyntheaClinicalHistoryAccess(vaka.id, secenekler.actor);
    } catch {
      // Geçmiş bağlamı eklenemese de vaka yanıtı üretimi çalışmaya devam eder.
      history = null;
    }
  }
  const profil = JSON.stringify(profilJson(vaka, secenekler.hastaTipi, history), null, 2);

  if (!geminiYapilandirilmisMi()) {
    return {
      basarili: false,
      cevaplar: {},
      rapor: {
        toplamSoru: CHIP_HAVUZU.length,
        cevaplananSoru: 0,
        eksikSoru: CHIP_HAVUZU.map((c) => c.aksiyon),
        uyarilar: ["GEMINI_API_KEY tanımlı değil. Sunucu ortamında ortam değişkenini tanımlayıp uygulamayı yeniden başlatın."],
      },
      debug: { profil, gruplar: [] },
    };
  }

  const konusma = konusmaProfili(
    secenekler.hastaTipi,
    secenekler.hastaTipi?.kisilikTipi || (secenekler.kisilik ? secenekler.kisilikTipi || "sakin" : undefined)
  );
  const anahtarlar = chipKeyKumesi();
  const gruplar = chipGruplari(CHIP_HAVUZU);

  const cevaplar: Record<string, string> = {};
  const debugGruplar: GrupDebug[] = [];

  // Sıralı üretim — büyük vaka üretimlerinde kota ve zaman aşımı riskini sınırlar.
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
  const birlestirilmis = Object.fromEntries(
    Object.entries({ ...buildDefaultYanitlar(CHIP_HAVUZU), ...cevaplar, ...vitalsHaritasi(vaka) })
      .map(([key, value]) => [key, hastaDilineCevir(value)])
  );
  if (!birlestirilmis.OZEL) {
    birlestirilmis.OZEL = "Bunu tam anlayamadım; başka şekilde sorabilir misiniz?";
  }

  // ── Tutarlılık katmanı: önce yerel ağrı kuralı, sonra Gemini denetimi ──
  const yerelOnarim = agriTutarliliginiZorla(birlestirilmis, vaka);
  for (const [k, v] of Object.entries(yerelOnarim.duzeltmeler)) {
    birlestirilmis[k] = v;
  }
  const aiDenetim = await tutarliligiDenetleVeOnar(birlestirilmis, vaka);
  for (const [k, v] of Object.entries(aiDenetim.duzeltmeler)) {
    if (birlestirilmis[k] !== v) birlestirilmis[k] = v;
  }

  const eksikSoru = CHIP_HAVUZU.filter((c) => !birlestirilmis[c.aksiyon]).map((c) => c.aksiyon);
  const uyarilar = guvenlikKontrolu(birlestirilmis, vaka);
  for (const key of yerelOnarim.onarilan) {
    uyarilar.push(`${key}: ana şikayetle çelişti — yerel kural ile düzeltildi.`);
  }
  for (const key of aiDenetim.sorunluKeys) {
    uyarilar.push(`${key}: Gemini tutarlılık denetimi düzeltti.`);
  }
  for (const [key, value] of Object.entries(birlestirilmis)) {
    if (yuksekTibbiTerimVarMi(value)) uyarilar.push(`${key}: yüksek tıbbi terim filtresinden geçemedi.`);
  }

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

/** Ana şikayette ağrı/baskı varken negatif ağrı yanıtını yerel kuralla düzeltir. */
function agriTutarliliginiZorla(
  cevaplar: Record<string, string>,
  vaka: AdminVaka
): { duzeltmeler: Record<string, string>; onarilan: string[] } {
  const anaSikayet = (vaka.anaSikayet || "").toLocaleLowerCase("tr");
  const agriVarMi = /ağr|agri|ağrı|baskı|basi/.test(anaSikayet);
  if (!agriVarMi) return { duzeltmeler: {}, onarilan: [] };

  const duzeltmeler: Record<string, string> = {};
  const onarilan: string[] = [];
  const negatifKalip =
    /ağrım yok|ağrı yok|agrim yok|agri yok|hiç ağrım|belirgin bir ağrı yok|şu an ağrım/i;

  for (const key of ["AGRI_YER", "AGRI_NITELIK", "AGRI_SURE", "AGRI_BASLANGIC", "AGRI_ARTIRAN", "AGRI_AZALTAN", "AGRI_YAYILIM"]) {
    const cevap = cevaplar[key];
    if (!cevap || !negatifKalip.test(cevap)) continue;
    // Ana şikayeti referans veren nötr-pozitif bir yanıtla değiştir; bölge bilgisi uydurma.
    duzeltmeler[key] =
      key === "AGRI_YER"
        ? "Evet, asıl şikâyetim olduğu yerde ağrım var; tam nerede olduğunu tarif etmekte zorlanıyorum."
        : "Ağrıyla ilgili soruyorsanız, evet — başta bahsettiğim şikâyetim yüzünden bu konuda da rahatsızlığım var.";
    onarilan.push(key);
  }
  return { duzeltmeler, onarilan };
}

/**
 * Gemini tutarlılık denetimi: üretilen tüm yanıtları ana şikayet + profile karşı
 * kontrol eder; çelişenleri tek turda düzeltir. Anahtar yoksa/hata olursa no-op.
 */
async function tutarliligiDenetleVeOnar(
  cevaplar: Record<string, string>,
  vaka: AdminVaka
): Promise<{ duzeltmeler: Record<string, string>; sorunluKeys: string[] }> {
  if (!geminiYapilandirilmisMi()) return { duzeltmeler: {}, sorunluKeys: [] };

  const satirlar = Object.entries(cevaplar)
    .map(([key, cevap]) => `- ${key}: ${cevap.replace(/\n+/g, " ")}`)
    .join("\n");

  const prompt = `Aşağıda bir tıp eğitimi simülasyonundaki sentetik hastanın ana şikayeti ve hazır sorulara verdiği yanıtlar var.
GÖREV: Yalnızca ANA ŞİKAYETLE veya hasta profiliyle ÇELİŞEN yanıtları bul ve düzelt.
Örnek çelişki: ana şikayet "göğüs ağrısı" iken ağrı sorusuna "ağrım yok" denmesi.
Tutarlı yanıtlara DOKUNMA. Bölge/değer UYDURMA; çelişkiyi gideren nötr bir ifade yaz ("tam tarif edemiyorum" gibi).

ANA ŞİKAYET: ${vaka.anaSikayet || "—"}
SEMPTEM ŞABLONU: ${vaka.semptomSablon || "—"}

YANITLAR:
${satirlar}

SADECE şu JSON formatında döndür:
{
  "duzeltmeler": { "CHIP_KEY": "düzeltilmiş cevap" },
  "sorunluKeys": ["CHIP_KEY", ...]
}
Çelişki yoksa boş nesne/liste döndür.`;

  try {
    const yanit = await geminiChat({
      messages: [
        { role: "system", content: "Sen tıp eğitimi senaryolarında tutarlılık denetleyicisisin. Sadece JSON döndür." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 8000,
    });
    const parsed = jsonCikar(yanit.content) as
      | { duzeltmeler?: Record<string, unknown>; sorunluKeys?: unknown }
      | null;
    if (!parsed) return { duzeltmeler: {}, sorunluKeys: [] };

    const anahtarlar = chipKeyKumesi();
    const duzeltmeler: Record<string, string> = {};
    const kaynak = parsed.duzeltmeler && typeof parsed.duzeltmeler === "object" ? parsed.duzeltmeler : {};
    for (const [k, v] of Object.entries(kaynak)) {
      if (anahtarlar.has(k) && typeof v === "string" && v.trim()) {
        duzeltmeler[k] = hastaDilineCevir(v);
      }
    }
    const sorunluKeys = Array.isArray(parsed.sorunluKeys)
      ? parsed.sorunluKeys.filter((k): k is string => typeof k === "string")
      : Object.keys(duzeltmeler);
    return { duzeltmeler, sorunluKeys };
  } catch {
    return { duzeltmeler: {}, sorunluKeys: [] };
  }
}
