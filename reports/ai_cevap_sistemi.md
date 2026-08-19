

Anlıyorum. Kullanıcı şunu istiyor:

1. Sorular SABİT kalacak (108 chip + rubrik soruları)
2. AI sadece CEVAPLARI üretecek (hasta profiline göre)
3. Serbest metin girişi → AI en yakın chip sorusuna eşleştirecek → O sorunun cevabını gösterecek
4. Kişilik tipleri eklenebilecek (ileride)
5. Tamamen AI tabanlı DEĞİL, AI sadece arka planda çalışacak

Bu çok daha akıllıca bir yaklaşım. Statik yapıyı koruyarak AI'ı sadece veri üretimi ve eşleştirme için kullanmak.

# AI Destekli Cevap Üretim Sistemi

---

## Sistem Mantığı

```
MEVCUT SİSTEM (değişmiyor):
108 sabit soru chipi + rubrik soruları + test kataloğu + puanlama

AI'NIN ROLÜ (arka planda):
1. Hasta profilinden 108 chip'in cevaplarını üretir (bir kerelik)
2. Serbest metin → en yakın chip eşleştirmesi yapar
3. Kişilik tipine göre cevap tonunu ayarlar

ÖĞRENCİNİN GÖRDÜĞİ (aynı kalıyor):
Chip'e tıkla → cevap gelir
Serbest metin yaz → cevap gelir
```

---

## Akış Şeması

```
VAKA OLUŞTURULURKEN (bir kerelik, arka planda):

Hasta Profili + Kişilik Tipi
           ↓
    AI'ya gönderilir
           ↓
    108 chip cevabı üretilir
           ↓
    Güvenlik kontrolü
           ↓
    JSON olarak kaydedilir
           ↓
    Artık statik veri gibi çalışır


ÖĞRENCI KULLANIMDA:

Chip'e tıklar → Kaydedilmiş cevap gösterilir (AI çağrısı YOK)
                 ↓
Serbest metin yazar → AI eşleştirir → En yakın chip bulunur
                 ↓                     → O chip'in cevabı gösterilir
```

---

## 1. Hasta Profili (Basitleştirilmiş)

```typescript
// lib/types/hasta-profili.ts

export interface HastaProfili {
  // Kimlik
  ad: string;
  yas: number;
  cinsiyet: "E" | "K";
  meslek: string;

  // Klinik
  anaSikayet: string;
  hikaye: string;

  // Semptomlar
  mevcutSemptomlar: string[];
  olmayanSemptomlar: string[];

  // Özgeçmiş
  gecmisHastaliklar: string[];
  ilaclar: string[];
  alerjiler: string[];
  sigara: string;
  alkol: string;
  aileOykusu: string[];

  // Vital
  vitals: {
    tansiyon: string;
    nabiz: number;
    ates: number;
    spo2: number;
    solunum: number;
    kilo: number;
    boy: number;
  };

  // Fizik muayene
  fizikMuayene: Record<string, string>;

  // Kişilik
  kisilikTipi: KisilikTipi;
}

export interface KisilikTipi {
  tip: "sakin" | "endiselı" | "agresif" | "ketum" | "konuskan" | "dramatik";
  egitimDuzeyi: "dusuk" | "orta" | "yuksek";
  konusmaTarzi: string;
}
```

---

## 2. Kişilik Tipleri

```typescript
// lib/ai/kisilik-tipleri.ts

export const KISILIK_TIPLERI: Record<string, {
  ad: string;
  aciklama: string;
  konusmaKurallari: string;
  ornekCevaplar: {
    pozitif: string;
    negatif: string;
    belirsiz: string;
  };
}> = {

  sakin: {
    ad: "Sakin ve İşbirlikçi",
    aciklama: "Net, kısa cevaplar verir. Sorulanı cevaplar, fazla detay vermez.",
    konusmaKurallari: `
- Kısa ve net cevap ver (1-2 cümle)
- Sakin ol, panik yapma
- Sorulanı cevapla, fazla detay ekleme
- "Evet" veya "Hayır" ile başla
- Kibarca konuş`,
    ornekCevaplar: {
      pozitif: "Evet, baş ağrım var. İki haftadır devam ediyor.",
      negatif: "Hayır, göğüs ağrım yok.",
      belirsiz: "Tam emin değilim ama sanırım yok."
    }
  },

  endiseli: {
    ad: "Endişeli ve Kaygılı",
    aciklama: "Çok soru sorar, endişesini belli eder, en kötüsünü düşünür.",
    konusmaKurallari: `
