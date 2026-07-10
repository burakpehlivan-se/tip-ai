/**
 * Hastalık bazlı rubrik / ideal yol iskeletleri.
 * MIMIC bunları vermez — ETL post-process veya AI doldurur; şablon seed.
 */

import { CdmRubrikAksiyon, DEFAULT_CDM_PUANLAMA } from "../../cdm/types";

export interface DiseaseRubricTemplate {
  beklenenSorular: CdmRubrikAksiyon[];
  beklenenTestler: CdmRubrikAksiyon[];
  gereksizTestler: CdmRubrikAksiyon[];
  redFlagler: CdmRubrikAksiyon[];
  idealYol: string[];
  egitimNotu: string;
  anaSikayetStub: string;
  ozetStub: string[];
}

const DEFAULT_TEMPLATE: DiseaseRubricTemplate = {
  beklenenSorular: [
    { key: "SIKAYET_SURE", etiket: "Şikayet süresi", aciklama: "Ne zamandır?", kategori: "Sikayet" },
    { key: "OZGECMIS", etiket: "Özgeçmiş", aciklama: "Kronik hastalıklar", kategori: "Ozgecmis" },
    { key: "ILAC_OYKUSU", etiket: "İlaçlar", aciklama: "Kullandığı ilaçlar", kategori: "Ilac" },
  ],
  beklenenTestler: [
    { key: "CBC", etiket: "Hemogram", aciklama: "Temel laboratuvar" },
  ],
  gereksizTestler: [],
  redFlagler: [
    { key: "HEMODINAMI", etiket: "Hemodinamik bozulma", aciklama: "Hipotansiyon, şok" },
  ],
  idealYol: [
    "1. Anamnez ve vitalleri değerlendir.",
    "2. İlgili lab/görüntülemeyi iste.",
    "3. Tanıyı netleştir, tedaviyi başlat.",
  ],
  egitimNotu: "Eğitim amaçlı vaka iskeleti — uzman onayı gerekir.",
  anaSikayetStub: "Genel halsizlik ve yakınma",
  ozetStub: ["Klinik öykü MIMIC epizodundan türetilmiştir.", "Eğitim amaçlı sentetik iskelet."],
};

