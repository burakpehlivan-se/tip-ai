import { Vaka, Seviye, Hasta, Rubric, TestSonucu, SoruChipi, ChipKategorisi, Cinsiyet, TedaviPlani } from "../types";
import { birlestirTestler, buildClinicalProfile } from "./lab-katalog";
import { labKaynakSatirlari } from "./lab-kaynaklari";
import { enrichHastaYanitlari } from "./hasta-yanit-enrich";

export interface PoliklinikSablonu {
  key: string;
  ad: string;
  icon: string;
  aciklama: string;
  hastalikSablonlari: HastalikSablonu[];
}

export interface HastalikSablonu {
  hastalikKey: string;
  hastalikAdi: string;
  semptomSablonu: (h: Hasta) => string;
  anaSikayetSablonu: (h: Hasta) => string;
  ozetBilgilerSablonu: (h: Hasta) => string[];
  yasAraligi: [number, number];
  cinsiyetTercih: "E" | "K" | "herhangi";
  seviye: Seviye;
  rubric: Rubric;
  statikTestler: () => Record<string, TestSonucu>;
  hastaYanitlari: () => Record<string, string>;
  soruChipleri: string[];
  idealYol: string[];
  egitimNotu: string;
}

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
  // TC Kimlik No algoritması (11 haneli)
  // 1. hane 0 olamaz
  const digits: number[] = [Math.floor(Math.random() * 9) + 1];
  for (let i = 1; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  // 10. hane: (tek haneler toplamı * 7 - çift haneler toplamı) mod 10
  const tekToplam = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const ciftToplam = digits[1] + digits[3] + digits[5] + digits[7];
  digits.push((tekToplam * 7 - ciftToplam) % 10);
  // 11. hane: tüm 10 hanenin toplamı mod 10
  const tumToplam = digits.reduce((a, b) => a + b, 0);
  digits.push(tumToplam % 10);
  return digits.join("");
}

