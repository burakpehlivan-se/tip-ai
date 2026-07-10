/**
 * Hasta yanıt tutarlılık katmanı
 *
 * Sorun: genelYanitlar içinde AGRI_SIDDAT="ağrı var" + AGRI_SKALA="ağrı yok"
 * ve şablonda eksik chip aksiyonları → çelişkili / "Anlamadım" cevaplar.
 *
 * Çözüm:
 * 1) Tüm chip aksiyonları için tutarlı NEGATİF/normal varsayılanlar
 * 2) Şablon yanıtları üzerine yazılır (öncelik)
 * 3) Vaka ağrı-pozitifse eksik ağrı ailesi cevapları doldurulur (göğüs/karın bağlamına göre)
 */

import { SoruChipi } from "../types";

/** Yanıt negatif/yok mu? */
export function yanitNegatifMi(metin: string | undefined): boolean {
  if (!metin) return true;
  const t = metin
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

  if (/\byok\b|\byoktur\b|hissetmiyorum|fark etmedim|farketmedim|olmad[ıi]|gormuyorum/.test(t)) {
    // "var ama yok değil" nadir; "ağrım yok" net negatif
    if (/\bvar\b/.test(t) && !/\byok\b/.test(t)) return false;
    return true;
  }
  // "0/10" skala
  if (/0\s*\/\s*10|skala.*0\b|^0$/.test(t) && /agri|skala|puan/.test(t)) return true;
  return false;
}

export function yanitPozitifMi(metin: string | undefined): boolean {
  if (!metin) return false;
  if (yanitNegatifMi(metin)) return false;
  const t = metin.toLowerCase();
  return (
    /\bvar\b|evet|şiddetli|siddetli|yayılıyor|yayiliyor|baskı|baski|ağrı|agri|yanma|sıkıntı|zorlan|artıyor|artiyor|başladı|basladi|saat|gündür|hafta|yayıl|sag alt|sağ alt|gobek|göbek/.test(
      t
    ) || metin.trim().length > 30
  );
}

