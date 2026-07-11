export type Tendency = "yuksek" | "dusuk";

export interface RuleEntry {
  /** Benzersiz kural ID'si */
  id: string;
  /** Hangi test için geçerli (örn: TROPONIN, GLUKOZ, TSH) */
  testKey: string;
  /** Hangi hastalıkta tetiklenir (örn: stemi, hipotiroidi) */
  diseaseKey: string;
  /** Anormal yön */
  tendency: Tendency;
  /** Çarpan faktörü — normal aralığın kaç katı sapacak (örn: 20 = 20x üst sınır) */
  factor: number;
  /** Açıklama */
  description: string;
  /** Kural aktif mi? */
  active: boolean;
  /** Oluşturulma zamanı */
  createdAt: number;
  /** Son güncelleme */
  updatedAt: number;
}

export interface DiseaseAlias {
  /** Alias (kullanıcının girdiği hastalık adı) */
  alias: string;
  /** Hangi kanonik hastalığa eşlenir (diseaseKey) */
  target: string;
}

export interface RuleEngineStore {
  version: number;
  updatedAt: number;
  rules: RuleEntry[];
  aliases: DiseaseAlias[];
}

export const DEFAULT_RULES: RuleEntry[] = [
  { id: "TROPONIN::stemi", testKey: "TROPONIN", diseaseKey: "stemi", tendency: "yuksek", factor: 20, description: "STEMI → Troponin belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TROPONIN::nstemi", testKey: "TROPONIN", diseaseKey: "nstemi", tendency: "yuksek", factor: 3, description: "NSTEMI → Troponin hafif yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TROPONIN::kalp-yetmezligi", testKey: "TROPONIN", diseaseKey: "kalp-yetmezligi", tendency: "yuksek", factor: 2, description: "Kalp yetmezliği → Troponin hafif yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "BNP::kalp-yetmezligi", testKey: "BNP", diseaseKey: "kalp-yetmezligi", tendency: "yuksek", factor: 8, description: "Kalp yetmezliği → BNP belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "BNP::stemi", testKey: "BNP", diseaseKey: "stemi", tendency: "yuksek", factor: 3, description: "STEMI → BNP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "BNP::nstemi", testKey: "BNP", diseaseKey: "nstemi", tendency: "yuksek", factor: 2, description: "NSTEMI → BNP hafif yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GLUKOZ::tip2-dm", testKey: "GLUKOZ", diseaseKey: "tip2-dm", tendency: "yuksek", factor: 1.8, description: "Tip 2 DM → Glukoz yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GLUKOZ::diyabetik-noropati", testKey: "GLUKOZ", diseaseKey: "diyabetik-noropati", tendency: "yuksek", factor: 2, description: "Diyabetik nöropati → Glukoz yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GLUKOZ::diyabetik-retinopati", testKey: "GLUKOZ", diseaseKey: "diyabetik-retinopati", tendency: "yuksek", factor: 1.8, description: "Diyabetik retinopati → Glukoz yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GLUKOZ::hipoglisemi", testKey: "GLUKOZ", diseaseKey: "hipoglisemi", tendency: "dusuk", factor: 0.6, description: "Hipoglisemi → Glukoz düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GLUKOZ::preeklampsi", testKey: "GLUKOZ", diseaseKey: "preeklampsi", tendency: "yuksek", factor: 1.3, description: "Preeklampsi → Glukoz hafif yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "HBA1C::tip2-dm", testKey: "HBA1C", diseaseKey: "tip2-dm", tendency: "yuksek", factor: 1.8, description: "Tip 2 DM → HbA1c yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "HBA1C::diyabetik-noropati", testKey: "HBA1C", diseaseKey: "diyabetik-noropati", tendency: "yuksek", factor: 2, description: "Diyabetik nöropati → HbA1c yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "HBA1C::diyabetik-retinopati", testKey: "HBA1C", diseaseKey: "diyabetik-retinopati", tendency: "yuksek", factor: 1.8, description: "Diyabetik retinopati → HbA1c yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "KREATININ::kbh", testKey: "KREATININ", diseaseKey: "kbh", tendency: "yuksek", factor: 3, description: "KBH → Kreatinin belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "KREATININ::abh", testKey: "KREATININ", diseaseKey: "abh", tendency: "yuksek", factor: 2.5, description: "ABH → Kreatinin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "KREATININ::ckd-ev3", testKey: "KREATININ", diseaseKey: "ckd-ev3", tendency: "yuksek", factor: 2, description: "CKD Evre 3 → Kreatinin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "BUN::kbh", testKey: "BUN", diseaseKey: "kbh", tendency: "yuksek", factor: 2.5, description: "KBH → BUN yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "BUN::abh", testKey: "BUN", diseaseKey: "abh", tendency: "yuksek", factor: 2, description: "ABH → BUN yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TSH::hipotiroidi", testKey: "TSH", diseaseKey: "hipotiroidi", tendency: "yuksek", factor: 4, description: "Hipotiroidi → TSH belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TSH::hipertiroidi", testKey: "TSH", diseaseKey: "hipertiroidi", tendency: "dusuk", factor: 0.08, description: "Hipertiroidi → TSH baskılanmış", active: true, createdAt: 0, updatedAt: 0 },
  { id: "FT4::hipertiroidi", testKey: "FT4", diseaseKey: "hipertiroidi", tendency: "yuksek", factor: 2.5, description: "Hipertiroidi → FT4 yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "FT4::hipotiroidi", testKey: "FT4", diseaseKey: "hipotiroidi", tendency: "dusuk", factor: 0.35, description: "Hipotiroidi → FT4 düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CRP::pnömoni", testKey: "CRP", diseaseKey: "pnömoni", tendency: "yuksek", factor: 15, description: "Pnömoni → CRP belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CRP::akut-apandisit", testKey: "CRP", diseaseKey: "akut-apandisit", tendency: "yuksek", factor: 12, description: "Akut apandisit → CRP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CRP::akut-kolesistit", testKey: "CRP", diseaseKey: "akut-kolesistit", tendency: "yuksek", factor: 10, description: "Akut kolesistit → CRP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CRP::akut-pankreatit", testKey: "CRP", diseaseKey: "akut-pankreatit", tendency: "yuksek", factor: 8, description: "Akut pankreatit → CRP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CRP::koah-eks", testKey: "CRP", diseaseKey: "koah-eks", tendency: "yuksek", factor: 9, description: "KOAH alevlenme → CRP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CRP::iye", testKey: "CRP", diseaseKey: "iye", tendency: "yuksek", factor: 6, description: "İYE → CRP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "WBC::pnömoni", testKey: "WBC", diseaseKey: "pnömoni", tendency: "yuksek", factor: 1.5, description: "Pnömoni → Lökosit yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "WBC::akut-apandisit", testKey: "WBC", diseaseKey: "akut-apandisit", tendency: "yuksek", factor: 1.6, description: "Akut apandisit → Lökosit yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "WBC::akut-kolesistit", testKey: "WBC", diseaseKey: "akut-kolesistit", tendency: "yuksek", factor: 1.5, description: "Akut kolesistit → Lökosit yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "WBC::akut-pankreatit", testKey: "WBC", diseaseKey: "akut-pankreatit", tendency: "yuksek", factor: 1.4, description: "Akut pankreatit → Lökosit yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "AMILAZ::akut-pankreatit", testKey: "AMILAZ", diseaseKey: "akut-pankreatit", tendency: "yuksek", factor: 5, description: "Akut pankreatit → Amilaz belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "AMILAZ::koledokolitiazis", testKey: "AMILAZ", diseaseKey: "koledokolitiazis", tendency: "yuksek", factor: 3, description: "Koledokolitiazis → Amilaz yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "LIPAZ::akut-pankreatit", testKey: "LIPAZ", diseaseKey: "akut-pankreatit", tendency: "yuksek", factor: 8, description: "Akut pankreatit → Lipaz belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "HGB::demir-eksikligi-anemisi", testKey: "HGB", diseaseKey: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.55, description: "Demir eksikliği anemisi → Hb düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "HGB::kalca-kirigi", testKey: "HGB", diseaseKey: "kalca-kirigi", tendency: "dusuk", factor: 0.7, description: "Kalça kırığı → Hb düşük (kan kaybı)", active: true, createdAt: 0, updatedAt: 0 },
  { id: "ALT::akut-kolesistit", testKey: "ALT", diseaseKey: "akut-kolesistit", tendency: "yuksek", factor: 2.5, description: "Akut kolesistit → ALT yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "ALT::hepatit", testKey: "ALT", diseaseKey: "hepatit", tendency: "yuksek", factor: 10, description: "Hepatit → ALT belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "ALT::koledokolitiazis", testKey: "ALT", diseaseKey: "koledokolitiazis", tendency: "yuksek", factor: 2, description: "Koledokolitiazis → ALT yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "AST::akut-kolesistit", testKey: "AST", diseaseKey: "akut-kolesistit", tendency: "yuksek", factor: 2.5, description: "Akut kolesistit → AST yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "AST::hepatit", testKey: "AST", diseaseKey: "hepatit", tendency: "yuksek", factor: 10, description: "Hepatit → AST belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TBIL::hepatit", testKey: "TBIL", diseaseKey: "hepatit", tendency: "yuksek", factor: 5, description: "Hepatit → Bilirubin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TBIL::koledokolitiazis", testKey: "TBIL", diseaseKey: "koledokolitiazis", tendency: "yuksek", factor: 3, description: "Koledokolitiazis → Bilirubin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "TBIL::akut-kolesistit", testKey: "TBIL", diseaseKey: "akut-kolesistit", tendency: "yuksek", factor: 2, description: "Akut kolesistit → Bilirubin hafif yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "DDIMER::dvt", testKey: "DDIMER", diseaseKey: "dvt", tendency: "yuksek", factor: 3, description: "DVT → D-Dimer yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "LACTATE::sepsis", testKey: "LACTATE", diseaseKey: "sepsis", tendency: "yuksek", factor: 3, description: "Sepsis → Laktat yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "LACTATE::pnömoni", testKey: "LACTATE", diseaseKey: "pnömoni", tendency: "yuksek", factor: 1.5, description: "Pnömoni → Laktat hafif yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PH::koah-eks", testKey: "PH", diseaseKey: "koah-eks", tendency: "dusuk", factor: 0.95, description: "KOAH alevlenme → pH düşük (asidoz)", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PH::pnömoni", testKey: "PH", diseaseKey: "pnömoni", tendency: "dusuk", factor: 0.97, description: "Pnömoni → pH hafif düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PH::astim", testKey: "PH", diseaseKey: "astim", tendency: "dusuk", factor: 0.97, description: "Astım → pH hafif düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PCO2::koah-eks", testKey: "PCO2", diseaseKey: "koah-eks", tendency: "yuksek", factor: 1.3, description: "KOAH alevlenme → pCO2 yüksek (retansiyon)", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PO2::pnömoni", testKey: "PO2", diseaseKey: "pnömoni", tendency: "dusuk", factor: 0.85, description: "Pnömoni → pO2 düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PO2::koah-eks", testKey: "PO2", diseaseKey: "koah-eks", tendency: "dusuk", factor: 0.82, description: "KOAH alevlenme → pO2 düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "ALBUMIN::hepatit", testKey: "ALBUMIN", diseaseKey: "hepatit", tendency: "dusuk", factor: 0.7, description: "Hepatit → Albumin düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "U_PROTEIN::kbh", testKey: "U_PROTEIN", diseaseKey: "kbh", tendency: "yuksek", factor: 10, description: "KBH → İdrar protein yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "U_PROTEIN::preeklampsi", testKey: "U_PROTEIN", diseaseKey: "preeklampsi", tendency: "yuksek", factor: 15, description: "Preeklampsi → İdrar protein belirgin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PLT::preeklampsi", testKey: "PLT", diseaseKey: "preeklampsi", tendency: "dusuk", factor: 0.5, description: "Preeklampsi → Trombosit düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "K::kbh", testKey: "K", diseaseKey: "kbh", tendency: "yuksek", factor: 1.2, description: "KBH → Potasyum yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "K::abh", testKey: "K", diseaseKey: "abh", tendency: "yuksek", factor: 1.3, description: "ABH → Potasyum yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GFR::kbh", testKey: "GFR", diseaseKey: "kbh", tendency: "dusuk", factor: 0.4, description: "KBH → eGFR belirgin düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GFR::abh", testKey: "GFR", diseaseKey: "abh", tendency: "dusuk", factor: 0.5, description: "ABH → eGFR düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GGT::akut-kolesistit", testKey: "GGT", diseaseKey: "akut-kolesistit", tendency: "yuksek", factor: 3, description: "Akut kolesistit → GGT yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "GGT::hepatit", testKey: "GGT", diseaseKey: "hepatit", tendency: "yuksek", factor: 3, description: "Hepatit → GGT yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "ALP::koledokolitiazis", testKey: "ALP", diseaseKey: "koledokolitiazis", tendency: "yuksek", factor: 3, description: "Koledokolitiazis → ALP yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CA::meme-ca", testKey: "CA", diseaseKey: "meme-ca", tendency: "yuksek", factor: 1.2, description: "Meme CA → Kalsiyum yüksek (kemik met)", active: true, createdAt: 0, updatedAt: 0 },
  { id: "CA::akciger-ca", testKey: "CA", diseaseKey: "akciger-ca", tendency: "yuksek", factor: 1.2, description: "Akciğer CA → Kalsiyum yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "FERITIN::demir-eksikligi-anemisi", testKey: "FERITIN", diseaseKey: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.3, description: "Demir eksikliği → Ferritin belirgin düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "HCT::demir-eksikligi-anemisi", testKey: "HCT", diseaseKey: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.7, description: "Demir eksikliği → Hct düşük", active: true, createdAt: 0, updatedAt: 0 },
  { id: "MCV::demir-eksikligi-anemisi", testKey: "MCV", diseaseKey: "demir-eksikligi-anemisi", tendency: "dusuk", factor: 0.8, description: "Demir eksikliği → MCV düşük (mikrositoz)", active: true, createdAt: 0, updatedAt: 0 },
  { id: "PROCT::pnömoni", testKey: "PROCT", diseaseKey: "pnömoni", tendency: "yuksek", factor: 8, description: "Pnömoni → Prokalsitonin yüksek", active: true, createdAt: 0, updatedAt: 0 },
  { id: "U_SG::iye", testKey: "U_SG", diseaseKey: "iye", tendency: "yuksek", factor: 1.05, description: "İYE → İdrar dansite yüksek", active: true, createdAt: 0, updatedAt: 0 },
];

export const DEFAULT_ALIASES: DiseaseAlias[] = [
  { alias: "tip-2-diyabet", target: "tip2-dm" },
  { alias: "tip2dm", target: "tip2-dm" },
  { alias: "diyabet", target: "tip2-dm" },
  { alias: "enfeksiyon", target: "iye" },
  { alias: "pankreatit", target: "akut-pankreatit" },
  { alias: "anemi", target: "demir-eksikligi-anemisi" },
  { alias: "sok", target: "sepsis" },
];
