import { Vaka, Hasta, Cinsiyet, TedaviPlani, TestSonucu, SoruChipi } from "../types";
import { buildInjectedRules, generateFullPanel } from "../lab-motor";
import { birlestirTestler, buildClinicalProfile } from "./lab-katalog";
import { labKaynakSatirlari } from "./lab-kaynaklari";
import { enrichHastaYanitlari } from "./hasta-yanit-enrich";
import { CHIP_HAVUZU } from "./chip-havuzu";

import {
  CHIP_KATEGORI_ETIKETLERI,
  CHIP_KATEGORIYE_GORE,
  KAYNAKLAR_SABLONLARI,
  poliklinikler,
  TEDAVI_SABLONLARI,
  type PoliklinikSablonu,
  type HastalikSablonu,
} from "./case-templates";

export { CHIP_HAVUZU };
export { CHIP_KATEGORI_ETIKETLERI, CHIP_KATEGORIYE_GORE, poliklinikler, type PoliklinikSablonu, type HastalikSablonu };

// ─── Dummy Hasta İsim/TC Üretimi ───
const ERKEK_ISIMLERI = ["Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "İbrahim", "Hasan", "Ömer", "Yusuf", "Murat", "Emre", "Burak", "Serkan", "Kadir", "Osman", "Salih", "Halil", "Cemal", "Veysel", "Ramazan"];
const KADIN_ISIMLERI = ["Fatma", "Ayşe", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Ayşegül", "Mine", "Selma", "Derya", "Pınar", "Şerife", "Sultan", "Hanife", "Nuray", "Aysel", "Gül", "Hülya", "Sevgi"];
const SOYISIMLER = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Korkmaz", "Çakır", "Erdoğan", "Güneş", "Aksoy", "Bulut", "Taş", "Acar", "Bilgin"];

function uretTamAd(cinsiyet: Cinsiyet): string {
  const isim = cinsiyet === "E"
    ? ERKEK_ISIMLERI[Math.floor(Math.random() * ERKEK_ISIMLERI.length)]
    : KADIN_ISIMLERI[Math.floor(Math.random() * KADIN_ISIMLERI.length)];
  const soyisim = SOYISIMLER[Math.floor(Math.random() * SOYISIMLER.length)];
  return `${isim} ${soyisim}`;
}

function uretTC(): string {
  const digits: number[] = [Math.floor(Math.random() * 9) + 1];
  for (let i = 1; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  const tekToplam = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const ciftToplam = digits[1] + digits[3] + digits[5] + digits[7];
  digits.push((tekToplam * 7 - ciftToplam) % 10);
  const tumToplam = digits.reduce((a, b) => a + b, 0);
  digits.push(tumToplam % 10);
  return digits.join("");
}

function rastgeleInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rastgeleCinsiyet(tercih: "E" | "K" | "herhangi"): "E" | "K" {
  if (tercih === "herhangi") {
    return Math.random() > 0.5 ? "E" : "K";
  }
  return tercih;
}

/** Admin deposundan gelen test override haritası: hastalikKey → tests */
export type AdminTestOverrides = Record<string, Record<string, TestSonucu>>;

export function vakaUret(
  poliklinikKey?: string,
  options?: { adminTests?: AdminTestOverrides }
): Vaka {
  let poliklinik: PoliklinikSablonu;
  if (poliklinikKey) {
    poliklinik = poliklinikler.find((p) => p.key === poliklinikKey) || poliklinikler[0];
  } else {
    poliklinik = poliklinikler[rastgeleInt(0, poliklinikler.length - 1)];
  }

  const sablon = poliklinik.hastalikSablonlari[rastgeleInt(0, poliklinik.hastalikSablonlari.length - 1)];
  const yas = rastgeleInt(sablon.yasAraligi[0], sablon.yasAraligi[1]);
  const cinsiyet = rastgeleCinsiyet(sablon.cinsiyetTercih);
  const vakaId = `${poliklinik.key}-${sablon.hastalikKey}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const tamAd = uretTamAd(cinsiyet);
  const tc = uretTC();

  const hasta: Hasta = {
    ad: tamAd,
    tamAd,
    tc,
    yas,
    cinsiyet,
    anaSikayet: sablon.anaSikayetSablonu({ ad: tamAd, tamAd, tc, yas, cinsiyet, anaSikayet: "", ozetBilgiler: [] }),
    ozetBilgiler: sablon.ozetBilgilerSablonu({ ad: tamAd, tamAd, tc, yas, cinsiyet, anaSikayet: "", ozetBilgiler: [] }),
  };

  // Tüm ortak chip havuzunu kullan — her poliklinikte aynı chip'ler
  const soruChipleri: SoruChipi[] = [...CHIP_HAVUZU];

  // Şablon yanıtları + tüm chip'ler için tutarlı varsayılanlar + ağrı tutarlılığı
  const sablonYanitlari = sablon.hastaYanitlari();
  let birlesikYanitlar = enrichHastaYanitlari(sablonYanitlari, {
    chipHavuzu: CHIP_HAVUZU,
    anaSikayet: hasta.anaSikayet,
    semptom: sablon.semptomSablonu(hasta),
  });

  // Rubrikte beklenen soru/red flag için cevap garantisi
  for (const q of sablon.rubric.beklenenSorular) {
    if (!birlesikYanitlar[q.key] || !String(birlesikYanitlar[q.key]).trim()) {
      birlesikYanitlar[q.key] = q.aciklama
        ? `Evet — ${q.aciklama}.`
        : `Evet, ${q.etiket.toLowerCase()} ile ilgili şikayetim var.`;
    }
  }
  for (const rf of sablon.rubric.redFlagler) {
    if (!birlesikYanitlar[rf.key] || !String(birlesikYanitlar[rf.key]).trim()) {
      // Red flag varsayılanı: çoğu vakada "yok" (yoksa şablon yazar)
      birlesikYanitlar[rf.key] = `Hayır, ${rf.etiket.toLowerCase()} yok.`;
    }
  }

  // Katman 2: Lab motoru ile tam panel üret — server'da admin kuralları inject edilir
  let injectedLab: { rules?: ReturnType<typeof buildInjectedRules>; aliases?: Record<string, string> } | undefined;
  try {
    if (typeof process !== "undefined" && process.versions?.node) {
      const store = require("../admin/rule-engine-store") as typeof import("../admin/rule-engine-store");
      const active = store.getActiveRules();
      const aliases = store.getActiveAliases();
      if (active.length) injectedLab = { rules: buildInjectedRules(active), aliases };
    }
  } catch {
    // fallback kuralları kullanılır
  }
  const zenginlestirilmisTestler: Record<string, TestSonucu> = generateFullPanel(
    sablon.hastalikKey,
    { age: yas, sex: cinsiyet, diagnoses: [sablon.hastalikKey], comorbidities: [], severity: sablon.seviye === "baslangic" ? "hafif" : sablon.seviye === "orta" ? "orta" : "agir" },
    sablon.statikTestler(),
    injectedLab
  );

  // Relevant aksiyonlar: vakanın beklediği + vital/öykü her zaman relevant
  const herZamanRelevant = [
    "VITAL_TANSIYON", "VITAL_NABIZ", "VITAL_ATES", "VITAL_SPO2",
    "SIGARA", "SIGARA_OYKUSU", "DIYABET", "DIYABET_OYKUSU", "ILAC", "ILAC_OYKUSU", "ALERJI",
    "SIKAYET", "AILE_OYKUSU",
  ];
  const relevantAksiyonlar = Array.from(new Set([
    ...sablon.rubric.beklenenSorular.map((s) => s.key),
    ...sablon.rubric.redFlagler.map((r) => r.key),
    ...sablon.rubric.beklenenTestler.map((t) => t.key),
    ...herZamanRelevant,
  ]));

  // ─── Data fusion: şablon patoloji testleri + profil uyumlu normal panel ───
  const episodeZamani = Date.now();
  const profile = buildClinicalProfile({
    yas,
    cinsiyet,
    hastalikKey: sablon.hastalikKey,
    taniListesi: sablon.rubric.kabulEdilenTani,
    poliklinikKey: poliklinik.key,
  });

  // Admin paneli testleri: varsa şablon testlerinin yerine geçer (tam yetki)
  const adminOverride = options?.adminTests?.[sablon.hastalikKey];
  let originalTestler: Record<string, TestSonucu> =
    adminOverride && Object.keys(adminOverride).length > 0
      ? { ...adminOverride }
      : { ...sablon.statikTestler() };

  // Beklenen / gereksiz testler vakada yoksa otomatik ekle (istenince sonuç gelsin)
  for (const t of [...sablon.rubric.beklenenTestler, ...sablon.rubric.gereksizTestler]) {
    if (!originalTestler[t.key]) {
      const isBeklenen = sablon.rubric.beklenenTestler.some((b) => b.key === t.key);
      originalTestler[t.key] = {
        testKey: t.key,
        testAdi: t.etiket,
        tip: "text",
        sonuc: isBeklenen
          ? `${t.etiket}: klinik olarak anlamlı bulgu mevcut. (${t.aciklama})`
          : `${t.etiket}: bu vaka bağlamında ek tanısal katkı sınırlı / erken aşamada öncelikli değil.`,
        referans: "Vaka şablonu",
        yorum: isBeklenen ? t.aciklama : "Gereksiz/erken test olarak değerlendirilebilir.",
        source: "original",
      };
    }
  }

  const statikTestler = birlestirTestler(originalTestler, profile, {
    patientId: tc,
    episodeId: vakaId,
    measuredAt: episodeZamani,
  });

  const originalSayisi = Object.keys(originalTestler).length;
  const datasetSayisi = Object.values(statikTestler).filter((t) => t.source === "dataset").length;

  return {
    id: vakaId,
    semptom: sablon.semptomSablonu(hasta),
    hastalik: sablon.hastalikKey,
    alan: poliklinik.ad,
    seviye: sablon.seviye,
    hasta,
    profile,
    episodeZamani,
    beklenenTani: sablon.rubric.kabulEdilenTani,
    rubric: sablon.rubric,
    statikTestler,
    hastaYanitlari: birlesikYanitlar,
    soruChipleri,
    relevantAksiyonlar,
    idealYol: sablon.idealYol,
    egitimNotu: sablon.egitimNotu,
    tedavi: TEDAVI_SABLONLARI[sablon.hastalikKey],
    kaynaklar: [
      `🆔 Vaka ID · ${vakaId} → bu vakaya sistem içinde bu ID ile erişilir`,
      `📊 Veri Noktası · ${sablon.hastalikAdi} şablonu → yaş=${yas}, cinsiyet=${cinsiyet}, ${hasta.anaSikayet}`,
      `🧬 Klinik Profil · age=${profile.age}, sex=${profile.sex}, dx=[${profile.diagnoses.slice(0, 2).join("; ")}]`,
      ...labKaynakSatirlari({ originalSayisi, datasetSayisi }),
      ...(KAYNAKLAR_SABLONLARI[sablon.hastalikKey] || []),
    ],
  };
}

export function poliklinikGetir(key: string): PoliklinikSablonu | undefined {
  return poliklinikler.find((p) => p.key === key);
}

// Bir aksiyon bu vaka için relevant mı?
export function aksiyonRelevantMi(vaka: Vaka, aksiyon: string): boolean {
  return vaka.relevantAksiyonlar.includes(aksiyon);
}