/** Tüm chip aksiyonları için nötr/negatif varsayılanlar (çelişkisiz) */
export function buildDefaultYanitlar(chipHavuzu: SoruChipi[]): Record<string, string> {
  const d: Record<string, string> = {
    OZEL: "Bunu tam anlayamadım; başka şekilde sorabilir misiniz?",

    AGRI_YER: "Belirgin bir ağrım yok.",
    AGRI_SURE: "Ağrım yok, süre söyleyemem.",
    AGRI_YAYILIM: "Ağrım yok, yayılım da yok.",
    AGRI_EFOR: "Eforla gelen bir ağrım yok.",
    AGRI_SIDDAT: "Ağrım yok.",
    AGRI_SKALA: "Ağrı skalası 0/10 — ağrım yok.",
    AGRI_HAFIFLETEN: "Ağrım olmadığı için bir şey söyleyemem.",
    AGRI_ARTIRAN: "Ağrım yok.",
    AGRI_KESICI_ETKI: "Ağrı kesici denemedim; ağrım yok.",
    GOGUS_AGRISI: "Göğüs ağrım yok.",
    KARIN_AGRISI: "Karın ağrım yok.",
    EPIGASTRIK_AGRI: "Epigastrik ağrı veya yanma yok.",
    RETROSTERNAL_AGRI: "Göğüs kemiği arkasında ağrı yok.",
    BAS_AGRISI: "Baş ağrım yok.",
    SIRT_AGRISI: "Sırt ağrım yok.",
    EKLEM_AGRISI: "Eklem ağrım yok.",
    MEME_AGRI: "Memede ağrı veya hassasiyet yok.",
    ANUS_AGRI: "Anüste ağrı yok.",
    YAN_AGRISI: "Yan/böğür ağrım yok.",

    KITLE_SURE: "Ele gelen kitle fark etmedim.",
    KITLE_AGRI: "Kitlem yok.",
    BUYUME: "Kitle fark etmedim.",
    BATIN_KITLE: "Karnımda ele gelen kitle yok.",
    OKSURUK: "Öksürüğüm yok.",
    BALGAM: "Balgamım yok.",
    ATES_SORGU: "Ateşim yok gibi.",
    ATES_SURE: "Ateş basmıyor.",
    NEFES_DARLIGI: "Nefes darlığım yok.",
    ODEM: "Bacaklarımda şişlik yok.",
    YUZ_ODEM: "Yüzümde şişlik yok.",
    PRETIBIAL_ODEM: "Pretibial ödem yok.",
    IDRAR_AZALMA: "İdrar miktarım normal.",
    HALSIZLIK: "Halsizlik tarif etmiyorum.",
    POLIURI: "Sık idrara çıkmıyorum.",
    POLIDIPSI: "Aşırı susuzluk hissetmiyorum.",
    KILO_KAYBI: "Kilo kaybım yok.",
    KILO_KAYBI_AYLIK: "Kilo değişimim yok.",
    KILO_ALIM: "Kilo almadım.",
    KILO_ALIM_AYLIK: "Kilo değişimim yok.",
    ISTAHSIZLIK: "İştahım normal.",
    POLIFAJI: "Aşırı yeme isteğim yok.",
    GORME: "Görmem normal.",
    SOGUK: "Üşüme yakınmam yok.",
    SICAK_INTOLERANS: "Sıcağa intoleransım yok.",
    KABIZLIK: "Kabız değilim.",
    ISHAL: "İshalim yok.",
    SAKAL_DOKULME: "Belirgin saç dökülmesi yok.",
    AKINTI: "Akıntım yok.",
    MENSTRUASYON: "Bu soru şimdilik ilgili değil / özellik yok.",
    BULANTI: "Bulantım yok.",
    KUSMA: "Kusmam yok.",
    TERLEME: "Aşırı terlemem yok.",
    TITREME: "Titremem yok.",
    BAS_DONMESI: "Baş dönmem yok.",
    SES_KISIKLIGI: "Sesim normal.",
    YUTKUNMA: "Yutkunmam normal.",
    ODINOFAJI: "Yutkunurken ağrım yok.",
    AGIZ_KURULUGU: "Ağız kuruluğum yok.",
    TAT_DEGISIKLIGI: "Tat almam normal.",
    HALITOZIS: "Kötü ağız kokusu yok.",
    REGURJITASYON: "Regürjitasyon yok.",
    GAZ_SISKINLIK: "Belirgin şişkinlik yok.",
    GEGINME: "Normal.",
    TENEZM: "Tenezm yok.",
    DISKI_KACIRMA: "Dışkı kaçırma yok.",
    GENIZ_AKINTISI: "Geniz akıntım yok.",
    BOGAZ_AGRISI: "Boğaz ağrım yok.",
    ORAL_AFT: "Ağızda yara yok.",
    DIS_ETI_KANAMA: "Diş eti kanamam yok.",
    ANUS_KASINTI: "Kaşıntı yok.",

    SIKAYET: "Ana şikayetim peşin söylendiği gibi.",
    SIKAYET_SURE: "Şikayetim bir süredir devam ediyor.",
    ESLIK_EDEN: "Başka belirgin şikayetim yok.",
    SARILIK: "Sarılık geçirmedim.",
    ANEMI_HIKAYESI: "Anemi öyküm yok.",
    LENFADENOPATI: "Lenf bezi şişliği yok.",
    KOLAY_MORARMA: "Kolay morarmam yok.",
    LAKTASYON: "Yok.",
    MEME_BASI_DEGISIM: "Yok.",
    JINEKOMASTI: "Yok.",
    VUCUT_GELISIM: "Normal.",
    SAC_KIL_DAGILIM: "Normal.",
    GUATR: "Guatrım yok.",

    HT_OYKUSU: "Hipertansiyonum yok / bilmiyorum.",
    KAH_OYKUSU: "Koroner arter hastalığım yok.",
    DIYABET: "Diyabetim yok.",
    DIYABET_OYKUSU: "Diyabetim yok.",
    HEPATIT_OYKUSU: "Hepatit geçirmedim.",
    TBC_OYKUSU: "Tüberküloz geçirmedim.",
    KOAH_OYKUSU: "KOAH veya astım tanım yok.",
    KANSER_OYKUSU: "Kanser öyküm yok.",
    BÖBREK_OYKUSU: "Böbrek hastalığım yok.",
    KARACIGER_OYKUSU: "Karaciğer hastalığım yok.",
    PSIKIYATRIK: "Psikiyatrik hastalık öyküm yok.",
    ILAC: "Düzenli ilaç kullanmıyorum.",
    ILAC_OYKUSU: "Düzenli ilaç yok.",
    ALERJI: "Bilinen alerjim yok.",
    ILAC_ALERJI: "İlaç alerjim yok.",
    AGRI_KESICI: "Düzenli ağrı kesici kullanmıyorum.",
    AGRI_KESICI_ICME: "Hayır, ağrı kesici içmedim.",
    ENFEKSIYON_OYKUSU: "Yakın enfeksiyon öyküm yok.",
    AMALIYAT: "Ameliyatım olmadı.",
    TRAVMA: "Travma geçirmedim.",
    TRANSFUZYON: "Kan almadım.",
    HASTANE_YATIS: "Yakın zamanda yatışım yok.",
    SIGARA: "Sigara kullanmıyorum.",
    SIGARA_OYKUSU: "Sigara içmiyorum.",
    ALKOL: "Alkol kullanmıyorum.",
    DIGER_MADDE: "Madde kullanımım yok.",
    YASAM_TARZI: "Normal bir yaşamım var.",
    BESLENME: "Beslenmem normal.",
    UYKU: "Uykum normal.",
    MESLEK: "Çalışıyorum.",
    SEYAHAT: "Yakın seyahat yok.",
    ASILAR: "Aşılarım tamam sanırım.",
    COVID_ASI: "COVID aşımı oldum.",

    SOY_DIYABET: "Ailede diyabet bilmiyorum / yok.",
    SOY_HT: "Ailede hipertansiyon net bilmiyorum.",
    SOY_KALP: "Ailede kalp hastalığı yok.",
    SOY_KANSER: "Ailede kanser öyküsü yok.",
    SOY_BÖBREK: "Ailede böbrek hastalığı yok.",
    SOY_ASTIM: "Ailede astım/KOAH yok.",
    SOY_TBC: "Ailede tüberküloz yok.",
    SOY_PSIKIYATRIK: "Ailede psikiyatrik hastalık yok.",
    SOY_GUATR: "Ailede guatr yok.",
    SOY_KANAMA: "Ailede kanama bozukluğu yok.",
    SOY_SARILIK: "Ailede sarılık yok.",
    SOY_OLUM: "Ailede erken ani ölüm bilmiyorum.",
    AILE_OYKUSU: "Ailede benzer hastalık bilmiyorum.",

    VITAL_TANSIYON: "Tansiyonum yaklaşık 120/80 mmHg.",
    VITAL_NABIZ: "Nabzım yaklaşık 78/dk.",
    VITAL_ATES: "Ateşim 36.6°C.",
    VITAL_SPO2: "SpO2 %98.",
    VITAL_SOLUNUM: "Solunum sayım 16/dk.",
    VITAL_KILO: "Kilom normal aralıkta.",
    VITAL_BOY: "Boyum yaklaşık 170 cm.",

    FIZIK_BILINC: "Bilinç açık, koopere.",
    FIZIK_ORYANTASYON: "Oryantasyon tam.",
    FIZIK_KALP: "Kalp sesleri normal, üfürüm yok.",
    FIZIK_UFURUM: "Üfürüm duyulmadı.",
    FIZIK_AKCIGER: "Akciğer sesleri doğal.",
    FIZIK_SOLUNUM: "Yardımcı solunum kası yok, siyanoz yok.",
    FIZIK_KARIN: "Karın rahat, hassasiyet yok.",
    FIZIK_DEFANS: "Defans/rebound yok.",
    FIZIK_KARACIGER_DALAK: "Hepatosplenomegali yok.",
    FIZIK_BARSAK: "Barsak sesleri normoaktif.",
    FIZIK_DERI: "Deri muayenesi normal.",
    FIZIK_LENF: "Lenfadenopati yok.",
    FIZIK_MUKOZA: "Mukozalar nemli.",
    FIZIK_GOZ: "Konjonktiva ve sklera normal.",
    FIZIK_TIROID: "Tiroid normal.",
    FIZIK_MEME: "Meme muayenesi özellik yok.",
    FIZIK_BOYUN_VENOZ: "Boyun venöz dolgunluğu yok.",
    FIZIK_TRAKEA: "Trakea orta hatta.",
    FIZIK_EKSTREMITE: "Ekstremiteler doğal.",
    FIZIK_PERIFERIK_NABIZ: "Periferik nabızlar alınabiliyor.",
    FIZIK_ODEM: "Ödem yok.",

    BAYILMA: "Bayılmadım, senkop olmadı.",
    YIRTILMA_AGRI: "Yırtılma tarzında ağrı değil.",
    KAN_BALGAM: "Kanlı balgam yok.",
    KANLI_KUSMA: "Kanlı kusma yok.",
    KANLI_DISKI: "Kanlı dışkı yok.",
    AKOLIK_DISKI: "Dışkı rengim normal.",
    HIPERKALEMI_SEMPTOM: "Kas güçsüzlüğü veya çarpıntı yok.",
    KONFUZYON: "Bilinç yerinde.",
    MEME_DERI_DEGISIKLIGI: "Deri değişikliği yok.",
    AKSIlla_KITLE: "Koltuk altında kitle yok.",
    PARMAK_COMAKLASMA: "Çomaklaşma yok.",
    ANI_KILO_KAYBI: "Ani kilo kaybım yok.",
    GECE_TERLEME: "Gece terlemem yok.",
    SARARMA: "Sararma yok.",
    IDRAR_KAN: "İdrarda kan yok.",
    DISKI_RENK: "Dışkı rengim normal.",

    CARPINTI_OYKU: "Çarpıntım yok.",
    ORTOPNE: "Düz yatabiliyorum.",
    WHEEZING: "Hışıltı yok.",
    ASTIM_OYKUSU: "Astım yok.",
    HIPOTANSIYON_SOK: "Şok bulgum yok.",
    TREMOR: "Titreme yok.",
    DEHIDRATASYON: "Dehidratasyon bulgum yok.",
    AKCIGER_ODEM: "Akciğer ödemi bulgum yok.",
    TIROID_FIRTINASI: "Tiroid fırtınası bulgum yok.",
    GOZ_BULGULARI: "Göz bulgum yok.",
    SESSIZ_AKCIGER: "Akciğer seslerim duyuluyor.",
    TETIKLEYICI: "Belirgin tetikleyici bilmiyorum.",
    UYUSMA: "Uyuşma tarif etmiyorum.",
    YANMA: "Yanma hissim yok.",
    GECE_ARTIS: "Gece artan bir şikayetim yok.",
    YARA: "Açık yaram yok.",
    KEMIK_AGRISI: "Kemik ağrım yok.",
    BURUN_KANAMASI: "Burun kanamam yok.",
    GOZ_AGRISI: "Göz ağrım / kızarıklık yok.",
    DIZURI: "İdrar yaparken yanma yok.",
    POLLAKURI: "Sık idrara çıkmıyorum.",
    IDRAR_RENK: "İdrar rengim normal, berrak.",
  };

  for (const chip of chipHavuzu) {
    if (!d[chip.aksiyon]) {
      d[chip.aksiyon] = "Bu konuda belirgin bir şikayetim yok / normal.";
    }
  }
  return d;
}