- Endişeni belli et
- Sık sık "Ciddi bir şey mi doktor?" gibi sorular sor
- Cevaplarına endişe ekle: "Bu kötü bir şey mi?"
- Biraz uzun cevaplar ver, detay ekle
- Ağlamaklı veya gergin ol`,
    ornekCevaplar: {
      pozitif: "Evet doktor, baş ağrım var, çok kötü... İki haftadır geçmiyor, acaba beynimde bir şey mi var? Çok korkuyorum.",
      negatif: "Göğüs ağrım yok ama... olmaması normal mi? Kalp krizi falan olmaz değil mi?",
      belirsiz: "Bilmiyorum doktor, emin olamıyorum... Bir şeyler oluyor ama ne olduğunu anlamıyorum, çok endişeleniyorum."
    }
  },

  ketum: {
    ad: "Ketum ve Az Konuşan",
    aciklama: "Tek kelimelik cevaplar verir, bilgi almak zordur, detay vermez.",
    konusmaKurallari: `
- Mümkün olduğunca kısa cevap ver (1-3 kelime)
- "Var", "Yok", "Evet", "Hayır" gibi cevaplar ver
- Detay istenmezse verme
- İsteksiz konuş
- Soruyu tekrar sormalarını bekle`,
    ornekCevaplar: {
      pozitif: "Var.",
      negatif: "Yok.",
      belirsiz: "Bilmem."
    }
  },

  konuskan: {
    ad: "Konuşkan ve Detaycı",
    aciklama: "Çok detay verir, konu dışına çıkar, hikaye anlatır.",
    konusmaKurallari: `
- Uzun ve detaylı cevap ver (3-5 cümle)
- Konuyla ilgisiz detaylar ekle
- Hikaye anlat: "Geçen gün komşum da..."
- Sorudan sapabilirsin ama sonunda cevabı ver
- Samimi ve sıcak konuş`,
    ornekCevaplar: {
      pozitif: "Aaaa evet doktor, baş ağrısı diyorsunuz, vallahi var. İki haftadır çekiyorum. Komşum Ayşe teyze de geçen ay baş ağrısından muzdaripti, tomografi çektirdiler, bir şey çıkmadı ama. Neyse benim ağrım başın ön tarafında, sürekli bir baskı gibi.",
      negatif: "Yok yok, göğsümde ağrı yok çok şükür. Geçen sene bi kere olmuştu ama o da gazdan çıkmıştı. Doktor ne demişti o zaman... neyse, şu an yok.",
      belirsiz: "Şimdi nasıl desem... bazen oluyor bazen olmuyor. Geçen hafta mesela oğlum geldi, onunla uğraşırken fark etmedim bile. Ama dün gece yatarken biraz hissettim gibi. Emin olamıyorum yani."
    }
  },

  agresif: {
    ad: "Sinirli ve Sabırsız",
    aciklama: "Sabırsızdır, soruları gereksiz bulabilir, kısa keser.",
    konusmaKurallari: `
- Sabırsız ve sinirli konuş
- "Bu soruyu niye soruyorsunuz?" gibi tepki ver (ara sıra)
- Kısa ve sert cevaplar ver
- "Beni tedavi edin artık" gibi ifadeler kullan
- Bazı soruları saçma bulabilirsin`,
    ornekCevaplar: {
      pozitif: "Evet var, söyledim ya! Baş ağrısı, iki haftadır.",
      negatif: "Yok, göğsüm ağrımıyor. Başım ağrıyor dedim ya.",
      belirsiz: "Ne bileyim, siz doktorsunuz siz söyleyin."
    }
  },

  dramatik: {
    ad: "Dramatik ve Abartılı",
    aciklama: "Semptomları abartır, çok şikayet eder, ağrısını büyütür.",
    konusmaKurallari: `
