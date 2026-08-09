import { LabTestDefinition } from "../types";

/** UI / katalog tanımı — ref aralıkları sadece gösterim; değer üretmez */
export const LAB_TEST_DEFINITIONS: LabTestDefinition[] = [
  { code: "CBC", name: "Hemogram (Tam Kan Sayımı)", unit: "—", kategori: "Laboratuvar", refRangeMale: [13.5, 17.5], refRangeFemale: [12.0, 15.5], tip: "json", sonucSablonu: "cbc" },
  { code: "GLUKOZ", name: "Açlık Kan Şekeri", unit: "mg/dL", kategori: "Endokrin", refRangeMale: [70, 99], refRangeFemale: [70, 99], pathologyDiagnoses: ["tip-2-diyabet", "hipoglisemi", "diyabetik-noropati"], tip: "numeric" },
  { code: "HBA1C", name: "HbA1c (Glikozile Hemoglobin)", unit: "%", kategori: "Endokrin", refRangeMale: [4.0, 5.6], refRangeFemale: [4.0, 5.6], pathologyDiagnoses: ["tip-2-diyabet", "diyabetik-noropati"], tip: "numeric" },
  { code: "KREATININ", name: "Serum Kreatinin", unit: "mg/dL", kategori: "Böbrek", refRangeMale: [0.7, 1.3], refRangeFemale: [0.6, 1.1], pathologyDiagnoses: ["kbh", "abh", "nefrotik-sendrom", "ckd-ev3", "kalp-yetmezligi"], tip: "numeric" },
  { code: "URE", name: "Kan Üre Azotu (BUN)", unit: "mg/dL", kategori: "Böbrek", refRangeMale: [7, 20], refRangeFemale: [7, 20], pathologyDiagnoses: ["kbh", "abh", "ckd-ev3"], tip: "numeric" },
  { code: "ELEKTROLIT", name: "Serum Elektrolitleri (Na/K)", unit: "mmol/L", kategori: "Böbrek", refRangeMale: [135, 145], refRangeFemale: [135, 145], pathologyDiagnoses: ["kbh", "abh", "nefrotik-sendrom", "ckd-ev3"], tip: "json", sonucSablonu: "elektrolit" },
  { code: "AST", name: "AST (SGOT)", unit: "U/L", kategori: "Karaciğer", refRangeMale: [10, 40], refRangeFemale: [10, 35], pathologyDiagnoses: ["hepatit-b"], tip: "numeric" },
  { code: "ALT", name: "ALT (SGPT)", unit: "U/L", kategori: "Karaciğer", refRangeMale: [10, 41], refRangeFemale: [7, 35], pathologyDiagnoses: ["hepatit-b"], tip: "numeric" },
  { code: "TSH", name: "TSH (Tiroid Stimülan Hormon)", unit: "mIU/L", kategori: "Endokrin", refRangeMale: [0.4, 4.0], refRangeFemale: [0.4, 4.0], pathologyDiagnoses: ["hipotiroidi", "hipertiroidi"], tip: "numeric" },
  { code: "T4", name: "Serbest T4", unit: "ng/dL", kategori: "Endokrin", refRangeMale: [0.8, 1.8], refRangeFemale: [0.8, 1.8], pathologyDiagnoses: ["hipotiroidi", "hipertiroidi"], tip: "numeric" },
  { code: "CRP", name: "C-Reaktif Protein (CRP)", unit: "mg/L", kategori: "Enflamasyon", refRangeMale: [0.1, 4.5], refRangeFemale: [0.1, 4.5], pathologyDiagnoses: ["pnomoni", "koah", "tbc", "akut-bronsit", "iye"], tip: "numeric" },
  { code: "TROPONIN", name: "Troponin I", unit: "ng/mL", kategori: "Kardiyak", refRangeMale: [0.0, 0.04], refRangeFemale: [0.0, 0.04], pathologyDiagnoses: ["stemi", "nstemi", "stabil-angina"], tip: "numeric" },
  { code: "BNP", name: "BNP (Beyin Natriüretik Peptid)", unit: "pg/mL", kategori: "Kardiyak", refRangeMale: [5, 90], refRangeFemale: [5, 90], pathologyDiagnoses: ["kalp-yetmezligi"], tip: "numeric" },
  { code: "KOLESTEROL", name: "Lipid Panel", unit: "mg/dL", kategori: "Laboratuvar", refRangeMale: [120, 199], refRangeFemale: [120, 199], pathologyDiagnoses: ["tip-2-diyabet"], tip: "json", sonucSablonu: "lipid" },
  { code: "IDRAR", name: "Tam İdrar Tetkiki", unit: "—", kategori: "Laboratuvar", refRangeMale: [1, 1], refRangeFemale: [1, 1], pathologyDiagnoses: ["tip-2-diyabet", "kbh", "abh", "nefrotik-sendrom", "iye", "ckd-ev3"], tip: "json", sonucSablonu: "idrar" },
  { code: "FERITIN", name: "Ferritin", unit: "ng/mL", kategori: "Hematoloji", refRangeMale: [30, 300], refRangeFemale: [15, 150], pathologyDiagnoses: ["demir-eksikligi-anemisi"], tip: "numeric" },
  { code: "DEMIR", name: "Serum Demir + TDBK", unit: "µg/dL", kategori: "Hematoloji", refRangeMale: [65, 175], refRangeFemale: [50, 170], pathologyDiagnoses: ["demir-eksikligi-anemisi"], tip: "json", sonucSablonu: "text-normal" },
  { code: "D_DIMER", name: "D-Dimer", unit: "ng/mL", kategori: "Hematoloji", refRangeMale: [50, 450], refRangeFemale: [50, 450], tip: "numeric" },
  { code: "PT", name: "PT / INR", unit: "sn", kategori: "Hematoloji", refRangeMale: [11, 13.5], refRangeFemale: [11, 13.5], tip: "json", sonucSablonu: "text-normal" },
  { code: "PTT", name: "aPTT", unit: "sn", kategori: "Hematoloji", refRangeMale: [25, 35], refRangeFemale: [25, 35], pathologyDiagnoses: ["hemofili-a"], tip: "numeric" },
  { code: "ABG", name: "Arteriyel Kan Gazı", unit: "—", kategori: "Solunum", refRangeMale: [7.35, 7.45], refRangeFemale: [7.35, 7.45], pathologyDiagnoses: ["koah", "astim", "pnomoni"], tip: "json", sonucSablonu: "abg" },
];

/** Her vakada mümkün olduğunca dataset’ten doldurulan bazal panel */
export const BAZAL_PANEL: string[] = [
  "CBC", "GLUKOZ", "KREATININ", "URE", "ELEKTROLIT", "AST", "ALT", "CRP",
];

export const EK_PANEL_HAVUZU: string[] = [
  "HBA1C", "KOLESTEROL", "TROPONIN", "BNP", "IDRAR", "FERITIN", "DEMIR", "D_DIMER", "PT", "PTT",
];

/** Katalog ekranları için, dataset havuzunu yüklemeden hafif test özeti. */
export function labKatalogListesi(): { key: string; ad: string; kategori: string }[] {
  return LAB_TEST_DEFINITIONS.map((definition) => ({
    key: definition.code,
    ad: definition.name,
    kategori: definition.kategori,
  }));
}