const AGRI_GENEL_POZITIF: Record<string, string> = {
  AGRI_SIDDAT: "Ağrım var; oldukça rahatsız edici.",
  AGRI_SKALA: "10 üzerinden yaklaşık 7-8 diyebilirim.",
  AGRI_HAFIFLETEN: "Dinlenince veya pozisyon değiştirince biraz hafifliyor.",
  AGRI_ARTIRAN: "Hareketle artıyor.",
  AGRI_KESICI_ETKI: "Ağrı kesici aldım, kısmen azalttı ama geçmedi.",
};

const AGRI_GOGUS_POZITIF: Record<string, string> = {
  ...AGRI_GENEL_POZITIF,
  AGRI_SIDDAT: "Ağrım var; baskı/sıkıştırma tarzında, oldukça rahatsız edici.",
  AGRI_HAFIFLETEN: "Dinlenince biraz hafifliyor ama tamamen geçmiyor.",
  AGRI_ARTIRAN: "Hareket ve eforla artıyor.",
  GOGUS_AGRISI: "Evet, göğsümde ağrı/baskı var.",
  RETROSTERNAL_AGRI: "Evet, göğüs kemiğimin arkasında hissediyorum.",
};

const AGRI_KARIN_POZITIF: Record<string, string> = {
  ...AGRI_GENEL_POZITIF,
  AGRI_SIDDAT: "Karın ağrım var; giderek artıyor, sürekli.",
  AGRI_YAYILIM: "Başladığı yerden sağ alt kadrana / etrafa yayılıyor.",
  AGRI_ARTIRAN: "Hareket ve öksürükle artıyor.",
  KARIN_AGRISI: "Evet, karın ağrım var.",
  GOGUS_AGRISI: "Göğüs ağrım yok; ağrım karında.",
  RETROSTERNAL_AGRI: "Göğüs kemiği arkasında ağrı yok.",
};

