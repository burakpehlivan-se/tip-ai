export type Seviye = "baslangic" | "orta" | "ileri";
export type Faz = "anamnez" | "fizik" | "test" | "tani" | "tamamlandi";

export type Cinsiyet = "E" | "K";

export interface Hasta {
  ad: string;
  tamAd: string;
  tc: string;
  yas: number;
  cinsiyet: Cinsiyet;
  anaSikayet: string;
  ozetBilgiler: string[];
}

export interface Vaka {
  id: string;
  semptom: string;
  hastalik: string;
  alan: string;
  seviye: Seviye;
  hasta: Hasta;
  beklenenTani: string[];
  rubric: Rubric;
  statikTestler: Record<string, TestSonucu>;
  hastaYanitlari: Record<string, string>;
  soruChipleri: SoruChipi[];
  relevantAksiyonlar: string[];
  idealYol?: string[];
  egitimNotu?: string;
  tedavi?: TedaviPlani;
  kaynaklar?: string[];
}

export interface TedaviPlani {
  aciklama: string;
  ilaclar: TedaviIlaci[];
  prosedurler: string[];
  notlar: string[];
  kaynak: string;
}

export interface TedaviIlaci {
  ad: string;
  doz: string;
  yol: string;
  endikasyon: string;
}

export type ChipKategorisi =
  | "anamnez-agri"
  | "anamnez-sistemik"
  | "anamnez-oyku"
  | "soygecmis"
  | "red-flag"
  | "vital"
  | "fizik";

export interface SoruChipi {
  etiket: string;
  aksiyon: string;
  kategori: ChipKategorisi;
}

export interface Rubric {
  beklenenSorular: RubrikAksiyon[];
  beklenenTestler: RubrikAksiyon[];
  gereksizTestler: RubrikAksiyon[];
  redFlagler: RubrikAksiyon[];
  kabulEdilenTani: string[];
  puanlama: Record<string, number>;
}

export interface RubrikAksiyon {
  key: string;
  etiket: string;
  aciklama: string;
}

export type TestSonucTipi = "numeric" | "text" | "json" | "image";

export interface TestSonucu {
  testKey: string;
  testAdi: string;
  tip: TestSonucTipi;
  sonuc: Record<string, unknown> | string;
  referans?: string;
  yorum?: string;
}

export interface ChatMesaj {
  id: string;
  rol: "ogrenci" | "hasta" | "sistem";
  metin: string;
  zaman: number;
  kategori?: ChipKategorisi;
  relevant?: boolean;
  testSonucu?: TestSonucu;
  testAdi?: string;
}

export interface TestIstegi {
  testKey: string;
  testAdi: string;
  sonuc: TestSonucu;
  zaman: number;
}

export interface DegerlendirmeSonuc {
  toplamPuan: number;
  maxPuan: number;
  dogruSorular: string[];
  eksikSorular: string[];
  dogruTestler: string[];
  eksikTestler: string[];
  gereksizTestler: string[];
  atlananRedFlagler: string[];
  taniDogru: boolean;
  taniGirildi: string;
  gucluYonler: string[];
  zayifYonler: string[];
  idealYol: string[];
  egitimNotu: string;
  tedavi?: TedaviPlani;
  anamnezAnalizi: AnamnezAnalizi;
}

export interface AnamnezAnalizi {
  kategoriBazinda: {
    kategori: ChipKategorisi;
    etiket: string;
    soruldu: number;
    beklenen: number;
    eksik: string[];
  }[];
  toplamSoruldu: number;
  toplamBeklenen: number;
  tumKategorilerSoruldu: boolean;
  enCokEksikKategori: string | null;
  enIyiKategori: string | null;
}

export interface SynonymSozluk {
  [alias: string]: string;
}