export const DISEASE_RUBRIC_TEMPLATES: Record<string, DiseaseRubricTemplate> = {
  stemi: {
    beklenenSorular: [
      { key: "AGRI_KARAKTER", etiket: "Göğüs ağrısı karakteri", aciklama: "Sıkıştırıcı mı?", kategori: "Sikayet" },
      { key: "AGRI_YAYILIM", etiket: "Yayılım", aciklama: "Kola/çeneye?", kategori: "Sikayet" },
      { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Eforla mı?", kategori: "Sikayet" },
      { key: "RISK_FAKTOR", etiket: "KV risk", aciklama: "HT, DM, sigara", kategori: "Ozgecmis" },
    ],
    beklenenTestler: [
      { key: "EKG", etiket: "EKG", aciklama: "ST elevasyonu" },
      { key: "TROPONIN", etiket: "Troponin", aciklama: "Miyokard hasarı" },
    ],
    gereksizTestler: [
      { key: "MAMOGRAFI", etiket: "Mamografi", aciklama: "Akut göğüs ağrısında yersiz" },
    ],
    redFlagler: [
      { key: "HEMODINAMI", etiket: "Hemodinamik bozulma", aciklama: "Şok, aritmi" },
      { key: "AKUT_GOGUS", etiket: "Akut göğüs ağrısı", aciklama: "İstirahat/yaşamı tehdit" },
    ],
    idealYol: [
      "1. ABC ve monitörizasyon; 12 derivasyon EKG hemen.",
      "2. Troponin ve temel laboratuvar.",
      "3. Dual antiplatelet + antikoagülasyon protokolü.",
      "4. Acil reperfüzyon (PCI) için sevk.",
    ],
    egitimNotu:
      "STEMI: ST elevasyonu + klinik. Zaman kritik; reperfüzyon gecikmemeli. Eğitim iskeleti.",
    anaSikayetStub: "Ani başlayan göğüs ağrısı",
    ozetStub: [
      "Göğüste sıkıştırıcı ağrı",
      "Soğuk terleme / nefes darlığı olabilir",
      "KV risk faktörleri sık",
    ],
  },
  "tip-2-diyabet": {
    beklenenSorular: [
      { key: "POLIURI", etiket: "Poliüri", aciklama: "Sık idrara çıkma", kategori: "Sikayet" },
      { key: "POLIDIPSI", etiket: "Polidipsi", aciklama: "Aşırı susama", kategori: "Sikayet" },
      { key: "KILO_DEGISIM", etiket: "Kilo değişimi", aciklama: "Kilo kaybı?", kategori: "Sikayet" },
      { key: "DIYABET_OYKU", etiket: "DM öyküsü", aciklama: "Tanı ve ilaçlar", kategori: "Ozgecmis" },
    ],
    beklenenTestler: [
      { key: "GLUKOZ", etiket: "Açlık glukoz", aciklama: "Hiperglisemi" },
      { key: "HBA1C", etiket: "HbA1c", aciklama: "Uzun dönem kontrol" },
      { key: "IDRAR", etiket: "İdrar", aciklama: "Glukozüri / protein" },
    ],
    gereksizTestler: [
      { key: "TROPONIN", etiket: "Troponin", aciklama: "Asemptomatik DM taramasında ilk basamak değil" },
    ],
    redFlagler: [
      { key: "DKA", etiket: "DKA bulguları", aciklama: "Kusma, nefes kokusu, bilinç" },
      { key: "HIPOGLISEMI", etiket: "Hipoglisemi", aciklama: "Titreme, terleme" },
    ],
    idealYol: [
      "1. Glukoz ve HbA1c ile tanı/kontrol değerlendir.",
      "2. Komplikasyon taraması (böbrek, göz, ayak).",
      "3. Yaşam tarzı + metformin temelli tedavi planı.",
    ],
    egitimNotu:
      "T2DM: HbA1c ve açlık glukoz tanı kriterleri. AI-READI diyabet lab pattern referansı. Eğitim iskeleti.",
    anaSikayetStub: "Ağız kuruluğu, poliüri, polidipsi",
    ozetStub: [
      "Poliüri / polidipsi",
      "Halsizlik",
      "Bilinen veya yeni tanı DM olabilir",
    ],
  },
  kbh: {
    beklenenSorular: [
      { key: "ODEM_SURE", etiket: "Ödem süresi", aciklama: "Ne zamandır şişlik?", kategori: "Sikayet" },
      { key: "HTN_OYKUSU", etiket: "Hipertansiyon", aciklama: "HTN öyküsü", kategori: "Ozgecmis" },
      { key: "DIYABET", etiket: "Diyabet", aciklama: "DM öyküsü", kategori: "Ozgecmis" },
      { key: "ILAC_KULLANIM", etiket: "İlaçlar", aciklama: "NSAID, ACEi", kategori: "Ilac" },
    ],
    beklenenTestler: [
      { key: "KREATININ", etiket: "Kreatinin", aciklama: "GFR" },
      { key: "URE", etiket: "Üre", aciklama: "Azotlu atık" },
      { key: "ELEKTROLIT", etiket: "Elektrolit", aciklama: "K+" },
      { key: "IDRAR", etiket: "İdrar", aciklama: "Proteinüri" },
    ],
    gereksizTestler: [
      { key: "BT_TORAKS", etiket: "BT Toraks", aciklama: "İlk basamakta gereksiz" },
    ],
    redFlagler: [
      { key: "HIPERKALEMI", etiket: "Hiperkalemi", aciklama: "EKG / güçsüzlük" },
      { key: "AKI", etiket: "Akut kötüleşme", aciklama: "ABH bulguları" },
    ],
    idealYol: [
      "1. Üre, kreatinin, elektrolit, idrar.",
      "2. GFR ile evrele.",
      "3. KB kontrolü ve nefroprotektif yaklaşım.",
    ],
    egitimNotu: "KBH: 3 aydan uzun GFR düşüklüğü veya yapısal hasar. Eğitim iskeleti.",
    anaSikayetStub: "Ödem ve halsizlik",
    ozetStub: ["Ödem", "HTN/DM komorbiditesi sık", "Proteinüri olabilir"],
  },
  pnomoni: {
    beklenenSorular: [
      { key: "OKSURUK", etiket: "Öksürük", aciklama: "Bal gam?", kategori: "Sikayet" },
      { key: "ATES", etiket: "Ateş", aciklama: "Ne zamandır?", kategori: "Sikayet" },
      { key: "NEFES_DARLIGI", etiket: "Nefes darlığı", aciklama: "Efor kapasitesi", kategori: "Sikayet" },
    ],
    beklenenTestler: [
      { key: "CBC", etiket: "Hemogram", aciklama: "Lökositoz" },
      { key: "CRP", etiket: "CRP", aciklama: "Enflamasyon" },
      { key: "AKCIGER_GRAFISI", etiket: "Akciğer grafisi", aciklama: "İnfiltrasyon" },
    ],
    gereksizTestler: [],
    redFlagler: [
      { key: "SOLUNUM_YETMEZ", etiket: "Solunum yetmezliği", aciklama: "Düşük SpO2" },
      { key: "SEPSIS", etiket: "Sepsis", aciklama: "Hipotansiyon, laktat" },
    ],
    idealYol: [
      "1. Vital + oksijenasyon.",
      "2. PA akciğer + CBC/CRP.",
      "3. Ampirik antibiyotik ve destek.",
    ],
    egitimNotu: "TKP: klinik + radyolojik. Eğitim iskeleti.",
    anaSikayetStub: "Öksürük, ateş, nefes darlığı",
    ozetStub: ["Prodüktif öksürük", "Ateş", "Plöritik ağrı olabilir"],
  },
};

export function getRubricTemplate(hastalikKey: string): DiseaseRubricTemplate {
  return DISEASE_RUBRIC_TEMPLATES[hastalikKey] || DEFAULT_TEMPLATE;
}

export { DEFAULT_CDM_PUANLAMA };