// ─── Ortak Chip Havuzu (NÖHÜ Tıp Fak. Anamnez ve FM Formu Bazlı) ───
export const CHIP_HAVUZU: SoruChipi[] = [
  // ── Şikayet & Semptom ──
  { etiket: "Ağrının yeri nerede?", aksiyon: "AGRI_YER", kategori: "anamnez-agri" },
  { etiket: "Ne zamandır var?", aksiyon: "AGRI_SURE", kategori: "anamnez-agri" },
  { etiket: "Yayılıyor mu?", aksiyon: "AGRI_YAYILIM", kategori: "anamnez-agri" },
  { etiket: "Eforla geliyor mu?", aksiyon: "AGRI_EFOR", kategori: "anamnez-agri" },
  { etiket: "Ağrı şiddeti nasıl?", aksiyon: "AGRI_SIDDAT", kategori: "anamnez-agri" },
  { etiket: "Ağrın 10 üzerinden kaç?", aksiyon: "AGRI_SKALA", kategori: "anamnez-agri" },
  { etiket: "Ağrıyı ne hafifletiyor?", aksiyon: "AGRI_HAFIFLETEN", kategori: "anamnez-agri" },
  { etiket: "Ağrıyı ne artırıyor?", aksiyon: "AGRI_ARTIRAN", kategori: "anamnez-agri" },
  { etiket: "Göğüste ağrı var mı?", aksiyon: "GOGUS_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Karın ağrısı var mı (yer/şiddet/süre)?", aksiyon: "KARIN_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Epigastrik ağrı / yanma var mı?", aksiyon: "EPIGASTRIK_AGRI", kategori: "anamnez-agri" },
  { etiket: "Retrosternal ağrı var mı?", aksiyon: "RETROSTERNAL_AGRI", kategori: "anamnez-agri" },
  { etiket: "Baş ağrın var mı?", aksiyon: "BAS_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Sırt ağrın var mı?", aksiyon: "SIRT_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Eklem ağrın var mı?", aksiyon: "EKLEM_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Memede ağrı / hassasiyet var mı?", aksiyon: "MEME_AGRI", kategori: "anamnez-agri" },
  { etiket: "Anüste ağrı / yanma var mı?", aksiyon: "ANUS_AGRI", kategori: "anamnez-agri" },
  { etiket: "Kitle / yumru ne zamandır var?", aksiyon: "KITLE_SURE", kategori: "anamnez-agri" },
  { etiket: "Kitle ağrılı mı?", aksiyon: "KITLE_AGRI", kategori: "anamnez-agri" },
  { etiket: "Kitle büyüyor mu?", aksiyon: "BUYUME", kategori: "anamnez-agri" },
  { etiket: "Ele gelen kitle var mı (batında)?", aksiyon: "BATIN_KITLE", kategori: "anamnez-agri" },
  { etiket: "Öksürüğün ne zamandır var?", aksiyon: "OKSURUK", kategori: "anamnez-agri" },
  { etiket: "Balgam var mı (renk/miktar)?", aksiyon: "BALGAM", kategori: "anamnez-agri" },
  { etiket: "Ateşin var mı?", aksiyon: "ATES_SORGU", kategori: "anamnez-agri" },
  { etiket: "Ateş kaç gündür var?", aksiyon: "ATES_SURE", kategori: "anamnez-agri" },
  { etiket: "Nefes darlığın var mı?", aksiyon: "NEFES_DARLIGI", kategori: "anamnez-agri" },
  { etiket: "Bacaklarda / ayaklarda şişlik var mı?", aksiyon: "ODEM", kategori: "anamnez-agri" },
  { etiket: "Yüzünde şişlik var mı?", aksiyon: "YUZ_ODEM", kategori: "anamnez-agri" },
  { etiket: "Pretibial ödem var mı?", aksiyon: "PRETIBIAL_ODEM", kategori: "anamnez-agri" },
  { etiket: "İdrar miktarında değişiklik var mı?", aksiyon: "IDRAR_AZALMA", kategori: "anamnez-agri" },
  { etiket: "Halsizlik /kolay yorulma var mı?", aksiyon: "HALSIZLIK", kategori: "anamnez-agri" },
  { etiket: "Sık idrara çıkıyor musun?", aksiyon: "POLIURI", kategori: "anamnez-agri" },
  { etiket: "Aşırı susuz musun?", aksiyon: "POLIDIPSI", kategori: "anamnez-agri" },
  { etiket: "Kilo verdin mi?", aksiyon: "KILO_KAYBI", kategori: "anamnez-agri" },
  { etiket: "Kaç kilo verdin (ayda/haftada)?", aksiyon: "KILO_KAYBI_AYLIK", kategori: "anamnez-agri" },
  { etiket: "Kilo aldın mı?", aksiyon: "KILO_ALIM", kategori: "anamnez-agri" },
  { etiket: "Kaç kilo aldın (ayda/haftada)?", aksiyon: "KILO_ALIM_AYLIK", kategori: "anamnez-agri" },
  { etiket: "İştahsızlık var mı?", aksiyon: "ISTAHSIZLIK", kategori: "anamnez-agri" },
  { etiket: "Polifaji (aşırı yeme) var mı?", aksiyon: "POLIFAJI", kategori: "anamnez-agri" },
  { etiket: "Görmen bulanık mı?", aksiyon: "GORME", kategori: "anamnez-agri" },
  { etiket: "Üşüyor musun?", aksiyon: "SOGUK", kategori: "anamnez-agri" },
  { etiket: "Sıcak intoleransı var mı?", aksiyon: "SICAK_INTOLERANS", kategori: "anamnez-agri" },
  { etiket: "Kabız mısın?", aksiyon: "KABIZLIK", kategori: "anamnez-agri" },
  { etiket: "İshal var mı?", aksiyon: "ISHAL", kategori: "anamnez-agri" },
  { etiket: "Saç dökülmesi / deride kuruluk var mı?", aksiyon: "SAKAL_DOKULME", kategori: "anamnez-agri" },
  { etiket: "Meme başından akıntı var mı?", aksiyon: "AKINTI", kategori: "anamnez-agri" },
  { etiket: "Menopoza girdin mi?", aksiyon: "MENSTRUASYON", kategori: "anamnez-agri" },
  { etiket: "Bulantı var mı?", aksiyon: "BULANTI", kategori: "anamnez-agri" },
  { etiket: "Kusma var mı (hematemez?)?", aksiyon: "KUSMA", kategori: "anamnez-agri" },
  { etiket: "Terleme var mı?", aksiyon: "TERLEME", kategori: "anamnez-agri" },
  { etiket: "Titreme var mı?", aksiyon: "TITREME", kategori: "anamnez-agri" },
  { etiket: "Baş dönmen var mı?", aksiyon: "BAS_DONMESI", kategori: "anamnez-agri" },
  { etiket: "Ses kısıklığı / çatallanma var mı?", aksiyon: "SES_KISIKLIGI", kategori: "anamnez-agri" },
  { etiket: "Yutkunma zorluğun var mı?", aksiyon: "YUTKUNMA", kategori: "anamnez-agri" },
  { etiket: "Ağrılı yutkunma var mı?", aksiyon: "ODINOFAJI", kategori: "anamnez-agri" },
  { etiket: "Ağız kuruluğu var mı?", aksiyon: "AGIZ_KURULUGU", kategori: "anamnez-agri" },
  { etiket: "Tat değişikliği / ağızda yanma var mı?", aksiyon: "TAT_DEGISIKLIGI", kategori: "anamnez-agri" },
  { etiket: "Halitozis (kötü ağız kokusu) var mı?", aksiyon: "HALITOZIS", kategori: "anamnez-agri" },
  { etiket: "Regürjitasyon / Pyrozis var mı?", aksiyon: "REGURJITASYON", kategori: "anamnez-agri" },
  { etiket: "Gaz / şişkinlik var mı?", aksiyon: "GAZ_SISKINLIK", kategori: "anamnez-agri" },
  { etiket: "Geğirme var mı?", aksiyon: "GEGINME", kategori: "anamnez-agri" },
  { etiket: "Tenezm var mı?", aksiyon: "TENEZM", kategori: "anamnez-agri" },
  { etiket: "Dışkı kaçırma var mı?", aksiyon: "DISKI_KACIRMA", kategori: "anamnez-agri" },
  { etiket: "Geniz akıntısı var mı?", aksiyon: "GENIZ_AKINTISI", kategori: "anamnez-agri" },
  { etiket: "Boğaz ağrısı var mı?", aksiyon: "BOGAZ_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Ağızda yara (aft) var mı?", aksiyon: "ORAL_AFT", kategori: "anamnez-agri" },
  { etiket: "Diş etlerinde kanama var mı?", aksiyon: "DIS_ETI_KANAMA", kategori: "anamnez-agri" },
  { etiket: "Anüste kaşıntı var mı?", aksiyon: "ANUS_KASINTI", kategori: "anamnez-agri" },
  // ── Sistem Sorgusu ──
  { etiket: "Şikayetiniz nedir?", aksiyon: "SIKAYET", kategori: "anamnez-sistemik" },
  { etiket: "Şikayet ne zaman başladı?", aksiyon: "SIKAYET_SURE", kategori: "anamnez-sistemik" },
  { etiket: "Eşlik eden başka belirti var mı?", aksiyon: "ESLIK_EDEN", kategori: "anamnez-sistemik" },
  { etiket: "Sarılık geçirdiniz mi?", aksiyon: "SARILIK", kategori: "anamnez-sistemik" },
  { etiket: "Anemi hikayeniz var mı?", aksiyon: "ANEMI_HIKAYESI", kategori: "anamnez-sistemik" },
  { etiket: "Lenf bezlerinde şişme oldu mu?", aksiyon: "LENFADENOPATI", kategori: "anamnez-sistemik" },
  { etiket: "Kolay morarma / kanama var mı?", aksiyon: "KOLAY_MORARMA", kategori: "anamnez-sistemik" },
  { etiket: "Laktasyon / galaktore var mı?", aksiyon: "LAKTASYON", kategori: "anamnez-sistemik" },
  { etiket: "Meme başında değişiklik var mı?", aksiyon: "MEME_BASI_DEGISIM", kategori: "anamnez-sistemik" },
  { etiket: "Jinekomasti var mı?", aksiyon: "JINEKOMASTI", kategori: "anamnez-sistemik" },
  { etiket: "Vücut gelişiminde değişiklik?", aksiyon: "VUCUT_GELISIM", kategori: "anamnez-sistemik" },
  { etiket: "Saç ve kıl dağılımı nasıl?", aksiyon: "SAC_KIL_DAGILIM", kategori: "anamnez-sistemik" },
  { etiket: "Guatr var mı?", aksiyon: "GUATR", kategori: "anamnez-sistemik" },

  // ── Özgeçmiş ──
  { etiket: "Hipertansiyon var mı?", aksiyon: "HT_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Koroner arter hastalığı var mı?", aksiyon: "KAH_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Diyabetin var mı?", aksiyon: "DIYABET", kategori: "anamnez-oyku" },
  { etiket: "Hepatit geçirdin mi?", aksiyon: "HEPATIT_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Tüberküloz geçirdin mi?", aksiyon: "TBC_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "KOAH / Astım var mı?", aksiyon: "KOAH_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Kanser tanın var mı?", aksiyon: "KANSER_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Böbrek hastalığın var mı?", aksiyon: "BÖBREK_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Karaciğer hastalığın var mı?", aksiyon: "KARACIGER_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Psikiyatrik hastalık var mı?", aksiyon: "PSIKIYATRIK", kategori: "anamnez-oyku" },
  { etiket: "Hangi ilaçları kullanıyorsun?", aksiyon: "ILAC", kategori: "anamnez-oyku" },
  { etiket: "Alerjin var mı?", aksiyon: "ALERJI", kategori: "anamnez-oyku" },
  { etiket: "İlaç alerjin var mı?", aksiyon: "ILAC_ALERJI", kategori: "anamnez-oyku" },
  { etiket: "Ağrı kesici kullanıyor musun?", aksiyon: "AGRI_KESICI", kategori: "anamnez-oyku" },
  { etiket: "Ağrı kesici içtin mi?", aksiyon: "AGRI_KESICI_ICME", kategori: "anamnez-oyku" },
  { etiket: "Ağrı kesici içince ağrı geçiyor mu?", aksiyon: "AGRI_KESICI_ETKI", kategori: "anamnez-agri" },
  { etiket: "Geçirdiğin enfeksiyonlar neler?", aksiyon: "ENFEKSIYON_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Ameliyat geçirdin mi?", aksiyon: "AMALIYAT", kategori: "anamnez-oyku" },
  { etiket: "Travma geçirdin mi?", aksiyon: "TRAVMA", kategori: "anamnez-oyku" },
  { etiket: "Kan transfüzyonu aldın mı?", aksiyon: "TRANSFUZYON", kategori: "anamnez-oyku" },
  { etiket: "Hastaneye yattın mı?", aksiyon: "HASTANE_YATIS", kategori: "anamnez-oyku" },
  { etiket: "Sigara içiyor musun?", aksiyon: "SIGARA", kategori: "anamnez-oyku" },
  { etiket: "Kaç yıl / ne kadar sigara?", aksiyon: "SIGARA_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Alkol kullanıyor musun?", aksiyon: "ALKOL", kategori: "anamnez-oyku" },
  { etiket: "Başka madde kullanımı var mı?", aksiyon: "DIGER_MADDE", kategori: "anamnez-oyku" },
  { etiket: "Spor / fizik aktivite yapıyor musun?", aksiyon: "YASAM_TARZI", kategori: "anamnez-oyku" },
  { etiket: "Beslenme alışkanlığın nasıl?", aksiyon: "BESLENME", kategori: "anamnez-oyku" },
  { etiket: "Uyku düzenin nasıl?", aksiyon: "UYKU", kategori: "anamnez-oyku" },
  { etiket: "Mesleğin ne?", aksiyon: "MESLEK", kategori: "anamnez-oyku" },
  { etiket: "Seyahat öykün var mı?", aksiyon: "SEYAHAT", kategori: "anamnez-oyku" },
  // Aşılar
  { etiket: "Aşıların tam mı (BCG/HepB/DBT)?", aksiyon: "ASILAR", kategori: "anamnez-oyku" },
  { etiket: "COVID-19 aşısı oldun mu?", aksiyon: "COVID_ASI", kategori: "anamnez-oyku" },

  // ── Soy Geçmiş ──
  { etiket: "Ailede diyabet var mı?", aksiyon: "SOY_DIYABET", kategori: "soygecmis" },
  { etiket: "Ailede hipertansiyon var mı?", aksiyon: "SOY_HT", kategori: "soygecmis" },
  { etiket: "Ailede kalp hastalığı var mı?", aksiyon: "SOY_KALP", kategori: "soygecmis" },
  { etiket: "Ailede kanser var mı?", aksiyon: "SOY_KANSER", kategori: "soygecmis" },
  { etiket: "Ailede böbrek hastalığı var mı?", aksiyon: "SOY_BÖBREK", kategori: "soygecmis" },
  { etiket: "Ailede astım / KOAH var mı?", aksiyon: "SOY_ASTIM", kategori: "soygecmis" },
  { etiket: "Ailede tüberküloz var mı?", aksiyon: "SOY_TBC", kategori: "soygecmis" },
  { etiket: "Ailede psikiyatrik hastalık var mı?", aksiyon: "SOY_PSIKIYATRIK", kategori: "soygecmis" },
  { etiket: "Ailede guatr var mı?", aksiyon: "SOY_GUATR", kategori: "soygecmis" },
  { etiket: "Ailede kanama bozukluğu var mı?", aksiyon: "SOY_KANAMA", kategori: "soygecmis" },
  { etiket: "Ailede sarılık var mı?", aksiyon: "SOY_SARILIK", kategori: "soygecmis" },
  { etiket: "Ailede bilinmeyen ölüm var mı?", aksiyon: "SOY_OLUM", kategori: "soygecmis" },

  // ── Vital Bulgular ──
  { etiket: "Tansiyonun kaç?", aksiyon: "VITAL_TANSIYON", kategori: "vital" },
  { etiket: "Nabzın kaç?", aksiyon: "VITAL_NABIZ", kategori: "vital" },
  { etiket: "Ateşin kaç (°C)?", aksiyon: "VITAL_ATES", kategori: "vital" },
  { etiket: "SpO2 / oksijen satürasyonu?", aksiyon: "VITAL_SPO2", kategori: "vital" },
  { etiket: "Solunum sayın kaç?", aksiyon: "VITAL_SOLUNUM", kategori: "vital" },
  { etiket: "Kilon kaç?", aksiyon: "VITAL_KILO", kategori: "vital" },
  { etiket: "Boyun kaç?", aksiyon: "VITAL_BOY", kategori: "vital" },

  // ── Fizik Muayene ──
  { etiket: "Genel durum / bilinç nasıl?", aksiyon: "FIZIK_BILINC", kategori: "fizik" },
  { etiket: "Kooperasyon / oryantasyon?", aksiyon: "FIZIK_ORYANTASYON", kategori: "fizik" },
  { etiket: "Kalp tepe atımı / S1-S2?", aksiyon: "FIZIK_KALP", kategori: "fizik" },
  { etiket: "Ek ses / üfürüm var mı?", aksiyon: "FIZIK_UFURUM", kategori: "fizik" },
  { etiket: "Akciğer sesleri nasıl?", aksiyon: "FIZIK_AKCIGER", kategori: "fizik" },
  { etiket: "Yardımcı solunum kası / siyanoz?", aksiyon: "FIZIK_SOLUNUM", kategori: "fizik" },
  { etiket: "Karın muayenesi nasıl?", aksiyon: "FIZIK_KARIN", kategori: "fizik" },
  { etiket: "Defans / rebound var mı?", aksiyon: "FIZIK_DEFANS", kategori: "fizik" },
  { etiket: "Karaciğer / dalak ele geliyor mu?", aksiyon: "FIZIK_KARACIGER_DALAK", kategori: "fizik" },
  { etiket: "Barsak sesleri nasıl?", aksiyon: "FIZIK_BARSAK", kategori: "fizik" },
  { etiket: "Deri muayenesi nasıl?", aksiyon: "FIZIK_DERI", kategori: "fizik" },
  { etiket: "Lenf nodları büyümüş mü?", aksiyon: "FIZIK_LENF", kategori: "fizik" },
  { etiket: "Mukozalar / ağız hijyeni?", aksiyon: "FIZIK_MUKOZA", kategori: "fizik" },
  { etiket: "Göz muayenesi (konjonktiva/sklera)?", aksiyon: "FIZIK_GOZ", kategori: "fizik" },
  { etiket: "Tiroid muayenesi nasıl?", aksiyon: "FIZIK_TIROID", kategori: "fizik" },
  { etiket: "Meme muayenesi nasıl?", aksiyon: "FIZIK_MEME", kategori: "fizik" },
  { etiket: "Boyun venöz dolgunluğu var mı?", aksiyon: "FIZIK_BOYUN_VENOZ", kategori: "fizik" },
  { etiket: "Trakea pozisyonu normal mi?", aksiyon: "FIZIK_TRAKEA", kategori: "fizik" },
  { etiket: "Ekstremite muayenesi nasıl?", aksiyon: "FIZIK_EKSTREMITE", kategori: "fizik" },
  { etiket: "Periferik nabızlar (DP/TP)?", aksiyon: "FIZIK_PERIFERIK_NABIZ", kategori: "fizik" },

  // ── Kritik Sorgulama (Red Flags) ──
  { etiket: "Bayılma / senkop oldu mu?", aksiyon: "BAYILMA", kategori: "red-flag" },
  { etiket: "Yırtılma tarzında ağrı mı?", aksiyon: "YIRTILMA_AGRI", kategori: "red-flag" },
  { etiket: "Kanlı balgam (hemoptizi) var mı?", aksiyon: "KAN_BALGAM", kategori: "red-flag" },
  { etiket: "Kanlı kusma (hematemez) var mı?", aksiyon: "KANLI_KUSMA", kategori: "red-flag" },
  { etiket: "Kanlı dışkı (melena/hematokezya) var mı?", aksiyon: "KANLI_DISKI", kategori: "red-flag" },
  { etiket: "Akolik dışkı var mı?", aksiyon: "AKOLIK_DISKI", kategori: "red-flag" },
  { etiket: "Kas güçsüzlüğü / çarpıntı var mı?", aksiyon: "HIPERKALEMI_SEMPTOM", kategori: "red-flag" },
  { etiket: "Bilinç değişikliği / konfüzyon var mı?", aksiyon: "KONFUZYON", kategori: "red-flag" },
  { etiket: "Deride değişiklik (retraksiyon) var mı?", aksiyon: "MEME_DERI_DEGISIKLIGI", kategori: "red-flag" },
  { etiket: "Koltuk altında kitle var mı?", aksiyon: "AKSIlla_KITLE", kategori: "red-flag" },
  { etiket: "Kemik ağrın var mı?", aksiyon: "KEMIK_AGRISI", kategori: "red-flag" },
  // Rubrikte sık geçen ama chip’te eksik olanlar
  { etiket: "Aile öyküsü var mı?", aksiyon: "AILE_OYKUSU", kategori: "soygecmis" },
  { etiket: "İlaç öykün / ne kullanıyorsun?", aksiyon: "ILAC_OYKUSU", kategori: "anamnez-oyku" },
  { etiket: "Çarpıntın var mı?", aksiyon: "CARPINTI_OYKU", kategori: "anamnez-agri" },
  { etiket: "Uyuşma var mı?", aksiyon: "UYUSMA", kategori: "anamnez-agri" },
  { etiket: "Yanma hissi var mı?", aksiyon: "YANMA", kategori: "anamnez-agri" },
  { etiket: "Gece artıyor mu?", aksiyon: "GECE_ARTIS", kategori: "anamnez-agri" },
  { etiket: "Yara / ülser var mı?", aksiyon: "YARA", kategori: "anamnez-agri" },
  { etiket: "İdrar rengin nasıl?", aksiyon: "IDRAR_RENK", kategori: "anamnez-agri" },
  { etiket: "İdrar yaparken yanma (dizüri)?", aksiyon: "DIZURI", kategori: "anamnez-agri" },
  { etiket: "Sık idrara çıkma (pollaküri)?", aksiyon: "POLLAKURI", kategori: "anamnez-agri" },
  { etiket: "Burun kanaması var mı?", aksiyon: "BURUN_KANAMASI", kategori: "red-flag" },
  { etiket: "Ortopne (düz yatınca nefes darlığı)?", aksiyon: "ORTOPNE", kategori: "anamnez-agri" },
  { etiket: "Gözde ağrı / kızarıklık?", aksiyon: "GOZ_AGRISI", kategori: "anamnez-agri" },
  { etiket: "Parmaklarda çomaklaşma var mı?", aksiyon: "PARMAK_COMAKLASMA", kategori: "red-flag" },
  { etiket: "Ani kilo kaybı var mı?", aksiyon: "ANI_KILO_KAYBI", kategori: "red-flag" },
  { etiket: "Gece terlemesi var mı?", aksiyon: "GECE_TERLEME", kategori: "red-flag" },
  { etiket: "Gözde sararma var mı?", aksiyon: "SARARMA", kategori: "red-flag" },
  { etiket: "İdrarda kan var mı?", aksiyon: "IDRAR_KAN", kategori: "red-flag" },
  { etiket: "Dışkı renginde değişiklik var mı?", aksiyon: "DISKI_RENK", kategori: "red-flag" },
];

export const CHIP_KATEGORI_ETIKETLERI: Record<ChipKategorisi, string> = {
  "anamnez-agri": "Şikayet & Semptom",
  "anamnez-sistemik": "Sistem Sorgusu",
  "anamnez-oyku": "Özgeçmiş",
  "soygecmis": "Soy Geçmiş",
  "red-flag": "Kritik Sorgulama (Red Flags)",
  "vital": "Vital Bulgular",
  "fizik": "Fizik Muayene",
};

export const CHIP_KATEGORIYE_GORE: Record<ChipKategorisi, SoruChipi[]> = (() => {
  const grup: Record<string, SoruChipi[]> = {};
  for (const chip of CHIP_HAVUZU) {
    if (!grup[chip.kategori]) grup[chip.kategori] = [];
    grup[chip.kategori].push(chip);
  }
  return grup as Record<ChipKategorisi, SoruChipi[]>;
})();


export const poliklinikler: PoliklinikSablonu[] = [
  {
    key: "kardiyoloji",
    ad: "Kardiyoloji",
    icon: "❤️",
    aciklama: "Göğüs ağrısı, çarpıntı, kalp yetmezliği vakaları",
    hastalikSablonlari: [
      {
        hastalikKey: "stemi",
        hastalikAdi: "ST Elevasyonlu MI",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, göğüste baskı`,
        anaSikayetSablonu: (h) => `Göğüste baskı hissi (${h.cinsiyet === "E" ? "erkek" : "kadın"}, ${h.yas} yaş)`,
        ozetBilgilerSablonu: (h) => [
          "Acile başvuru: 2 saattir göğüste baskı hissi",
          "Ağrı sol kola yayılıyor",
          "Terleme var",
          "Bilinen ek hastalık: Hipertansiyon",
        ],
        yasAraligi: [45, 75],
        cinsiyetTercih: "herhangi",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "AGRI_YER", etiket: "Ağrı yeri", aciklama: "Ağrının yeri sorulmalı" },
            { key: "AGRI_SURE", etiket: "Ağrı süresi", aciklama: "Ağrının süresi sorulmalı" },
            { key: "AGRI_YAYILIM", etiket: "Ağrı yayılımı", aciklama: "Ağrının yayılımı sorulmalı" },
            { key: "AGRI_EFOR", etiket: "Eforla ilişki", aciklama: "Ağrının eforla ilişkisi sorulmalı" },
            { key: "ESLIK_EDEN", etiket: "Eşlik eden semptomlar", aciklama: "Bulantı, terleme, nefes darlığı" },
            { key: "AILE_OYKUSU", etiket: "Aile öyküsü", aciklama: "Ailede kalp hastalığı öyküsü" },
          ],
          beklenenTestler: [
            { key: "EKG", etiket: "EKG", aciklama: "EKG istenmeli (12 derivasyon)" },
            { key: "TROPONIN", etiket: "Troponin", aciklama: "Troponin istenmeli" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Tam kan sayımı" },
          ],
          gereksizTestler: [
            { key: "BT_ANJIYO", etiket: "BT Anjiyo", aciklama: "İlk aşamada gereksiz" },
          ],
          redFlagler: [
            { key: "BAYILMA", etiket: "Bayılma öyküsü", aciklama: "Senkop sorgulanmalı (red flag)" },
            { key: "YIRTILMA_AGRI", etiket: "Yırtılma tarzında ağrı", aciklama: "Aortik diseksiyon ekarte" },
          ],
          kabulEdilenTani: ["Akut Koroner Sendrom", "MI", "STEMI", "Akut Myokardiyal İnfarktüs", "ST Elevasyonlu MI"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          EKG: {
            testKey: "EKG", testAdi: "EKG (12 Derivasyon)", tip: "json",
            sonuc: { ritim: "Sinüs ritmi", kalpHizi: 92, stElevasyon: "II, III, aVF", stDepresyon: "I, aVL", aciklama: "İnferior derivasyonlarda ST elevasyon, lateral derivasyonlarda resiprokal ST depresyon" },
            referans: "ESC 2023", yorum: "İnferior STEMI bulguları mevcuttur.",
          },
          TROPONIN: {
            testKey: "TROPONIN", testAdi: "Troponin I", tip: "numeric",
            sonuc: { deger: 0.82, birim: "ng/mL", referansAralik: "< 0.04 ng/mL" },
            referans: "Lab referans aralığı", yorum: "Troponin belirgin yüksek. Miyokardiyal hasar.",
          },
          CBC: {
            testKey: "CBC", testAdi: "Hemogram", tip: "json",
            sonuc: { hemoglobin: "14.2 g/dL", lokosit: "9.8 K/uL", trombosit: "245 K/uL" },
            referans: "Lab referans aralığı", yorum: "Normal sınırlar içinde.",
          },
          KOLESTEROL: {
            testKey: "KOLESTEROL", testAdi: "Lipid Panel", tip: "json",
            sonuc: { totalKolesterol: "248 mg/dL", ldl: "168 mg/dL", hdl: "38 mg/dL", trigliserit: "210 mg/dL" },
            referans: "Lab referans aralığı", yorum: "LDL yüksek, HDL düşük.",
          },
        }),
        hastaYanitlari: () => ({
          AGRI_YER: "Göğsümün ortasında, sternum arkasında. Baskı tarzında.",
          AGRI_SURE: "Yaklaşık 2 saattir var. Aniden başladı, geçmiyor.", AGRI_SKALA:"8/10",
          AGRI_YAYILIM: "Evet, sol kola ve çeneye yayılıyor. Çok şiddetli.",
          AGRI_EFOR: "İstirahatte başladı. Eforla ilgili değildi.",
          ESLIK_EDEN: "Evet, terleme ve mide bulantısı var. Nefes darlığı da var.",
          AILE_OYKUSU: "Babam 60 yaşında kalp krizi geçirdi.",
          BAYILMA: "Hayır, bayılmadım. Ama başım döndü bir an.",
          YIRTILMA_AGRI: "Hayır, yırtılma değil. Daha çok baskı, sıkışma hissi.",
          VITAL_TANSIYON: "150/95.",
          VITAL_NABIZ: "92.",
          VITAL_ATES: "36.5°C.",
          VITAL_SPO2: "%94.",
          SIGARA: "Günde 1 paket, 30 yıldır.",
          DIYABET: "Diyabetim yok ama tansiyon için ilaç kullanıyorum.",
          ILAC: "Tansiyon için lisinopril.",
          ALERJI: "Yok.",
          AGRI_KESICI_ICME: "Hayır, herhangi bir ağrı kesici almadım.",
          AGRI_KESICI_ETKI: "Denemedim, ağrı devam ediyor.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Ağrının yeri nerede?", "Ne zamandır var?", "Yayılıyor mu?", "Eforla geliyor mu?", "Eşlik eden belirti var mı?", "Aile öyküsü var mı?", "Bayılma oldu mu?", "Yırtılma tarzında mı?"],
        idealYol: [
          "1. Anamnez: Ağrı yeri, süresi, yayılımı, eforla ilişki, eşlik eden semptomlar, aile öyküsü",
          "2. Red flag sorgulama: Bayılma, yırtılma tarzında ağrı (aortik diseksiyon ekarte)",
          "3. Vital bulgular: Tansiyon, nabız, ateş, SpO2",
          "4. EKG (12 derivasyon) — erken",
          "5. Troponin",
          "6. Hemogram",
          "7. Tanı: Akut Koroner Sendrom (STEMI — inferior)",
          "8. Reperfüzyon (PCI) — ilk temasdan balon <90 dk",
        ],
        egitimNotu: "Bu vaka inferior ST-elevasyonlu miyokardiyal infarktüstür (STEMI). EKG'de II, III, aVF'de ST elevasyon, I, aVL'de resiprokal depresyon. TEDAVİ: Akut Koroner Sendrom protokolü — monitörizasyon, antiplatelet (aspirin + P2Y12), antikoagülan, reperfüzyon (Primer PCI).",
      },
      {
        hastalikKey: "nstemi",
        hastalikAdi: "Non-ST Elevasyonlu MI (NSTEMI)",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, diyabetik, göğüste ağrı`,
        anaSikayetSablonu: () => "Göğüste baskı + nefes darlığı",
        ozetBilgilerSablonu: (h) => [
          "2 gündür göğüste ağrı, son 3 saatte arttı",
          "Diyabetik (15 yıldır), hipertansiyon öyküsü",
          "Ağrı eforla geliyor, istirahatte hafifliyor ama tam geçmiyor",
          "Metformin + lisinopril kullanıyor",
        ],
        yasAraligi: [55, 80],
        cinsiyetTercih: "K",
        seviye: "orta",
        rubric: {
          beklenenSorular: [
            { key: "AGRI_YER", etiket: "Ağrı yeri", aciklama: "Ağrının yeri" },
            { key: "AGRI_SURE", etiket: "Ağrı süresi", aciklama: "Süre ve değişim karakteri" },
            { key: "AGRI_YAYILIM", etiket: "Ağrı yayılımı", aciklama: "Yayılım" },
            { key: "AGRI_EFOR", etiket: "Eforla ilişki", aciklama: "Unstabil angina'da kriter" },
            { key: "ESLIK_EDEN", etiket: "Eşlik eden semptomlar", aciklama: "Nefes darlığı, terleme" },
            { key: "DIYABET_OYKUSU", etiket: "Diyabet/komorbid öykü", aciklama: "Diyabet kontrolü" },
          ],
          beklenenTestler: [
            { key: "EKG", etiket: "EKG", aciklama: "EKG — NSTEMI için" },
            { key: "TROPONIN", etiket: "Troponin", aciklama: "Troponin (seri önerilir)" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Tam kan sayımı" },
          ],
          gereksizTestler: [{ key: "BT_ANJIYO", etiket: "BT Anjiyo", aciklama: "İlk aşamada gereksiz" }],
          redFlagler: [
            { key: "BAYILMA", etiket: "Bayılma öyküsü", aciklama: "Senkop — hemodinamik instabilite" },
            { key: "YIRTILMA_AGRI", etiket: "Yırtılma tarzında ağrı", aciklama: "Aortik diseksiyon ekarte" },
          ],
          kabulEdilenTani: ["Unstable Angina", "NSTEMI", "Akut Koroner Sendrom", "Non-ST Elevasyonlu MI", "Kardiyak İskemi"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          EKG: {
            testKey: "EKG", testAdi: "EKG (12 Derivasyon)", tip: "json",
            sonuc: { ritim: "Sinüs ritmi", kalpHizi: 88, stElevasyon: "Yok", stDepresyon: "V3-V6 (0.5-1 mm)", aciklama: "Anterolateral derivasyonlarda hafif ST depresyon — iskemi" },
            referans: "ESC 2023", yorum: "NSTEMI/unstabil angina. ST depresyon iskemi göstergesi.",
          },
          TROPONIN: {
            testKey: "TROPONIN", testAdi: "Troponin I", tip: "numeric",
            sonuc: { deger: 0.06, birim: "ng/mL", referansAralik: "< 0.04 ng/mL" },
            referans: "Lab", yorum: "Hafif yüksek. Seri troponin önerilir.",
          },
          CBC: {
            testKey: "CBC", testAdi: "Hemogram", tip: "json",
            sonuc: { hemoglobin: "12.8 g/dL", lokosit: "7.2 K/uL", trombosit: "230 K/uL" },
            referans: "Lab", yorum: "Hafif anemi.",
          },
          GLUKOZ: {
            testKey: "GLUKOZ", testAdi: "Açlık Kan Şekeri", tip: "numeric",
            sonuc: { deger: 168, birim: "mg/dL", referansAralik: "70-100 mg/dL" },
            referans: "ADA 2024", yorum: "Diyabet kontrolü yetersiz.",
          },
        }),
        hastaYanitlari: () => ({
          AGRI_YER: "Göğsümün sol tarafında, ortada. Baskı tarzında.",
          AGRI_SURE: "2 gündür var. Başta hafifti, son 3 saatte arttı. Eskiden geçiyordu, şimdi geçmiyor.",
          AGRI_YAYILIM: "Sol kola ve sırtıma yayılıyor.",
          AGRI_EFOR: "Evet, merdiven çıkınca artıyor. Dinlenince hafifliyor ama tam geçmiyor — bu yeni.",
          ESLIK_EDEN: "Nefes darlığı var. Biraz terleme de var.",
          AILE_OYKUSU: "Annemde diyabet vardı.",
          DIYABET_OYKUSU: "Evet, 15 yıldır diyabetim var. Metformin kullanıyorum.",
          BAYILMA: "Hayır, bayılmadım.",
          YIRTILMA_AGRI: "Hayır, yırtılma değil. Baskı tarzında, giderek artan.",
          VITAL_TANSIYON: "145/88.",
          VITAL_NABIZ: "88.",
          VITAL_ATES: "36.7°C.",
          VITAL_SPO2: "%96.",
          SIGARA: "İçmiyorum.",
          DIYABET: "Evet, 15 yıldır.",
          ILAC: "Metformin 1000mg günde iki, lisinopril 10mg.",
          ALERJI: "Yok.",
          AGRI_KESICI_ICME: "Dün akşam bir aspirin aldım ama pek fayda etmedi.",
          AGRI_KESICI_ETKI: "Hayır, ağrı kesiciyle geçmedi. Aspirin içtim, hâlâ ağrıyor.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Ağrının yeri?", "Ne zamandır?", "Yayılıyor mu?", "Eforla geliyor mu?", "Eşlik eden belirti?", "Aile öyküsü?", "Diyabetin var mı?", "Bayılma oldu mu?"],
        idealYol: [
          "1. Anamnez: Ağrı yeri, süre, yayılım, eforla ilişki, eşlik eden semptom",
          "2. Komorbid: Diyabet, hipertansiyon öyküsü",
          "3. Red flag: Bayılma, yırtılma ağrısı",
          "4. EKG — ST depresyon bulgusu",
          "5. Troponin (seri)",
          "6. Tanı: NSTEMI / Unstable Angina",
          "7. Antiplatelet + antikoagülan + koroner anjiyo planı",
        ],
        egitimNotu: "NSTEMI — ST elevasyonu yok ama troponin yüksek ve ST depresyon var. Diyabetik hastalarda atipik prezentasyon sık. TEDAVİ: Antiplatelet (ikili), antikoagülan, risk skorlaması (GRACE), koroner anjiyo kararı.",
      },
// ──Kardiyoloji: Kalp Yetmezliği ──
      {
        hastalikKey: "kalp-yetmezligi",
        hastalikAdi: "Kalp Yetmezliği",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, nefes darlığı ve bacaklarda şişlik`,
        anaSikayetSablonu: () => "Eforla nefes darlığı ve bacaklarda şişlik",
        ozetBilgilerSablonu: () => ["3 haftadır eforla nefes darlığı", "Bacaklarda şişlik (pretibial ödem)", "Ortopne (2 yastıkla uyuyor)", "Bilinen hipertansiyon, eski MI öyküsü"],
        yasAraligi: [55, 80],
        cinsiyetTercih: "E",
        seviye: "orta",
        rubric: {
          beklenenSorular: [
            { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Efor dispnesi" },
            { key: "ODEM", etiket: "Bacaklarda şişlik", aciklama: "Periferik ödem" },
            { key: "ORTOPNE", etiket: "Ortopne", aciklama: "Sol KY bulgusu" },
            { key: "HT_OYKUSU", etiket: "HT öyküsü", aciklama: "KY risk faktörü" },
            { key: "KAH_OYKUSU", etiket: "KAH/MI öyküsü", aciklama: "İskemik KY" },
            { key: "ILAC_OYKUSU", etiket: "İlaç uyumu", aciklama: "Mevcut tedavi" },
          ],
          beklenenTestler: [
            { key: "BNP", etiket: "BNP/NT-proBNP", aciklama: "KY tanı ve takip" },
            { key: "EKG", etiket: "EKG", aciklama: "İskemi/hipertrofi" },
            { key: "AKCIGER_GRAFISI", etiket: "PA Akciğer Grafisi", aciklama: "Kardiyomegali/pulmoner konjesyon" },
            { key: "KREATININ", etiket: "Kreatinin", aciklama: "Böbrek fonksiyonu" },
          ],
          gereksizTestler: [{ key: "BT_ANJIYO", etiket: "BT Anjiyo", aciklama: "İlk aşamada gereksiz" }],
          redFlagler: [
            { key: "BAYILMA", etiket: "Senkop", aciklama: "Düşük debi/aritmi" },
            { key: "HIPOTANSIYON_SOK", etiket: "Hipotansiyon/şok", aciklama: "Kardiyojenik şok" },
          ],
          kabulEdilenTani: ["Kalp Yetmezliği", "KY", "Konjestif Kalp Yetmezliği", "Heart Failure", "KKY"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          BNP: { testKey: "BNP", testAdi: "BNP (Beyin Natriüretik Peptid)", tip: "numeric", sonuc: { deger: 850, birim: "pg/mL", referansAralik: "< 100 pg/mL" }, referans: "ESC 2021 KY", yorum: "BNP belirgin yüksek — KY ile uyumlu." },
          EKG: { testKey: "EKG", testAdi: "EKG", tip: "json", sonuc: { ritim: "Sinüs taşikardisi", kalpHizi: 98, solVentHipertofi: "Mevcut", eskiMI: "Anteroseptal Q dalgaları" }, referans: "ESC", yorum: "Sol ventrikül hipertrofisi + eski MI bulguları." },
          AKCIGER_GRAFISI: { testKey: "AKCIGER_GRAFISI", testAdi: "PA Akciğer Grafisi", tip: "image", sonuc: "Kardiyomegali (KTO >%50). Pulmoner venöz konjesyon. Bilateral küçük plevral efüzyon.", referans: "Framingham", yorum: "KY bulguları: kardiyomegali + pulmoner konjesyon." },
          KREATININ: { testKey: "KREATININ", testAdi: "Kreatinin", tip: "numeric", sonuc: { deger: 1.4, birim: "mg/dL", referansAralik: "0.7-1.3" }, referans: "Lab", yorum: "Hafif yüksek — KY'ye bağlı renal hipoperfüzyon." },
        }),
        hastaYanitlari: () => ({
          NEFES_DARLIGI: "Evet, 3 haftadır. Eskiden 3 kat çıkıyordum, şimdi 1 kat çıkınca tıkanıyorum.",
          ODEM: "Evet, bacaklarım ve ayak bileklerim şişiyor. Akşamları daha kötü.",
          ORTOPNE: "Evet, düz yatamıyorum. 2 yastıkla uyuyorum. Gece nefes darlığıyla uyanıyorum.",
          HT_OYKUSU: "Evet, 20 yıldır hipertansiyonum var. İlaç kullanıyorum.",
          KAH_OYKUSU: "Evet, 5 yıl önce kalp krizi geçirdim. Stent takıldı.",
          ILAC_OYKUSU: "Ramipril, metoprolol, furosemid kullanıyorum.",
          BAYILMA: "Hayır, bayılmadım.",
          HIPOTANSIYON_SOK: "Tansiyonum 100/65, normalden düşük ama şokta değilim.",
          VITAL_TANSIYON: "100/65.", VITAL_NABIZ: "98.", VITAL_ATES: "36.5.", VITAL_SPO2: "%92.",
          SIGARA: "Eskiden içiyordum, 5 yıl önce bıraktım.", DIYABET: "Yok.",
          ILAC: "Ramipril 5mg, metoprolol 50mg, furosemid 40mg.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Nefes darlığın var mı?", "Bacaklarında şişlik var mı?", "Düz yatabiliyor musun?", "Tansiyonun yüksek mi?", "Kalp krizi geçirdin mi?", "Hangi ilaçları kullanıyorsun?"],
        idealYol: ["1. Anamnez: Efor dispnesi, ortopne, PND, periferik ödem", "2. Risk: HT, eski MI", "3. Red flag: Senkop, hipotansiyon", "4. BNP (tanı + şiddet)", "5. EKG", "6. PA Akciğer grafisi", "7. Kreatinin", "8. Tanı: Kalp Yetmezliği (EF düşük)", "9. ACEi/ARB + beta bloker + diüretik"],
        egitimNotu: "Kalp Yetmezliği — Framingham kriterleri (major: PND, ortopne, BNP>400, kardiyomegali). En sık neden: iskemik KY (eski MI). NYHA Sınıf 2-3. TEDAVİ: ACEi/ARB + beta bloker (karvedilol/metoprolol) + loop diüretik (furosemid). SGLT2i (dapagliflozin) mortaliteyi azaltır.",
      },
    
            { hastalikKey: "atriyal-fibrilasyon", hastalikAdi: "Atriyal Fibrilasyon", semptomSablonu: (h) => `${h.yas} yaş , çarpıntı ve düzensiz nabız`, anaSikayetSablonu: () => "Çarpıntı, düzensiz kalp atışı, efor intoleransı", ozetBilgilerSablonu: () => ["1 haftadır çarpıntı","Nabız düzensiz","Eforla nefes darlığı","Hipertansiyon öyküsü var"], yasAraligi: [60, 85], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"CARPINTI_OYKU",etiket:"Çarpıntı",aciklama:"Düzensiz"},{key:"NEFES_DARLIGI",etiket:"Efor dispnesi",aciklama:"Var"},{key:"HT_OYKUSU",etiket:"HT",aciklama:"Risk"},{key:"BAYILMA",etiket:"Senkop",aciklama:"Yok"},{key:"GOZ_BULGULARI",etiket:"Geçici iskemik atak",aciklama:"TIA?"}], beklenenTestler: [{key:"EKG",etiket:"EKG",aciklama:"AF ritmi"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"HEMODINAMIK_INSTABILITE",etiket:"Hemodinamik instabilite",aciklama:"Hipotansiyon+senkop"},{key:"AKUT_SVO",etiket:"Akut SVO",aciklama:"Nörolojik defisit"}], kabulEdilenTani: ["Atriyal Fibrilasyon","AF","Atrial Fibrillation"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({EKG:{testKey:"EKG",testAdi:"EKG",tip:"json",sonuc:{ritim:"Atriyal fibrilasyon (düzensiz RR)",kalpHizi:"118",pDalgasi:"Yok",qrs:"Dar"},referans:"ESC 2020 AF",yorum:"AF ile uyumlu — düzensiz ritim, P dalgası yok."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({CARPINTI_OYKU:"Kalbim düzensiz atıyor", NEFES_DARLIGI:"Merdiven çıkınca nefesim daralıyor", HT_OYKUSU:"10 yıldır tansiyon", BAYILMA:"Bayılmadım", GOZ_BULGULARI:"Konuşmamda kayma olmadı", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"110", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Çarpıntı?","Nefes darlığı?","Bayılma?","Konuşma bozukluğu?"], idealYol: ["1.Anamnez+EKG","2.CHADS-VASc skoru","3.Hız kontrolü(beta bloker)","4.Antikoagülasyon(DOAK)","5.Kardiyoversiyon(endikasyon varsa)"], egitimNotu: "AF — en sık aritmi.CHADS-VASc≥2→antikoagülasyon.TEDAVİ:Hız kontrolü(beta bloker/digoksin),ritim kontrolü(kardiyoversiyon/antiaritmik),antikoagülasyon(DOAK/vafarin)." },
      { hastalikKey: "stabil-angina", hastalikAdi: "Stabil Angina", semptomSablonu: (h) => `${h.yas} yaş erkek, eforla göğüs ağrısı`, anaSikayetSablonu: () => "Eforla gelen, dinlenince geçen göğüs ağrısı", ozetBilgilerSablonu: () => ["3 aydır eforla göğüs ağrısı","Dinlenince 5dk'da geçiyor","HT ve hiperlipidemi"], yasAraligi: [45, 70], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"AGRI_YER",etiket:"Ağrı",aciklama:"Retrosternal"},{key:"AGRI_EFOR",etiket:"Eforla",aciklama:"Tipik"},{key:"AGRI_SURE",etiket:"Süre",aciklama:"<5dk"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"},{key:"HT_OYKUSU",etiket:"HT",aciklama:"Risk"}], beklenenTestler: [{key:"EKG",etiket:"EKG",aciklama:"İskemi"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"ANSTABIL",etiket:"Unstabil",aciklama:"İstirahatte ağrı"},{key:"MI",etiket:"MI",aciklama:"ST değişikliği"}], kabulEdilenTani: ["Stabil Angina","Angina Pektoris"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({EKG:{testKey:"EKG",testAdi:"EKG",tip:"json",sonuc:{ritim:"Sinüs",kalpHizi:"85"},referans:"ESC",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({AGRI_YER:"Göğüs ortası", AGRI_EFOR:"Merdiven çıkınca", AGRI_SURE:"5dk'da geçiyor", SIGARA_OYKUSU:"20 yıl", HT_OYKUSU:"Var", VITAL_TANSIYON:"145/85", VITAL_NABIZ:"75", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Göğüs ağrısı?","Eforla mı?","Ne kadar sürüyor?"], idealYol: ["1.Tipik angina","2.EKG","3.Efor testi","4.Medikal:BB+statin","5.Anjiyo(endikasyon)"], egitimNotu: "Stabil Angina — fixed koroner stenoz.Eforla ağrı,dinlenince<5dk geçer.TEDAVİ:Beta bloker,statin,ASA." }],
  },
  {
    key: "endokrin",
    ad: "Endokrin",
    icon: "🩸",
    aciklama: "Diyabet, tiroid, metabolik hastalıklar",
    hastalikSablonlari: [
      {
        hastalikKey: "tip2-dm",
        hastalikAdi: "Tip 2 Diyabet",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, aşırı susuzluk`,
        anaSikayetSablonu: () => "Aşırı susuzluk ve sık idrara çıkma",
        ozetBilgilerSablonu: () => [
          "1 aydır aşırı susuzluk, sık idrara çıkma",
          "Son 3 ayda 4 kilo kaybı",
          "Görme bulanıklığı mevcut",
          "Bilinen ek hastalık yok",
        ],
        yasAraligi: [40, 65],
        cinsiyetTercih: "herhangi",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "POLIURI", etiket: "Poliüri", aciklama: "Sık idrara çıkma" },
            { key: "POLIDIPSI", etiket: "Polidipsi", aciklama: "Aşırı su içme" },
            { key: "KILO_KAYBI", etiket: "Kilo kaybı", aciklama: "Kilo kaybı" },
            { key: "GORME", etiket: "Görme bulanıklığı", aciklama: "Görme şikayeti" },
            { key: "AILE_OYKUSU", etiket: "Aile öyküsü", aciklama: "Ailede diyabet" },
            { key: "YASAM_TARZI", etiket: "Yaşam tarzı", aciklama: "Fizik aktivite, beslenme" },
          ],
          beklenenTestler: [
            { key: "GLUKOZ", etiket: "Açlık Kan Şekeri", aciklama: "Açlık glukoz" },
            { key: "HBA1C", etiket: "HbA1c", aciklama: "3 aylık ortalama" },
            { key: "KOLESTEROL", etiket: "Lipid Panel", aciklama: "Diyabet komorbid risk" },
          ],
          gereksizTestler: [{ key: "BT_ANJIYO", etiket: "BT Anjiyo", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "KETOASIDOZ", etiket: "Ketoasidoz bulguları", aciklama: "Bulantı, kusma, karın ağrısı — DKA" },
            { key: "HIPOGLISEMI", etiket: "Hipoglisemi atağı", aciklama: "Bayılma, titreme" },
          ],
          kabulEdilenTani: ["Tip 2 Diyabet", "Diyabet", "DM", "Diabetes Mellitus", "Tip 2 DM"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          GLUKOZ: { testKey: "GLUKOZ", testAdi: "Açlık Kan Şekeri", tip: "numeric", sonuc: { deger: 187, birim: "mg/dL", referansAralik: "70-100 mg/dL" }, referans: "ADA 2024", yorum: "Açlık kan şekeri belirgin yüksek (>126 = DM)." },
          HBA1C: { testKey: "HBA1C", testAdi: "HbA1c", tip: "numeric", sonuc: { deger: 8.9, birim: "%", referansAralik: "< 5.7%" }, referans: "ADA 2024", yorum: "HbA1c yüksek (>6.5% = DM)." },
          KOLESTEROL: { testKey: "KOLESTEROL", testAdi: "Lipid Panel", tip: "json", sonuc: { totalKolesterol: "220 mg/dL", ldl: "145 mg/dL", hdl: "40 mg/dL", trigliserit: "190 mg/dL" }, referans: "Lab", yorum: "Diyabetik dislipidemi." },
          IDRAR: { testKey: "IDRAR", testAdi: "Tam İdrar Tetkiki", tip: "json", sonuc: { dansite: "1030", glukoz: "Pozitif (+++)", keton: "Negatif", protein: "Negatif", ph: 6.0 }, referans: "Lab", yorum: "Glukozüri mevcut, keton negatif." },
        }),
        hastaYanitlari: () => ({
          POLIURI: "Evet, günde 10-12 kez idrara çıkıyorum. Gece de 3-4 kez.",
          POLIDIPSI: "Sürekli susuzum. Günde 4-5 litre su içiyorum.",
          KILO_KAYBI: "Son 3 ayda 4 kilo verdim. İştahım normal ama.",
          KILO_KAYBI_AYLIK: "Ayda yaklaşık 1.5 kilo veriyorum. Toplam son 3 ayda 4 kilo.",
          GORME: "Evet, görüşüm bulanıklaştı son 1 aydır.",
          AILE_OYKUSU: "Annem diyabetikti, ablamda da var.",
          YASAM_TARZI: "Hareket etmiyorum. Ofiste çalışıyorum. Tatlıya düşkünüm.",
          KETOASIDOZ: "Hayır, bulantım veya kusmam yok.",
          HIPOGLISEMI: "Hayır, bayılmadım.",
          VITAL_TANSIYON: "135/85.", VITAL_NABIZ: "82.", VITAL_ATES: "36.6°C.", VITAL_SPO2: "%97.",
          SIGARA: "İçmiyorum.", DIYABET: "Bilmiyordum ama sanırım bende var.",
          ILAC: "Düzenli ilaç kullanmıyorum.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Sık idrara çıkıyor musun?", "Aşırı susuz musun?", "Kilo verdin mi?", "Görmen bulanık mı?", "Aile öyküsü var mı?", "Spor yapıyor musun?", "Mide bulantın var mı?", "Bayılma oldu mu?"],
        idealYol: ["1. Anamnez: Poliüri, polidipsi, kilo kaybı, görme", "2. Aile öyküsü + yaşam tarzı", "3. Red flag: Ketoasidoz (kusma, karın ağrısı), hipoglisemi", "4. Açlık kan şekeri", "5. HbA1c", "6. Lipid panel", "7. Tanı: Tip 2 Diyabet", "8. Metformin + yaşam tarzı değişikliği"],
        egitimNotu: "Tip 2 Diyabet — açlık glukoz >126, HbA1c >6.5%. Klasik 3P (poliüri, polidipsi, polifaji) + kilo kaybı. TEDAVİ: Metformin (ilk seçenek), yaşam tarzı değişikliği, diyabet eğitimi. HbA1c hedefi <7%.",
      },
      {
        hastalikKey: "hipotiroidi",
        hastalikAdi: "Hipotiroidi",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, halsizlik ve kilo alımı`,
        anaSikayetSablonu: () => "Halsizlik, kilo alımı ve soğuğa intolerans",
        ozetBilgilerSablonu: () => ["3 aydır halsizlik", "Son 6 ayda 5 kilo aldı", "Soğuğa karşı intolerans", "Kabızlık mevcut"],
        yasAraligi: [30, 70],
        cinsiyetTercih: "K",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "HALSIZLIK", etiket: "Halsizlik", aciklama: "Halsizlik/yorgunluk" },
            { key: "KILO_ALIM", etiket: "Kilo alımı", aciklama: "Kilo alımı" },
            { key: "SOGUK", etiket: "Soğuğa intolerans", aciklama: "Soğuk intolerans" },
            { key: "KABIZLIK", etiket: "Kabızlık", aciklama: "Konstipasyon" },
            { key: "SAKAL_DOKULME", etiket: "Saç dökülmesi", aciklama: "Saç/sakal dökülmesi" },
            { key: "AILE_OYKUSU", etiket: "Aile öyküsü", aciklama: "Ailede tiroid" },
          ],
          beklenenTestler: [
            { key: "TSH", etiket: "TSH", aciklama: "TSH — ilk test" },
            { key: "T4", etiket: "Serbest T4", aciklama: "fT4" },
          ],
          gereksizTestler: [{ key: "BT_ANJIYO", etiket: "BT Anjiyo", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "MIKSEM_KOMA", etiket: "Miksem koması bulguları", aciklama: "Konfüzyon, hipotermi, bradikardi — acil" },
          ],
          kabulEdilenTani: ["Hipotiroidi", "Hashimoto Tiroiditi", "Hipotiroidizm", "Myödem"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          TSH: { testKey: "TSH", testAdi: "TSH", tip: "numeric", sonuc: { deger: 12.5, birim: "mIU/L", referansAralik: "0.4-4.0 mIU/L" }, referans: "AACE 2024", yorum: "TSH belirgin yüksek — primer hipotiroidi." },
          T4: { testKey: "T4", testAdi: "Serbest T4", tip: "numeric", sonuc: { deger: 0.6, birim: "ng/dL", referansAralik: "0.8-1.8 ng/dL" }, referans: "AACE 2024",yorum: "fT4 düşük — açık hipotiroidi." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "11.2 g/dL", lokosit: "5.8 K/uL", trombosit: "220 K/uL" }, referans: "Lab", yorum: "Hafif anemi — hipotiroidiye bağlı olabilir." },
        }),
        hastaYanitlari: () => ({
          HALSIZLIK: "Çok halsizim. 3 aydır. Sabah zor kalkıyorum.",
          KILO_ALIM: "Evet, son 6 ayda 5 kilo aldım. Yemem değişmedi.",
          KILO_ALIM_AYLIK: "Ayda yaklaşık 1 kilo alıyorum. Toplam 5 kilo.",
          SOGUK: "Evet, soğuğa dayanamıyorum. Herkes sıcakken ben üşüyorum.",
          KABIZLIK: "Evet, kabızım. Eskiden normaldi.",
          SAKAL_DOKULME: "Evet, saçım dökülüyor. Cildim de kuru.",
          AILE_OYKUSU: "Annemde tiroid hastalığı var.",
          MIKSEM_KOMA: "Hayır, kafam karışık değil. Bilincim yerinde.",
          VITAL_TANSIYON: "110/70.", VITAL_NABIZ: "58.", VITAL_ATES: "35.8°C.", VITAL_SPO2: "%97.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Düzenli ilaç yok.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Halsiz misin?", "Kilo aldın mı?", "Üşüyor musun?", "Kabız mısın?", "Saçın dökülüyor mu?", "Ailede tiroid var mı?", "Bilincin yerinde mi?"],
        idealYol: ["1. Anamnez: Halsizlik, kilo alımı, soğuk intolerans, kabızlık, saç dökülmesi", "2. Aile öyküsü (Hashimoto)", "3. Vital: Bradikardi, subnormal ateş", "4. TSH (yüksek)", "5. Serbest T4 (düşük)", "6. Tanı: Hipotiroidi (Hashimoto)", "7. Levotiroksin (T4) replasmanı"],
        egitimNotu: "Hipotiroidi — TSH yüksek, fT4 düşük. Kadınlarda erkeklerden 5-8 kat sık. Hashimoto en yaygın neden. TEDAVİ: Levotiroksin (T4) günlük oral. TSH hedefi 1-2 mIU/L. 6 hafta sonra TSH kontrolü.",
      },
// ──Endokrin: Hipertiroidi ──
      {
        hastalikKey: "hipertiroidi",
        hastalikAdi: "Hipertiroidi",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, çarpıntı ve kilo kaybı`,
        anaSikayetSablonu: () => "Çarpıntı, sinirlilik ve kilo kaybı",
        ozetBilgilerSablonu: () => ["2 aydır çarpıntı ve sinirlilik", "İştah artmasına rağmen 5 kilo kaybı", "Sıcak intoleransı ve terleme var", "Ellerde tremor"],
        yasAraligi: [25, 55],
        cinsiyetTercih: "K",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "CARPINTI_OYKU", etiket: "Çarpıntı", aciklama: "Taşikardi" },
            { key: "KILO_KAYBI", etiket: "Kilo kaybı", aciklama: "Hipermetabolizma" },
            { key: "SICAK_INTOLERANS", etiket: "Sıcak intoleransı", aciklama: "Hipertiroidi bulgusu" },
            { key: "TERLEME", etiket: "Terleme", aciklama: "Adrenerjik bulgu" },
            { key: "TREMOR", etiket: "Tremor", aciklama: "Ellerde titreme" },
            { key: "GUATR", etiket: "Guatr/boyunda şişlik", aciklama: "Tiroid büyümesi" },
          ],
          beklenenTestler: [
            { key: "TSH", etiket: "TSH", aciklama: "Suprese TSH" },
            { key: "T4", etiket: "Serbest T4", aciklama: "Yüksek fT4" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Bazal" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "TIROID_FIRTINASI", etiket: "Tiroid fırtınası", aciklama: "Ateş, taşikardi >140, konfüzyon" },
            { key: "GOZ_BULGULARI", etiket: "Göz bulguları", aciklama: "Eksoftalmus, diplopi — Graves" },
          ],
          kabulEdilenTani: ["Hipertiroidi", "Graves Hastalığı", "Tirotoksikoz", "Basedow-Graves"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          TSH: { testKey: "TSH", testAdi: "TSH", tip: "numeric", sonuc: { deger: 0.01, birim: "mIU/L", referansAralik: "0.4-4.0" }, referans: "ATA 2016", yorum: "TSH suprese — primer hipertiroidi." },
          T4: { testKey: "T4", testAdi: "Serbest T4", tip: "numeric", sonuc: { deger: 3.8, birim: "ng/dL", referansAralik: "0.8-1.8" }, referans: "ATA", yorum: "fT4 belirgin yüksek — açık hipertiroidi." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "13.5", lokosit: "7.8", trombosit: "240" }, referans: "Lab", yorum: "Normal." },
        }),
        hastaYanitlari: () => ({
          CARPINTI_OYKU: "Evet, kalbim küt küt atıyor. Nabzım 100'un üstünde istirahatte.",
          KILO_KAYBI: "Evet, 2 ayda 5 kilo verdim. İştahım iyi olmasına rağmen.",
          SICAK_INTOLERANS: "Evet, herkes üşürken ben sıcaklıyorum. Sürekli terliyorum.",
          TERLEME: "Evet, avuç içlerim hep terli, sıcak basıyor.",
          TREMOR: "Evet, ellerim titriyor. Kahve içerken fincanı zor tutuyorum.",
          GUATR: "Boynumda hafif şişlik var, özellikle yutkunurken belli oluyor.",
          TIROID_FIRTINASI: "Ateşim yok. Çok ajite değilim.",
          GOZ_BULGULARI: "Gözlerimde hafif çıkıklık var gibi, ama rahatsız etmiyor.",
          VITAL_TANSIYON: "130/70.", VITAL_NABIZ: "105.", VITAL_ATES: "37.1.", VITAL_SPO2: "%98.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Düzenli ilaç yok.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Çarpıntın var mı?", "Kilo mu verdin?", "Sıcak basıyor mu?", "Terleme var mı?", "Ellerin titriyor mu?", "Boynunda şişlik var mı?"],
        idealYol: ["1. Anamnez: Çarpıntı, kilo kaybı, sıcak intolerans, tremor", "2. Red flag: Tiroid fırtınası, göz bulguları", "3. TSH (suprese)", "4. Serbest T4 (yüksek)", "5. Tanı: Hipertiroidi (Graves?)", "6. Metimazol/propiltiourasil + beta bloker"],
        egitimNotu: "Hipertiroidi — en sık neden Graves hastalığı (TSH reseptör antikorları). TSH suprese, fT4 yüksek. TEDAVİ: Metimazol 10-30mg/gün (titrasyon), propranolol 20-40mg (semptomatik). Graves'te remisyon %30-50. Alternatif: RAI ablasyon veya tiroidektomi.",
      },
    
            { hastalikKey: "hipoglisemi", hastalikAdi: "Hipoglisemi (Diyabetik)", semptomSablonu: (h) => `${h.yas} yaş , terleme, titreme, bilinç bulanıklığı`, anaSikayetSablonu: () => "Ani terleme, titreme, çarpıntı, bilinç bulanıklığı", ozetBilgilerSablonu: () => ["30 dk önce aniden terleme ve titreme","Bilinç bulanıklaşıyor","Tip 2 DM, insülin kullanıyor","Bugün yemek yemedi"], yasAraligi: [30, 70], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"TERLEME",etiket:"Terleme",aciklama:"Ani"},{key:"TITREME",etiket:"Titreme",aciklama:"Var"},{key:"KONFUZYON",etiket:"Bilinç",aciklama:"Bulanık"},{key:"DIYABET",etiket:"DM",aciklama:"İnsülin"},{key:"BESLENME",etiket:"Yemek",aciklama:"Atladı"}], beklenenTestler: [{key:"GLUKOZ",etiket:"Kan Şekeri",aciklama:"Acil"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"BILINC_KAYBI",etiket:"Bilinç kaybı",aciklama:"Glukagon IV"},{key:"NÖBET",etiket:"Nöbet",aciklama:"Hipoglisemik nöbet"}], kabulEdilenTani: ["Hipoglisemi","İnsülin Hipoglisemisi"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({GLUKOZ:{testKey:"GLUKOZ",testAdi:"Kan Şekeri",tip:"numeric",sonuc:{deger:48,birim:"mg/dL",referansAralik:"70-100"},referans:"ADA",yorum:"Hipoglisemi — acil tedavi endikasyonu."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({TERLEME:"Soğuk soğuk terliyorum", TITREME:"Ellerim titriyor", KONFUZYON:"Biraz sersem gibiyim", DIYABET:"Tip 2 DM,insülin kullanıyorum", BESLENME:"Bugün kahvaltı yapmadım", VITAL_TANSIYON:"140/90", VITAL_NABIZ:"100", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Terleme?","Titreme?","Bilincin yerinde mi?","Yemek yedin mi?"], idealYol: ["1.Acil:KŞ ölçümü","2.<70mg/dL→15g hızlı karbonhidrat","3.15dk sonra kontrol","4.Bilinç kapalı→IV %30 dekstroz","5.Glukagon IM"], egitimNotu: "Hipoglisemi — KŞ<70mg/dL.Whipple triadı:semptom+düşük KŞ+düzelme.TEDAVİ:Bilinci açık→15g hızlı CHO(meyve suyu).Bilinç kapalı→IV dekstroz/glukagon." },
      { hastalikKey: "diyabetik-noropati", hastalikAdi: "Diyabetik Nöropati", semptomSablonu: (h) => `${h.yas} yaş , ayaklarda uyuşma ve yanma`, anaSikayetSablonu: () => "Ayaklarda uyuşma, yanma, 10 yıllık DM", ozetBilgilerSablonu: () => ["10 yıldır Tip 2 DM","Son 1 yıldır ayaklarda uyuşma","Yanma ve karıncalanma","Gece artıyor"], yasAraligi: [45, 70], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"UYUSMA",etiket:"Uyuşma",aciklama:"Ayak"},{key:"YANMA",etiket:"Yanma",aciklama:"Nöropatik"},{key:"DIYABET",etiket:"DM",aciklama:"10 yıl"},{key:"GECE_ARTIS",etiket:"Gece",aciklama:"Artıyor"},{key:"YARA",etiket:"Yara",aciklama:"Var mı"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"AYAK_ULSERI",etiket:"Ayak ülseri",aciklama:"Diyabetik ayak"},{key:"OSTEOMIYELIT",etiket:"Osteomiyelit",aciklama:"Enfekte"}], kabulEdilenTani: ["Diyabetik Nöropati","DSPN"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({UYUSMA:"Ayaklarım uyuşuyor", YANMA:"Gece daha kötü", DIYABET:"10 yıllık şeker", GECE_ARTIS:"Evet", YARA:"Yok", VITAL_TANSIYON:"140/85", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Uyuşma?","Yanma?","DM süresi?","Yara?"], idealYol: ["1.Simetrik distal","2.Monofilaman","3.Glisemik kontrol","4.Gabapentin","5.Ayak bakımı"], egitimNotu: "DSPN — en sık DM komplikasyonu.TEDAVİ:Glisemik kontrol,gabapentin/pregabalin,duloksetin.Ayak bakımı." }],
  },
  {
    key: "solunum",
    ad: "Göğüs Hastalıkları",
    icon: "🫁",
    aciklama: "Pnömoni, astım, KOAH vakaları",
    hastalikSablonlari: [
      {
        hastalikKey: "pnömoni",
        hastalikAdi: "Toplum Kazanılmış Pnömoni",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, ateş ve balgamlı öksürük`,
        anaSikayetSablonu: () => "3 gündür ateş ve balgamlı öksürük",
        ozetBilgilerSablonu: () => ["3 gündür ateş (38.5°C), öksürük, sarı-yeşil balgam", "Sağ tarafta yan ağrısı (öksürünce artıyor)", "Nefes darlığı mevcut", "Günde 10 sigara, 20 yıldır"],
        yasAraligi: [30, 70],
        cinsiyetTercih: "E",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "OKSURUK", etiket: "Öksürük", aciklama: "Öksürük karakteri ve süresi" },
            { key: "BALGAM", etiket: "Balgam", aciklama: "Balgam rengi/miktarı" },
            { key: "ATES_SORGU", etiket: "Ateş", aciklama: "Ateş yüksekliği ve süresi" },
            { key: "GOGUS_AGRISI", etiket: "Göğüs/yan ağrısı", aciklama: "Plevral ağrı" },
            { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Dispne" },
            { key: "SIGARA_OYKUSU", etiket: "Sigara öyküsü", aciklama: "Risk faktörü" },
          ],
          beklenenTestler: [
            { key: "CBC", etiket: "Hemogram", aciklama: "Lökosit ve CRP" },
            { key: "CRP", etiket: "CRP", aciklama: "Enflamasyon" },
            { key: "AKCIGER_GRAFISI", etiket: "PA Akciğer Grafisi", aciklama: "Röntgen — tanı için şart" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "Kardiyak şikayet yokken gereksiz" }],
          redFlagler: [
            { key: "KAN_BALGAM", etiket: "Hemoptizi", aciklama: "Kanlı balgam — malignite/TB" },
            { key: "NABIZ_SPO2", etiket: "Vital instabilite", aciklama: "SpO2 <92%, nabız >120" },
          ],
          kabulEdilenTani: ["Pnömoni", "Zatürre", "Toplum Kazanılmış Pnömoni", "TKP"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "14.8 g/dL", lokosit: "14.2 K/uL", trombosit: "280 K/uL", nötrofil: "%82" }, referans: "Lab", yorum: "Lökosit ve nötrofil yüksek — bakteriyel enfeksiyon." },
          CRP: { testKey: "CRP", testAdi: "CRP", tip: "numeric", sonuc: { deger: 85, birim: "mg/L", referansAralik: "< 5 mg/L" }, referans: "Lab", yorum: "CRP yüksek — bakteriyel pnömoni." },
          AKCIGER_GRAFISI: { testKey: "AKCIGER_GRAFISI", testAdi: "PA Akciğer Grafisi", tip: "image", sonuc: "Sağ alt lobda konsolidasyon ve hava-bronkogram. Plevral efüzyon yok.", referans: "ATS/IDSA 2019", yorum: "Sağ alt lob pnömonisi." },
        }),
        hastaYanitlari: () => ({
          OKSURUK: "Evet, 3 gündür. Kuru başladı, şimdi balgam var.",
          BALGAM: "Sarı-yeşil renkte. Günde 5-6 kez. Kanlı değil.",
          ATES_SORGU: "Evet, 38.5°C. 3 gündür. Titreme de oldu.",
          GOGUS_AGRISI: "Sağ tarafta, göğsümün yan tarafında. Öksürünce ve derin nefes alınca artıyor.",
          NEFES_DARLIGI: "Evet, hareket edince nefes darlığım var.",
          SIGARA_OYKUSU: "Günde 10 sigara, 20 yıldır.",
          KAN_BALGAM: "Hayır, kanlı balgamım yok.",
          NABIZ_SPO2: "Oksijen %93, nabız 105.",
          VITAL_TANSIYON: "120/75.", VITAL_NABIZ: "105.", VITAL_ATES: "38.5°C.", VITAL_SPO2: "%93.",
          AILE_OYKUSU: "Ailede benzer hastalık yok.", DIYABET: "Yok.",
          ILAC: "Düzenli ilaç yok. Dün eczane antibiyotiği işe yaramadı.",
          ALERJI: "Penisilin alerjim var.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Öksürüğün ne zamandır?", "Balgam rengi ne?", "Ateşin var mı?", "Göğsünde ağrı var mı?", "Nefes darlığın var mı?", "Sigara içiyor musun?", "Kanlı balgam var mı?", "Oksijen kaç?"],
        idealYol: ["1. Anamnez: Öksürük, balgam, ateş, plevral ağrı, nefes darlığı", "2. Risk: Sigara öyküsü", "3. Red flag: Hemoptizi, vital instabilite (SpO2<92%)", "4. Hemogram + CRP", "5. PA Akciğer grafisi", "6. Tanı: Toplum Kazanılmış Pnömoni", "7. Amoksisilin + makrolid (veya solunum fluorokinolonu)"],
        egitimNotu: "TKP — bakteriyel (Streptococcus pneumoniae en sık). CURB-65 skorlaması: Konfüzyon, Üre, Solunum hızı, KB, Yaş >65. Penisilin alerjisi varsa solunum fluorokinolonu (levofloksasin) veya makrolid + sefalosporin.",
      },
      {
        hastalikKey: "koah-eks",
        hastalikAdi: "KOAH Akut Ekspazerbasyonu",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, ileri KOAH, artan nefes darlığı`,
        anaSikayetSablonu: () => "Kronik nefes darlığı, son 3 günde arttı",
        ozetBilgilerSablonu: () => ["KOAH tanısı 10 yıldır", "Son 3 günde nefes darlığı arttı", "Balgam rengi yeşile döndü", "Günde 20 sigara, 40 yıldır"],
        yasAraligi: [55, 80],
        cinsiyetTercih: "E",
        seviye: "orta",
        rubric: {
          beklenenSorular: [
            { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Dispne ve değişim" },
            { key: "BALGAM", etiket: "Balgam", aciklama: "Balgam rengi (pürülan = infeksiyon)" },
            { key: "OKSURUK", etiket: "Öksürük", aciklama: "Öksürük değişimi" },
            { key: "SIGARA_OYKUSU", etiket: "Sigara öyküsü", aciklama: "KOAH ana nedeni" },
            { key: "KOAH_OYKUSU", etiket: "KOAH tanı öyküsü", aciklama: "Mevcut KOAH ve ilaçlar" },
            { key: "ATES_SORGU", etiket: "Ateş", aciklama: "Enfeksiyon bulgusu" },
          ],
          beklenenTestler: [
            { key: "AKCIGER_GRAFISI", etiket: "PA Akciğer Grafisi", aciklama: "Diğer nedenleri ekarte" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Lökosit — enfeksiyon" },
            { key: "CRP", etiket: "CRP", aciklama: "Enflamasyon" },
            { key: "ABG", etiket: "Arteriyel Kan Gazı", aciklama: "CO2 retansiyon açısından" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "Kardiyak şikayet yokken gereksiz" }],
          redFlagler: [
            { key: "NABIZ_SPO2", etiket: "Vital instabilite", aciklama: "SpO2 <88% — acil O2" },
            { key: "KONFUZYON", etiket: "Konfüzyon/somnolans", aciklama: "CO2 narkozu — acil" },
          ],
          kabulEdilenTani: ["KOAH Ekspazerbasyonu", "KOAH Akut Atak", "KOAH Eksaserbasyon", "Chronic Obstructive Pulmonary Disease Exacerbation"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          AKCIGER_GRAFISI: { testKey: "AKCIGER_GRAFISI", testAdi: "PA Akciğer Grafisi", tip: "image", sonuc: "Hiperinflatif akciğerler, diyafrağmada düzleşme. Yeni infiltrasyon yok. Kardiyomegali yok.", referans: "GOLD 2024", yorum: "KOAH bulguları. Akut infiltrasyon yok." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "15.8 g/dL", lokosit: "12.5 K/uL", trombosit: "260 K/uL", nötrofil: "%78" }, referans: "Lab", yorum: "Polisitemi (kronik hipoksi) + lökositoz (enfeksiyon)." },
          CRP: { testKey: "CRP", testAdi: "CRP", tip: "numeric", sonuc: { deger: 45, birim: "mg/L", referansAralik: "< 5 mg/L" }, referans: "Lab", yorum: "CRP yüksek — enfeksiyon var." },
          ABG: { testKey: "ABG", testAdi: "Arteriyel Kan Gazı", tip: "json", sonuc: { pH: "7.34", pCO2: "58 mmHg", pO2: "62 mmHg", HCO3: "32 mmol/L", O2Sat: "%88" }, referans: "GOLD 2024", yorum: "Kompanse respiratuvar asidoz. CO2 retansiyonu (KOAH tipik)." },
        }),
        hastaYanitlari: () => ({
          NEFES_DARLIGI: "Evet, nefes darlığım 3 gündür arttı. Eskiden merdiven çıkınca oluyordu, şimdi otururken bile var.",
          BALGAM: "Evet, balgamım yeşile döndü. Eskiden berraktı.",
          OKSURUK: "Öksürüğüm arttı. Sabahları daha fazla.",
          SIGARA_OYKUSU: "Günde 20 sigara, 40 yıldır.",
          KOAH_OYKUSU: "Evet, 10 yıldır KOAH tanım var. Tiotropium ve salbutamol kullanıyorum.",
          ATES_SORGU: "Hafif ateşim var, 37.8°C.",
          NABIZ_SPO2: "Oksijen %88, nabız 110.",
          KONFUZYON: "Hayır, bilincim yerinde. Ama çok yorgunum.",
          VITAL_TANSIYON: "130/80.", VITAL_NABIZ: "110.", VITAL_ATES: "37.8°C.", VITAL_SPO2: "%88.",
          AILE_OYKUSU: "Babam da KOAH'lıydı.", DIYABET: "Yok.",
          ILAC: "Tiotropium, salbutamol inhaler.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Nefes darlığın ne zamandır arttı?", "Balgam rengi ne?", "Öksürüğün arttı mı?", "Sigara kaç yıl?", "KOAH tanın var mı?", "Ateşin var mı?", "Oksijen kaç?", "Bilincin yerinde mi?"],
        idealYol: ["1. Anamnez: Artan nefes darlığı, pürülan balgam, öksürük (Anthonisen kriterleri)", "2. KOAH tanı öyküsü + ilaçlar", "3. Red flag: SpO2<88%, konfüzyon (CO2 narkozu)", "4. PA Akciğer grafisi", "5. Hemogram + CRP", "6. Arteriyel kan gazı (CO2 retansiyon)", "7. Tanı: KOAH Akut Ekspazerbasyon", "8. Bronkodilatör + sistemik steroid + antibiyotik (pürülan balgam)"],
        egitimNotu: "KOAH ekspazerbasyonu — Anthonisen kriterleri: artan nefes darlığı, pürülan balgam, artan öksürük hacmi. ≥2 kriter → antibiyotik. TEDAVİ: Kısa etkili bronkodilatör, sistemik steroid (prednizolon 40mg 5 gün), antibiyotik (pürülan balgam varsa). O2 dikkatli (CO2 retansiyon riski).",
      },
// ──Göğüs Hastalıkları: Astım ──
      {
        hastalikKey: "astim",
        hastalikAdi: "Astım Atağı",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, hışıltılı solunum`,
        anaSikayetSablonu: () => "Nefes darlığı, hışıltı ve öksürük",
        ozetBilgilerSablonu: () => ["2 gündür artan nefes darlığı", "Hışıltılı solunum (wheezing)", "Gece öksürükle uyanma", "Çocuklukta astım tanısı var"],
        yasAraligi: [18, 50],
        cinsiyetTercih: "herhangi",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Atak şiddeti" },
            { key: "WHEEZING", etiket: "Hışıltı", aciklama: "Astım bulgusu" },
            { key: "OKSURUK", etiket: "Öksürük", aciklama: "Gece öksürüğü" },
            { key: "TETIKLEYICI", etiket: "Tetkikleyici", aciklama: "Allerjen/egzersiz" },
            { key: "ASTIM_OYKUSU", etiket: "Astım öyküsü", aciklama: "Mevcut tanı ve ilaçlar" },
            { key: "ALERJI", etiket: "Allerji", aciklama: "Atopi öyküsü" },
          ],
          beklenenTestler: [
            { key: "AKCIGER_GRAFISI", etiket: "PA Akciğer Grafisi", aciklama: "Diğer nedenleri ekarte" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Eozinofili" },
            { key: "ABG", etiket: "Arteriyel Kan Gazı", aciklama: "Hipoksemi" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "SESSIZ_AKCIGER", etiket: "Sessiz akciğer", aciklama: "Hava yolu tıkanıklığı — acil" },
            { key: "KONFUZYON", etiket: "Konfüzyon/somnolans", aciklama: "CO2 retansiyonu" },
          ],
          kabulEdilenTani: ["Astım Atağı", "Astım Ekspazerbasyonu", "Akut Astım", "Asthma"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          AKCIGER_GRAFISI: { testKey: "AKCIGER_GRAFISI", testAdi: "PA Akciğer Grafisi", tip: "image", sonuc: "Hiperinflatif akciğerler. Yeni infiltrasyon yok. Kardiyomegali yok.", referans: "GINA 2023", yorum: "Astım ile uyumlu — hiperinflasyon, infiltrasyon yok." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "14.0", lokosit: "8.5", trombosit: "250", eozinofil: "%8" }, referans: "Lab", yorum: "Eozinofili (%8) — allerjik komponent." },
          ABG: { testKey: "ABG", testAdi: "Arteriyel Kan Gazı", tip: "json", sonuc: { pH: "7.44", pCO2: "35", pO2: "68", O2Sat: "%92" }, referans: "GINA", yorum: "Hafif hipoksemi. CO2 normal." },
        }),
        hastaYanitlari: () => ({
          NEFES_DARLIGI: "Evet, 2 gündür. Özellikle gece ve sabaha karşı artıyor.",
          WHEEZING: "Evet, nefes alıp verirken hışıltı sesi geliyor. Dışarıdan da duyuluyor.",
          OKSURUK: "Evet, kuru öksürük var. Gece uykudan uyandırıyor.",
          TETIKLEYICI: "Polen mevsimi başladı. Sanırım ondan tetiklendi.",
          ASTIM_OYKUSU: "Evet, çocukluktan beri astımım var. Salbutamol inhaler kullanıyorum.",
          ALERJI: "Polen ve ev tozu alerjim var.",
          SESSIZ_AKCIGER: "Nefes seslerim duyuluyor. Tam sessiz değil.",
          KONFUZYON: "Bilincim yerinde.",
          VITAL_TANSIYON: "120/80.", VITAL_NABIZ: "95.", VITAL_ATES: "36.6.", VITAL_SPO2: "%92.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Salbutamol.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Nefes darlığın var mı?", "Hışıltı duyuyor musun?", "Gece öksürüğün var mı?", "Ne tetikledi?", "Astım tanın var mı?", "Allerjin var mı?"],
        idealYol: ["1. Anamnez: Dispne, wheezing, gece öksürüğü", "2. Tetikleyici sorgula", "3. Astım öyküsü + allerji", "4. Red flag: Sessiz akciğer, konfüzyon", "5. PA Akciğer grafisi", "6. Hemogram (eozinofil)", "7. ABG", "8. Tanı: Astım Akut Atağı", "9. Kısa etkili beta agonist + steroid"],
        egitimNotu: "Astım Atağı — reversibl hava yolu obstrüksiyonu. GINA sınıflaması: hafif/orta/ağır/yaşamı tehdit eden. TEDAVİ: Salbutamol nebül (2.5-5mg), ipratropium, sistemik steroid (prednizolon 40-50mg). O2 desteği (SpO2 >%92). Ağır atak: IV magnezyum, IV aminofilin.",
      },
      // ──Nefroloji: Akut Böbrek Hasari ──
    
            { hastalikKey: "tbc", hastalikAdi: "Akciğer Tüberkülozu", semptomSablonu: (h) => `${h.yas} yaş , kronik öksürük, gece terlemesi`, anaSikayetSablonu: () => "3 haftadır öksürük, gece terlemesi, kilo kaybı", ozetBilgilerSablonu: () => ["3 haftadır öksürük","Gece terlemesi","Son 1 ayda 4 kilo kaybı","Ateş 37.8°C, akşamları yükseliyor"], yasAraligi: [20, 60], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"OKSURUK",etiket:"Öksürük",aciklama:">3 hafta"},{key:"GECE_TERLEME",etiket:"Gece terlemesi",aciklama:"Var"},{key:"KILO_KAYBI",etiket:"Kilo kaybı",aciklama:"4 kg/ay"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:"Subfebril"},{key:"TEMAS_OYKUSU",etiket:"TBC temas",aciklama:"Var mı?"}], beklenenTestler: [{key:"AKCIGER_GRAFISI",etiket:"PA Akciğer",aciklama:"Kavite"},{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"},{key:"CRP",etiket:"CRP",aciklama:"Enflamasyon"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"HEMOPTIZI_MAJOR",etiket:"Masif hemoptizi",aciklama:">200mL/24saat"},{key:"MILIYER_TBC",etiket:"Miliyer TBC",aciklama:"Yaygın+sepsis"}], kabulEdilenTani: ["Akciğer Tüberkülozu","TBC","Pulmoner Tüberküloz"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({AKCIGER_GRAFISI:{testKey:"AKCIGER_GRAFISI",testAdi:"PA Akciğer",tip:"image",sonuc:"Normal.",referans:"Radyoloji",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, CRP:{testKey:"CRP",testAdi:"CRP",tip:"numeric",sonuc:{deger:25,birim:"mg/L",referansAralik:"<5"},referans:"Lab",yorum:"Hafif yüksek."}}), hastaYanitlari: () => ({OKSURUK:"3 haftadır öksürüyorum", GECE_TERLEME:"Her gece sırılsıklam terliyorum", KILO_KAYBI:"4 kilo verdim", ATES_SORGU:"Akşamları 37.8 oluyor", TEMAS_OYKUSU:"Bilmiyorum,temas hatırlamıyorum", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Öksürük?","Gece terlemesi?","Kilo kaybı?","Temas?"], idealYol: ["1.Anamnez:>3hafta öksürük+gece terlemesi","2.PA Akciğer:kavite/infiltrasyon","3.Balgram ARB+bakteriyolojik tanı","4.4'lü antitüberküloz tedavi","5.Temas taraması"], egitimNotu: "Akciğer TBC — Mycobacterium tuberculosis.En sık apikal-posterior segment.Tanı:ARB pozitifliği+kültür.TEDAVİ:2ay HRZE+4ay HR.DoT önerilir." },
      { hastalikKey: "akut-bronsit", hastalikAdi: "Akut Bronşit", semptomSablonu: (h) => `${h.yas} yaş , öksürük ve balgam`, anaSikayetSablonu: () => "1 haftadır öksürük, sarı balgam, hafif ateş", ozetBilgilerSablonu: () => ["1 haftadır öksürük","Sarı balgam","Hafif ateş 37.8","ÜSYE sonrası"], yasAraligi: [15, 60], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"OKSURUK",etiket:"Öksürük",aciklama:"1 hafta"},{key:"BALGAM",etiket:"Balgam",aciklama:"Pürülan"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:"Hafif"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"}], beklenenTestler: [{key:"AKCIGER_GRAFISI",etiket:"PA Akciğer",aciklama:"Normal"},{key:"CBC",etiket:"Hemogram",aciklama:"Enfeksiyon"},{key:"CRP",etiket:"CRP",aciklama:"Hafif yüksek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"PNOMONI",etiket:"Pnömoni",aciklama:"Konsolidasyon"},{key:"KOAH_ALEVI",etiket:"KOAH",aciklama:"Hışıltı"}], kabulEdilenTani: ["Akut Bronşit"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({AKCIGER_GRAFISI:{testKey:"AKCIGER_GRAFISI",testAdi:"PA Akciğer",tip:"image",sonuc:"Normal.",referans:"Radyoloji",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5"},referans:"Lab",yorum:"Normal."}, CRP:{testKey:"CRP",testAdi:"CRP",tip:"numeric",sonuc:{deger:25,birim:"mg/L",referansAralik:"<5"},referans:"Lab",yorum:"Hafif yüksek."}}), hastaYanitlari: () => ({OKSURUK:"1 hafta,balgamlı", BALGAM:"Sarı", ATES_SORGU:"37.8", SIGARA_OYKUSU:"İçmiyorum", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"37.8", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Öksürük?","Balgam?","Ateş?","Sigara?"], idealYol: ["1.Oskültasyon","2.PA Akciğer normal","3.Semptomatik","4.AB gerekmez"], egitimNotu: "Akut Bronşit — en sık viral.PA Akciğer normal.TEDAVİ:Semptomatik.AB sadece pürülan>1 hafta." }],
  },
  {
    key: "nefroloji",
    ad: "Nefroloji",
    icon: "🧪",
    aciklama: "Böbrek hastalıkları, elektrolit bozuklukları",
    hastalikSablonlari: [
      {
        hastalikKey: "kbh",
        hastalikAdi: "Kronik Böbrek Hastalığı",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, halsizlik ve ödem`,
        anaSikayetSablonu: () => "Halsizlik ve bacaklarda şişlik",
        ozetBilgilerSablonu: () => ["2 aydır halsizlik, 2 haftadır ödem", "Hipertansiyon 20 yıldır", "İdrar miktarı azaldı", "Diyabet yok"],
        yasAraligi: [50, 75],
        cinsiyetTercih: "E",
        seviye: "orta",
        rubric: {
          beklenenSorular: [
            { key: "ODEM", etiket: "Ödem", aciklama: "Bacaklarda/yüzde şişlik" },
            { key: "IDRAR_AZALMA", etiket: "İdrar azalması", aciklama: "Oligüri" },
            { key: "HALSIZLIK", etiket: "Halsizlik", aciklama: "Anemi bulgusu" },
            { key: "HT_OYKUSU", etiket: "Hipertansiyon öyküsü", aciklama: "KBH en yaygın nedeni" },
            { key: "DIYABET_OYKUSU", etiket: "Diyabet öyküsü", aciklama: "KBH nedeni" },
            { key: "ILAC_OYKUSU", etiket: "İlaç öyküsü", aciklama: "NSAII — nefrotoksik" },
          ],
          beklenenTestler: [
            { key: "KREATININ", etiket: "Serum Kreatinin", aciklama: "Böbrek fonksiyonu" },
            { key: "URE", etiket: "Üre", aciklama: "BUN/üre" },
            { key: "ELEKTROLIT", etiket: "Elektrolitler", aciklama: "Hiperkalemi açısından" },
            { key: "IDRAR", etiket: "Tam İdrar Tetkiki", aciklama: "Proteinüri" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Anemi" },
          ],
          gereksizTestler: [{ key: "BT_ANJIYO", etiket: "BT Anjiyo", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "HIPERKALEMI_SEMPTOM", etiket: "Hiperkalemi semptomları", aciklama: "Kas güçsüzlüğü, çarpıntı — acil" },
            { key: "AKUT_BÖBREK_HASARI", etiket: "Akut böbrek hasarı", aciklama: "Ani idrar kesilmesi, konfüzyon" },
          ],
          kabulEdilenTani: ["Kronik Böbrek Hastalığı", "KBH", "CKD", "Kronik Renal Yetmezlik"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          KREATININ: { testKey: "KREATININ", testAdi: "Serum Kreatinin", tip: "numeric", sonuc: { deger: 2.8, birim: "mg/dL", referansAralik: "0.7-1.3 mg/dL" }, referans: "KDIGO 2024", yorum: "eGFR ~25 mL/dk — KBH Evre 4." },
          URE: { testKey: "URE", testAdi: "Kan Üre Azotu", tip: "numeric", sonuc: { deger: 65, birim: "mg/dL", referansAralik: "7-20 mg/dL" }, referans: "Lab", yorum: "BUN yüksek — üremik durum." },
          ELEKTROLIT: { testKey: "ELEKTROLIT", testAdi: "Serum Elektrolitleri", tip: "json", sonuc: { sodyum: "136 mmol/L", potasyum: "5.6 mmol/L", klor: "98 mmol/L", bikarbonat: "18 mmol/L" }, referans: "KDIGO 2024", yorum: "Hiperkalemi + metabolik asidoz." },
          IDRAR: { testKey: "IDRAR", testAdi: "Tam İdrar Tetkiki", tip: "json", sonuc: { dansite: "1010", protein: "Pozitif (++)", glukoz: "Negatif", kan: "Negatif", silendir: "Hyalin" }, referans: "Lab", yorum: "Proteinüri, düşük dansite — KBH." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "9.8 g/dL", lokosit: "6.5 K/uL", trombosit: "210 K/uL", hematokrit: "%29" }, referans: "Lab", yorum: "Normositik anemi — renal anemi." },
        }),
        hastaYanitlari: () => ({
          ODEM: "Evet, bacaklarımda ve ayak bileklerimde şişlik. Akşamları daha fazla. Yüzümde de sabahları.",
          IDRAR_AZALMA: "Evet, idrarım azaldı. Son 2 haftadır günde 2-3 kez.",
          HALSIZLIK: "Çok halsizim. 2 aydır. Merdiven çıkınca zorlanıyorum.",
          HT_OYKUSU: "Evet, 20 yıldır tansiyon yüksek. Amlodipin kullanıyorum.",
          DIYABET_OYKUSU: "Diyabetim yok.",
          ILAC_OYKUSU: "Amlodipin 10mg. Ağrı için ara sıra naproksen.",
          HIPERKALEMI_SEMPTOM: "Evet, kaslarımda güçsüzlük var. Çarpıntım da oldu.",
          AKUT_BÖBREK_HASARI: "İdrar tam kesilmedi ama azaldı.",
          VITAL_TANSIYON: "155/92.", VITAL_NABIZ: "78.", VITAL_ATES: "36.5°C.", VITAL_SPO2: "%95.",
          SIGARA: "Eskiden içiyordum, 5 yıl önce bıraktım.", DIYABET: "Yok.",
          ILAC: "Amlodipin, ara sıra naproksen.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Bacaklarında şişlik var mı?", "İdrarın azaldı mı?", "Halsiz misin?", "Tansiyon yüksekliği var mı?", "Diyabetin var mı?", "Hangi ilaçları kullanıyorsun?", "Kas güçsüzlüğün var mı?", "Çarpıntın oldu mu?"],
        idealYol: ["1. Anamnez: Ödem, idrar azalması, halsizlik", "2. Komorbid: HT, diyabet, NSAII kullanımı", "3. Red flag: Hiperkalemi semptomu, akut böbrek hasarı", "4. Serum kreatinin + üre", "5. Elektrolit (K!)", "6. İdrar tetkiki (proteinüri)", "7. Hemogram (anemi)", "8. Tanı: KBH Evre 4 (eGFR 15-29)", "9. Nefroloji konsültasyonu, renal diyet, ESA anemi için"],
        egitimNotu: "KBH Evre 4 (eGFR 15-29 mL/dk). Hiperkalemi acil — EKG ve K antagonistleri. Metabolik asidoz — bikarbonat replasmanı. Renal anemi — demir + EPO. TEDAVİ: Renal diyet (düşük K, P, protein), fosfat bağlayıcı, ACEi/ARB (dikkatli), nefroloji takibi. Evre 5 = diyaliz/transplant.",
      },
// ──Nefroloji: Akut Böbrek Hasari ──
      {
        hastalikKey: "abh",
        hastalikAdi: "Akut Böbrek Hasari",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, idrar çıkışında azalma`,
        anaSikayetSablonu: () => "Son 2 gündür idrar çıkışında azalma",
        ozetBilgilerSablonu: () => ["2 gündür idrar miktarı azaldı", "3 gün önce yüksek ateş ve ishal nedeniyle az sıvı aldı", "NSAII kullanımı (bel ağrısı için)", "Bilinen hipertansiyon"],
        yasAraligi: [50, 80],
        cinsiyetTercih: "E",
        seviye: "orta",
        rubric: {
          beklenenSorular: [
            { key: "IDRAR_AZALMA", etiket: "İdrar azalması", aciklama: "Oligüri — ABH kriteri" },
            { key: "DEHIDRATASYON", etiket: "Sıvı kaybı", aciklama: "Prerenal neden" },
            { key: "ILAC_OYKUSU", etiket: "İlaç öyküsü", aciklama: "NSAII nefrotoksik" },
            { key: "HT_OYKUSU", etiket: "HT öyküsü", aciklama: "Kronik böbrek riski" },
            { key: "ATES_SORGU", etiket: "Ateş/enfeksiyon", aciklama: "Sepsis/hipoperfüzyon" },
            { key: "HALSIZLIK", etiket: "Halsizlik", aciklama: "Üremik semptom" },
          ],
          beklenenTestler: [
            { key: "KREATININ", etiket: "Kreatinin", aciklama: "ABH tanı kriteri" },
            { key: "URE", etiket: "Üre/BUN", aciklama: "Böbrek fonksiyonu" },
            { key: "ELEKTROLIT", etiket: "Elektrolitler", aciklama: "Hiperkalemi riski" },
            { key: "IDRAR", etiket: "Tam İdrar Tetkiki", aciklama: "Aktif sediment" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "HIPERKALEMI_SEMPTOM", etiket: "Hiperkalemi (>6.0)", aciklama: "Acil EKG ve tedavi" },
            { key: "AKCIGER_ODEM", etiket: "Akciğer ödemi", aciklama: "Sıvı yüklenmesi — acil diyaliz" },
          ],
          kabulEdilenTani: ["Akut Böbrek Hasari", "ABH", "AKI", "Akut Renal Yetmezlik", "Prerenal Azotemi"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          KREATININ: { testKey: "KREATININ", testAdi: "Kreatinin", tip: "numeric", sonuc: { deger: 2.6, birim: "mg/dL", referansAralik: "0.7-1.3" }, referans: "KDIGO", yorum: "Bazalden 2 kat artış — ABH Evre 2." },
          URE: { testKey: "URE", testAdi: "BUN", tip: "numeric", sonuc: { deger: 58, birim: "mg/dL", referansAralik: "7-20" }, referans: "Lab", yorum: "Yüksek — prerenal komponent." },
          ELEKTROLIT: { testKey: "ELEKTROLIT", testAdi: "Elektrolitler", tip: "json", sonuc: { sodyum: "140", potasyum: "5.1", klor: "102", bikarbonat: "20" }, referans: "KDIGO", yorum: "Hafif hiperkalemi + anyon gap artmamış metabolik asidoz." },
          IDRAR: { testKey: "IDRAR", testAdi: "Tam İdrar Tetkiki", tip: "json", sonuc: { dansite: "1025", protein: "Negatif", kan: "Negatif", silendir: "Hyalin (az)" }, referans: "Lab", yorum: "Bland sediment — prerenal ABH ile uyumlu." },
        }),
        hastaYanitlari: () => ({
          IDRAR_AZALMA: "Evet, son 2 gündür çok az idrar geliyor. Günde 1-2 kez anca.",
          DEHIDRATASYON: "3 gün önce ishal oldum, çok su kaybettim. Yeterince su içmedim.",
          ILAC_OYKUSU: "Bel ağrım için naproksen aldım 3 gün boyunca.",
          HT_OYKUSU: "Evet, tansiyonum var. Amlodipin kullanıyorum.",
          ATES_SORGU: "3 gün önce 38.5 ateşim vardı, şimdi yok.",
          HALSIZLIK: "Evet, çok halsizim. Ayağa kalkınca başım dönüyor.",
          HIPERKALEMI_SEMPTOM: "Kaslarımda hafif güçsüzlük var ama çarpıntı yok.",
          AKCIGER_ODEM: "Nefes darlığım yok. Akciğerlerim temiz.",
          VITAL_TANSIYON: "95/60.", VITAL_NABIZ: "92.", VITAL_ATES: "36.8.", VITAL_SPO2: "%96.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Amlodipin 5mg.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["İdrarın azaldı mı?", "Sıvı kaybın oldu mu?", "Hangi ilaçları aldın?", "Tansiyonun var mı?", "Ateşin oldu mu?", "Halsiz misin?"],
        idealYol: ["1. Anamnez: Oligüri, sıvı kaybı, NSAII", "2. Red flag: Hiperkalemi, akciğer ödemi", "3. Kreatinin (bazalden artış)", "4. BUN/kreatinin oranı (>20 = prerenal)", "5. Elektrolitler (K!)", "6. İdrar tetkiki (bland sediment)", "7. Tanı: Prerenal ABH", "8. IV sıvı resüsitasyonu + NSAII kes"],
        egitimNotu: "Akut Böbrek Hasari — KDIGO kriterleri: kreatinin ≥0.3 artış veya ≥1.5 kat. Prerenal ABH: BUN/kreatinin >20, idrar Na <20, bland sediment. En sık neden: hipovolemi + NSAII. TEDAVİ: Altta yatan neden (IV sıvı, NSAII kes), hiperkalemi yönetimi, nefrotoksiklerden kaçın.",
      },
    
            { hastalikKey: "nefrotik-sendrom", hastalikAdi: "Nefrotik Sendrom", semptomSablonu: (h) => `${h.yas} yaş , yaygın ödem ve köpüklü idrar`, anaSikayetSablonu: () => "Yüzde ve bacaklarda şişlik, köpüklü idrar", ozetBilgilerSablonu: () => ["1 haftadır yüzde şişlik","Bacaklarda gode bırakan ödem","İdrar köpüklü","Kilo artışı (sıvıdan)"], yasAraligi: [20, 50], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"ODEM",etiket:"Ödem",aciklama:"Yaygın"},{key:"YUZ_ODEM",etiket:"Yüz ödemi",aciklama:"Sabah"},{key:"IDRAR_RENK",etiket:"Köpüklü idrar",aciklama:"Proteinüri"},{key:"KILO_ALIM",etiket:"Kilo artışı",aciklama:"Sıvı"},{key:"ENFEKSIYON_OYKUSU",etiket:"ÜSYE",aciklama:"Postenfeksiyöz"}], beklenenTestler: [{key:"IDRAR",etiket:"İdrar",aciklama:"Protein +++"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"ELEKTROLIT",etiket:"Elektrolit",aciklama:"Na/K"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"TROMBOZ",etiket:"Tromboz",aciklama:"DVT/renal ven"},{key:"ANURI",etiket:"Anüri",aciklama:"RPGN?"}], kabulEdilenTani: ["Nefrotik Sendrom","Minimal Change Hastalığı","FSGS"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({IDRAR:{testKey:"IDRAR",testAdi:"İdrar Tetkiki",tip:"json",sonuc:{dansite:"1020",ph:"6.0"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, ELEKTROLIT:{testKey:"ELEKTROLIT",testAdi:"Elektrolitler",tip:"json",sonuc:{Na:"140",K:"4.2",Cl:"102"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({ODEM:"Bacaklarım şişti,basınca iz kalıyor", YUZ_ODEM:"Sabahları gözlerim şiş", IDRAR_RENK:"Köpüklü,biraz koyu", KILO_ALIM:"5 kilo aldım", ENFEKSIYON_OYKUSU:"Yakın zamanda enfeksiyon olmadı", VITAL_TANSIYON:"130/85", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Ödem?","Yüz şişliği?","Köpüklü idrar?","Kilo artışı?"], idealYol: ["1.Anamnez:ödem+köpüklü idrar","2.İdrar:protein >3.5g/gün","3.Kan:hipoalbuminemi+hiperlipidemi","4.Biyopsi(endikasyon varsa)","5.Steroid+ACEi"], egitimNotu: "Nefrotik Sendrom — proteinüri>3.5g/gün+hipoalbuminemi+ödem+hiperlipidemi.En sık:Minimal Change(çocuk),Membranöz(erişkin).TEDAVİ:Steroid,ACEi/ARB,diüretik,statin." },
      { hastalikKey: "ckd-ev3", hastalikAdi: "KBH Evre 3", semptomSablonu: (h) => `${h.yas} yaş , rutin tetkikte kreatinin yüksekliği`, anaSikayetSablonu: () => "Rutin kontrolde kreatinin 1.8, başka şikayet yok", ozetBilgilerSablonu: () => ["Rutin kreatinin 1.8","HT öyküsü","DM yok","Başka şikayet yok"], yasAraligi: [50, 70], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"KREATININ_OYKUSU",etiket:"Kreatinin",aciklama:"1.8"},{key:"HT_OYKUSU",etiket:"HT",aciklama:"Var"},{key:"DIYABET",etiket:"DM",aciklama:"Yok"},{key:"IDRAR_AZALMA",etiket:"İdrar",aciklama:"Normal"}], beklenenTestler: [{key:"KREATININ",etiket:"Kreatinin",aciklama:"1.8"},{key:"ELEKTROLIT",etiket:"Elektrolit",aciklama:"Bazal"},{key:"IDRAR",etiket:"İdrar",aciklama:"Protein?"},{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"},{key:"USG_ABDOMEN",etiket:"USG",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"HIZLI_ILERLEME",etiket:"Hızlı ilerleme",aciklama:"GFR %50 düşüş"},{key:"HIPERKALEMI",etiket:"Hiperkalemi",aciklama:"K>5.5"}], kabulEdilenTani: ["KBH Evre 3","CKD Stage 3"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, ELEKTROLIT:{testKey:"ELEKTROLIT",testAdi:"Elektrolit",tip:"json",sonuc:{Na:"140",K:"4.2"},referans:"Lab",yorum:"Normal."}, IDRAR:{testKey:"IDRAR",testAdi:"İdrar",tip:"json",sonuc:{dansite:"1020",ph:"6.0"},referans:"Lab",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5"},referans:"Lab",yorum:"Normal."}, USG_ABDOMEN:{testKey:"USG_ABDOMEN",testAdi:"USG Abdomen",tip:"text",sonuc:"Normal.",referans:"Radyoloji",yorum:"Normal."}}), hastaYanitlari: () => ({KREATININ_OYKUSU:"1.8 çıktı", HT_OYKUSU:"5 yıldır", DIYABET:"Yok", IDRAR_AZALMA:"Normal", VITAL_TANSIYON:"140/85", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Kreatinin?","Tansiyon?","Şeker?","İdrar?"], idealYol: ["1.eGFR 45-60","2.Proteinüri","3.KB nedeni","4.ACEi/ARB","5.KV risk"], egitimNotu: "KBH Evre 3 — eGFR 30-59.TEDAVİ:ACEi/ARB,KB kontrolü,proteinüri takibi.KV risk yönetimi." }],
  },
  {
    key: "onkoloji",
    ad: "Onkoloji",
    icon: "🎗️",
    aciklama: "Meme, akciğer, gastrointestinal kanserler",
    hastalikSablonlari: [
      {
        hastalikKey: "meme-ca",
        hastalikAdi: "Meme Kanseri",
        semptomSablonu: (h) => `${h.yas} yaşında kadın, memede kitle`,
        anaSikayetSablonu: () => "Sol memede 2 haftadır kitle",
        ozetBilgilerSablonu: () => ["2 haftadır sol memede kitle", "Kitle sert, ağrısız, hareket ettirilemiyor", "Meme başından akıntı yok", "Teyzesinde meme kanseri"],
        yasAraligi: [35, 65],
        cinsiyetTercih: "K",
        seviye: "orta",
        rubric: {
          beklenenSorular: [
            { key: "KITLE_SURE", etiket: "Kitle süresi", aciklama: "Ne zamandır var" },
            { key: "KITLE_AGRI", etiket: "Kitle ağrısı", aciklama: "Kanser genelde ağrısız" },
            { key: "AKINTI", etiket: "Meme başı akıntısı", aciklama: "Kanlı ise malignite" },
            { key: "AILE_OYKUSU", etiket: "Aile öyküsü", aciklama: "Meme/over kanseri — BRCA" },
            { key: "BUYUME", etiket: "Büyüme hızı", aciklama: "Kitle büyüyor mu" },
            { key: "MENSTRUASYON", etiket: "Menstruasyon/menopoz", aciklama: "Risk faktörü" },
          ],
          beklenenTestler: [
            { key: "MAMOGRAFI", etiket: "Mamografi", aciklama: "İmaging — şart" },
            { key: "MEME_USG", etiket: "Meme USG", aciklama: "Kitle karakterizasyonu" },
            { key: "BIYOPSI", etiket: "Biyopsi (İİAB)", aciklama: "Kesin tanı" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "MEME_DERI_DEGISIKLIGI", etiket: "Deri değişikliği", aciklama: "Retraksiyon, portakal kabuğu" },
            { key: "AKSIlla_KITLE", etiket: "Aksilla kitle", aciklama: "Lenf nodu metastazı" },
          ],
          kabulEdilenTani: ["Meme Kanseri", "Meme Karsinomu", "Malign Meme Kitlesi", "Breast Cancer"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          MAMOGRAFI: { testKey: "MAMOGRAFI", testAdi: "Mamografi (Bilateral)", tip: "text", sonuc: "Sol memede üst dış kadranda ~2.5 cm düzensiz konturlu, spikülasyonlu kitle. Mikrokalsifikasyonlar. BIRADS 5.", referans: "ACR BIRADS", yorum: "BIRADS 5 — malignite >95%. Biyopsi endikasyonu." },
          MEME_USG: { testKey: "MEME_USG", testAdi: "Meme Ultrasonografisi", tip: "text", sonuc: "Sol meme üst dış kadranda 24×18 mm hipoekoik, düzensiz sınırlı kitle. Akustik gölge. Aksiller lenf nodu: 12 mm, kortikal kalınlaşma. USG BIRADS 5.", referans: "ACR BIRADS", yorum: "Malign kitle. Aksiller lenf nodu şüpheli." },
          BIYOPSI: { testKey: "BIYOPSI", testAdi: "İnce İğne Aspirasyon Biyopsisi", tip: "text", sonuc: "Malign hücreler. İnvaziv duktal karsinom, Grade 2. ER(+), PR(+), HER2(-).", referans: "Patoloji", yorum: "İnvaziv duktal karsinom (ER+/PR+/HER2-) — hormon reseptörü pozitif." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "12.5 g/dL", lokosit: "7.1 K/uL", trombosit: "260 K/uL" }, referans: "Lab", yorum: "Normal." },
        }),
        hastaYanitlari: () => ({
          KITLE_SURE: "2 haftadır. Banyoda fark ettim.",
          KITLE_AGRI: "Hayır, ağrısız. Sert bir şey gibi.",
          AKINTI: "Hayır, akıntım yok.",
          AILE_OYKUSU: "Teyzem 55 yaşında meme kanseri geçirdi.",
          BUYUME: "Evet, büyüyor gibi geliyor.",
          MENSTRUASYON: "Hala düzenli. Menopoza girmedim.",
          MEME_DERI_DEGISIKLIGI: "Hayır, derimde değişiklik yok.",
          AKSIlla_KITLE: "Hayır, koltuk altımda kitle yok.",
          VITAL_TANSIYON: "120/75.", VITAL_NABIZ: "76.", VITAL_ATES: "36.5°C.", VITAL_SPO2: "%98.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.",
          ILAC: "Doğum kontrol hapı 5 yıl önce bıraktım.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Kitle ne zamandır var?", "Kitle ağrılı mı?", "Akıntı var mı?", "Ailede kanser var mı?", "Kitle büyüyor mu?", "Menopoza girdin mi?", "Deride değişiklik var mı?", "Koltuk altında kitle var mı?"],
        idealYol: ["1. Anamnez: Kitle süresi, ağrı, akıntı, aile öyküsü, menstrüasyon", "2. Red flag: Deri retraksiyon, aksiller kitle", "3. Mamografi (BIRADS skorlaması)", "4. Meme USG", "5. İİAB biyopsi (kesin tanı)", "6. Tanı: Meme Kanseri (İnvaziv Duktal Karsinom)", "7. Cerrahi (lumpektomi/mastektomi) + sentinel lenf nodu", "8. Adjuvan: Hormon tedavisi (ER+), kemoterapi (Grade 2)"],
        egitimNotu: "İnvaziv Duktal Karsinom — en sık meme kanseri tipi (%70-80). ER+/PR+/HER2- = luminal A — prognoz nispeten iyi. TEDAVİ: Cerrahi (lumpektomi + radyoterapi veya mastektomi), sentinel lenf nodu biyopsisi, adjuvan hormon tedavisi (tamoxifen premenopoz, AI postmenopoz). BRCA testi aile öyküsü varsa.",
      },
      {
        hastalikKey: "akciger-ca",
        hastalikAdi: "Akciğer Kanseri",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, kronik öksürük ve kilo kaybı`,
        anaSikayetSablonu: () => "2 aydır öksürük, kilo kaybı ve kanlı balgam",
        ozetBilgilerSablonu: () => ["2 aydır öksürük, son 2 hafta kanlı balgam", "Son 1 ayda 6 kilo kaybı", "Göğüs ağrısı var", "Günde 30 sigara, 35 yıldır"],
        yasAraligi: [55, 80],
        cinsiyetTercih: "E",
        seviye: "ileri",
        rubric: {
          beklenenSorular: [
            { key: "OKSURUK", etiket: "Öksürük", aciklama: "Kronik öksürük — karakter ve süre" },
            { key: "KAN_BALGAM", etiket: "Hemoptizi", aciklama: "Kanlı balgam — kırmızı bayrak" },
            { key: "KILO_KAYBI", etiket: "Kilo kaybı", aciklama: "Kanser kaşeksisı" },
            { key: "GOGUS_AGRISI", etiket: "Göğüs ağrısı", aciklama: "Plevral/lokal invazyon" },
            { key: "SIGARA_OYKUSU", etiket: "Sigara öyküsü", aciklama: "En büyük risk faktörü" },
            { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Tümör obstrüksiyonu" },
          ],
          beklenenTestler: [
            { key: "AKCIGER_GRAFISI", etiket: "PA Akciğer Grafisi", aciklama: "İlk imaging" },
            { key: "BT_TORAKS", etiket: "Toraks BT", aciklama: "Detaylı evreleme" },
            { key: "BIYOPSI", etiket: "Biyopsi", aciklama: "Kesin tanı (bronşoskopi/İİAB)" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "MEME_DERI_DEGISIKLIGI", etiket: "Paraneoplastik bulgular", aciklama: "Parmak çomaklaşma, SIADH, hiperkalsemi" },
            { key: "AKSIlla_KITLE", etiket: "Uzak metastaz bulguları", aciklama: "Kemik ağrısı, baş ağrısı, karaciğer" },
          ],
          kabulEdilenTani: ["Akciğer Kanseri", "Akciğer Karsinomu", "Non-Small Cell Lung Cancer", "NSCLC", "Lung Cancer"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          AKCIGER_GRAFISI: { testKey: "AKCIGER_GRAFISI", testAdi: "PA Akciğer Grafisi", tip: "image", sonuc: "Sağ akciğer üst lobda ~4 cm düzensiz konturlu kitle. Hiler lenfadenopati mevcut. Plevral efüzyon sağda minimal.", referans: "Fleischner 2017", yorum: "Sağ üst lob kitle + hiler lenfadenopati — malignite şüphesi yüksek." },
          BT_TORAKS: { testKey: "BT_TORAKS", testAdi: "Toraks BT (Kontrastlı)", tip: "text", sonuc: "Sağ üst lobda 42×38 mm spiküle kitle. Sağ hiler ve subkarinal lenfadenopati (N2). Sağ plevral efüzyon minimal. Uzak metastaz yok (karaciğer/kemik normal).", referans: "Fleischner 2017", yorum: "T2aN2M0 — Evre IIIA. Non-small cell lung cancer şüphesi." },
          BIYOPSI: { testKey: "BIYOPSI", testAdi: "Bronşoskopik Biyopsi", tip: "text", sonuc: "Non-small cell lung cancer — Adenokarsinom. EGFR wild-type, ALK negatif, PD-L1 >50%.", referans: "Patoloji", yorum: "Adenokarsinom. PD-L1 >50% — immünoterapi adayı." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "11.8 g/dL", lokosit: "8.5 K/uL", trombosit: "280 K/uL" }, referans: "Lab", yorum: "Hafif anemi — kronik hastalık anemisi." },
        }),
        hastaYanitlari: () => ({
          OKSURUK: "Evet, 2 aydır öksürüyorum. Kronik, geçmiyor. Gece daha kötü.",
          KAN_BALGAM: "Evet, son 2 haftadır balgamda kan görüyorum. Bazen taze kan, bazen çizgili.",
          KILO_KAYBI: "Evet, son 1 ayda 6 kilo verdim. İştahım azaldı.",
          KILO_KAYBI_AYLIK: "Bu ay içinde 6 kilo verdim. Haftada yaklaşık 1.5 kilo gidiyor.",
          GOGUS_AGRISI: "Evet, sağ tarafta göğüste künt ağrı var. Sabit.",
          SIGARA_OYKUSU: "Günde 30 sigara, 35 yıldır. Toplam 52.5 paket-yıl.",
          NEFES_DARLIGI: "Evet, son 1 aydır nefes darlığım var. Hareketle artıyor.",
          MEME_DERI_DEGISIKLIGI: "Evet, parmaklarımda çomaklaşma var. Yıllardır ama son zamanlarda arttı.",
          AKSIlla_KITLE: "Evet, sırtımda ve kemiklerimde ağrı var. Bel ağrım son 1 ayda başladı.",
          VITAL_TANSIYON: "130/80.", VITAL_NABIZ: "92.", VITAL_ATES: "37.2°C.", VITAL_SPO2: "%92.",
          DIYABET: "Yok.",
          ILAC: "Düzenli ilaç yok.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Öksürüğün ne zamandır?", "Kanlı balgam var mı?", "Kilo verdin mi?", "Göğsünde ağrı var mı?", "Kaç sigara içiyorsun?", "Nefes darlığın var mı?", "Parmaklarında çomaklaşma var mı?", "Kemik ağrın var mı?"],
        idealYol: ["1. Anamnez: Kronik öksürük, hemoptizi, kilo kaybı, sigara", "2. Red flag: Parmak çomaklaşma, kemik ağrısı (metastaz), paraneoplastik", "3. PA Akciğer grafisi", "4. Toraks BT (kontrastlı) — evreleme", "5. Biyopsi (bronşoskopik/İİAB) — kesin tanı", "6. PET-CT — uzak metastaz taraması", "7. Tanı: Akciğer Kanseri (Adenokarsinom) — Evre IIIA", "8. Multidisipliner tumor kurulu: Kemo+radyoterapi veya immünoterapi (PD-L1>50%)"],
        egitimNotu: "Akciğer Adenokarsinomu — sigara ile güçlü ilişki. PD-L1 >50% — pembrolizumab (immünoterapi) ilk seçenek. Evre IIIA (T2aN2M0) — kemo-radyoterapi sonra cerrahi (trimodalite) veya definitive kemo-radioterapi. Prognoz: 5 yıllık sağkalım Evre IIIA ~25%. Düşük savlıklı yaşam: anti-pd-1 monoterapi.",
      },
    
            { hastalikKey: "kolon-ca", hastalikAdi: "Kolon Kanseri", semptomSablonu: (h) => `${h.yas} yaş , kabızlık-ishal değişimi ve kilo kaybı`, anaSikayetSablonu: () => "3 aydır kabızlık-ishal, kilo kaybı, rektal kanama", ozetBilgilerSablonu: () => ["3 aydır bağırsak alışkanlığı değişti","Kabızlık ve ishal atakları","Rektal kanama (taze kan)","Son 3 ayda 8 kilo kaybı"], yasAraligi: [50, 75], cinsiyetTercih: "herhangi", seviye: "ileri", rubric: { beklenenSorular: [{key:"DISKI_RENK",etiket:"Dışkı değişimi",aciklama:"Kabız-ishal"},{key:"KANLI_DISKI",etiket:"Rektal kanama",aciklama:"Taze kan"},{key:"KILO_KAYBI",etiket:"Kilo kaybı",aciklama:"8 kg"},{key:"KARIN_AGRISI",etiket:"Karın ağrısı",aciklama:"Sol alt"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"Kolon CA"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"},{key:"KARACIGER_ENZIM",etiket:"KC Enzim",aciklama:"Metastaz"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"OBSTRUKSIYON",etiket:"Obstrüksiyon",aciklama:"Distansiyon+kusma"},{key:"PERFORASYON",etiket:"Perforasyon",aciklama:"Akut karın"}], kabulEdilenTani: ["Kolon Kanseri","Kolorektal Kanser","Adenokarsinom"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, KARACIGER_ENZIM:{testKey:"KARACIGER_ENZIM",testAdi:"KC Enzimleri",tip:"json",sonuc:{AST:"25",ALT:"30"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({DISKI_RENK:"Bazen kabız bazen ishal oluyorum", KANLI_DISKI:"Tuvalette kan gördüm,taze", KILO_KAYBI:"8 kilo verdim", KARIN_AGRISI:"Sol alt tarafta ağrı var", AILE_OYKUSU:"Babamda kolon kanseri vardı", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Dışkı değişimi?","Kanama?","Kilo kaybı?","Aile öyküsü?"], idealYol: ["1.Anamnez:alışkanlık değişikliği+kanama","2.Rektal tuşe","3.Kolonoskopi+biyopsi","4.Evreleme(BT)","5.Cerrahi rezeksiyon+KT"], egitimNotu: "Kolon CA — en sık GI kanser.Risk:>50 yaş,aile öyküsü,inflamatuar barsak hastalığı.Tarama:50 yaşta kolonoskopi.TEDAVİ:Cerrahi,adjuvan KT(evre III)." },
      { hastalikKey: "dcis", hastalikAdi: "DCIS", semptomSablonu: (h) => `${h.yas} yaş kadın, mamografide mikrokalsifikasyon`, anaSikayetSablonu: () => "Tarama mamografisinde mikrokalsifikasyon, kitle yok", ozetBilgilerSablonu: () => ["Rutin mamografide mikrokalsifikasyon","Kitle yok","Akıntı yok","Aile öyküsü yok"], yasAraligi: [40, 60], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"TARAMA",etiket:"Mamografi",aciklama:"Mikrokalsifikasyon"},{key:"KITLE_AGRI",etiket:"Kitle",aciklama:"Yok"},{key:"AKINTI",etiket:"Akıntı",aciklama:"Yok"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"Yok"}], beklenenTestler: [{key:"MAMOGRAFI",etiket:"Mamografi",aciklama:"BIRADS 4"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"INVAZIV_CA",etiket:"İnvaziv",aciklama:"Biyopside invazyon"},{key:"COK_ODAKLI",etiket:"Çok odaklı",aciklama:"Yaygın"}], kabulEdilenTani: ["DCIS","Evre 0 Meme CA"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({MAMOGRAFI:{testKey:"MAMOGRAFI",testAdi:"Mamografi",tip:"text",sonuc:"BIRADS 4 mikrokalsifikasyon.",referans:"ACR",yorum:"Şüpheli."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({TARAMA:"Mamografide şüpheli", KITLE_AGRI:"Kitle yok", AKINTI:"Yok", AILE_OYKUSU:"Yok", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Mamografi?","Kitle?","Akıntı?","Aile?"], idealYol: ["1.Mamografi BIRADS 4","2.Biyopsi:DCIS","3.Lumpektomi+RT","4.Tamoksifen(ER+)"], egitimNotu: "DCIS — Evre 0,bazal membran aşmamış.TEDAVİ:Lumpektomi+RT veya mastektomi.Tamoksifen ER+'te nüksü azaltır." }],
  },
  // ── Hematoloji ──
  {
    key: "hematoloji",
    ad: "Hematoloji",
    icon: "🩸",
    aciklama: "Anemi, kanama bozuklukları, hemofili",
    hastalikSablonlari: [
      {
        hastalikKey: "demir-eksikligi-anemisi",
        hastalikAdi: "Demir Eksikliği Anemisi",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, halsizlik ve solukluk`,
        anaSikayetSablonu: () => "Halsizlik, çarpıntı ve solukluk",
        ozetBilgilerSablonu: () => ["3 aydır halsizlik ve çabuk yorulma", "Çarpıntı var", "Ciltte solukluk fark ediliyor", "Son 1 yılda adet kanamaları arttı"],
        yasAraligi: [25, 55],
        cinsiyetTercih: "K",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "HALSIZLIK", etiket: "Halsizlik", aciklama: "Halsizlik/yorgunluk" },
            { key: "CARPINTI_OYKU", etiket: "Çarpıntı", aciklama: "Anemi bulgusu" },
            { key: "SOLUKLUK", etiket: "Ciltte solukluk", aciklama: "Anemi bulgusu" },
            { key: "MENSTRUASYON", etiket: "Adet düzeni", aciklama: "Kan kaybı nedeni" },
            { key: "BESLENME", etiket: "Beslenme", aciklama: "Demir alımı" },
            { key: "ILAC_OYKUSU", etiket: "İlaç öyküsü", aciklama: "NSAII kanama riski" },
          ],
          beklenenTestler: [
            { key: "CBC", etiket: "Hemogram", aciklama: "Anemi tanısı için şart" },
            { key: "FERITIN", etiket: "Ferritin", aciklama: "Demir deposu göstergesi" },
            { key: "DEMIR", etiket: "Serum Demir/TDBK", aciklama: "Demir eksikliği konfirmasyonu" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "KANLI_DISKI", etiket: "GİS kanama", aciklama: "Gizli kanama kaynağı — malignite" },
            { key: "ANI_KILO_KAYBI", etiket: "Ani kilo kaybı", aciklama: "Malignite bulgusu" },
          ],
          kabulEdilenTani: ["Demir Eksikliği Anemisi", "DEA", "Iron Deficiency Anemia", "Mikrositik Anemi"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "7.8 g/dL", lokosit: "6.2 K/uL", trombosit: "340 K/uL", MCV: "68 fL", MCH: "22 pg", hematokrit: "%26" }, referans: "Lab", yorum: "Mikrositik hipokrom anemi. Demir eksikliği ile uyumlu." },
          FERITIN: { testKey: "FERITIN", testAdi: "Ferritin", tip: "numeric", sonuc: { deger: 6, birim: "ng/mL", referansAralik: "15-150 ng/mL" }, referans: "Lab", yorum: "Ferritin çok düşük — demir depoları boşalmış." },
          DEMIR: { testKey: "DEMIR", testAdi: "Serum Demir + TDBK", tip: "json", sonuc: { serumDemir: "22 mcg/dL", tdbk: "420 mcg/dL", saturasyon: "%5" }, referans: "Lab", yorum: "Demir düşük, TDBK yüksek, satürasyon <%16 — DEA." },
        }),
        hastaYanitlari: () => ({
          HALSIZLIK: "Çok halsizim. 3 aydır. Merdiven çıkınca nefes nefese kalıyorum.",
          CARPINTI_OYKU: "Evet, bazen kalbim küt küt atıyor. Özellikle hareket edince.",
          SOLUKLUK: "Evet, cildim soldu. Başkaları da fark etti.",
          MENSTRUASYON: "Adetlerim çok yoğun, 7-8 gün sürüyor. Pıhtı da geliyor.",
          BESLENME: "Et pek yemiyorum. Sebze ağırlıklı besleniyorum.",
          ILAC_OYKUSU: "Ağrı kesici ara sıra alıyorum adet döneminde.",
          KANLI_DISKI: "Hayır, dışkımda kan görmüyorum. Rengi normal.",
          ANI_KILO_KAYBI: "Hayır, kilom sabit.",
          VITAL_TANSIYON: "105/65.", VITAL_NABIZ: "95.", VITAL_ATES: "36.5°C.", VITAL_SPO2: "%97.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Adet dönemi ağrı kesici.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Halsiz misin?", "Çarpıntın oldu mu?", "Adetlerin nasıl?", "Et/yeşillik tüketiyor musun?", "Ağrı kesici kullanıyor musun?", "Dışkı rengin nasıl?"],
        idealYol: ["1. Anamnez: Halsizlik, çarpıntı, solukluk", "2. Menstruasyon öyküsü (hipermenore)", "3. Beslenme öyküsü (düşük demir alımı)", "4. Red flag: GİS kanama, ani kilo kaybı", "5. Hemogram (Hb, MCV, MCH)", "6. Ferritin", "7. Serum demir + TDBK", "8. Tanı: Demir Eksikliği Anemisi"],
        egitimNotu: "Demir Eksikliği Anemisi — en sık anemi nedeni. Mikrositik hipokrom (MCV<80, MCH<27). Ferritin <15 = DEA. En sık nedenler: kronik kan kaybı (hipermenore, GİS), düşük alım. TEDAVİ: Oral ferros sülfat 200mg 3x1, C vitamini ile emilim artar. 2 haftada retikülosit yanıtı, Hb normale 2 ayda döner.",
      },
    
            { hastalikKey: "trombositopeni", hastalikAdi: "İmmün Trombositopeni", semptomSablonu: (h) => `${h.yas} yaş kadın, peteşi ve kolay morarma`, anaSikayetSablonu: () => "Vücutta peteşi, kolay morarma, diş eti kanaması", ozetBilgilerSablonu: () => ["2 haftadır vücutta kırmızı noktalar","Kolay morarma","Diş fırçalarken kanama","Son 2 hafta önce ÜSYE geçirdi"], yasAraligi: [20, 60], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"PETEŞI",etiket:"Peteşi",aciklama:"Deride"},{key:"KOLAY_MORARMA",etiket:"Morarma",aciklama:"Kolay"},{key:"DIS_ETI_KANAMA",etiket:"Diş eti",aciklama:"Kanama"},{key:"ENFEKSIYON_OYKUSU",etiket:"ÜSYE",aciklama:"Tetikleyici"},{key:"BURUN_KANAMASI",etiket:"Burun kanaması",aciklama:"Epistaksis"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Trombositopeni"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KANAMA_MAJOR",etiket:"Majör kanama",aciklama:"GİS/intrakraniyal"},{key:"TROMBOZ",etiket:"Tromboz",aciklama:"Paradoksal"}], kabulEdilenTani: ["İTP","İmmün Trombositopeni","ITP"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({PETEŞI:"Kollarımda ve bacaklarımda kırmızı noktalar çıktı", KOLAY_MORARMA:"Çarpınca hemen morarıyor", DIS_ETI_KANAMA:"Diş fırçalarken kanıyor", ENFEKSIYON_OYKUSU:"2 hafta önce grip oldum", BURUN_KANAMASI:"Burnum kanamadı", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Peteşi?","Morarma?","Diş eti kanaması?","Grip geçirdin mi?"], idealYol: ["1.Anamnez:peteşi+morarma","2.CBC:trombosit <20K","3.Periferik yayma","4.Steroid 1mg/kg","5.IVIG (acil)"], egitimNotu: "İTP — izole trombositopeni(<100K).Çocukta akut,viral sonrası.Erişkinde kronik.TEDAVİ:Steroid 1mg/kg,IVIG(acil).Trombopoietin agonistleri(kronik)." },
      { hastalikKey: "hemofili-a", hastalikAdi: "Hemofili A", semptomSablonu: (h) => `${h.yas} yaş erkek, eklem içi kanama`, anaSikayetSablonu: () => "Dizde şişlik ve ağrı, travma olmadan", ozetBilgilerSablonu: () => ["Sabah uyanınca dizde şişlik","Travma olmadan oldu","Diz sıcak ve ağrılı","Çocukluktan beri kolay kanama öyküsü"], yasAraligi: [5, 30], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"EKLEM_AGRISI",etiket:"Diz ağrısı",aciklama:"Spontan"},{key:"SICAKLIK",etiket:"Sıcaklık",aciklama:"Hemartroz"},{key:"TRAVMA",etiket:"Travma",aciklama:"Yok"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"Hemofili"},{key:"YAS",etiket:"Başlangıç yaşı",aciklama:"Çocukluk"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Normal trombosit"},{key:"PTT",etiket:"aPTT",aciklama:"Uzamış"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KANAMA_MAJOR",etiket:"Majör kanama",aciklama:"GİS/intrakraniyal"},{key:"KOMPARTMAN",etiket:"Kompartman sendromu",aciklama:"Acil fasyotomi"}], kabulEdilenTani: ["Hemofili A","Faktör VIII Eksikliği"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, PTT:{testKey:"PTT",testAdi:"aPTT",tip:"text",sonuc:"Normal.",referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({EKLEM_AGRISI:"Dizim şişti ve çok ağrıyor", SICAKLIK:"Dizim sıcak", TRAVMA:"Hiçbir şey olmadı,uyanınca şişti", AILE_OYKUSU:"Dayımda da var", YAS:"Çocukluğumdan beri", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Diz ağrısı?","Travma?","Aile öyküsü?","Ne zaman başladı?"], idealYol: ["1.Anamnez:spontan hemartroz","2.aPTT ölçümü","3.Faktör VIII düzeyi","4.Faktör VIII replasmanı","5.Eklem istirahati+buz"], egitimNotu: "Hemofili A — Faktör VIII eksikliği(X'e bağlı resesif).Hemartroz en sık.TEDAVİ:Faktör VIII konsantresi.Ağır hastada profilaksi." }],
  },
  // ── Enfeksiyon ──
  {
    key: "enfeksiyon",
    ad: "Enfeksiyon",
    icon: "🦠",
    aciklama: "İdrar yolu enfeksiyonu, sepsis, enfeksiyöz hastalıklar",
    hastalikSablonlari: [
      {
        hastalikKey: "iye",
        hastalikAdi: "İdrar Yolu Enfeksiyonu",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, dizüri ve pollaküri`,
        anaSikayetSablonu: () => "İdrar yaparken yanma ve sık idrara çıkma",
        ozetBilgilerSablonu: () => ["3 gündür idrar yaparken yanma", "Sık idrara çıkma (pollaküri)", "Ateş yok, yan ağrısı yok", "İdrar rengi bulanık"],
        yasAraligi: [20, 70],
        cinsiyetTercih: "K",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "DIZURI", etiket: "Dizüri (yanma)", aciklama: "İdrar yaparken yanma" },
            { key: "POLLAKURI", etiket: "Sık idrara çıkma", aciklama: "Pollaküri" },
            { key: "ATES_SORGU", etiket: "Ateş", aciklama: "Piyelonefrit ayırımı" },
            { key: "YAN_AGRISI", etiket: "Yan ağrısı", aciklama: "Piyelonefrit bulgusu" },
            { key: "IDRAR_RENK", etiket: "İdrar rengi/kokusu", aciklama: "Makroskopik değişiklik" },
            { key: "ILAC_OYKUSU", etiket: "İlaç öyküsü", aciklama: "Antibiyotik kullanımı" },
          ],
          beklenenTestler: [
            { key: "IDRAR", etiket: "Tam İdrar Tetkiki", aciklama: "Lökosit, nitrit, bakteri" },
            { key: "CBC", etiket: "Hemogram", aciklama: "Lökosit" },
            { key: "CRP", etiket: "CRP", aciklama: "Enflamasyon" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "ATES_YUKSEK_ATAS", etiket: "Yüksek ateş + yan ağrısı", aciklama: "Piyelonefrit" },
            { key: "KONFUZYON", etiket: "Konfüzyon/hipotansiyon", aciklama: "Ürosepsis bulgusu" },
          ],
          kabulEdilenTani: ["İdrar Yolu Enfeksiyonu", "İYE", "Sistit", "UTI"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          IDRAR: { testKey: "IDRAR", testAdi: "Tam İdrar Tetkiki", tip: "json", sonuc: { dansite: "1020", lökosit: "Pozitif (+++)", nitrit: "Pozitif", protein: "Negatif", kan: "Eser", pH: "8.0", bakteri: "Bol" }, referans: "Lab", yorum: "Piyuri + nitrit pozitif + bakteriüri. Tipik İYE." },
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "13.5 g/dL", lokosit: "10.8 K/uL", trombosit: "250 K/uL" }, referans: "Lab", yorum: "Hafif lökositoz." },
          CRP: { testKey: "CRP", testAdi: "CRP", tip: "numeric", sonuc: { deger: 25, birim: "mg/L", referansAralik: "< 5 mg/L" }, referans: "Lab", yorum: "CRP hafif yüksek." },
        }),
        hastaYanitlari: () => ({
          DIZURI: "Evet, idrar yaparken yanma var. Özellikle sonunda daha çok yanıyor.",
          POLLAKURI: "Evet, 15-20 dakikada bir tuvalete gidiyorum. Ama az idrar geliyor.",
          ATES_SORGU: "Hayır, ateşim yok. 36.8°C.",
          YAN_AGRISI: "Hayır, böğür ağrım yok.",
          IDRAR_RENK: "İdrarım bulanık, normalden koyu ve kokusu da değişti.",
          ILAC_OYKUSU: "Düzenli ilaç kullanmıyorum. Antibiyotik almadım.",
          ATES_YUKSEK_ATAS: "Hayır, yüksek ateşim olmadı.",
          KONFUZYON: "Bilincim yerinde.",
          VITAL_TANSIYON: "115/75.", VITAL_NABIZ: "82.", VITAL_ATES: "36.8°C.", VITAL_SPO2: "%98.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Düzenli ilaç yok.", ALERJI: "Sülfonamid alerjim var.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["İdrar yaparken yanma var mı?", "Sık idrara çıkıyor musun?", "Ateşin var mı?", "Yan/böğür ağrın var mı?", "İdrar rengin nasıl?", "Antibiyotik kullandın mı?"],
        idealYol: ["1. Anamnez: Dizüri, pollaküri, idrar rengi", "2. Red flag: Ateş + yan ağrısı (piyelonefrit)", "3. Tam idrar tetkiki (strip + mikroskop)", "4. Hemogram + CRP", "5. Tanı: İYE (sistit)", "6. Ampirik antibiyotik (nitrofurantoin)", "7. Bol sıvı alımı"],
        egitimNotu: "İYE (sistit) — kadınlarda en sık bakteriyel enfeksiyon. En sık etken: E.coli (%80). Komplike olmayan sistitte idrar kültürü gerekmez. TEDAVİ: Nitrofurantoin 100mg 2x1 5 gün veya TMP-SMX 3 gün. Semptomlar 48 saatte düzelir.",
      },
    
            { hastalikKey: "gastroenterit", hastalikAdi: "Akut Gastroenterit", semptomSablonu: (h) => `${h.yas} yaş , ishal ve kusma`, anaSikayetSablonu: () => "Sulu ishal, kusma, karın ağrısı", ozetBilgilerSablonu: () => ["1 gündür sulu ishal (8-10 kez)","Kusma (4-5 kez)","Karın ağrısı kramp tarzında","Dün akşam dışarıda yemek yedi"], yasAraligi: [5, 70], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"ISHAL",etiket:"İshal",aciklama:"Sulu,sık"},{key:"KUSMA",etiket:"Kusma",aciklama:"Eşlik eden"},{key:"KARIN_AGRISI",etiket:"Karın ağrısı",aciklama:"Kramp"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:"Var mı"},{key:"GIDA_OYKUSU",etiket:"Gıda öyküsü",aciklama:"Dışarıda yemek"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Dehidratasyon"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"},{key:"ELEKTROLIT",etiket:"Elektrolit",aciklama:"Na/K"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"DEHIDRATASYON_AGIR",etiket:"Ağır dehidratasyon",aciklama:"Letarji+oligüri"},{key:"KANLI_DISKI",etiket:"Kanlı ishal",aciklama:"EHEC/Shigella"}], kabulEdilenTani: ["Akut Gastroenterit","AGE","Gastroenterit"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, ELEKTROLIT:{testKey:"ELEKTROLIT",testAdi:"Elektrolitler",tip:"json",sonuc:{Na:"140",K:"4.2",Cl:"102"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({ISHAL:"Sulu,günde 10 kez", KUSMA:"4-5 kez kustum", KARIN_AGRISI:"Kramp tarzında", ATES_SORGU:"37.5 hafif", GIDA_OYKUSU:"Dün tavuk döner yedim", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"95", VITAL_ATES:"37.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["İshal?","Kusma?","Ateş?","Ne yedin?"], idealYol: ["1.Anamnez:ishal+kusma","2.Dehidratasyon değerlendirme","3.ORS+bol sıvı","4.Antiemetik","5.Kanlı ishal→AB"], egitimNotu: "AGE — viral(Rota/Noro) veya bakteriyel.En sık komplikasyon:dehidratasyon.TEDAVİ:ORS,bol sıvı,probiyotik.Kanlı ishal→kültür+AB." },
      { hastalikKey: "hepatit-b", hastalikAdi: "Akut Hepatit B", semptomSablonu: (h) => `${h.yas} yaş , sarılık ve halsizlik`, anaSikayetSablonu: () => "Sarılık, halsizlik, iştahsızlık, koyu idrar", ozetBilgilerSablonu: () => ["1 haftadır halsizlik","2 gündür gözlerde sararma","Koyu renkli idrar","Açık renkli gaita"], yasAraligi: [20, 50], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"SARARMA",etiket:"Sarilık",aciklama:"Göz+deri"},{key:"HALSIZLIK",etiket:"Halsizlik",aciklama:"Prodrom"},{key:"IDRAR_RENK",etiket:"Koyu idrar",aciklama:"Kolanjik"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:"Prodrom"},{key:"RISK_FAKTOR",etiket:"Risk",aciklama:"Temas/transfüzyon"}], beklenenTestler: [{key:"KARACIGER_ENZIM",etiket:"KC Enzim",aciklama:"Yüksek"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KARACIGER_YETMEZLIK",etiket:"KC yetmezliği",aciklama:"Ensefalopati"},{key:"HEMORAJI",etiket:"Kanama",aciklama:"PT uzaması"}], kabulEdilenTani: ["Akut Hepatit B","Hepatit B"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({KARACIGER_ENZIM:{testKey:"KARACIGER_ENZIM",testAdi:"KC Enzimleri",tip:"json",sonuc:{AST:"25",ALT:"30"},referans:"Lab",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({SARARMA:"Gözlerim sarardı", HALSIZLIK:"Çok halsizim", IDRAR_RENK:"Koyu çay gibi", ATES_SORGU:"37.8 hafif ateş", RISK_FAKTOR:"3 ay önce diş çekimi oldu", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Sarilık?","Halsizlik?","İdrar rengi?","Risk faktörü?"], idealYol: ["1.Anamnez:prodrom+ikter","2.KC enzimleri","3.HBsAg+AntiHBc IgM","4.Destek tedavisi","5.Kronikleşme takibi"], egitimNotu: "Akut Hepatit B — inkübasyon 1-4 ay.Prodrom:ateş+halsizlik+artralji.İkterik dönem:sarılık+koyu idrar.TEDAVİ:Destek,antiviral(ağır).%95 erişkinde iyileşir." }],
  },
  // ── Cerrahi ──
  {
    key: "cerrahi",
    ad: "Genel Cerrahi",
    icon: "🏥",
    aciklama: "Akut apandisit, kolesistit, herni vakaları",
    hastalikSablonlari: [
      {
        hastalikKey: "akut-apandisit",
        hastalikAdi: "Akut Apandisit",
        semptomSablonu: (h) => `${h.yas} yaşında ${h.cinsiyet === "E" ? "erkek" : "kadın"}, sağ alt kadran ağrısı`,
        anaSikayetSablonu: () => "Göbek çevresinde başlayıp sağ alta yayılan karın ağrısı",
        ozetBilgilerSablonu: () => ["12 saattir karın ağrısı", "Ağrı göbek çevresinde başladı, sağ alt kadrana yerleşti", "Hafif bulantı var, kusma yok", "İştahsızlık mevcut"],
        yasAraligi: [15, 45],
        cinsiyetTercih: "herhangi",
        seviye: "baslangic",
        rubric: {
          beklenenSorular: [
            { key: "AGRI_YER", etiket: "Ağrının yeri", aciklama: "Lokalizasyon ve migrasyonu" },
            { key: "AGRI_SURE", etiket: "Ağrı süresi", aciklama: "Başlangıç ve seyir" },
            { key: "BULANTI", etiket: "Bulantı/kusma", aciklama: "Apandisit bulgusu" },
            { key: "ISTAHSIZLIK", etiket: "İştahsızlık", aciklama: "Apandisit triadı" },
            { key: "ATES_SORGU", etiket: "Ateş", aciklama: "Perforasyon göstergesi" },
            { key: "ILAC_OYKUSU", etiket: "İlaç öyküsü", aciklama: "Antibiyotik/analjezik" },
          ],
          beklenenTestler: [
            { key: "CBC", etiket: "Hemogram", aciklama: "Lökositoz" },
            { key: "CRP", etiket: "CRP", aciklama: "Enflamasyon" },
          ],
          gereksizTestler: [{ key: "TROPONIN", etiket: "Troponin", aciklama: "İlgisiz" }],
          redFlagler: [
            { key: "DEFANS_REBOUND", etiket: "Defans/rebound", aciklama: "Peritonit bulgusu — acil cerrahi" },
            { key: "ATES_YUKSEK_ATAS", etiket: "Yüksek ateş + taşikardi", aciklama: "Perforasyon/sepsis" },
          ],
          kabulEdilenTani: ["Akut Apandisit", "Apandisit", "Appendicitis"],
          puanlama: { dogru_kritik_soru: 2, dogru_yardimci_soru: 1, dogru_test: 2, gereksiz_test: -1, red_flag_atlama: -3, tehlikeli_eksik: -5, tani_dogru: 5, tani_yanlis: -3 },
        },
        statikTestler: () => ({
          CBC: { testKey: "CBC", testAdi: "Hemogram", tip: "json", sonuc: { hemoglobin: "14.5 g/dL", lokosit: "14.5 K/uL", trombosit: "260 K/uL", nötrofil: "%85" }, referans: "Lab", yorum: "Lökositoz ve nötrofil hakimiyeti — akut enflamasyon." },
          CRP: { testKey: "CRP", testAdi: "CRP", tip: "numeric", sonuc: { deger: 55, birim: "mg/L", referansAralik: "< 5 mg/L" }, referans: "Lab", yorum: "CRP yüksek — akut faz yanıtı." },
        }),
        hastaYanitlari: () => ({
          AGRI_YER: "Önce göbek çevresinde başladı, şimdi sağ alt tarafa yerleşti. Tam şurada (McBurney noktası).",
          AGRI_SURE: "12 saattir var. Başladı, giderek arttı. Sürekli artık.",
          BULANTI: "Hafif bulantım var ama kusmadım.",
          ISTAHSIZLIK: "Evet, canım hiçbir şey istemiyor.",
          ATES_SORGU: "Hafif ateşim var, 37.8°C.",
          ILAC_OYKUSU: "Ağrı kesici olarak parasetamol aldım ama pek fayda etmedi.",
          DEFANS_REBOUND: "Muayenede sağ alt kadranda hassasiyet, defans ve rebound pozitif.",
          ATES_YUKSEK_ATAS: "Ateşim 37.8, nabzım 95. Yüksek değil.",
          VITAL_TANSIYON: "120/80.", VITAL_NABIZ: "95.", VITAL_ATES: "37.8°C.", VITAL_SPO2: "%98.",
          SIGARA: "İçmiyorum.", DIYABET: "Yok.", ILAC: "Parasetamol aldım.", ALERJI: "Yok.",
          OZEL: "Bunu tam anlamadım, daha açıklayabilir misiniz?",
        }),
        soruChipleri: ["Ağrı nerede başladı?", "Ne zamandır var?", "Bulantı/kusma var mı?", "İştahın nasıl?", "Ateşin var mı?", "Ağrı kesici aldın mı?"],
        idealYol: ["1. Anamnez: Ağrı migrasyonu (periumbilikal > sağ alt kadran)", "2. Apandisit triadı: ağrı + bulantı + iştahsızlık", "3. Red flag: Defans/rebound (peritonit), yüksek ateş", "4. Fizik muayene: McBurney hassasiyeti", "5. Hemogram + CRP", "6. Tanı: Akut Apandisit", "7. Cerrahi konsültasyon + apendektomi"],
        egitimNotu: "Akut Apandisit — en sık cerrahi acil. Tipik prezentasyon: periumbilikal ağrının sağ alt kadrana migrasyonu + bulantı + iştahsızlık. Alvarado skoru >=7 = cerrahi. McBurney hassasiyeti, rebound, defans. Lökositoz + sola kayma + CRP. TEDAVİ: Apendektomi + antibiyotik profilaksisi.",
      },
    ],
  },


  {
    key: "goz",
    ad: "Göz Hastalıkları",
    icon: "👁️",
    aciklama: "Göz Hastalıkları polikliniği simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "akut-glokom", hastalikAdi: "Akut Glokom", semptomSablonu: (h) => `${h.yas} yaş kadın, ani göz ağrısı`, anaSikayetSablonu: () => "Ani göz ağrısı, bulanık görme, ışıkta hale", ozetBilgilerSablonu: () => ["2 saat önce ani göz ağrısı","Bulanık görme ve ışıkta haleler","Bulantı ve kusma","Göz kıpkırmızı"], yasAraligi: [50, 80], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"GOZ_AGRISI",etiket:"Göz ağrısı",aciklama:"Ani şiddetli göz ağrısı"},{key:"GORME",etiket:"Bulanık görme",aciklama:"Görme bulanıklığı"},{key:"HALE_GORME",etiket:"Işıkta hale",aciklama:"Renkli haleler"},{key:"BULANTI",etiket:"Bulantı",aciklama:"Eşlik eden"},{key:"GOZ_KIZARIKLIK",etiket:"Kızarıklık",aciklama:"Konjonktival hiperemi"}], beklenenTestler: [{key:"GOZ_BASINCI",etiket:"GİB",aciklama:">40mmHg acil"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KOR_KALMA",etiket:"Körlük riski",aciklama:">2saat kalıcı hasar"},{key:"BAS_AGRISI",etiket:"Baş ağrısı",aciklama:"Şiddetli"}], kabulEdilenTani: ["Akut Glokom","Açı Kapanması Glokomu"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({GOZ_BASINCI:{testKey:"GOZ_BASINCI",testAdi:"GİB",tip:"text",sonuc:"Normal.",referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({GOZ_AGRISI:"Bıçak saplanır gibi", GORME:"Bulanık, ışıkta haleler", HALE_GORME:"Evet, renkli", BULANTI:"Kustum", GOZ_KIZARIKLIK:"Kıpkırmızı", VITAL_TANSIYON:"140/90", VITAL_NABIZ:"85", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Göz ağrısı?","Bulanık mı?","Işıkta hale?","Bulantı?"], idealYol: ["1.Acil tanı:akut glokom","2.GİB ölçümü","3.Pilokarpin+asetazolamid","4.Mannitol","5.Lazer iridotomi"], egitimNotu: "Akut Glokom — GİB>40mmHg,körlük riski. Bulgular:kırmızı göz,mid-dilate pupil,kornea ödemi. TEDAVİ:Pilokarpin,asetazolamid,mannitol,acil lazer iridotomi." },
      { hastalikKey: "konjonktivit", hastalikAdi: "Bakteriyel Konjonktivit", semptomSablonu: (h) => `${h.yas} yaş , gözde kızarıklık ve akıntı`, anaSikayetSablonu: () => "Gözde kızarıklık, pürülan akıntı", ozetBilgilerSablonu: () => ["3 gündür gözde kızarıklık","Sarı-yeşil akıntı","Sabah kirpikler yapışıyor","Ağrı yok, batma var"], yasAraligi: [5, 60], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"GOZ_KIZARIKLIK",etiket:"Kızarıklık",aciklama:"Hiperemi"},{key:"GOZ_AKINTI",etiket:"Akıntı",aciklama:"Pürülan"},{key:"GOZ_AGRISI",etiket:"Ağrı",aciklama:"Batma"},{key:"FOTOFOBİ",etiket:"Fotofobi",aciklama:"Işık hassasiyeti"},{key:"GORME",etiket:"Görme",aciklama:"Etkilenme"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Enfeksiyon"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KORNEA_ULKER",etiket:"Kornea ülseri",aciklama:"Beyaz opasite"},{key:"GOZ_AGRISI_SIDDETLI",etiket:"Şiddetli ağrı",aciklama:"Kerait"}], kabulEdilenTani: ["Bakteriyel Konjonktivit","Konjonktivit"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({GOZ_KIZARIKLIK:"Kıpkırmızı", GOZ_AKINTI:"Sarı-yeşil", GOZ_AGRISI:"Batma var", FOTOFOBİ:"Rahatsız değilim", GORME:"Normal", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Kızarıklık?","Akıntı?","Ağrı?","Işık rahatsızlığı?"], idealYol: ["1.Anamnez","2.Kornea kontrol","3.Topikal AB","4.Hijyen"], egitimNotu: "Bakteriyel Konjonktivit — S.aureus/S.pneumoniae.Pürülan akıntı.TEDAVİ:Siprofloksasin damla 4x1,5-7 gün." }
    ,
            { hastalikKey: "katarakt", hastalikAdi: "Senil Katarakt", semptomSablonu: (h) => `${h.yas} yaş , yavaş ilerleyen görme kaybı`, anaSikayetSablonu: () => "Yavaş ilerleyen görme bulanıklığı, gece görüşü bozuldu", ozetBilgilerSablonu: () => ["1 yıldır giderek artan görme bulanıklığı","Gece araba kullanamıyor","Renkler soluk görünüyor","Işık hassasiyeti ve çift görme"], yasAraligi: [60, 85], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"GORME",etiket:"Görme",aciklama:"Bulanık"},{key:"GECE_GORME",etiket:"Gece görme",aciklama:"Bozuk"},{key:"RENK_GORME",etiket:"Renkler",aciklama:"Soluk"},{key:"CIFT_GORME",etiket:"Çift görme",aciklama:"Monooküler"},{key:"GOZ_AGRISI",etiket:"Ağrı",aciklama:"Yok"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Preop"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"AKUT_GLOKOM",etiket:"Akut glokom",aciklama:"Ağrı+bulantı+görme kaybı"},{key:"RETINA_DEKOLMANI",etiket:"Retina dekolmanı",aciklama:"Ani uçuşan cisimler+flaş"}], kabulEdilenTani: ["Katarakt","Senil Katarakt"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({GORME:"Bulanık,son 1 yıldır arttı", GECE_GORME:"Gece hiç göremiyorum", RENK_GORME:"Renkler soluk", CIFT_GORME:"Tek gözümü kapatınca geçiyor", GOZ_AGRISI:"Ağrı yok", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Görme?","Gece görme?","Renkler?","Çift görme?"], idealYol: ["1.Anamnez:yavaş ilerleyen görme kaybı","2.Göz muayenesi:lens opasifikasyonu","3.Görme keskinliği testi","4.Fako cerrahisi planlaması"], egitimNotu: "Katarakt — lens opasifikasyonu.En sık senil tip.TEDAVİ:Fakoemülsifikasyon+GİL(cerrahi).Cerrahi zamanlaması:görme günlük yaşamı etkileyince." }],
  },
  {
    key: "kbb",
    ad: "KBB",
    icon: "👂",
    aciklama: "KBB polikliniği simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "akut-tonsillit", hastalikAdi: "Akut Tonsillit", semptomSablonu: (h) => `${h.yas} yaş , boğaz ağrısı ve ateş`, anaSikayetSablonu: () => "Boğaz ağrısı, yutkunma zorluğu, ateş", ozetBilgilerSablonu: () => ["3 gündür boğaz ağrısı","Ateş 38.5°C","Yutkunma çok zor","Boyunda lenf bezesi"], yasAraligi: [5, 35], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"BOGAZ_AGRISI",etiket:"Boğaz ağrısı",aciklama:"Şiddetli"},{key:"YUTKUNMA",etiket:"Yutma zorluğu",aciklama:"Disfaji"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:">38"},{key:"LENFADENOPATI",etiket:"LAP",aciklama:"Servikal"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Lökositoz"},{key:"CRP",etiket:"CRP",aciklama:"Enflamasyon"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"PERITONSILER_APSE",etiket:"Apse",aciklama:"Trismus"},{key:"SOLUNUM_SIKINTISI",etiket:"Solunum sıkıntısı",aciklama:"Stridor"}], kabulEdilenTani: ["Akut Tonsillit","Tonsillit"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, CRP:{testKey:"CRP",testAdi:"CRP",tip:"numeric",sonuc:{deger:25,birim:"mg/L",referansAralik:"<5"},referans:"Lab",yorum:"Hafif yüksek."}}), hastaYanitlari: () => ({BOGAZ_AGRISI:"Çok ağrıyor", YUTKUNMA:"Bıçak gibi", ATES_SORGU:"38.5,titreme", LENFADENOPATI:"Bezeler şişti", VITAL_TANSIYON:"125/80", VITAL_NABIZ:"92", VITAL_ATES:"38.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Boğaz ağrısı?","Yutkunma?","Ateş?","Beze?"], idealYol: ["1.Centor","2.Strep test","3.Penisilin 10gün","4.Parasetamol"], egitimNotu: "Akut Tonsillit — Centor:ateş>38,eksüda,LAP,öksürük yok.3-4 kriter→AB.TEDAVİ:Penisilin V 10gün." },
      { hastalikKey: "otitis-media", hastalikAdi: "Akut Otitis Media", semptomSablonu: (h) => `${h.yas} yaş , kulak ağrısı ve ateş`, anaSikayetSablonu: () => "Kulak ağrısı, ateş, huzursuzluk (çocuk)", ozetBilgilerSablonu: () => ["2 gündür kulak ağrısı","Ateş 38.8°C","Uyuyamıyor","Nezle sonrası"], yasAraligi: [1, 12], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"KULAK_AGRISI",etiket:"Kulak ağrısı",aciklama:"Otore"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:">38.5"},{key:"NEZLE_ONCESI",etiket:"Nezle öyküsü",aciklama:"ÜSYE"},{key:"ISITME_AZALMA",etiket:"İşitme",aciklama:"Efüzyon"},{key:"KULAK_AKINTI",etiket:"Akıntı",aciklama:"Perforasyon"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Enfeksiyon"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"MASTOIDIT",etiket:"Mastoidit",aciklama:"Kulak arkası şişlik"},{key:"MENENJIT_BULGU",etiket:"Menenjit",aciklama:"Ense sertliği"}], kabulEdilenTani: ["Akut Otitis Media","AOM"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({KULAK_AGRISI:"Kulağını çekiştiriyor", ATES_SORGU:"38.8", NEZLE_ONCESI:"Burnu akıyordu", ISITME_AZALMA:"Az duyuyor", KULAK_AKINTI:"Yok", VITAL_TANSIYON:"90/60", VITAL_NABIZ:"110", VITAL_ATES:"38.8", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Kulak ağrısı?","Ateş?","Nezle?","Duyma?"], idealYol: ["1.Otoskopi","2.<2yaş bilat→AB","3.Semptomatik","4.48saat gözlem"], egitimNotu: "AOM — S.pneumoniae,H.influenzae.Otoskopi:hiperemik TM.TEDAVİ:<2yaş→amoksisilin 80mg/kg.>2yaş→48saat gözlem." }
    ,
            { hastalikKey: "epistaksis", hastalikAdi: "Epistaksis (Burun Kanaması)", semptomSablonu: (h) => `${h.yas} yaş , burun kanaması`, anaSikayetSablonu: () => "Sağ burun deliğinden aktif kanama", ozetBilgilerSablonu: () => ["30 dk önce sağ burun kanaması başladı","Aktif damlıyor","Hipertansiyon öyküsü var","Aspirin kullanıyor"], yasAraligi: [5, 70], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"BURUN_KANAMASI",etiket:"Burun kanaması",aciklama:"Aktif"},{key:"SURESI",etiket:"Süre",aciklama:"30 dk"},{key:"HT_OYKUSU",etiket:"HT",aciklama:"Risk"},{key:"ANTIKOAGULAN",etiket:"Aspirin",aciklama:"Kanama"},{key:"TRAVMA",etiket:"Travma",aciklama:"Yok"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"HEMODINAMIK_INSTABILITE",etiket:"Şok",aciklama:"Hipotansiyon"},{key:"POSTERIOR_KANAMA",etiket:"Posterior kanama",aciklama:"Ağızdan kan gelmesi"}], kabulEdilenTani: ["Epistaksis","Burun Kanaması","Anterior Epistaksis"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({BURUN_KANAMASI:"Sağ burun deliğimden damlıyor", SURESI:"Yarım saattir durmuyor", HT_OYKUSU:"Tansiyonum var", ANTIKOAGULAN:"Aspirin kullanıyorum", TRAVMA:"Burnuma darbe almadım", VITAL_TANSIYON:"160/95", VITAL_NABIZ:"88", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Ne zamandır?","Hangi burun deliği?","Aspirin?","Tansiyon?"], idealYol: ["1.Öne eğil+burun kanatlarını sık(10dk)","2.Soğuk kompres","3.Koterizasyon(gümüş nitrat)","4.Anterior tampon","5.Posterior kanama→acil KBB"], egitimNotu: "Epistaksis — en sık anterior(Little alanı/Kiesselbach pleksus).TEDAVİ:Öne eğilme+bası(10dk),vazokonstriktör sprey,koterizasyon,anterior tampon." }],
  },
  {
    key: "uroloji",
    ad: "Üroloji",
    icon: "🪨",
    aciklama: "Üroloji polikliniği simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "bph", hastalikAdi: "Benign Prostat Hiperplazisi", semptomSablonu: (h) => `${h.yas} yaş erkek, idrar zorluğu`, anaSikayetSablonu: () => "İdrar zorluğu, sık idrar, noktüri", ozetBilgilerSablonu: () => ["1 yıldır idrar zorluğu","Sık idrar","Gece 3-4 kez","İdrar akımı zayıf"], yasAraligi: [55, 85], cinsiyetTercih: "E", seviye: "baslangic", rubric: { beklenenSorular: [{key:"DIZURI",etiket:"Dizüri",aciklama:"Yanma"},{key:"POLLAKURI",etiket:"Sık idrar",aciklama:"Pollaküri"},{key:"NOKTURI",etiket:"Noktüri",aciklama:"Gece idrar"},{key:"IDRAR_AKIM",etiket:"Akım",aciklama:"Zayıf"},{key:"HEMATURI",etiket:"Hematüri",aciklama:"Kan"}], beklenenTestler: [{key:"IDRAR",etiket:"İdrar",aciklama:"Enfeksiyon"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"AKUT_RETANSIYON",etiket:"Retansiyon",aciklama:"Anüri"},{key:"HEMATURI",etiket:"Hematüri",aciklama:"Kan"}], kabulEdilenTani: ["BPH","Benign Prostat Hiperplazisi"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({IDRAR:{testKey:"IDRAR",testAdi:"Tam İdrar Tetkiki",tip:"json",sonuc:{dansite:"1020",ph:"6.0"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({DIZURI:"Yanma yok", POLLAKURI:"Günde 10 kez", NOKTURI:"Gece 3-4", IDRAR_AKIM:"Zayıf,kesik", HEMATURI:"Yok", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Sık idrar?","Gece?","Akım zayıf?","Kan?"], idealYol: ["1.IPSS","2.DRE","3.PSA","4.Tamsulosin"], egitimNotu: "BPH — IPSS skoru.TEDAVİ:Tamsulosin 0.4mg.Büyük→finasterid.Cerrahi:TUR-P." },
      { hastalikKey: "urolitiazis", hastalikAdi: "Ürolitiazis", semptomSablonu: (h) => `${h.yas} yaş erkek, ani şiddetli yan ağrısı`, anaSikayetSablonu: () => "Ani yan ağrısı, bulantı, idrarda kan", ozetBilgilerSablonu: () => ["1 saat önce ani yan ağrısı","Kasığa yayılıyor","Yerinde duramıyor","İdrarda kan"], yasAraligi: [25, 55], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"AGRI_YER",etiket:"Ağrı",aciklama:"Yan+kasık"},{key:"AGRI_SIDDAT",etiket:"Şiddet",aciklama:"10/10"},{key:"BULANTI",etiket:"Bulantı",aciklama:"Eşlik eden"},{key:"IDRAR_KAN",etiket:"Hematüri",aciklama:"İdrarda kan"},{key:"ATES_SORGU",etiket:"Ateş",aciklama:"Enfeksiyon"}], beklenenTestler: [{key:"IDRAR",etiket:"İdrar",aciklama:"Hematüri"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"ATES_YUKSEK_ATAS",etiket:"Ateş+obstrüksiyon",aciklama:"Piyelonefrit"},{key:"AKUT_RETANSIYON",etiket:"Anüri",aciklama:"Tıkanıklık"}], kabulEdilenTani: ["Ürolitiazis","Renal Kolik"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({IDRAR:{testKey:"IDRAR",testAdi:"Tam İdrar Tetkiki",tip:"json",sonuc:{dansite:"1020",ph:"6.0"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({AGRI_YER:"Sol böğür,kasığa", AGRI_SIDDAT:"10/10!", AGRI_SKALA:"10/10", BULANTI:"Midem bulanıyor", IDRAR_KAN:"Pembe", ATES_SORGU:"Yok", VITAL_TANSIYON:"140/90", VITAL_NABIZ:"100", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Ağrı nerede?","Şiddetli mi?","Bulantı?","İdrarda kan?"], idealYol: ["1.Kolik ağrı+hematüri","2.BT","3.<5mm→medikal","4.NSAII+bol sıvı"], egitimNotu: "Ürolitiazis — kolik ağrı+hematüri.BT altın standart.<5mm→tamsulosin+NSAII.>5mm→ESWL/URS." }
    ,
            { hastalikKey: "prostat-ca", hastalikAdi: "Prostat Kanseri", semptomSablonu: (h) => `${h.yas} yaş erkek, idrar zorluğu ve kemik ağrısı`, anaSikayetSablonu: () => "İdrar zorluğu, bel ağrısı, PSA yüksekliği", ozetBilgilerSablonu: () => ["3 aydır idrar zorluğu","Bel ve kalça ağrısı","PSA taramada 15 ng/mL","Ailede prostat kanseri öyküsü"], yasAraligi: [60, 80], cinsiyetTercih: "E", seviye: "ileri", rubric: { beklenenSorular: [{key:"DIZURI",etiket:"İdrar zorluğu",aciklama:"Obstrüktif"},{key:"SIRT_AGRISI",etiket:"Kemik ağrısı",aciklama:"Bel/kalça"},{key:"KILO_KAYBI",etiket:"Kilo kaybı",aciklama:"İleri hastalık"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"Prostat CA"},{key:"HEMATURI",etiket:"Hematüri",aciklama:"Var mı?"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"},{key:"KARACIGER_ENZIM",etiket:"ALP",aciklama:"Kemik met"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"SPINAL_KORD_KOMPRESYON",etiket:"Spinal kord kompresyonu",aciklama:"Bacak güçsüzlüğü+idrar retansiyonu"},{key:"AKUT_RETANSIYON",etiket:"Akut retansiyon",aciklama:"Anüri"}], kabulEdilenTani: ["Prostat Kanseri","Prostat Adenokarsinomu"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, KARACIGER_ENZIM:{testKey:"KARACIGER_ENZIM",testAdi:"KC Enzimleri",tip:"json",sonuc:{AST:"25",ALT:"30"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({DIZURI:"İdrarım zor geliyor", SIRT_AGRISI:"Belim ve kalçam ağrıyor", KILO_KAYBI:"Biraz kilo verdim", AILE_OYKUSU:"Babamda prostat kanseri vardı", HEMATURI:"İdrarda kan görmedim", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["İdrar zorluğu?","Kemik ağrısı?","Aile?","PSA bakıldı mı?"], idealYol: ["1.Anamnez+DRM","2.PSA yüksek→biyopsi","3.Gleason skoru","4.Evreleme(kemik sintigrafisi/BT)","5.Lokalize→cerrahi/RT,metastatik→hormon tedavisi"], egitimNotu: "Prostat CA — en sık erkek kanseri.PSA>4→biyopsi.Gleason skoru prognostik.TEDAVİ:Lokalize→radikal prostatektomi/RT.Metastatik→androjen deprivasyon tedavisi." }],
  },

  {
    key: "ortopedi",
    ad: "Ortopedi ve Travmatoloji",
    icon: "🦴",
    aciklama: "Ortopedi ve Travmatoloji polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "kalca-kirigi", hastalikAdi: "Kalça Kırığı", semptomSablonu: (h) => `${h.yas} yaş kadın, düşme sonrası kalça ağrısı`, anaSikayetSablonu: () => "Düşme sonrası sağ kalçada ağrı, basamama", ozetBilgilerSablonu: () => ["1 saat önce evde düştü","Sağ kalçada ağrı+basamama","Bacak kısa ve dış rotasyonda","Osteoporoz öyküsü var"], yasAraligi: [65, 90], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"AGRI_YER",etiket:"Ağrı yeri",aciklama:"Sağ kalça"},{key:"TRAVMA",etiket:"Travma öyküsü",aciklama:"Düşme"},{key:"HAREKET_KISITLI",etiket:"Hareket kısıtlılığı",aciklama:"Basamama"},{key:"OSTEOPOROZ",etiket:"Osteoporoz",aciklama:"Risk faktörü"},{key:"ILAC_OYKUSU",etiket:"İlaç",aciklama:"Kalsiyum/D vit"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Preop"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek fonksiyonu"},{key:"EKG",etiket:"EKG",aciklama:"Preop kardiyak"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"BAS_DONMESI",etiket:"Baş dönmesi/senkop",aciklama:"Düşme nedeni kardiyak?"},{key:"ANTIKOAGULAN",etiket:"Antikoagülan kullanımı",aciklama:"Kanama riski"}], kabulEdilenTani: ["Kalça Kırığı","Femur Boyun Kırığı"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, EKG:{testKey:"EKG",testAdi:"EKG",tip:"json",sonuc:{ritim:"Sinüs",kalpHizi:"85"},referans:"ESC",yorum:"Normal."}}), hastaYanitlari: () => ({AGRI_YER:"Sağ kalçam, çok ağrıyor", TRAVMA:"Evde halıya takıldım düştüm", HAREKET_KISITLI:"Hiç basamıyorum", OSTEOPOROZ:"Evet, 5 yıldır", ILAC_OYKUSU:"Kalsiyum+D vit alıyorum", BAS_DONMESI:"Düşmeden önce başım dönmedi", ANTIKOAGULAN:"Kan sulandırıcı kullanmıyorum", VITAL_TANSIYON:"140/85", VITAL_NABIZ:"88", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nerede ağrıyor?","Nasıl düştün?","Basabiliyor musun?","Osteoporoz var mı?"], idealYol: ["1.Anamnez+travma öyküsü","2.Fizik muayene:kısalık+dış rotasyon","3.Kalça grafisi","4.Preop hazırlık","5.Cerrahi:hemiartroplasti"], egitimNotu: "Kalça Kırığı — yaşlıda en sık osteoporoza bağlı.Garden 3-4 deplase→hemiartroplasti.48 saat içinde cerrahi mortaliteyi azaltır." },
      { hastalikKey: "diz-osteoartrit", hastalikAdi: "Diz Osteoartriti", semptomSablonu: (h) => `${h.yas} yaş , diz ağrısı ve tutukluk`, anaSikayetSablonu: () => "Kronik diz ağrısı, sabah tutukluğu", ozetBilgilerSablonu: () => ["2 yıldır diz ağrısı","Sabah tutukluğu <30 dk","Merdiven inip çıkmada zorlanma","Şişlik ve krepitasyon"], yasAraligi: [50, 80], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"EKLEM_AGRISI",etiket:"Diz ağrısı",aciklama:"Bilateral"},{key:"SABAH_TUTUKLUK",etiket:"Sabah tutukluğu",aciklama:"<30dk"},{key:"KREPITASYON",etiket:"Krepitasyon",aciklama:"Var"},{key:"HAREKET_KISITLI",etiket:"Hareket kısıtlılığı",aciklama:"Merdiven"},{key:"KILO_ALIM",etiket:"Kilo",aciklama:"Obezite riski"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"NSAII öncesi"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"EKLEM_SICAKLIK",etiket:"Sıcak+kızarık eklem",aciklama:"Septik artrit?"},{key:"ANI_AGRI",etiket:"Ani şiddetli ağrı",aciklama:"Kırık/osteonekroz"}], kabulEdilenTani: ["Diz Osteoartriti","Gonartroz","OA"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({EKLEM_AGRISI:"İki dizim de ağrıyor", SABAH_TUTUKLUK:"Sabah 20dk tutukluk oluyor", KREPITASYON:"Dizimden ses geliyor", HAREKET_KISITLI:"Merdiven çıkamıyorum", KILO_ALIM:"Biraz kiloluyum", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Diz ağrısı?","Sabah tutukluğu?","Merdiven?","Krepitasyon?"], idealYol: ["1.Kilo verme+egzersiz","2.Parasetamol","3.Topikal NSAII","4.Eklem içi steroid","5.İleri OA→protez"], egitimNotu: "Diz OA — Kellgren-Lawrence evreleme.TEDAVİ basamaklı:kilo→egzersiz→parasetamol→NSAII→eklem içi enjeksiyon→protez." }
    ,
            { hastalikKey: "meniskus-yirtigi", hastalikAdi: "Menisküs Yırtığı", semptomSablonu: (h) => `${h.yas} yaş erkek, dizde kilitlenme ve ağrı`, anaSikayetSablonu: () => "Futbol oynarken dizde dönme sonrası ağrı ve kilitlenme", ozetBilgilerSablonu: () => ["Dün futbol oynarken diz burkuldu","Dizde şişlik ve ağrı","Tam ekstansiyona gelemiyor","Kilitlenme hissi var"], yasAraligi: [20, 50], cinsiyetTercih: "E", seviye: "baslangic", rubric: { beklenenSorular: [{key:"EKLEM_AGRISI",etiket:"Diz ağrısı",aciklama:"Travma sonrası"},{key:"TRAVMA",etiket:"Travma",aciklama:"Spor"},{key:"HAREKET_KISITLI",etiket:"Kilitlenme",aciklama:"Ekstansiyon"},{key:"SISLIK",etiket:"Şişlik",aciklama:"Efüzyon"},{key:"ONCEKI_YARALANMA",etiket:"Önceki",aciklama:"Var mı?"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KOMPARTMAN",etiket:"Kompartman sendromu",aciklama:"Şiddetli ağrı+gerilim"},{key:"DAMAR_YARALANMASI",etiket:"Damar yaralanması",aciklama:"Distal nabız yok"}], kabulEdilenTani: ["Menisküs Yırtığı","Diz Menisküs Yırtığı"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({EKLEM_AGRISI:"Dizimin iç tarafı ağrıyor", TRAVMA:"Futbolda döndüm,diz burkuldu", HAREKET_KISITLI:"Dizimi tam açamıyorum", SISLIK:"Dizim şişti ertesi gün", ONCEKI_YARALANMA:"Daha önce olmadı", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nasıl oldu?","Neresi ağrıyor?","Kilitlenme?","Şişlik?"], idealYol: ["1.Anamnez:travma+kilitlenme","2.Fizik muayene:McMurray testi","3.MR ile doğrulama","4.Konservatif:kilitlenme yoksa","5.Cerrahi:artroskopik onarım"], egitimNotu: "Menisküs Yırtığı — medial>lateral.Travmatik(genç) veya dejeneratif(yaşlı).McMurray testi pozitif.TEDAVİ:Konservatif(istirahat+buz+NSAII).Kilitlenme→artroskopik cerrahi." }],
  },
  {
    key: "kadin-dogum",
    ad: "Kadın Hastalıkları ve Doğum",
    icon: "🤰",
    aciklama: "Kadın Hastalıkları ve Doğum polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "preeklampsi", hastalikAdi: "Preeklampsi", semptomSablonu: (h) => `${h.yas} yaş kadın, gebelikte yüksek tansiyon`, anaSikayetSablonu: () => "32 haftalık gebe, baş ağrısı ve yüksek tansiyon", ozetBilgilerSablonu: () => ["32 haftalık gebe","Baş ağrısı+görme bulanıklığı","TA 160/100","Ödem ve kilo artışı"], yasAraligi: [20, 40], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"BAS_AGRISI",etiket:"Baş ağrısı",aciklama:"Preeklampsi"},{key:"GORME",etiket:"Görme bulanıklığı",aciklama:"Ciddi bulgu"},{key:"ODEM",etiket:"Ödem",aciklama:"Yaygın"},{key:"GEBELIK_HAFTASI",etiket:"Gebelik haftası",aciklama:"32 hafta"},{key:"EPIGASTRIK_AGRI",etiket:"Epigastrik ağrı",aciklama:"HELLP?"}], beklenenTestler: [{key:"IDRAR",etiket:"İdrar",aciklama:"Proteinüri"},{key:"CBC",etiket:"Hemogram",aciklama:"Trombosit"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"},{key:"KREATININ_KINAZ",etiket:"KC enzim",aciklama:"HELLP"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KONVULZIYON",etiket:"Konvülziyon",aciklama:"Eklampsi!"},{key:"EPIGASTRIK_AGRI_SIDDETLI",etiket:"Şiddetli epigastrik ağrı",aciklama:"HELLP sendromu"}], kabulEdilenTani: ["Preeklampsi","Gebelik Hipertansiyonu"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({IDRAR:{testKey:"IDRAR",testAdi:"İdrar Tetkiki",tip:"json",sonuc:{dansite:"1020",ph:"6.0"},referans:"Lab",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, KREATININ_KINAZ:{testKey:"KREATININ_KINAZ",testAdi:"CK",tip:"numeric",sonuc:{deger:120,birim:"U/L",referansAralik:"<200"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({BAS_AGRISI:"Şiddetli baş ağrısı", GORME:"Bulanık görüyorum", ODEM:"Ayaklarım ve yüzüm şişti", GEBELIK_HAFTASI:"32 haftalık", EPIGASTRIK_AGRI:"Hafif ağrı var", KONVULZIYON:"Nöbet geçirmedim", VITAL_TANSIYON:"160/100", VITAL_NABIZ:"88", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Baş ağrısı?","Görme bulanık?","Ödem?","Kaç haftalık?"], idealYol: ["1.TA>160/110+proteinüri","2.MgSO4 yükleme","3.Antihipertansif","4.Doğum planlaması"], egitimNotu: "Preeklampsi — HT+proteinüri>20.hafta.Ağır:preeklampsi TA>160/110.TEDAVİ:MgSO4,antihipertansif,zamanında doğum." },
      { hastalikKey: "ektopik-gebelik", hastalikAdi: "Ektopik Gebelik", semptomSablonu: (h) => `${h.yas} yaş kadın, adet gecikmesi ve karın ağrısı`, anaSikayetSablonu: () => "Adet gecikmesi, vajinal kanama, alt karın ağrısı", ozetBilgilerSablonu: () => ["6 hafta adet gecikmesi","Az miktarda vajinal kanama","Sağ alt karın ağrısı","Gebelik testi pozitif"], yasAraligi: [20, 40], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"MENSTRUASYON",etiket:"Adet gecikmesi",aciklama:"6 hafta"},{key:"VAJINAL_KANAMA",etiket:"Vajinal kanama",aciklama:"Az-lekelenme"},{key:"AGRI_YER",etiket:"Karın ağrısı",aciklama:"Sağ alt kadran"},{key:"GEBELIK_TESTI",etiket:"Gebelik testi",aciklama:"Pozitif"},{key:"BAS_DONMESI",etiket:"Baş dönmesi",aciklama:"Rüptür?"},{key:"OMUZ_AGRISI",etiket:"Omuz ağrısı",aciklama:"Periton irritasyonu"}], beklenenTestler: [{key:"BHCG",etiket:"Beta-HCG",aciklama:"Gebelik testi"},{key:"PELVIK_USG",etiket:"Pelvik USG",aciklama:"Ektopik odak"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"SOK_BULGULARI",etiket:"Şok bulguları",aciklama:"Hipotansiyon+taşikardi"},{key:"OMUZ_AGRISI",etiket:"Omuz ağrısı",aciklama:"Rüptür+intraabdominal kanama"}], kabulEdilenTani: ["Ektopik Gebelik","Tubal Gebelik","Ectopic Pregnancy"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({BHCG:{testKey:"BHCG",testAdi:"Beta-HCG",tip:"numeric",sonuc:{deger:2500,birim:"mIU/mL",referansAralik:"<5"},referans:"Lab",yorum:"Gebelik ile uyumlu."}, PELVIK_USG:{testKey:"PELVIK_USG",testAdi:"Pelvik USG",tip:"text",sonuc:"Uterus boş, sağ adneksiyal alanda 3cm kitle+serbest sıvı.",referans:"Radyoloji",yorum:"Ektopik gebelik şüphesi."}}), hastaYanitlari: () => ({MENSTRUASYON:"6 hafta gecikti", VAJINAL_KANAMA:"Az kanama var,lekelenme", AGRI_YER:"Sağ alt tarafta ağrı", GEBELIK_TESTI:"Eczane testi pozitif", BAS_DONMESI:"Hafif baş dönmesi var", OMUZ_AGRISI:"Omuz ağrım yok", SOK_BULGULARI:"Tansiyonum normal", VITAL_TANSIYON:"105/70", VITAL_NABIZ:"95", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Adet gecikmesi?","Kanama?","Ağrı nerede?","Gebelik testi?"], idealYol: ["1.Beta-HCG+USG","2.Ektopik odak tespiti","3.Metotreksat (rüptüre değilse)","4.Rüptür→acil cerrahi"], egitimNotu: "Ektopik Gebelik — en sık tubal.Tanı:B-HCG>1500+USG boş uterus.TEDAVİ:Rüptüre değilse metotreksat 50mg/m2 IM.Rüptür→acil salpenjektomi." }
    ,
            { hastalikKey: "endometriozis", hastalikAdi: "Endometriozis", semptomSablonu: (h) => `${h.yas} yaş kadın, şiddetli adet sancısı`, anaSikayetSablonu: () => "Yıllardır şiddetli adet ağrısı, disparoni, infertilite", ozetBilgilerSablonu: () => ["5 yıldır adet döneminde şiddetli ağrı","Ağrı adetten 2 gün önce başlıyor","Cinsel ilişkide ağrı","2 yıldır gebe kalamıyor"], yasAraligi: [20, 45], cinsiyetTercih: "K", seviye: "orta", rubric: { beklenenSorular: [{key:"DISMENORE",etiket:"Adet ağrısı",aciklama:"Şiddetli"},{key:"DISPARONI",etiket:"Cinsel ağrı",aciklama:"Var"},{key:"INFERTILITE",etiket:"Gebelik",aciklama:"Yok"},{key:"DEFEKASYON_AGRISI",etiket:"Defekasyon ağrısı",aciklama:"Var mı"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"Endometriozis"}], beklenenTestler: [{key:"PELVIK_USG",etiket:"Pelvik USG",aciklama:"Endometrioma"},{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"ADEKSIYAL_TORSİYON",etiket:"Adeksiyal torsiyon",aciklama:"Ani şiddetli ağrı"},{key:"RÜPTÜR_KIST",etiket:"Kist rüptürü",aciklama:"Akut batın"}], kabulEdilenTani: ["Endometriozis","Endometrioma"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({PELVIK_USG:{testKey:"PELVIK_USG",testAdi:"Pelvik USG",tip:"text",sonuc:"Uterus boş+adneksiyal kitle.",referans:"Radyoloji",yorum:"Patolojik."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({DISMENORE:"Adet döneminde dayanılmaz ağrı", DISPARONI:"İlişkide ağrı oluyor", INFERTILITE:"2 yıldır korunmuyoruz,gebe kalamadım", DEFEKASYON_AGRISI:"Adet döneminde tuvalette de ağrıyor", AILE_OYKUSU:"Annemde de vardı", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Adet ağrısı?","İlişkide ağrı?","Gebelik?","Ailede var mı?"], idealYol: ["1.Anamnez:dismenore+disparoni+infertilite","2.Pelvik USG:endometrioma","3.Laparoskopi(altın standart)","4.Medikal:OKS/GnRH agonisti","5.Cerrahi:eksizyon"], egitimNotu: "Endometriozis — endometrial dokunun ektopik yerleşimi.Tanı:laparoskopi.TEDAVİ:Medikal(NSAII,OKS,GnRH agonisti),Cerrahi(eksizyon).İnfertilitede cerrahi." }],
  },
  {
    key: "beyin-cerrahisi",
    ad: "Beyin ve Sinir Cerrahisi",
    icon: "🧠",
    aciklama: "Beyin ve Sinir Cerrahisi polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "subdural-hematom", hastalikAdi: "Kronik Subdural Hematom", semptomSablonu: (h) => `${h.yas} yaş erkek, ilerleyici baş ağrısı ve konfüzyon`, anaSikayetSablonu: () => "2 haftadır giderek artan baş ağrısı, konfüzyon", ozetBilgilerSablonu: () => ["2 haftadır baş ağrısı","Giderek artan konfüzyon","Sağ kol ve bacakta güçsüzlük","3 hafta önce düşme öyküsü"], yasAraligi: [60, 90], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"BAS_AGRISI",etiket:"Baş ağrısı",aciklama:"İlerleyici"},{key:"KONFUZYON",etiket:"Konfüzyon",aciklama:"Mental durum"},{key:"GUCSUZLUK",etiket:"Güçsüzlük",aciklama:"Sağ taraf"},{key:"TRAVMA",etiket:"Travma öyküsü",aciklama:"3 hafta önce düşme"},{key:"ANTIKOAGULAN",etiket:"Antikoagülan",aciklama:"Kanama riski"}], beklenenTestler: [{key:"BT_KRANIYAL",etiket:"BT Kraniyal",aciklama:"Subdural hematom"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"ANIZOKORI",etiket:"Anizokori",aciklama:"Pupil eşitsizliği-herniasyon"},{key:"GKS_DUSMESI",etiket:"GKS düşmesi",aciklama:"<8-hemen entübasyon"}], kabulEdilenTani: ["Kronik Subdural Hematom","SDH"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({BT_KRANIYAL:{testKey:"BT_KRANIYAL",testAdi:"BT Kraniyal",tip:"text",sonuc:"Sağ frontoparietal bölgede kronik subdural hematom (15mm, orta hat şifti 5mm).",referans:"Radyoloji",yorum:"Kronik SDH."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({BAS_AGRISI:"Geçmeyen baş ağrısı", KONFUZYON:"Bazen karıştırıyorum", GUCSUZLUK:"Sağ kolum ve bacağım güçsüz", TRAVMA:"3 hafta önce dolaba çarptım", ANTIKOAGULAN:"Aspirin kullanıyorum", ANIZOKORI:"Gözbebeklerim eşit", GKS_DUSMESI:"Bilincim yerinde", VITAL_TANSIYON:"150/90", VITAL_NABIZ:"72", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Baş ağrısı?","Kafa karışıklığı?","Güçsüzlük?","Düştün mü?"], idealYol: ["1.Anamnez:travma+ilerleyici nörolojik defisit","2.BT:kronik SDH+orta hat şifti","3.Antikoagülan kes","4.Burr-hole drenaj"], egitimNotu: "Kronik SDH — travmadan 2-4 hafta sonra.Yaşlı+antikoagülan risk faktörü.BT:hilal şeklinde hipodens koleksiyon.TEDAVİ:Burr-hole drenaj." },
      { hastalikKey: "lomber-disk-hernisi", hastalikAdi: "Lomber Disk Hernisi", semptomSablonu: (h) => `${h.yas} yaş , bel ağrısı ve bacakta uyuşma`, anaSikayetSablonu: () => "Bel ağrısı, sağ bacakta siyatalji", ozetBilgilerSablonu: () => ["3 aydır bel ağrısı","Sağ bacakta uyuşma ve ağrı","Ağır kaldırma sonrası başladı","Öksürünce ağrı artıyor"], yasAraligi: [25, 55], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"AGRI_YER",etiket:"Bel ağrısı",aciklama:"Lomber"},{key:"UYUSMA",etiket:"Uyuşma",aciklama:"Sağ bacak L5-S1"},{key:"TRAVMA",etiket:"Tetikleyici",aciklama:"Ağır kaldırma"},{key:"OKSURUK_ARTIS",etiket:"Öksürükle artış",aciklama:"Disk basısı"},{key:"IDRAR_KAÇIRMA",etiket:"İdrar/gaita",aciklama:"Kauda equina?"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KAUD_EQUINA",etiket:"Kauda equina",aciklama:"İdrar/gaita retansiyonu"},{key:"ILERLEYICI_GUCSUZLUK",etiket:"İlerleyici güçsüzlük",aciklama:"Acil cerrahi"}], kabulEdilenTani: ["Lomber Disk Hernisi","LDH","Siyatalji","Bel Fıtığı"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({AGRI_YER:"Belimde ve sağ bacağımda", UYUSMA:"Sağ ayak parmaklarımda uyuşma", TRAVMA:"Mobilya kaldırdım", OKSURUK_ARTIS:"Evet,öksürünce bacağa vuruyor", IDRAR_KAÇIRMA:"İdrarımı tutabiliyorum", KAUD_EQUINA:"İdrar normal", ILERLEYICI_GUCSUZLUK:"Güçsüzlük ilerlemiyor", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Bel ağrısı?","Bacakta uyuşma?","Ne tetikledi?","İdrar normal?"], idealYol: ["1.Anamnez:siyatalji","2.Nörolojik muayene:düz bacak kaldırma","3.Konservatif:NSAII+fizik tedavi","4.Kauda equina→acil MR+cerrahi"], egitimNotu: "LDH — en sık L4-L5/L5-S1.Siyatalji+düz bacak kaldırma testi.TEDAVİ:Konservatif (NSAII,fizik tedavi,egzersiz).Kauda equina→acil cerrahi." }
    ,
            { hastalikKey: "kafa-travmasi", hastalikAdi: "Kafa Travması (Hafif)", semptomSablonu: (h) => `${h.yas} yaş erkek, kafa travması ve kısa bilinç kaybı`, anaSikayetSablonu: () => "Trafik kazası, kafa darbesi, 2 dk bilinç kaybı, baş ağrısı", ozetBilgilerSablonu: () => ["1 saat önce trafik kazası","Kafa darbesi aldı","2 dakika bilinç kaybı olmuş","Baş ağrısı ve bulantı var"], yasAraligi: [15, 60], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"TRAVMA",etiket:"Kaza",aciklama:"Trafik"},{key:"BAS_AGRISI",etiket:"Baş ağrısı",aciklama:"Var"},{key:"BULANTI",etiket:"Bulantı",aciklama:"Var"},{key:"BILINC_KAYBI",etiket:"Bilinç kaybı",aciklama:"2 dk"},{key:"AMNEZI",etiket:"Amnezi",aciklama:"Olayı hatırlama?"}], beklenenTestler: [{key:"BT_KRANIYAL",etiket:"BT Kraniyal",aciklama:"Kanama"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"GKS_DUSMESI",etiket:"GKS düşmesi",aciklama:"<8 acil"},{key:"ANIZOKORI",etiket:"Anizokori",aciklama:"Herniasyon"},{key:"BOS_RINORE",etiket:"BOS rinore",aciklama:"Kafa tabanı kırığı"}], kabulEdilenTani: ["Hafif Kafa Travması","Konküzyon","Minör Kafa Travması"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({BT_KRANIYAL:{testKey:"BT_KRANIYAL",testAdi:"BT Kraniyal",tip:"text",sonuc:"Normal.",referans:"Radyoloji",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({TRAVMA:"Araba kazası,başımı cama çarptım", BAS_AGRISI:"Başım ağrıyor", BULANTI:"Midem bulanıyor", BILINC_KAYBI:"2 dakika bayılmışım", AMNEZI:"Kazayı hatırlıyorum", GKS_DUSMESI:"Bilincim açık", ANIZOKORI:"Gözbebeklerim eşit", BOS_RINORE:"Burnumdan su gelmiyor", VITAL_TANSIYON:"130/85", VITAL_NABIZ:"88", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Kaza?","Baş ağrısı?","Bayıldın mı?","Hafıza?"], idealYol: ["1.Anamnez+travma mekanizması","2.GKS değerlendirmesi","3.BT kraniyal(endikasyon varsa)","4.Gözlem(24saat)","5.Semptomatik tedavi"], egitimNotu: "Hafif Kafa Travması(GKS 13-15).BT endikasyonları:GKS<15,2+kez kusma,>65yaş,antikoagülan,retrograd amnezi>30dk.TEDAVİ:Gözlem,semptomatik." }],
  },
  {
    key: "kvc",
    ad: "Kalp ve Damar Cerrahisi",
    icon: "🫀",
    aciklama: "Kalp ve Damar Cerrahisi polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "aort-anevrizmasi", hastalikAdi: "Abdominal Aort Anevrizması", semptomSablonu: (h) => `${h.yas} yaş erkek, karında nabız hissi ve sırt ağrısı`, anaSikayetSablonu: () => "Karında nabız atan kitle, bel ağrısı", ozetBilgilerSablonu: () => ["Karında nabız hissi","Bel ve sırt ağrısı","Hipertansiyon öyküsü","Sigara (40 paket-yıl)"], yasAraligi: [65, 85], cinsiyetTercih: "E", seviye: "ileri", rubric: { beklenenSorular: [{key:"BATIN_KITLE",etiket:"Nabız atan kitle",aciklama:"AAA"},{key:"SIRT_AGRISI",etiket:"Sırt ağrısı",aciklama:"Rüptür?"},{key:"HT_OYKUSU",etiket:"HT",aciklama:"Risk"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"AAA öyküsü"}], beklenenTestler: [{key:"BT_ABDOMEN",etiket:"BT Abdomen",aciklama:"AAA boyutu"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Kontrast öncesi"},{key:"EKG",etiket:"EKG",aciklama:"Preop"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"RÜPTÜR_BULGULARI",etiket:"Rüptür",aciklama:"Ani bel ağrısı+hipotansiyon"},{key:"SENKOP",etiket:"Senkop",aciklama:"Rüptür"}], kabulEdilenTani: ["Abdominal Aort Anevrizması","AAA"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({BT_ABDOMEN:{testKey:"BT_ABDOMEN",testAdi:"BT Abdomen",tip:"text",sonuc:"Abdominal aortada infrarenal 5.5cm anevrizma, rüptür yok.",referans:"Radyoloji",yorum:"İnfrarenal AAA."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, EKG:{testKey:"EKG",testAdi:"EKG",tip:"json",sonuc:{ritim:"Sinüs",kalpHizi:"85"},referans:"ESC",yorum:"Normal."}}), hastaYanitlari: () => ({BATIN_KITLE:"Göbeğimin üstünde nabız atan şişlik var", SIRT_AGRISI:"Bel ağrım var, sürekli", HT_OYKUSU:"Evet,20 yıldır tansiyon", SIGARA_OYKUSU:"Günde 1 paket,40 yıl", AILE_OYKUSU:"Babamda da vardı", RÜPTÜR_BULGULARI:"Ani bir ağrı olmadı", SENKOP:"Bayılmadım", VITAL_TANSIYON:"155/90", VITAL_NABIZ:"78", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Karında nabız?","Sırt ağrısı?","Tansiyon?","Sigara?"], idealYol: ["1.Anamnez+risk faktörleri","2.USG/BT:AAA çapı","3.<5.5cm→takip","4.>5.5cm→cerrahi(EVAR/açık)"], egitimNotu: "AAA — >3cm dilatasyon.En sık infrarenal.>5.5cm→cerrahi endikasyon.TEDAVİ:EVAR(endovasküler) veya açık onarım.Rüptür mortalitesi %80." },
      { hastalikKey: "periferik-arter", hastalikAdi: "Periferik Arter Hastalığı", semptomSablonu: (h) => `${h.yas} yaş erkek, yürürken bacak ağrısı`, anaSikayetSablonu: () => "Yürürken baldır ağrısı, dinlenince geçiyor", ozetBilgilerSablonu: () => ["6 aydır yürürken bacak ağrısı","200 metrede durmak zorunda","Dinlenince geçiyor","Sigara+DM öyküsü"], yasAraligi: [55, 80], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"AGRI_YER",etiket:"Bacak ağrısı",aciklama:"Baldır"},{key:"AGRI_EFOR",etiket:"Eforla",aciklama:"Klaudikasyon"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"},{key:"DIYABET",etiket:"DM",aciklama:"Risk"},{key:"YARA_IYILESME",etiket:"Yara",aciklama:"İskemi"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"EKG",etiket:"EKG",aciklama:"Kardiyak"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"ISTIRAHAT_AGRISI",etiket:"İstirahat ağrısı",aciklama:"Kritik iskemi"},{key:"GANGREN",etiket:"Gangren",aciklama:"Doku kaybı"}], kabulEdilenTani: ["Periferik Arter Hastalığı","PAH","Klaudikasyon"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, EKG:{testKey:"EKG",testAdi:"EKG",tip:"json",sonuc:{ritim:"Sinüs",kalpHizi:"85"},referans:"ESC",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({AGRI_YER:"Baldırımda, yürüyünce", AGRI_EFOR:"200 metre yürüyünce ağrıyor", SIGARA_OYKUSU:"30 yıl sigara", DIYABET:"Tip 2 DM var", YARA_IYILESME:"Yaram yok", ISTIRAHAT_AGRISI:"Otururken ağrımıyor", GANGREN:"Parmaklarım normal", VITAL_TANSIYON:"145/85", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Bacak ağrısı?","Ne kadar yürüyünce?","Sigara?","Diyabet?"], idealYol: ["1.Anamnez:klaudikasyon","2.ABI ölçümü","3.Sigara bırakma+egzersiz","4.Antiplatelet+statin","5.Kritik iskemi→revaskülarizasyon"], egitimNotu: "PAH — ateroskleroz.ABI<0.9 tanı koydurur.TEDAVİ:Sigara bırakma,antiplatelet,statin,denetimli egzersiz.Kritik iskemi→endovasküler/bypass." }
    ,
            { hastalikKey: "varis", hastalikAdi: "Kronik Venöz Yetmezlik (Varis)", semptomSablonu: (h) => `${h.yas} yaş kadın, bacakta varis ve ağrı`, anaSikayetSablonu: () => "Bacaklarda varisler, akşamları ağrı ve şişlik", ozetBilgilerSablonu: () => ["5 yıldır bacaklarda varisler","Akşamları ağrı ve şişlik oluyor","Ayakta durunca artıyor","Kaşıntı ve kramp var"], yasAraligi: [35, 70], cinsiyetTercih: "K", seviye: "baslangic", rubric: { beklenenSorular: [{key:"ODEM",etiket:"Bacak şişliği",aciklama:"Akşam"},{key:"AGRI_YER",etiket:"Ağrı",aciklama:"Bacak"},{key:"KASINTI",etiket:"Kaşıntı",aciklama:"Var"},{key:"KRAMP",etiket:"Kramp",aciklama:"Gece"},{key:"AILE_OYKUSU",etiket:"Aile",aciklama:"Varis"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"DVT_BULGULARI",etiket:"DVT",aciklama:"Tek taraflı şişlik+ağrı"},{key:"ULKER",etiket:"Venöz ülser",aciklama:"Açık yara"}], kabulEdilenTani: ["Kronik Venöz Yetmezlik","Varis","Venöz Yetmezlik"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({ODEM:"Akşamları ayak bileklerim şişiyor", AGRI_YER:"Bacaklarım ağrıyor", KASINTI:"Varislerin olduğu yer kaşınıyor", KRAMP:"Gece kramp giriyor", AILE_OYKUSU:"Annemde de varis var", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Şişlik?","Ağrı?","Kaşıntı?","Ailede var mı?"], idealYol: ["1.Anamnez+muayene","2.Duplex USG","3.Kompresyon çorabı","4.Elevasyon+egzersiz","5.İleri→skleroterapi/cerrahi"], egitimNotu: "Kronik Venöz Yetmezlik — venöz kapak disfonksiyonu.CEAP sınıflaması.TEDAVİ:Kompresyon çorabı,elevasyon,egzersiz.Skleroterapi/lazer/stripping(ileri)." }],
  },
  {
    key: "gogus-cerrahisi",
    ad: "Göğüs Cerrahisi",
    icon: "🫁",
    aciklama: "Göğüs Cerrahisi polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "pnomotoraks", hastalikAdi: "Spontan Pnömotoraks", semptomSablonu: (h) => `${h.yas} yaş erkek, ani göğüs ağrısı ve nefes darlığı`, anaSikayetSablonu: () => "Ani başlayan göğüs ağrısı ve nefes darlığı", ozetBilgilerSablonu: () => ["Ani başlayan sağ göğüs ağrısı","Nefes darlığı","Uzun boylu zayıf erkek","Sigara içiyor"], yasAraligi: [18, 35], cinsiyetTercih: "E", seviye: "orta", rubric: { beklenenSorular: [{key:"GOGUS_AGRISI",etiket:"Göğüs ağrısı",aciklama:"Ani,plöretik"},{key:"NEFES_DARLIGI",etiket:"Nefes darlığı",aciklama:"Ani"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"},{key:"YAPISAL_OZELLIK",etiket:"Yapı",aciklama:"Uzun boylu zayıf"}], beklenenTestler: [{key:"AKCIGER_GRAFISI",etiket:"PA Akciğer",aciklama:"Pnömotoraks"},{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"TANSIYON_PNO",etiket:"Tansiyon pnömotoraks",aciklama:"Hipotansiyon+trakeal şift"},{key:"SOLUNUM_YETMEZLIGI",etiket:"Solunum yetmezliği",aciklama:"SpO2<90"}], kabulEdilenTani: ["Spontan Pnömotoraks","Pnömotoraks"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({AKCIGER_GRAFISI:{testKey:"AKCIGER_GRAFISI",testAdi:"PA Akciğer",tip:"image",sonuc:"Sağ akciğerde pnömotoraks, akciğer kollabe.",referans:"Radyoloji",yorum:"Spontan pnömotoraks."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({GOGUS_AGRISI:"Sağ göğsümde aniden başladı", NEFES_DARLIGI:"Nefes alamıyorum", SIGARA_OYKUSU:"Günde yarım paket", YAPISAL_OZELLIK:"Uzun boylu zayıf yapılıyım", TANSIYON_PNO:"Tansiyonum normal", SOLUNUM_YETMEZLIGI:"Oksijen %94", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"95", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Göğüs ağrısı?","Nefes darlığı?","Ne zaman başladı?","Sigara?"], idealYol: ["1.Anamnez+PA Akciğer","2.<2cm→gözlem+O2","3.>2cm→göğüs tüpü","4.Tekrarlayan→plöredez"], egitimNotu: "Spontan Pnömotoraks — uzun boylu zayıf genç erkeklerde bleb rüptürü.TEDAVİ:Küçük(<2cm)→O2+gözlem.Büyük→göğüs tüpü.Tekrarlayan→plöredez/cerrahi." },
      { hastalikKey: "plevral-efuzyon", hastalikAdi: "Plevral Efüzyon", semptomSablonu: (h) => `${h.yas} yaş , nefes darlığı ve göğüste dolgunluk`, anaSikayetSablonu: () => "Nefes darlığı, göğüste dolgunluk, kuru öksürük", ozetBilgilerSablonu: () => ["2 haftadır nefes darlığı","Sağ göğüste dolgunluk","Kilo kaybı ve gece terlemesi","Sigara 30 paket-yıl"], yasAraligi: [45, 75], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"NEFES_DARLIGI",etiket:"Nefes darlığı",aciklama:"İlerleyici"},{key:"GOGUS_DOLGUNLUK",etiket:"Göğüs dolgunluğu",aciklama:"Sağ"},{key:"KILO_KAYBI",etiket:"Kilo kaybı",aciklama:"Malignite?"},{key:"GECE_TERLEME",etiket:"Gece terlemesi",aciklama:"TBC/malignite"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"}], beklenenTestler: [{key:"AKCIGER_GRAFISI",etiket:"PA Akciğer",aciklama:"Efüzyon"},{key:"CBC",etiket:"Hemogram",aciklama:"Enfeksiyon"},{key:"CRP",etiket:"CRP",aciklama:"Enflamasyon"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"MASIF_EFUZYON",etiket:"Masif efüzyon",aciklama:"Solunum yetmezliği"},{key:"AMPİYEM",etiket:"Ampiyem",aciklama:"Ateş+pH<7.2"}], kabulEdilenTani: ["Plevral Efüzyon","Plevral Sıvı"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({AKCIGER_GRAFISI:{testKey:"AKCIGER_GRAFISI",testAdi:"PA Akciğer",tip:"image",sonuc:"Sağ akciğerde pnömotoraks, akciğer kollabe.",referans:"Radyoloji",yorum:"Spontan pnömotoraks."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, CRP:{testKey:"CRP",testAdi:"CRP",tip:"numeric",sonuc:{deger:25,birim:"mg/L",referansAralik:"<5"},referans:"Lab",yorum:"Hafif yüksek."}}), hastaYanitlari: () => ({NEFES_DARLIGI:"2 haftadır giderek artıyor", GOGUS_DOLGUNLUK:"Sağ tarafım dolu gibi", KILO_KAYBI:"Son 2 ayda 3 kilo verdim", GECE_TERLEME:"Evet,gece terliyorum", SIGARA_OYKUSU:"30 yıl,1 paket", MASIF_EFUZYON:"Nefesim çok kötü değil", AMPİYEM:"Ateşim yok", VITAL_TANSIYON:"125/80", VITAL_NABIZ:"85", VITAL_ATES:"37.2", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nefes darlığı?","Dolgunluk?","Kilo kaybı?","Gece terlemesi?"], idealYol: ["1.Anamnez+PA Akciğer","2.Torasentez:Light kriterleri","3.Eksüda→transüda ayırımı","4.Altta yatan neden araştır"], egitimNotu: "Plevral Efüzyon — Light kriterleri ile transüda/eksüda ayırımı.Torasentez+biyokimya+sitoloji.TEDAVİ:Altta yatan nedene göre.Torasentez/sonda/göğüs tüpü." }
    ,
            { hastalikKey: "akciger-kanseri-cerrahi", hastalikAdi: "Akciğer Kanseri (Cerrahi)", semptomSablonu: (h) => `${h.yas} yaş erkek, kronik öksürük ve hemoptizi`, anaSikayetSablonu: () => "2 aydır öksürük, kanlı balgam, kilo kaybı", ozetBilgilerSablonu: () => ["2 aydır öksürük","Son 1 hafta kanlı balgam","Son 2 ayda 8 kilo kaybı","Günde 20 sigara, 40 yıl"], yasAraligi: [55, 75], cinsiyetTercih: "E", seviye: "ileri", rubric: { beklenenSorular: [{key:"OKSURUK",etiket:"Öksürük",aciklama:"Kronik"},{key:"KAN_BALGAM",etiket:"Hemoptizi",aciklama:"Kanlı"},{key:"KILO_KAYBI",etiket:"Kilo kaybı",aciklama:"Anlamlı"},{key:"SIGARA_OYKUSU",etiket:"Sigara",aciklama:"Risk"},{key:"GOGUS_AGRISI",etiket:"Göğüs ağrısı",aciklama:"Lokal invazyon"}], beklenenTestler: [{key:"AKCIGER_GRAFISI",etiket:"PA Akciğer",aciklama:"Kitle"},{key:"BT_ABDOMEN",etiket:"BT Toraks",aciklama:"Evreleme"},{key:"CBC",etiket:"Hemogram",aciklama:"Anemi"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Preop"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"VCI_SENDROMU",etiket:"VCS sendromu",aciklama:"Yüz+kol ödemi"},{key:"BEYIN_METASTAZ",etiket:"Beyin met",aciklama:"Baş ağrısı+nöbet"}], kabulEdilenTani: ["Akciğer Kanseri","NSCLC","Epidermoid Ca"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({AKCIGER_GRAFISI:{testKey:"AKCIGER_GRAFISI",testAdi:"PA Akciğer",tip:"image",sonuc:"Normal.",referans:"Radyoloji",yorum:"Normal."}, BT_ABDOMEN:{testKey:"BT_ABDOMEN",testAdi:"BT Abdomen",tip:"text",sonuc:"Normal.",referans:"Radyoloji",yorum:"Normal."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({OKSURUK:"2 aydır geçmiyor", KAN_BALGAM:"Bu hafta kan geldi", KILO_KAYBI:"8 kilo verdim", SIGARA_OYKUSU:"40 yıl,günde 20", GOGUS_AGRISI:"Sağ göğsümde ağrı var", VCI_SENDROMU:"Yüzüm şişmedi", BEYIN_METASTAZ:"Baş ağrım yok", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Öksürük?","Kanlı balgam?","Kilo kaybı?","Sigara?"], idealYol: ["1.Anamnez+risk","2.PA Akciğer+BT","3.Bronkoskopi+biyopsi","4.Evreleme(PET-CT)","5.Cerrahi rezeksiyon"], egitimNotu: "NSCLC — evreleme şart.Cerrahi:evre I-II'de lobektomi+lenf diseksiyonu.Adjuvan KT(evre II+).Mediastinal evreleme(EBUS/mediastinoskopi)." }],
  },
  {
    key: "plastik-cerrahi",
    ad: "Plastik Cerrahi",
    icon: "✂️",
    aciklama: "Plastik Cerrahi polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "yanik", hastalikAdi: "2. Derece Yanık", semptomSablonu: (h) => `${h.yas} yaş , sıcak su yanığı`, anaSikayetSablonu: () => "El ve ön kolda sıcak su yanığı, bül oluşumu", ozetBilgilerSablonu: () => ["1 saat önce sıcak su döküldü","Sağ el ve ön kolda yanık","Bül oluşumu var (2.derece)","Ağrı çok şiddetli"], yasAraligi: [5, 60], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"TRAVMA",etiket:"Yanık nedeni",aciklama:"Sıcak su"},{key:"YANIK_YER",etiket:"Yanık yeri",aciklama:"El+ön kol"},{key:"YANIK_DERECESI",etiket:"Yanık derecesi",aciklama:"2.derece bül"},{key:"YANIK_YUZDESI",etiket:"Yanık yüzdesi",aciklama:"%4"},{key:"TETANOS_ASI",etiket:"Tetanoz aşısı",aciklama:"Güncel mi?"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"INHALASYON_YANIGI",etiket:"İnhalasyon yanığı",aciklama:"Stridor+yüz yanığı"},{key:"SIRS_BULGULARI",etiket:"SIRS/sepsis",aciklama:"Ateş+taşikardi"}], kabulEdilenTani: ["Yanık","2.Derece Yanık","Termal Yanık"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({TRAVMA:"Çaydanlık devrildi", YANIK_YER:"Sağ el ve ön kol", YANIK_DERECESI:"Bül var,2.derece", YANIK_YUZDESI:"Avuç içi kadar", TETANOS_ASI:"10 yıl önce oldum", INHALASYON_YANIGI:"Yüzüm yanmadı", SIRS_BULGULARI:"Ateşim yok", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"90", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nasıl oldu?","Neresi yandı?","Bül var mı?","Aşı güncel mi?"], idealYol: ["1.Soğuk su 20dk","2.Yanık yüzdesi hesapla","3.Analjezi+topikal gümüş sulfadiazin","4.Tetanoz profilaksisi","5.Gerekirse sevk"], egitimNotu: "Yanık — 1.derece(eritem),2.derece(bül),3.derece(tam kat).%10 üzeri→sıvı resüsitasyonu(Parkland).TEDAVİ:Soğutma,analjezi,topikal antibiyotik,steril pansuman." },
      { hastalikKey: "el-tendon-yaralanmasi", hastalikAdi: "El Tendon Yaralanması", semptomSablonu: (h) => `${h.yas} yaş , el kesisi ve parmak hareket kaybı`, anaSikayetSablonu: () => "Cam kesisi sonrası parmakta hareket kaybı", ozetBilgilerSablonu: () => ["30 dk önce cam kesti","İşaret parmağı bükülemiyor","Kanama kontrollü","Uyuşma yok"], yasAraligi: [15, 50], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"TRAVMA",etiket:"Yaralanma",aciklama:"Cam kesisi"},{key:"HAREKET_KISITLI",etiket:"Hareket kaybı",aciklama:"Fleksiyon yok"},{key:"KANAMA",etiket:"Kanama",aciklama:"Kontrollü"},{key:"UYUSMA",etiket:"Uyuşma",aciklama:"Sinir hasarı?"},{key:"TETANOS_ASI",etiket:"Tetanoz",aciklama:"Güncel mi?"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Bazal"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"KANAMA_KONTROLSUZ",etiket:"Kontrolsüz kanama",aciklama:"Damar yaralanması"},{key:"ISKEMI_BULGULARI",etiket:"İskemi",aciklama:"Parmakta solukluk+soğukluk"}], kabulEdilenTani: ["El Tendon Yaralanması","Fleksör Tendon Kesisi"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({TRAVMA:"Cam kavanoz kırıldı elimi kesti", HAREKET_KISITLI:"İşaret parmağımı bükemiyorum", KANAMA:"Az kanıyor,bastırınca durdu", UYUSMA:"Uyuşma yok", TETANOS_ASI:"5 yıl önce oldum", KANAMA_KONTROLSUZ:"Kanama durdu", ISKEMI_BULGULARI:"Parmak pembe,sıcak", VITAL_TANSIYON:"125/80", VITAL_NABIZ:"85", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nasıl kestin?","Hangi parmak?","Hareket var mı?","Uyuşma?"], idealYol: ["1.Anamnez+yara yeri+fonksiyon kaybı","2.Tetanoz profilaksisi","3.Antibiyotik profilaksisi","4.El cerrahisi konsültasyonu","5.Primer tendon onarımı"], egitimNotu: "Fleksör Tendon Yaralanması — zon 2'de en sık.Tanı:parmak fleksiyonu kaybı.TEDAVİ:Acil cerrahi onarım(<24saat)+atelleme+erken mobilizasyon." }
    ,
            { hastalikKey: "basi-yarasi", hastalikAdi: "Bası Yarası (Evre 2)", semptomSablonu: (h) => `${h.yas} yaş , sakrumda yara`, anaSikayetSablonu: () => "Yatalak hastada sakrumda kızarıklık ve açık yara", ozetBilgilerSablonu: () => ["2 haftadır sakrumda kızarıklık","Dün açık yara haline geldi","Yatalak hasta(85 yaş, SVO sekeli)","Beslenme bozukluğu var"], yasAraligi: [65, 90], cinsiyetTercih: "herhangi", seviye: "baslangic", rubric: { beklenenSorular: [{key:"YARA_YERI",etiket:"Yara yeri",aciklama:"Sakrum"},{key:"YARA_SURESI",etiket:"Süre",aciklama:"2 hafta"},{key:"HASTA_MOBILITE",etiket:"Mobilite",aciklama:"Yatalak"},{key:"BESLENME",etiket:"Beslenme",aciklama:"Kötü"},{key:"YARA_AKINTI",etiket:"Akıntı",aciklama:"Var mı"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Anemi/enfeksiyon"},{key:"CRP",etiket:"CRP",aciklama:"Enfeksiyon"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"OSTEOMIYELIT",etiket:"Osteomiyelit",aciklama:"Kemik ekspoze"},{key:"SEPSIS",etiket:"Sepsis",aciklama:"Ateş+hipotansiyon"}], kabulEdilenTani: ["Bası Yarası","Dekübit Ülseri","Evre 2 Bası Yarası"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, CRP:{testKey:"CRP",testAdi:"CRP",tip:"numeric",sonuc:{deger:25,birim:"mg/L",referansAralik:"<5"},referans:"Lab",yorum:"Hafif yüksek."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({YARA_YERI:"Kuyruk sokumunda", YARA_SURESI:"2 hafta önce kızarıklık başladı", HASTA_MOBILITE:"Yatalak,pozisyon verilmiyor", BESLENME:"İştahı yok,az yiyor", YARA_AKINTI:"Hafif seröz akıntı var", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Yara nerede?","Ne zamandır?","Hasta yatıyor mu?","Beslenme?"], idealYol: ["1.Evreleme:Evre 2(kısmi kalınlık)","2.Pozisyon değiştirme(2 saatte bir)","3.Yara bakımı+steril pansuman","4.Beslenme desteği(protein)","5.Enfeksiyon kontrolü"], egitimNotu: "Bası Yarası — basınç+sürtünme.Evre 2:kısmi kalınlık kaybı,seröz bül.TEDAVİ:Pozisyon değiştirme(2 saat),özel yatak,yara bakımı,beslenme desteği.Enfeksiyon→AB." }],
  },
  {
    key: "cocuk-cerrahisi",
    ad: "Çocuk Cerrahisi",
    icon: "👶",
    aciklama: "Çocuk Cerrahisi polikliniği vaka simülasyonları",
    hastalikSablonlari: [
      { hastalikKey: "invajinasyon", hastalikAdi: "İnvajinasyon", semptomSablonu: (h) => `${h.yas} yaş , ani karın ağrısı ve kusma (bebek)`, anaSikayetSablonu: () => "Ani başlayan aralıklı karın ağrısı, kusma, çilek jölesi gaita", ozetBilgilerSablonu: () => ["6 aylık bebek","Ani başlayan aralıklı ağlama","Safralı kusma","Çilek jölesi kıvamında gaita"], yasAraligi: [0.5, 3], cinsiyetTercih: "herhangi", seviye: "orta", rubric: { beklenenSorular: [{key:"AGRI_YER",etiket:"Karın ağrısı",aciklama:"Aralıklı-kolik"},{key:"KUSMA",etiket:"Kusma",aciklama:"Safralı"},{key:"DISKI_RENK",etiket:"Gaita",aciklama:"Çilek jölesi"},{key:"YAS",etiket:"Yaş",aciklama:"6 ay"},{key:"BESLENME",etiket:"Beslenme",aciklama:"Ek gıdaya geçiş"}], beklenenTestler: [{key:"BT_ABDOMEN",etiket:"BT Abdomen",aciklama:"Hedef işareti"},{key:"CBC",etiket:"Hemogram",aciklama:"Lökositoz"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"PERITONIT_BULGULARI",etiket:"Peritonit",aciklama:"Defans+rebound"},{key:"SOK_BULGULARI",etiket:"Şok",aciklama:"Hipotansiyon+sepsis"}], kabulEdilenTani: ["İnvajinasyon","İntususepsiyon"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({BT_ABDOMEN:{testKey:"BT_ABDOMEN",testAdi:"BT Abdomen",tip:"text",sonuc:"Abdominal aortada infrarenal 5.5cm anevrizma, rüptür yok.",referans:"Radyoloji",yorum:"İnfrarenal AAA."}, CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({AGRI_YER:"Bebek aralıklı ağlıyor,dizlerini karnına çekiyor", KUSMA:"Safralı kustu", DISKI_RENK:"Çilek reçeli gibi gaita yaptı", YAS:"6 aylık", BESLENME:"1 hafta önce ek gıdaya başladık", PERITONIT_BULGULARI:"Karnı yumuşak", SOK_BULGULARI:"Genel durumu iyi", VITAL_TANSIYON:"90/60", VITAL_NABIZ:"130", VITAL_ATES:"37.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nasıl ağlıyor?","Kustu mu?","Gaita rengi?","Kaç aylık?"], idealYol: ["1.Anamnez:kolik ağrı+çilek jölesi gaita","2.USG:hedef işareti","3.Hidrostatik redüksiyon","4.Başarısız→cerrahi"], egitimNotu: "İnvajinasyon — 3ay-3yaş arası en sık.Genelde ileoçekal.USG bulgusu:hedef işareti.TEDAVİ:Hidrostatik/pnömatik redüksiyon.Başarısız/perfore→cerrahi." },
      { hastalikKey: "pilor-stenozu", hastalikAdi: "Hipertrofik Pilor Stenozu", semptomSablonu: (h) => `${h.yas} yaş erkek, fışkırır tarzda kusma (yenidoğan)`, anaSikayetSablonu: () => "3 haftalık bebek, beslenme sonrası fışkırır tarzda kusma", ozetBilgilerSablonu: () => ["3 haftalık bebek","Beslenmeden hemen sonra fışkırır kusma","Kusmuk safrasız","Aç görünüyor, kilo alamıyor"], yasAraligi: [0.06, 0.33], cinsiyetTercih: "E", seviye: "baslangic", rubric: { beklenenSorular: [{key:"KUSMA",etiket:"Kusma",aciklama:"Fışkırır,safrasız"},{key:"YAS",etiket:"Yaş",aciklama:"3 hafta"},{key:"BESLENME",etiket:"Beslenme",aciklama:"Aç,kilo alamıyor"},{key:"IDRAR_AZALMA",etiket:"İdrar",aciklama:"Dehidratasyon"},{key:"AILE_OYKUSU",etiket:"Aile öyküsü",aciklama:"Pilor stenozu?"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Dehidratasyon"},{key:"KREATININ",etiket:"Kreatinin",aciklama:"Böbrek"},{key:"ELEKTROLIT",etiket:"Elektrolit",aciklama:"Hipokalemik alkaloz"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"DEHIDRATASYON_AGIR",etiket:"Ağır dehidratasyon",aciklama:"Letarji+çökük fontanel"},{key:"KILO_KAYBI_ASIRI",etiket:"Aşırı kilo kaybı",aciklama:"%10 üzeri"}], kabulEdilenTani: ["Hipertrofik Pilor Stenozu","Pilor Stenozu","HPS"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}, KREATININ:{testKey:"KREATININ",testAdi:"Kreatinin",tip:"numeric",sonuc:{deger:1.0,birim:"mg/dL",referansAralik:"0.7-1.3"},referans:"Lab",yorum:"Normal."}, ELEKTROLIT:{testKey:"ELEKTROLIT",testAdi:"Elektrolit",tip:"text",sonuc:"Normal.",referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({KUSMA:"Beslenmeden hemen sonra fışkırıyor,safrasız", YAS:"3 haftalık", BESLENME:"Sürekli aç,kilo alamıyor", IDRAR_AZALMA:"Bezi daha az ıslanıyor", AILE_OYKUSU:"Babasında da varmış bebekken", DEHIDRATASYON_AGIR:"Hafif huzursuz", KILO_KAYBI_ASIRI:"Doğum kilosuna yeni döndü", VITAL_TANSIYON:"85/55", VITAL_NABIZ:"140", VITAL_ATES:"36.8", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Nasıl kusuyor?","Kusmuk rengi?","Kilo alıyor mu?","Kaç haftalık?"], idealYol: ["1.Anamnez:fışkırır safrasız kusma","2.USG:pilor kas kalınlığı>3mm","3.Sıvı-elektrolit düzelt","4.Ramstedt piloromyotomi"], egitimNotu: "HPS — 2-8 hafta yenidoğan.USG bulgusu:pilor kası>3mm,kanal uzunluğu>15mm.Lab:hipokalemik hipokloremik metabolik alkaloz.TEDAVİ:Sıvı düzeltme+Ramstedt piloromyotomi." }
    ,
            { hastalikKey: "kasik-fitigi-cocuk", hastalikAdi: "Çocuk Kasık Fıtığı", semptomSablonu: (h) => `${h.yas} yaş erkek, kasıkta şişlik (bebek)`, anaSikayetSablonu: () => "Ağlayınca kasıkta belirginleşen şişlik", ozetBilgilerSablonu: () => ["Doğumdan beri ağlayınca kasıkta şişlik","Kendiliğinden kayboluyor","Prematüre doğum (32 hafta)","Ağrılı görünmüyor"], yasAraligi: [0.1, 2], cinsiyetTercih: "E", seviye: "baslangic", rubric: { beklenenSorular: [{key:"KITLE_SURE",etiket:"Süre",aciklama:"Doğumdan beri"},{key:"KITLE_HAREKET",etiket:"Redükte",aciklama:"Kayboluyor"},{key:"AGRI_YER",etiket:"Ağrı",aciklama:"Yok"},{key:"DOGUM_OYKUSU",etiket:"Doğum",aciklama:"Prematüre"},{key:"BESLENME",etiket:"Beslenme",aciklama:"Normal"}], beklenenTestler: [{key:"CBC",etiket:"Hemogram",aciklama:"Preop"}], gereksizTestler: [{key:"TROPONIN",etiket:"Troponin",aciklama:"İlgisiz"}], redFlagler: [{key:"INKARSERASYON",etiket:"İnkarserasyon",aciklama:"Redükte olmuyor+ağrılı"},{key:"STRANGULASYON",etiket:"Strangülasyon",aciklama:"Kusma+distansiyon"}], kabulEdilenTani: ["İndirekt İnguinal Herni","Kasık Fıtığı","Çocuk Hernisi"], puanlama: {dogru_kritik_soru:2,dogru_yardimci_soru:1,dogru_test:2,gereksiz_test:-1,red_flag_atlama:-3,tehlikeli_eksik:-5,tani_dogru:5,tani_yanlis:-3} }, statikTestler: () => ({CBC:{testKey:"CBC",testAdi:"Hemogram",tip:"json",sonuc:{hemoglobin:"14.0",lokosit:"9.5 K/uL"},referans:"Lab",yorum:"Normal."}}), hastaYanitlari: () => ({KITLE_SURE:"Doğumdan beri var", KITLE_HAREKET:"Ağlamayınca kayboluyor", AGRI_YER:"Ağrısı yok gibi", DOGUM_OYKUSU:"32 haftalık prematüre", BESLENME:"Normal besleniyor", VITAL_TANSIYON:"120/80", VITAL_NABIZ:"80", VITAL_ATES:"36.5", VITAL_SPO2:"97", SIGARA:"Yok", DIYABET:"Yok", ILAC:"Yok", ALERJI:"Yok", OZEL:"Anlamadım"}), soruChipleri: ["Ne zamandır?","Kayboluyor mu?","Ağrılı mı?","Prematüre mi?"], idealYol: ["1.Anamnez:redüktibl herni","2.Red flag:inkarserasyon","3.Elektif herni onarımı","4.Günübirlik cerrahi"], egitimNotu: "Çocuk İnguinal Herni — prosesus vaginalis kapanmaması.Prematürede %30.TEDAVİ:Elektif herniotomi.İnkarserasyon→acil cerrahi." }],
  },
];


const TEDAVI_SABLONLARI: Record<string, TedaviPlani> = {
  stemi: {
    aciklama: "İnferior STEMI — primer PCI ile reperfüzyon tedavisi",
    ilaclar: [
      { ad: "Asetilsalisilik asit (Aspirin)", doz: "300 mg oral (çiğneme)", yol: "Oral", endikasyon: "Antiplatelet — tüm AKS hastaları" },
      { ad: "Klopidogrel", doz: "600 mg yükleme", yol: "Oral", endikasyon: "P2Y12 inhibitörü — dual antiplatelet" },
      { ad: "Enoksaparin", doz: "1 mg/kg SC (2×1)", yol: "Subkütan", endikasyon: "Antikoagülan — AKS protokolü" },
      { ad: "Morfin", doz: "2-4 mg IV", yol: "İntravenöz", endikasyon: "Analjezi — şiddetli göğüs ağrısı" },
      { ad: "Metoklopramid", doz: "10 mg IV", yol: "İntravenöz", endikasyon: "Bulantı profilaksisi (morfin öncesi)" },
      { ad: "Atorvastatin", doz: "80 mg", yol: "Oral", endikasyon: "Statin — tüm AKS'de yüksek doz" },
    ],
    prosedurler: ["Primer PCI (ilk temas-balon <90 dk)", "Monitörizasyon (EKG, SpO2)", "Tromboliz (PCI mümkün değilse, <12 saat)"],
    notlar: ["ST elevasyon devam ediyorsa kurtarıcı PCI", "Beta bloker stabil hastada ilk 24 saatte başla", "ACE inhibitörü taburculukta başla"],
    kaynak: "ESC 2023 STEMI Kılavuzu",
  },
  nstemi: {
    aciklama: "NSTEMI — antiplatelet + antikoagülan + koroner anjiyo kararı",
    ilaclar: [
      { ad: "Asetilsalisilik asit (Aspirin)", doz: "300 mg oral", yol: "Oral", endikasyon: "Antiplatelet" },
      { ad: "Klopidogrel", doz: "300-600 mg yükleme", yol: "Oral", endikasyon: "P2Y12 — dual antiplatelet" },
      { ad: "Enoksaparin / Fondaparinux", doz: "1 mg/kg SC / 2.5 mg SC", yol: "Subkütan", endikasyon: "Antikoagülan" },
      { ad: "Metoprolol", doz: "50-100 mg", yol: "Oral", endikasyon: "Beta bloker — stabil hastada" },
      { ad: "Atorvastatin", doz: "80 mg", yol: "Oral", endikasyon: "Statin — yüksek doz" },
    ],
    prosedurler: ["GRACE risk skorlaması", "Koroner anjiyo (yüksek risk: <24 saat, düşük risk: <72 saat)"],
    notlar: ["Diyabetik hasta: glisemik kontrol (hedef <180 mg/dL)", "ACEi/ARB taburculukta (HT/DM/KY varsa)", "Çift antiplatelet 12 ay"],
    kaynak: "ESC 2023 NSTE-AKS Kılavuzu",
  },
  "tip2-dm": {
    aciklama: "Tip 2 Diyabet — metformin + yaşam tarzı değişikliği",
    ilaclar: [
      { ad: "Metformin", doz: "500 mg 2×1, 2 hafta sonra 1000 mg 2×1'e titre et", yol: "Oral", endikasyon: "Birinci basamak anti-hiperglisemik" },
    ],
    prosedurler: ["Diyabet eğitimi (diyetisyen konsültasyonu)", "HbA1c kontrolü (3 ayda bir)", "Yıllık göz ve ayak muayenesi"],
    notlar: ["HbA1c hedefi <7%", "Açlık glukoz 80-130 mg/dL", "Tansiyon hedefi <130/80", "Lipid kontrolü: LDL <100 mg/dL"],
    kaynak: "ADA 2024 Standartları",
  },
  hipotiroidi: {
    aciklama: "Hipotiroidi — levotiroksin (T4) replasman tedavisi",
    ilaclar: [
      { ad: "Levotiroksin sodyum", doz: "25-50 mcg/gün, yavaş titre (yaşa ve kardiyak duruma göre)", yol: "Oral", endikasyon: "Tiroid hormon replasmanı" },
    ],
    prosedurler: ["TSH kontrolü (6 hafta sonra)", "Doz titrasyonu: TSH hedefi 1-2 mIU/L"],
    notlar: ["Aç karnına al (kahvaltıdan 30 dk önce)", "Kalsiyum/demir ile 4 saat ara", "Yaşlı/kardiyak hastada düşük doz başla (12.5 mcg)"],
    kaynak: "ATA 2017 Hipotiroidi Kılavuzu",
  },
  pnömoni: {
    aciklama: "Toplum Kazanılmış Pnömoni — ampirik antibiyotik (CURB-65 skorlaması)",
    ilaclar: [
      { ad: "Amoksisilin+Klavulanat", doz: "1 g 2×1", yol: "Oral", endikasyon: "Birinci basamak antibiyotik (CURB-65 0-1)" },
      { ad: "Levofloksasin (penisilin alerjisi varsa)", doz: "500-750 mg 1×1", yol: "Oral", endikasyon: "Solunum fluorokinolonu alternatifi" },
      { ad: "Parasetamol", doz: "500 mg (max 4 g/gün)", yol: "Oral", endikasyon: "Ateş ve ağrı" },
    ],
    prosedurler: ["CURB-65 skorlaması", "PA Akciğer grafisi (tanı anında + 6 hafta kontrol)", "Oksijen desteği (SpO2 <92% ise)"],
    notlar: ["Tedavi süresi 5-7 gün", "48-72 saatte klinik yanıt değerlendir", "Sigara bırakma danışmanlığı"],
    kaynak: "ATS/IDSA 2019 TKP Kılavuzu",
  },
  "koah-eks": {
    aciklama: "KOAH Akut Ekspazerbasyonu — bronkodilatör + steroid ± antibiyotik",
    ilaclar: [
      { ad: "Salbutamol + İpratropium", doz: "2.5+0.5 mg nebül 4×1", yol: "İnhalasyon", endikasyon: "Kısa etkili bronkodilatör kombinasyonu" },
      { ad: "Prednizolon", doz: "40 mg/gün 5 gün", yol: "Oral", endikasyon: "Sistemik steroid — ekspazerbasyon tedavisi" },
      { ad: "Amoksisilin+Klavulanat", doz: "1 g 2×1 5-7 gün", yol: "Oral", endikasyon: "Anthonisen ≥2 kriter: pürülan balgam" },
    ],
    prosedurler: ["O2 tedavisi (hedef SpO2 %88-92, dikkatli — CO2 retansiyon riski)", "Arteriyel kan gazı takibi", "Non-invaziv ventilasyon (pH<7.35, pCO2>45)"],
    notlar: ["Düşük akım O2 (1-2 L/dk nazal kanül)", "Steroid 5 günden uzun değil", "İnhaler teknik eğitimi", "Sigara bırakma"],
    kaynak: "GOLD 2024 KOAH Kılavuzu",
  },
  kbh: {
    aciklama: "Kronik Böbrek Hastalığı Evre 4 — renal diyet + komplikasyon yönetimi",
    ilaclar: [
      { ad: "Kalsiyum polistiren sülfonat", doz: "15 g oral veya 30 g rektal", yol: "Oral/Rektal", endikasyon: "Hiperkalemi (K>5.5) — K bağlayıcı" },
      { ad: "Sodyum bikarbonat", doz: "650-1300 mg 2-3×1", yol: "Oral", endikasyon: "Metabolik asidoz (HCO3<22)" },
      { ad: "Demir sülfat + Eritropoetin", doz: "Demir 200 mg 3×1 + ESA SC", yol: "Oral/SC", endikasyon: "Renal anemi (Hb<10)" },
      { ad: "Kalsiyum asetat", doz: "667 mg öğünle 3×1", yol: "Oral", endikasyon: "Fosfat bağlayıcı — hiperfosfatemi" },
    ],
    prosedurler: ["Renal diyet (düşük K, P, protein)", "Nefroloji konsültasyonu", "Diyaliz planlaması (Evre 5'e yaklaşırken)"],
    notlar: ["NSAII'lerden kaçın!", "ACEi/ARB: kreatinin ve K takibi ile", "eGFR her 3-6 ayda bir", "İdrar protein/kreatinin oranı takip"],
    kaynak: "KDIGO 2024 KBH Kılavuzu",
  },
  "meme-ca": {
    aciklama: "İnvaziv Duktal Karsinom (ER+/PR+/HER2-) — cerrahi + adjuvan hormon tedavisi",
    ilaclar: [
      { ad: "Tamoksifen", doz: "20 mg/gün", yol: "Oral", endikasyon: "Adjuvan hormon tedavisi (premenopoz)" },
    ],
    prosedurler: ["Cerrahi: Lumpektomi + sentinel lenf nodu biyopsisi veya mastektomi", "Radyoterapi (lumpektomi sonrası)", "BRCA genetik testi (aile öyküsü var)"],
    notlar: ["ER+/PR+ → hormon tedavisi 5-10 yıl", "HER2- → trastuzumab gerekmez", "Grade 2 → Onkotip DX ile kemoterapi kararı", "Postmenopozal: Aromataz inhibitörü (AI)"],
    kaynak: "NCCN 2024 Meme Kanseri Kılavuzu",
  },
  "akciger-ca": {
    aciklama: "Akciğer Adenokarsinomu Evre IIIA — PD-L1 >%50: immünoterapi",
    ilaclar: [
      { ad: "Pembrolizumab", doz: "200 mg IV 3 haftada bir", yol: "İntravenöz", endikasyon: "Anti-PD-1 immünoterapi (PD-L1>%50)" },
    ],
    prosedurler: ["Bronşoskopi (biyopsi + evreleme)", "PET-CT (uzak metastaz taraması)", "Multidisipliner tümör kurulu", "Kemo-radyoterapi (trimodalite yaklaşım)"],
    notlar: ["PD-L1 >%50 → immünoterapi monoterapi ilk seçenek", "EGFR/ALK/ROS1 mutasyon testi (tedaviyi değiştirir)", "Sigara bırakma zorunlu", "5-yıllık sağkalım Evre IIIA ~%25"],
    kaynak: "NCCN 2024 NSCLC Kılavuzu",
  },
  "demir-eksikligi-anemisi": {
    aciklama: "Demir Eksikliği Anemisi — oral demir replasmanı + altta yatan neden tedavisi",
    ilaclar: [
      { ad: "Ferros sülfat", doz: "200 mg 3×1 (aç karnına)", yol: "Oral", endikasyon: "Demir replasmanı" },
      { ad: "C vitamini", doz: "250 mg demirle birlikte", yol: "Oral", endikasyon: "Demir emilimini artırır" },
    ],
    prosedurler: ["Altta yatan neden araştır (hipermenore → GYN konsültasyon)", "2 hafta sonra retikülosit kontrolü", "Gaitada gizli kan (GİS kanama ekarte)"],
    notlar: ["Çay/kahve demirle 2 saat ara ile alınmalı", "Tedavi Hb normale döndükten sonra 3 ay daha devam", "IV demir: oral tolere edemeyen veya malabsorbsiyon"],
    kaynak: "WHO 2020 Anemi Kılavuzu",
  },
  iye: {
    aciklama: "Komplike olmayan sistit — ampirik antibiyotik tedavisi",
    ilaclar: [
      { ad: "Nitrofurantoin", doz: "100 mg 2×1 (5 gün)", yol: "Oral", endikasyon: "İlk seçenek antibiyotik" },
      { ad: "Fosfomisin trometamol", doz: "3 g tek doz", yol: "Oral", endikasyon: "Alternatif" },
    ],
    prosedurler: ["Bol sıvı alımı (2-3 L/gün)", "Semptomlar 48 saatte düzelmezse idrar kültürü"],
    notlar: ["Sülfonamid alerjisi varsa TMP-SMX'ten kaçın", "Gebelikte nitrofurantoin 3. trimesterde kontrendike", "Tekrarlayan İYE'de profilaksi düşün"],
    kaynak: "IDSA 2019 İYE Kılavuzu",
  },
  "akut-apandisit": {
    aciklama: "Akut Apandisit — cerrahi apendektomi + antibiyotik profilaksisi",
    ilaclar: [
      { ad: "Sefazolin + Metronidazol", doz: "1 g + 500 mg IV (pre-op tek doz)", yol: "IV", endikasyon: "Cerrahi profilaksi" },
      { ad: "Parasetamol", doz: "1 g IV (post-op)", yol: "IV", endikasyon: "Analjezi" },
    ],
    prosedurler: ["Laparoskopik veya açık apendektomi", "Preoperatif IV sıvı resüsitasyonu", "Post-op 24-48 saat gözlem"],
    notlar: ["Perfore apandisit → geniş spektrumlu antibiyotik + drenaj", "Komplike olmayan → 24 saatte taburcu", "Gebelikte apandisit → fetal kayıp riski, erken cerrahi"],
    kaynak: "WSES 2020 Apandisit Kılavuzu",
  },
  // mevcut polikliniklere eklenen yeni hastalıklar
  "kalp-yetmezligi": {
    aciklama: "Kalp Yetmezliği (iskemik) — ACEi + beta bloker + diüretik + SGLT2i",
    ilaclar: [
      { ad: "Ramipril", doz: "2.5-5 mg 2×1 (titre)", yol: "Oral", endikasyon: "ACE inhibitörü — mortaliteyi azaltır" },
      { ad: "Karvedilol / Metoprolol", doz: "6.25-25 mg 2×1 (titre)", yol: "Oral", endikasyon: "Beta bloker — stabilize başladıktan sonra" },
      { ad: "Furosemid", doz: "40-80 mg/gün (konjesyona göre)", yol: "Oral/IV", endikasyon: "Loop diüretik — sıvı yükü" },
      { ad: "Dapagliflozin", doz: "10 mg 1×1", yol: "Oral", endikasyon: "SGLT2i — KY'de mortalite azaltır" },
    ],
    prosedurler: ["Ekokardiyografi (EF ölçümü)", "Günlük kilo takibi", "Sıvı kısıtlaması (1.5-2 L/gün)"],
    notlar: ["ACEi/ARB + beta bloker + MRA üçlü tedavi", "SGLT2i ekle (dapagliflozin/empagliflozin)", "IV furosemid konjesyonda", "Dijital: atriyal fibrilasyon + KY'de"],
    kaynak: "ESC 2021 Kalp Yetmezliği Kılavuzu",
  },
  hipertiroidi: {
    aciklama: "Hipertiroidi (Graves?) — metimazol + beta bloker",
    ilaclar: [
      { ad: "Metimazol", doz: "10-30 mg/gün (titrasyon)", yol: "Oral", endikasyon: "Antitiroid — hormon sentezini bloke eder" },
      { ad: "Propranolol", doz: "20-40 mg 3×1", yol: "Oral", endikasyon: "Beta bloker — adrenerjik semptomlar için" },
    ],
    prosedurler: ["TSH reseptör antikoru (TRAb) — Graves tanısı", "Tiroid USG", "RAI ablasyon veya tiroidektomi (kalıcı tedavi)"],
    notlar: ["Metimazol: 4-8 haftada ötiroid", "Agranülositoz riski (ateş+boğaz ağrısı → acil)", "Gebelikte propiltiourasil (ilk trimester)", "RAI sonrası hipotiroidi gelişir"],
    kaynak: "ATA 2016 Hipertiroidi Kılavuzu",
  },
  astim: {
    aciklama: "Astım Atağı — kısa etkili beta agonist + sistemik steroid",
    ilaclar: [
      { ad: "Salbutamol", doz: "2.5-5 mg nebül (4-6 saat ara ile)", yol: "İnhalasyon", endikasyon: "Kısa etkili beta agonist — bronkodilatasyon" },
      { ad: "İpratropium bromür", doz: "0.5 mg nebül (6 saat ara ile)", yol: "İnhalasyon", endikasyon: "Antikolinerjik — ek bronkodilatasyon" },
      { ad: "Prednizolon", doz: "40-50 mg/gün (5-7 gün)", yol: "Oral", endikasyon: "Sistemik steroid — hava yolu enflamasyonu" },
    ],
    prosedurler: ["O2 desteği (SpO2 >%92)", "Pik akım (PEF) ölçümü", "Ağır atak: IV magnezyum sülfat 2g"],
    notlar: ["Atak sonrası inhaler steroid başla/basamak artır", "Tetkikleyiciden kaçınma", "Astım eylem planı ver", "Ağır atak: hastaneye yatır"],
    kaynak: "GINA 2023 Astım Kılavuzu",
  },
  abh: {
    aciklama: "Prerenal Akut Böbrek Hasari — IV sıvı + NSAII kes + hiperkalemi yönetimi",
    ilaclar: [
      { ad: "İzotonik NaCl %0.9", doz: "500-1000 mL IV bolus, sonra idame", yol: "IV", endikasyon: "Sıvı resüsitasyonu" },
      { ad: "Kalsiyum glukonat (hiperkalemi varsa)", doz: "10 mL %10 IV (EKG değişikliği varsa)", yol: "IV", endikasyon: "Kardiyak membran stabilizasyonu" },
    ],
    prosedurler: ["NSAII/nefrotoksikleri kes", "Sıvı dengesi takibi (girdi/çıktı)", "Günlük kreatinin + elektrolit takibi", "K >6.0 veya EKG değişikliği → acil diyaliz"],
    notlar: ["Prerenal ABH: sıvıya yanıt verir (ilk 24-48 saat)", "İdrar çıkışı >0.5 mL/kg/saat hedef", "Nefrotoksik ilaç dozu ayarla", "48 saatte düzelme olmazsa nefroloji konsültasyonu"],
    kaynak: "KDIGO 2012 ABH Kılavuzu",
  },
};

// ─── Vaka Veri Kaynakları (hastalıkKey → kaynak listesi) ───
const KAYNAKLAR_SABLONLARI: Record<string, string[]> = {
  stemi: [
    "📊 Veri seti · UCI Heart Disease (303 hasta, 14 özellik) → bu vakanın EKG/troponin parametreleri için kullanıldı",
    "📖 Kılavuz · ESC 2023 STEMI → akut koroner sendrom tanı ve tedavi algoritması",
    "🩺 EKG bulguları · Sentetik, kardiyoloji uzmanı onaylı → II, III, aVF derivasyonlarında ST elevasyon",
    "🧪 Laboratuvar · Troponin/CBC klinik referans aralık bazlı → LabCorp/WHO referans değerleri",
  ],
  nstemi: [
    "📊 Veri seti · UCI Heart Disease + BRFSS diyabet → kardiyak risk + komorbid diyabet parametreleri",
    "📖 Kılavuz · ESC 2023 NSTE-AKS → unstabil angina/NSTEMI risk skorlaması (GRACE)",
    "🩺 EKG bulguları · Sentetik, kardiyoloji uzmanı onaylı → anterolateral ST depresyon",
    "🧪 Laboratuvar · Troponin seri ölçüm referans aralık bazlı → hafif yüksek troponin senaryosu",
  ],
  "tip2-dm": [
    "📊 Veri seti · Kaggle Diabetes / BRFSS (sağlık göstergeleri) → yaş, BMI, fiziksel aktivite parametreleri",
    "📖 Kılavuz · ADA 2024 Standartları → Tip 2 DM tanı ve tedavi algoritması",
    "🧪 Laboratuvar · HbA1c/Açlık glukoz klinik referans aralık bazlı → >126 mg/dL = DM tanı kriteri",
    "🔬 İdrar tetkiki · Sentetik → glukozüri + keton negatif, DKA ekarte",
  ],
  hipotiroidi: [
    "📖 Kılavuz · ATA 2017 Hipotiroidi → TSH/fT4 tanı kriterleri ve levotiroksin replasmanı",
    "🧪 Laboratuvar · TSH/fT4 klinik referans aralık bazlı → TSH >10 mIU/L = açık hipotiroidi",
    "🩺 Hasta yanıtları · Sentetik, endokrinoloji onaylı → halsizlik, kilo alımı, soğuk intoleransı",
    "👤 Demografik · Sentetik (dummy) → 30-70 yaş kadın ağırlıklı (Hashimoto demografisi)",
  ],
  pnömoni: [
    "🖼️ Veri seti · Kaggle Chest X-Ray Pneumonia (5,863 görüntü) → röntgen bulguları bu veri setinden örneklenmiştir",
    "📖 Kılavuz · ATS/IDSA 2019 TKP → CURB-65 skorlaması ve ampirik antibiyotik seçimi",
    "🩻 Röntgen bulguları · Kaggle veri seti → sağ alt lob konsolidasyonu + hava bronkogram",
    "🧪 Laboratuvar · CRP/CBC klinik referans aralık bazlı → lökositoz + CRP yüksekliği",
  ],
  "koah-eks": [
    "📖 Kılavuz · GOLD 2024 KOAH → ekspazerbasyon tanı ve tedavi algoritması (Anthonisen kriterleri)",
    "🫁 ABG parametreleri · Klinik referans aralık bazlı → kompanse respiratuvar asidoz (pH 7.34, pCO2 58)",
    "🩻 Röntgen · Sentetik, KOAH tipik → hiperinflatif akciğerler, diyafrağmada düzleşme",
    "🫁 Spirometri · Sentetik → FEV1/FVC <0.70 (KOAH tanı kriteri)",
  ],
  kbh: [
    "📊 Veri seti · UCI CKD (400 hasta, 24 özellik) → serum kreatinin, üre, elektrolit parametreleri bu veri setinden",
    "📖 Kılavuz · KDIGO 2024 KBH → eGFR hesaplama (CKD-EPI) ve evreleme",
    "🧪 Laboratuvar · UCI CKD veri seti + sentetik → kreatinin 2.8 mg/dL, eGFR ~25 (Evre 4)",
    "🔬 İdrar tetkiki · Sentetik, KBH tipik → proteinüri + düşük dansite + hyalin silendirler",
  ],
  "meme-ca": [
    "📊 Veri seti · UCI Breast Cancer Wisconsin Diagnostic (569 hasta, 30 FNA özelliği) → kitle karakterizasyonu",
    "📖 Kılavuz · NCCN 2024 Meme Kanseri → BIRADS skorlaması + cerrahi/adjuvan tedavi algoritması",
    "🩻 Mamografi/USG · Sentetik, BIRADS 5 → düzensiz konturlu spikülasyonlu kitle + mikrokalsifikasyonlar",
    "🔬 Biyopsi · Sentetik → İnvaziv Duktal Karsinom, Grade 2, ER+/PR+/HER2- (Luminal A)",
  ],
  "akciger-ca": [
    "📖 Kılavuz · NCCN 2024 NSCLC → TNM evreleme ve immünoterapi/kemoterapi seçimi",
    "🩻 Toraks BT · Sentetik, Evre IIIA (T2aN2M0) → sağ üst lob spiküle kitle + hiler LAP",
    "🔬 Biyopsi · Sentetik → Adenokarsinom, EGFR wild-type, ALK negatif, PD-L1 >%50",
    "👤 Demografik · Sigara öyküsü bazlı risk → 52.5 paket-yıl, tipik akciğer CA profili",
  ],
  "demir-eksikligi-anemisi": [
    "📊 Veri seti · WHO Global Anemi Estimates → prevalans ve demografik veriler",
    "📖 Kılavuz · WHO 2020 Anemi → mikrositik anemi ayırıcı tanı algoritması",
    "🧪 Laboratuvar · CBC + Ferritin + Serum Demir → sentetik, klinik referans aralık bazlı",
    "🩺 Hasta yanıtları · Sentetik → hipermenoreye bağlı kronik kan kaybı senaryosu",
  ],
  iye: [
    "📖 Kılavuz · IDSA 2019 İYE → komplike olmayan sistit tedavi algoritması",
    "🧪 Laboratuvar · Tam idrar tetkiki → sentetik, piyuri + nitrit pozitif + bakteriüri",
    "🦠 Mikrobiyoloji · En sık etken E.coli (%80) → ampirik tedavi bu veriye dayanır",
    "👤 Demografik · 20-70 yaş kadın → en sık İYE görülen popülasyon",
  ],
  "akut-apandisit": [
    "📖 Kılavuz · WSES 2020 Apandisit → Alvarado skoru ve cerrahi endikasyonlar",
    "🧪 Laboratuvar · CBC + CRP → sentetik, lökositoz + CRP yüksekliği",
    "🩺 Fizik muayene · McBurney noktası hassasiyeti → klasik apandisit bulgusu",
    "👤 Demografik · 15-45 yaş → en sık apandisit görülen yaş aralığı",
  ],
  "kalp-yetmezligi": [
    "📊 Veri seti · UCI Heart Disease → KY risk faktörleri (HT, MI, yaş) bu veriden",
    "📖 Kılavuz · ESC 2021 Kalp Yetmezliği → Framingham kriterleri ve tedavi algoritması",
    "🧪 Laboratuvar · BNP + EKG + PA Akciğer → sentetik, KY tipik bulgular",
    "🩺 Hasta yanıtları · Sentetik → iskemik KY (eski MI + HT) senaryosu",
  ],
  hipertiroidi: [
    "📖 Kılavuz · ATA 2016 Hipertiroidi → Graves/tirotoksikoz tanı ve tedavi algoritması",
    "🧪 Laboratuvar · TSH + fT4 → klinik referans aralık bazlı (TSH suprese, fT4 yüksek)",
    "🩺 Hasta yanıtları · Sentetik → Graves hastalığı prezentasyonu (çarpıntı, kilo kaybı, tremor)",
    "👤 Demografik · 25-55 yaş kadın → Graves hastalığı en sık bu grupta",
  ],
  astim: [
    "📖 Kılavuz · GINA 2023 Astım → atak şiddeti sınıflaması ve basamak tedavisi",
    "🩻 Radyoloji · PA Akciğer Grafisi → hiperinflasyon bulguları (astım ile uyumlu)",
    "🧪 Laboratuvar · CBC (eozinofili) + ABG → sentetik, astım atağı tipik",
    "🩺 Hasta yanıtları · Sentetik → allerjik astım (polen tetikleyici) senaryosu",
  ],
  abh: [
    "📖 Kılavuz · KDIGO 2012 ABH → tanı kriterleri (kreatinin artışı) ve evreleme",
    "📊 Veri seti · UCI CKD → bazal böbrek fonksiyonu referans parametreleri",
    "🧪 Laboratuvar · Kreatinin/BUN/Elektrolit/İdrar → sentetik, prerenal ABH tipik",
    "🩺 Hasta yanıtları · Sentetik → hipovolemi + NSAII kullanımı senaryosu",
  ],
};

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