const AGRI_SINYAL_KEYS = [
  "AGRI_YER",
  "AGRI_SURE",
  "AGRI_YAYILIM",
  "AGRI_EFOR",
  "GOGUS_AGRISI",
  "RETROSTERNAL_AGRI",
  "KARIN_AGRISI",
  "EPIGASTRIK_AGRI",
  "BAS_AGRISI",
  "SIRT_AGRISI",
  "MEME_AGRI",
];

type AgriBaglam = "gogus" | "karin" | "genel" | "yok";

function agriBaglam(anaSikayet: string, semptom: string, sablon: Record<string, string>): AgriBaglam {
  const t = `${anaSikayet} ${semptom}`.toLowerCase();
  // "kalp atışı" göğüs ağrısı sayılmaz — yalnızca göğüs/iskemi ifadeleri
  if (/göğüs|gogus|baskı hiss|baski hiss|stern|angina|stemi|nstemi|retrosternal|göğüste|goguste|mi\b|enfarkt/.test(t))
    return "gogus";
  if (/karın|karin|göbek|gobek|apandis|sağ alt|sag alt|epigastr|batın|batin|kolesist|pankreat/.test(t))
    return "karin";
  if (yanitPozitifMi(sablon.KARIN_AGRISI) || yanitPozitifMi(sablon.AGRI_YER) && /karın|alt|gobek|göbek/i.test(sablon.AGRI_YER || ""))
    return "karin";
  if (yanitPozitifMi(sablon.GOGUS_AGRISI) || yanitPozitifMi(sablon.AGRI_YER) && /göğüs|baskı|stern|kol/i.test(sablon.AGRI_YER || ""))
    return "gogus";
  if (/ağrı|agri|sancı|sanci|yanma|hassasiyet/.test(t)) return "genel";
  if (AGRI_SINYAL_KEYS.some((k) => yanitPozitifMi(sablon[k]))) return "genel";
  return "yok";
}