- Semptomları abartarak anlat
- "Dayanılmaz", "korkunç", "ölüyorum" gibi ifadeler kullan
- Acı çektiğini belli et
- Ağrı skalasını yüksek ver
- "Hayatımda bu kadar kötü olmamıştım" gibi ifadeler`,
    ornekCevaplar: {
      pozitif: "Doktor inanın bana, baş ağrısı demeyin buna, başım patlıyor resmen! İki haftadır çekilmez bir acı, uyuyamıyorum, yiyemiyorum, ölüyorum!",
      negatif: "Göğsümde ağrı yok ama zaten başım o kadar ağrıyor ki başka bir yeri hissedemiyorum bile.",
      belirsiz: "Bilmiyorum doktor, o kadar çok yerim ağrıyor ki hangisi hangisi ayırt edemiyorum artık."
    }
  }
};
```

---

## 3. Cevap Üretim Prompt'u

```typescript
// lib/ai/cevap-uretici.ts

export function cevapUretimPrompt(
  profil: HastaProfili,
  sorular: { chipKey: string; etiket: string; kategori: string }[]
): string {

  const kisilik = KISILIK_TIPLERI[profil.kisilikTipi.tip];

  return `Sen bir tıp eğitimi simülasyon sistemi için hasta cevapları 
üreten bir uzmansın. Sana bir hasta profili ve soru listesi 
vereceğim. Her soru için bu hastanın vereceği cevabı yazacaksın.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HASTA PROFİLİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ad: ${profil.ad}
Yaş: ${profil.yas}
Cinsiyet: ${profil.cinsiyet === "E" ? "Erkek" : "Kadın"}
Meslek: ${profil.meslek}

Ana Şikayet: ${profil.anaSikayet}

Detaylı Hikaye:
${profil.hikaye}

Mevcut Semptomlar (BUNLAR VAR):
${profil.mevcutSemptomlar.map(s => `- ${s}`).join("\n")}

Olmayan Semptomlar (BUNLAR YOK):
${profil.olmayanSemptomlar.map(s => `- ${s}`).join("\n")}

Geçmiş Hastalıklar: ${profil.gecmisHastaliklar.join(", ") || "Yok"}
İlaçlar: ${profil.ilaclar.join(", ") || "Yok"}
Alerjiler: ${profil.alerjiler.join(", ") || "Yok"}
Sigara: ${profil.sigara}
Alkol: ${profil.alkol}
Aile Öyküsü: ${profil.aileOykusu.join(", ") || "Bilmiyor"}

Vital Bulgular:
- Tansiyon: ${profil.vitals.tansiyon}
- Nabız: ${profil.vitals.nabiz}
- Ateş: ${profil.vitals.ates}
- SpO2: ${profil.vitals.spo2}
- Solunum: ${profil.vitals.solunum}
- Kilo: ${profil.vitals.kilo} kg
- Boy: ${profil.vitals.boy} cm

