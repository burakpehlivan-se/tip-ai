import { TipAiCdmDocument, TIP_AI_CDM_VERSION } from "./types";

/** TIP-AI CDM v1 örnek: Kronik Böbrek Hastalığı (yazar şablonu) */
export const EXAMPLE_CDM_KBH: TipAiCdmDocument = {
  cdmVersion: TIP_AI_CDM_VERSION,
  id: "nefroloji::kronik-bobrek-hastaligi",
  meta: {
    poliklinikKey: "nefroloji",
    poliklinikAd: "Nefroloji",
    poliklinikIcon: "🫘",
    poliklinikAciklama: "Böbrek hastalıkları",
    hastalikKey: "kronik-bobrek-hastaligi",
    hastalikAdi: "Kronik Böbrek Hastalığı (KBH)",
    seviye: "orta",
    durum: "aktif",
    etiketler: ["Poliklinik", "Orta seviye"],
    surum: 1,
    uzmanOnayi: false,
  },
  patient: {
    yasAraligi: [45, 70],
    cinsiyetTercih: "herhangi",
    profil: {
      bmi: 28,
      sigara: "Eski içici",
      komorbiditeler: ["HTN", "T2DM"],
    },
  },
  presentation: {
    anaSikayet: "Yüz ve bacaklarda şişlik, köpüklü idrar",
    ozetBilgiler: [
      "1 haftadır yüzde ve bacaklarda şişlik",
      "Bacaklarda gode bırakan ödem",
      "İdrar köpüklü",
      "Kilo artışı (sıvıdan)",
    ],
    semptomSablon: "{{yas}} yaş {{cinsiyet}}, yüzde ve bacaklarda şişlik, köpüklü idrar",
  },
  conditions: [
    { code: "CKD_G3", ad: "Kronik Böbrek Hastalığı Evre 3", system: "local", primary: true },
    { code: "HTN", ad: "Esansiyel Hipertansiyon", system: "local" },
    { code: "T2DM", ad: "Tip 2 Diabetes Mellitus", system: "local" },
  ],
  rubric: {
    beklenenSorular: [
      {
        key: "ODEM_SURE",
        kategori: "Sikayet",
        etiket: "Ödem süresi",
        aciklama: "Ne zamandır şişlik var?",
      },
      {
        key: "IDRAR_KOPUK",
        kategori: "Sikayet",
        etiket: "Köpüklü idrar",
        aciklama: "İdrarınız köpüklü mü?",
      },
      {
        key: "HTN_OYKUSU",
        kategori: "Ozgecmis",
        etiket: "Hipertansiyon",
        aciklama: "HTN öyküsü",
      },
      {
        key: "DIYABET",
        kategori: "Ozgecmis",
        etiket: "Diyabet",
        aciklama: "DM öyküsü",
      },
      {
        key: "ILAC_KULLANIM",
        kategori: "Ilac",
        etiket: "İlaçlar",
        aciklama: "ACEi, NSAID vb.",
      },
    ],
    beklenenTestler: [
      { key: "KREATININ", etiket: "Serum kreatinin", aciklama: "Böbrek fonksiyonu" },
      { key: "URE", etiket: "Kan üre", aciklama: "Azotlu atık" },
      { key: "ELEKTROLIT", etiket: "Na/K", aciklama: "Elektrolitler" },
      { key: "IDRAR", etiket: "Tam idrar tetkiki", aciklama: "Proteinüri" },
    ],
    gereksizTestler: [
      { key: "BT_TORAKS", etiket: "BT Toraks", aciklama: "İlk basamakta gereksiz" },
    ],
    redFlagler: [
      {
        key: "HIPERKALEMI",
        etiket: "Hiperkalemi bulguları",
        aciklama: "EKG değişikliği, kas güçsüzlüğü",
      },
      {
        key: "AKI",
        etiket: "Akut kötüleşme",
        aciklama: "Akut böbrek hasarı bulguları",
      },
    ],
    kabulEdilenTani: [
      "Kronik Böbrek Hastalığı",
      "KBH Evre 3",
      "KBH Evre 4",
    ],
  },
  labs: {
    statikTestler: {
      KREATININ: {
        testKey: "KREATININ",
        testAdi: "Serum kreatinin",
        tip: "numeric",
        sonuc: { deger: 2.1, birim: "mg/dL", referansAralik: "0.6-1.2" },
        referans: "Lab",
        yorum: "Yüksek — KBH ile uyumlu.",
        flag: "high",
      },
      URE: {
        testKey: "URE",
        testAdi: "Kan Üre",
        tip: "numeric",
        sonuc: { deger: 65, birim: "mg/dL", referansAralik: "10-50" },
        referans: "Lab",
        yorum: "Yüksek — renal fonksiyon bozukluğu.",
        flag: "high",
      },
      ELEKTROLIT: {
        testKey: "ELEKTROLIT",
        testAdi: "Elektrolitler",
        tip: "json",
        sonuc: { sodyum: "138 mmol/L", potasyum: "5.4 mmol/L" },
        referans: "Lab",
        yorum: "Sodyum normal, potasyum hafif yüksek.",
        flag: "abnormal",
      },
      IDRAR: {
        testKey: "IDRAR",
        testAdi: "Tam idrar tetkiki",
        tip: "json",
        sonuc: { protein: "3+", eritrosit: "1-2 /hpf" },
        referans: "Lab",
        yorum: "Ağır proteinüri.",
        flag: "abnormal",
      },
      CBC: {
        testKey: "CBC",
        testAdi: "Hemogram",
        tip: "json",
        sonuc: { hemoglobin: "10.5 g/dL", lokosit: "7.8 K/uL" },
        referans: "Lab",
        yorum: "Hafif anemi, lökosit normal.",
        flag: "abnormal",
      },
    },
  },
  vitals: {
    tansiyon: "150/95",
    nabiz: 92,
    ates: 36.7,
    spo2: 96,
  },
  hastaYanitlari: {
    ODEM_SURE: "Yaklaşık 1 haftadır",
    IDRAR_KOPUK: "Evet, son günlerde daha köpüklü",
    HTN_OYKUSU: "10 yıldır hipertansiyonum var",
    DIYABET: "5 yıldır tip 2 diyabetim var",
    ILAC_KULLANIM: "Amlodipin ve metformin kullanıyorum",
    VITAL_TANSIYON: "150/95",
    VITAL_NABIZ: "92",
    VITAL_ATES: "36.7",
    VITAL_SPO2: "96",
    OZEL: "Anlamadım",
  },
  management: {
    idealYol: [
      "1. Ödem ve proteinüri ile gelen hastada böbrek fonksiyon testlerini (üre, kreatinin, elektrolitler) iste.",
      "2. Tam idrar tetkiki ile proteinüriyi doğrula.",
      "3. KBH evresini GFR üzerinden değerlendir.",
      "4. Kan basıncını kontrol altına al, RAAS blokajını değerlendir.",
      "5. Nefroloji takibine al, diyet ve yaşam tarzı önerilerini ver.",
    ],
    egitimNotu:
      "KBH: 3 aydan uzun süren GFR <60 ml/dk veya yapısal böbrek hasarı. Proteinüri, kreatinin yüksekliği ve hipertansiyon sık görülür. Tedavi: kan basıncını hedefle, RAAS blokajı, diyabet kontrolü, nefrolojik takip.",
    tedavi: {
      ilaclar: [
        {
          ad: "ACE inhibitörü (ör. Ramipril)",
          doz: "5 mg/gün",
          yol: "PO",
          endikasyon: "Proteinürili KBH ve HTN",
        },
        {
          ad: "Loop diüretik (ör. Furosemid)",
          doz: "40 mg/gün",
          yol: "PO",
          endikasyon: "Ödem kontrolü",
        },
      ],
      prosedurler: [
        "Tuz kısıtlaması ve sıvı dengesi eğitimi",
        "Nefroloji polikliniğine düzenli kontrol planı",
      ],
      onemliNotlar: [
        "NSAID kullanımından kaçınılmalı.",
        "Hiperkalemi açısından ACEi/ARB kullanırken elektrolitler düzenli takip edilmeli.",
      ],
    },
  },
};