/**
 * Şablon + varsayılanları birleştirir, ağrı tutarlılığını sağlar.
 */
export function enrichHastaYanitlari(
  sablonYanitlari: Record<string, string>,
  opts: {
    chipHavuzu: SoruChipi[];
    anaSikayet: string;
    semptom?: string;
  }
): Record<string, string> {
  const defaults = buildDefaultYanitlar(opts.chipHavuzu);
  const out: Record<string, string> = { ...defaults, ...sablonYanitlari };

  if (!sablonYanitlari.SIKAYET && opts.anaSikayet) {
    out.SIKAYET = opts.anaSikayet;
  }

  const baglam = agriBaglam(opts.anaSikayet, opts.semptom || "", sablonYanitlari);
  const sablonPozitifAgri = AGRI_SINYAL_KEYS.some((k) => yanitPozitifMi(sablonYanitlari[k]));

  if (baglam !== "yok" || sablonPozitifAgri) {
    const dolgu =
      baglam === "gogus"
        ? AGRI_GOGUS_POZITIF
        : baglam === "karin"
          ? AGRI_KARIN_POZITIF
          : AGRI_GENEL_POZITIF;

    for (const [k, v] of Object.entries(dolgu)) {
      // Şablon açıkça yazmışsa koru (pozitif veya bilinçli negatif)
      if (sablonYanitlari[k] && yanitPozitifMi(sablonYanitlari[k])) continue;
      if (sablonYanitlari[k] && yanitNegatifMi(sablonYanitlari[k]) && !sablonPozitifAgri) continue;
      // Şablon negatif ama vaka ağrılı → düzelt (AGRI_SKALA: "0" bug'ı)
      if (sablonYanitlari[k] && yanitNegatifMi(sablonYanitlari[k]) && sablonPozitifAgri) {
        out[k] = v;
        continue;
      }
      if (!sablonYanitlari[k] || yanitNegatifMi(out[k])) {
        out[k] = v;
      }
    }

    // Skala/şiddet zayıf genel cümleleri iyileştir
    if (sablonYanitlari.AGRI_SIDDAT && /net bir şey söyleyemem|bilmiyorum/i.test(sablonYanitlari.AGRI_SIDDAT)) {
      out.AGRI_SIDDAT = dolgu.AGRI_SIDDAT || AGRI_GENEL_POZITIF.AGRI_SIDDAT;
    }
  }

  if (!out.OZEL) out.OZEL = defaults.OZEL;
  return out;
}