Fizik Muayene:
${Object.entries(profil.fizikMuayene).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KİŞİLİK TİPİ: ${kisilik.ad}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${kisilik.aciklama}

Konuşma Kuralları:
${kisilik.konusmaKurallari}

Örnek Cevaplar:
- Pozitif semptom: "${kisilik.ornekCevaplar.pozitif}"
- Negatif semptom: "${kisilik.ornekCevaplar.negatif}"
- Belirsiz: "${kisilik.ornekCevaplar.belirsiz}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CEVAP KURALLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. HASTA GİBİ KONUŞ:
   - Tıbbi terim kullanma
   - "Dispne" değil "nefes darlığı"
   - "Sefalji" değil "baş ağrısı"
   - Halk dilinde konuş

2. TUTARLI OL:
   - Mevcut semptomlar listesinde olan → pozitif cevap
   - Olmayan semptomlar listesinde olan → negatif cevap
   - Hiçbir listede olmayan → "Bilmiyorum" veya "Fark etmedim"

3. ANA ŞİKAYET AĞRI İSE:
   - Genel ağrı soruları (ağrı yeri, süresi, yayılımı) → 
     ana şikayetteki ağrıya göre cevapla
   - Spesifik bölge soruları (göğüs ağrısı, karın ağrısı) → 
     o bölgede ağrı yoksa "yok" de

4. VİTAL BULGULAR:
   - Sorulunca yukarıdaki değerleri söyle
   - Sadece sayıyı ver, yorum yapma

5. FİZİK MUAYENE:
   - Yukarıdaki bulguları aktar
   - "Doktor baktı ve şunu söyledi" tarzında anlat

6. KİŞİLİĞE GÖRE CEVAP:
   - ${profil.kisilikTipi.tip} kişiliğine uygun konuş
   - Her cevap bu kişilik tipinin tonunda olsun

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SORU LİSTESİ VE BEKLENEN FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Aşağıdaki her soru için cevap yaz. Cevabı JSON formatında ver.

Format:
{
  "cevaplar": {
    "CHIP_KEY": "Hasta cevabı burada",
    ...
  }
}

SORULAR:
${sorular.map(s => `- ${s.chipKey}: "${s.etiket}" (kategori: ${s.kategori})`).join("\n")}

Tüm soruları tek bir JSON objesi olarak cevapla. 
Hiçbir soruyu atlama. Her soruya kişilik tipine uygun cevap ver.
SADECE JSON döndür, başka açıklama yazma.`;
}
```

---

## 4. Cevap Üretici Servis

```typescript
// lib/ai/cevap-uretici-servis.ts

import OpenAI from "openai";
import { cevapUretimPrompt } from "./cevap-uretici";
import { CHIP_HAVUZU } from "../data/chip-havuzu";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface CevapUretimSonucu {
  basarili: boolean;
  cevaplar: Record<string, string>;
  pipilineRapor: {
    toplamSoru: number;
    cevaplanaSoru: number;
    eksikSoru: string[];
    uyarilar: string[];
  };
}

export async function cevaplariUret(
  profil: HastaProfili
): Promise<CevapUretimSonucu> {

  // Tüm chip sorularını hazırla
  const sorular = CHIP_HAVUZU.map(chip => ({
    chipKey: chip.aksiyon,
    etiket: chip.etiket,
    kategori: chip.kategori
  }));

  const prompt = cevapUretimPrompt(profil, sorular);

  try {
    const yanit = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sen JSON formatında hasta cevapları üreten bir sistemsin." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" }
    });

    const icerik = yanit.choices[0]?.message?.content || "{}";
    const sonuc = JSON.parse(icerik);
    const cevaplar = sonuc.cevaplar || sonuc;

    // Eksik soru kontrolü
    const eksikSorular: string[] = [];
    for (const soru of sorular) {
      if (!cevaplar[soru.chipKey]) {
        eksikSorular.push(soru.chipKey);
      }
    }

    // Güvenlik kontrolleri
    const uyarilar = guvenlikKontrolu(cevaplar, profil);

    return {
      basarili: eksikSorular.length === 0,
      cevaplar,
      pipilineRapor: {
        toplamSoru: sorular.length,
        cevaplanaSoru: Object.keys(cevaplar).length,
        eksikSoru: eksikSorular,
        uyarilar
      }
    };
  } catch (hata) {
    console.error("Cevap üretim hatası:", hata);
    return {
      basarili: false,
      cevaplar: {},
      pipilineRapor: {
        toplamSoru: sorular.length,
        cevaplanaSoru: 0,
        eksikSoru: sorular.map(s => s.chipKey),
        uyarilar: [`API hatası: ${hata}`]
      }
    };
  }
}

function guvenlikKontrolu(
  cevaplar: Record<string, string>,
  profil: HastaProfili
): string[] {
  const uyarilar: string[] = [];

  // Mevcut semptom kontrolü
  for (const [chipKey, cevap] of Object.entries(cevaplar)) {
    const cevapLower = (cevap as string).toLowerCase();

    // Tıbbi terim kontrolü
    const tibbTerimler = [
      "miyokard", "dispne", "sefalji", "hemiparezi",
      "intrakraniyal", "subdural", "epidural",
      "trombositopeni", "hiperglisemi"
    ];

    for (const terim of tibbTerimler) {
      if (cevapLower.includes(terim)) {
        uyarilar.push(`${chipKey}: Tıbbi terim kullanılmış → "${terim}"`);
      }
    }
  }

  // Ana şikayet tutarlılığı
  const anaSikayetLower = profil.anaSikayet.toLowerCase();

  // Ağrı varsa ağrı chip'leri pozitif olmalı
  if (anaSikayetLower.includes("ağrı")) {
    const agriYer = cevaplar["AGRI_YER"]?.toLowerCase() || "";
    if (agriYer.includes("ağrım yok") || agriYer.includes("belirgin")) {
      uyarilar.push("AGRI_YER: Ana şikayette ağrı var ama cevap negatif");
    }
  }

  // Vital tutarlılık
  const vitalTansiyon = cevaplar["VITAL_TANSIYON"] || "";
  if (vitalTansiyon && !vitalTansiyon.includes(profil.vitals.tansiyon)) {
    uyarilar.push(`VITAL_TANSIYON: Profil ${profil.vitals.tansiyon}, cevap ${vitalTansiyon}`);
  }

  return uyarilar;
}
```

---

## 5. Eksik Cevap Tamamlayıcı

```typescript
// lib/ai/eksik-tamamlayici.ts

export async function eksikCevaplariTamamla(
  mevcutCevaplar: Record<string, string>,
  profil: HastaProfili,
  eksikChipler: string[]
): Promise<Record<string, string>> {

  if (eksikChipler.length === 0) return mevcutCevaplar;

  const eksikSorular = CHIP_HAVUZU
    .filter(c => eksikChipler.includes(c.aksiyon))
    .map(c => ({
      chipKey: c.aksiyon,
      etiket: c.etiket,
      kategori: c.kategori
    }));

  const prompt = cevapUretimPrompt(profil, eksikSorular);

  const yanit = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Eksik soruların cevaplarını JSON olarak üret." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "json_object" }
  });

  const yeniCevaplar = JSON.parse(
    yanit.choices[0]?.message?.content || "{}"
  );

  return {
    ...mevcutCevaplar,
    ...(yeniCevaplar.cevaplar || yeniCevaplar)
  };
}
```

---

## 6. Serbest Metin Eşleştirici

```typescript
// lib/ai/soru-eslestirici.ts

import OpenAI from "openai";
import { CHIP_HAVUZU } from "../data/chip-havuzu";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface EslesmeSonucu {
  chipKey: string;
  chipEtiket: string;
  guvenSkor: number;
  eslesmeBulundu: boolean;
}

// Önce yerel sözlükle eşleştir, bulamazsa AI'ya sor
export async function serbestMetinEslestir(
  metin: string
): Promise<EslesmeSonucu> {

  // ADIM 1: Yerel sözlük eşleştirmesi (hızlı, ücretsiz)
  const yerelSonuc = yerelEslestirme(metin);
  if (yerelSonuc) return yerelSonuc;

  // ADIM 2: AI eşleştirmesi (yavaş ama akıllı)
  return await aiEslestirme(metin);
}


// ═══════════════════════════════════════
// YEREL SÖZLÜK EŞLEŞTİRME
// ═══════════════════════════════════════

const SERBEST_METIN_SOZLUGU: Record<string, string[]> = {
  "AGRI_YER": [
    "ağrın nerede", "neren ağrıyor", "ağrı yeri",
    "nerede ağrı", "ağrınız nerede", "nereniz ağrıyor"
  ],
  "AGRI_SURE": [
    "ne zamandır", "ne zamandan beri", "kaç gündür",
    "ne zaman başladı", "süre", "başlangıç"
  ],
  "AGRI_YAYILIM": [
    "yayılıyor mu", "başka yere vuruyor mu",
    "ağrı yayılımı", "yansıyor mu"
  ],
  "BAS_AGRISI": [
    "başın ağrıyor mu", "baş ağrısı", "başında ağrı",
    "kafan ağrıyor mu", "migren"
  ],
  "GOGUS_AGRISI": [
    "göğsün ağrıyor mu", "göğüs ağrısı", "göğüste baskı",
    "kalbin ağrıyor mu"
  ],
  "NEFES_DARLIGI": [
    "nefes alabilıyor musun", "nefes darlığı", "nefessiz",
    "soluk alamıyor musun"
  ],
  "ATES_SORGU": [
    "ateşin var mı", "ateş", "sıcaklık", "hararetın"
  ],
  "BULANTI": [
    "miden bulanıyor mu", "bulantı", "kusacak gibi",
    "mideniz"
  ],
  "SIGARA": [
    "sigara içiyor musun", "sigara", "tütün",
    "içici misiniz"
  ],
  "ILAC": [
    "ilaç kullanıyor musun", "ilaçlar", "ne ilaç",
    "düzenli ilaç"
  ],
  "ALERJI": [
    "alerjin var mı", "alerji", "hassasiyet"
  ],
  "VITAL_TANSIYON": [
    "tansiyonun kaç", "tansiyon", "kan basıncı",
    "tansiyonunuz"
  ],
  "VITAL_NABIZ": [
    "nabzın kaç", "nabız", "kalp atış hızı",
    "pulse"
  ],
  "TRAVMA": [
    "düştün mü", "travma", "çarptın mı",
    "kaza geçirdin mi", "darbe aldın mı"
  ],
  "KONFUZYON": [
    "kafan karışıyor mu", "unutkanlık", "konfüzyon",
    "bilinç bulanıklığı", "dalıp gidiyor musun"
  ],
  "BAYILMA": [
    "bayıldın mı", "senkop", "düştün mü",
    "bilincini kaybettin mi"
  ]
};

function yerelEslestirme(metin: string): EslesmeSonucu | null {
  const metinLower = metin.toLowerCase()
    .replace(/[?.,!]/g, "")
    .trim();

  // Direkt eşleşme
  for (const [chipKey, aliaslar] of Object.entries(SERBEST_METIN_SOZLUGU)) {
    for (const alias of aliaslar) {
      if (metinLower.includes(alias) || alias.includes(metinLower)) {
        const chip = CHIP_HAVUZU.find(c => c.aksiyon === chipKey);
        return {
          chipKey,
          chipEtiket: chip?.etiket || chipKey,
          guvenSkor: 0.9,
          eslesmeBulundu: true
        };
      }
    }
  }

  return null;
}


// ═══════════════════════════════════════
// AI EŞLEŞTİRME (Sözlükte yoksa)
// ═══════════════════════════════════════

async function aiEslestirme(metin: string): Promise<EslesmeSonucu> {
  const chipListesi = CHIP_HAVUZU.map(c =>
    `${c.aksiyon}: "${c.etiket}"`
  ).join("\n");

  const prompt = `Aşağıda bir tıp öğrencisinin hastaya sorduğu serbest 
metin soru var. Bu sorunun aşağıdaki hazır sorulardan hangisine 
karşılık geldiğini bul.

Öğrencinin sorusu: "${metin}"

Hazır sorular:
${chipListesi}

SADECE şu JSON formatında cevap ver:
{
  "chipKey": "EN_UYGUN_CHIP_KEY",
  "guvenSkor": 0.0-1.0 arası güven skoru
}

Eğer hiçbir soru uymuyorsa:
{
  "chipKey": "OZEL",
  "guvenSkor": 0.0
}`;

  try {
    const yanit = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Soru eşleştirme sistemisin. Sadece JSON döndür." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: "json_object" }
    });

    const sonuc = JSON.parse(
      yanit.choices[0]?.message?.content || '{"chipKey":"OZEL","guvenSkor":0}'
    );

    const chip = CHIP_HAVUZU.find(c => c.aksiyon === sonuc.chipKey);

    return {
      chipKey: sonuc.chipKey,
      chipEtiket: chip?.etiket || "Özel soru",
      guvenSkor: sonuc.guvenSkor,
      eslesmeBulundu: sonuc.chipKey !== "OZEL" && sonuc.guvenSkor > 0.5
    };
  } catch {
    return {
      chipKey: "OZEL",
      chipEtiket: "Özel soru",
      guvenSkor: 0,
      eslesmeBulundu: false
    };
  }
}
```

---

## 7. Ana Pipeline

```typescript
// lib/ai/pipeline.ts

import { cevaplariUret, CevapUretimSonucu } from "./cevap-uretici-servis";
import { eksikCevaplariTamamla } from "./eksik-tamamlayici";
import { serbestMetinEslestir } from "./soru-eslestirici";

// ═══════════════════════════════════════
// PIPELINE 1: VAKA OLUŞTURMA
// Yeni vaka oluşturulurken bir kerelik çalışır
// ═══════════════════════════════════════

export async function vakaOlusturmaPipeline(
  profil: HastaProfili
): Promise<{
  basarili: boolean;
  hastaYanitlari: Record<string, string>;
  rapor: any;
}> {

  console.log("📋 Adım 1: AI ile cevaplar üretiliyor...");
  const sonuc = await cevaplariUret(profil);

  console.log(`   → ${sonuc.pipilineRapor.cevaplanaSoru}/${sonuc.pipilineRapor.toplamSoru} soru cevaplandı`);

  // Eksik varsa tamamla
  if (sonuc.pipilineRapor.eksikSoru.length > 0) {
    console.log(`🔧 Adım 2: ${sonuc.pipilineRapor.eksikSoru.length} eksik cevap tamamlanıyor...`);

    const tamamlanmis = await eksikCevaplariTamamla(
      sonuc.cevaplar,
      profil,
      sonuc.pipilineRapor.eksikSoru
    );

    sonuc.cevaplar = tamamlanmis;
  }

  // Vital bulguları garantile (AI üretmese bile)
  sonuc.cevaplar["VITAL_TANSIYON"] = profil.vitals.tansiyon;
  sonuc.cevaplar["VITAL_NABIZ"] = String(profil.vitals.nabiz);
  sonuc.cevaplar["VITAL_ATES"] = String(profil.vitals.ates);
  sonuc.cevaplar["VITAL_SPO2"] = String(profil.vitals.spo2);
  sonuc.cevaplar["VITAL_SOLUNUM"] = `${profil.vitals.solunum}/dk`;
  sonuc.cevaplar["VITAL_KILO"] = `${profil.vitals.kilo} kg`;
  sonuc.cevaplar["VITAL_BOY"] = `${profil.vitals.boy} cm`;

  // Güvenlik kontrolü sonuçları
  if (sonuc.pipilineRapor.uyarilar.length > 0) {
    console.log("⚠️  Güvenlik uyarıları:");
    sonuc.pipilineRapor.uyarilar.forEach(u => console.log(`   - ${u}`));
  }

  console.log(`✅ Cevap üretimi tamamlandı. ${Object.keys(sonuc.cevaplar).length} cevap hazır.`);

  return {
    basarili: true,
    hastaYanitlari: sonuc.cevaplar,
    rapor: sonuc.pipilineRapor
  };
}


// ═══════════════════════════════════════
// PIPELINE 2: SORU CEVAPLAMA
// Öğrenci soru sorduğunda çalışır
// ═══════════════════════════════════════

export async function soruCevaplamaP ipeline(
  soru: string,
  tip: "chip" | "serbest",
  chipKey: string | null,
  hastaYanitlari: Record<string, string>
): Promise<{
  cevap: string;
  chipKey: string;
  eslesmeTipi: "chip" | "sozluk" | "ai" | "bulunamadi";
}> {

  // TİP 1: Chip tıklandı → direkt cevap ver
  if (tip === "chip" && chipKey) {
    const cevap = hastaYanitlari[chipKey];

    if (cevap) {
      return {
        cevap,
        chipKey,
        eslesmeTipi: "chip"
      };
    }

    return {
      cevap: "Bunu tam anlamadım, başka türlü sorabilir misiniz?",
      chipKey,
      eslesmeTipi: "bulunamadi"
    };
  }

  // TİP 2: Serbest metin → eşleştir → cevap ver
  const esleme = await serbestMetinEslestir(soru);

  if (esleme.eslesmeBulundu) {
    const cevap = hastaYanitlari[esleme.chipKey];

    if (cevap) {
      return {
        cevap,
        chipKey: esleme.chipKey,
        eslesmeTipi: esleme.guvenSkor > 0.8 ? "sozluk" : "ai"
      };
    }
  }

  // Eşleşme bulunamadı
  return {
    cevap: "Bunu tam anlamadım, daha açık sorabilir misiniz?",
    chipKey: "OZEL",
    eslesmeTipi: "bulunamadi"
  };
}


// ═══════════════════════════════════════
// PIPELINE 3: KİŞİLİK DEĞİŞTİRME
// Aynı vaka, farklı kişilik
// ═══════════════════════════════════════

export async function kisilikDegistir(
  profil: HastaProfili,
  yeniKisilik: string
): Promise<Record<string, string>> {

  const guncelProfil = {
    ...profil,
    kisilikTipi: {
      ...profil.kisilikTipi,
      tip: yeniKisilik
    }
  };

  const sonuc = await cevaplariUret(guncelProfil);
  return sonuc.cevaplar;
}
```

---

## 8. API Route

```typescript
// app/api/vaka-cevap-uret/route.ts

import { NextRequest, NextResponse } from "next/server";
import { vakaOlusturmaPipeline } from "@/lib/ai/pipeline";

export async function POST(req: NextRequest) {
  const { profil } = await req.json();

  const sonuc = await vakaOlusturmaPipeline(profil);

  return NextResponse.json(sonuc);
}
```

```typescript
// app/api/soru-cevapla/route.ts

import { NextRequest, NextResponse } from "next/server";
import { soruCevaplamaP ipeline } from "@/lib/ai/pipeline";

export async function POST(req: NextRequest) {
  const { soru, tip, chipKey, hastaYanitlari } = await req.json();

  const sonuc = await soruCevaplamaP ipeline(
    soru, tip, chipKey, hastaYanitlari
  );

  return NextResponse.json(sonuc);
}
```

---

## 9. Akış Özeti

```
VAKA OLUŞTURMA (bir kerelik):
┌─────────────────────────┐
│ Hasta Profili            │
│ + Kişilik Tipi           │
│ + Semptomlar             │
│ + Hikaye                 │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ AI Cevap Üretimi         │
│ (gpt-4o-mini)            │
│ 108 chip → 108 cevap     │
│ Tek seferde üretilir     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Güvenlik Kontrolü        │
│ - Tıbbi terim var mı?    │
│ - Tutarlılık sağlandı mı?│
│ - Vital doğru mu?        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ JSON Olarak Kaydedilir   │
│ hastaYanitlari: {        │
│   "AGRI_YER": "Başımda", │
│   "AGRI_SURE": "2 hafta",│
│   ...108 cevap            │
│ }                         │
└─────────────────────────┘


ÖĞRENCI KULLANIMI:
┌─────────────────────────┐
│ Öğrenci Chip'e Tıklar    │──→ Kaydedilmiş cevap (AI çağrısı YOK)
└─────────────────────────┘

┌─────────────────────────┐
│ Öğrenci Serbest Yazar    │
│ "başın ağrıyor mu?"      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Yerel Sözlük Eşleştirme │──→ Bulursa → Cevap (AI çağrısı YOK)
│ (anında, ücretsiz)        │
└────────┬────────────────┘
         │ Bulamazsa
         ▼
┌─────────────────────────┐
│ AI Eşleştirme            │──→ En yakın chip bulunur → Cevap
│ (gpt-4o-mini, ucuz)      │
└─────────────────────────┘
```

---

## 10. Maliyet

```
VAKA OLUŞTURMA (bir kerelik):
- 108 soru cevabı = ~3,000 token input + ~3,000 token output
- gpt-4o-mini: $0.15/1M input + $0.60/1M output
- Maliyet: ~$0.002 (0.2 kuruş / vaka)
- 57 hastalık: ~$0.11 (toplam 11 kuruş)

SERBEST METİN EŞLEŞTİRME:
- Yerel sözlükte bulunursa: $0 (çoğu soru burada çözülür)
- AI eşleştirme: ~$0.0002 / soru (~0.02 kuruş)
- Vaka başına ortalama 5 serbest soru: ~$0.001

TOPLAM: 
- İlk kurulum: ~$0.11 (bir kerelik, tüm 57 hastalık)
- Kullanım: ~$0.001 / vaka (çok düşük)
- 1,000 öğrenci × 50 vaka = ~$50 / yıl
```

---

## 11. Uygulama Planı

### Bu Hafta

```
1. OpenAI API key alın
2. npm install openai
3. 1 hastalık için profil yazın (STEMI veya SDH)
4. Cevap üretimini test edin
5. Sonuçları mevcut vaka verisiyle karşılaştırın
```

### Bu Ay

```
6. 57 hastalık için profiller yazın
7. Tüm cevapları üretin ve kaydedin
8. Serbest metin eşleştiriciyi entegre edin
9. Kişilik tipi seçici ekleyin (UI)
```

### İlerleyen Dönem

```
10. Kişilik tipleriyle A/B test
11. Öğrenci geri bildirimleriyle profilleri iyileştirin
12. Yeni kişilik tipleri ekleyin
```

---

Bu yapıyla AI sadece **arka planda cevap üreten ve eşleştiren** bir araç olur. Öğrenci arayüzü, puanlama sistemi, chip yapısı hiçbir şey değişmez. Hangi hastalıkla başlamak istersiniz?