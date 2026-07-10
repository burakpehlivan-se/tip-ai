import { SynonymSozluk } from "../types";
import { synonymSozluk as kalpSoruSyn, testSynonymSozluk as kalpTestSyn, testKatalogu as kalpKatalog } from "./kalp-001";
import { ekSoruSynonymleri, ekTestSynonymleri, ekTestKatalogu } from "./ek-vakalar";
import { labKatalogListesi } from "./lab-katalog";

export const birlesikSoruSynonymleri: SynonymSozluk = {
  ...kalpSoruSyn,
  ...ekSoruSynonymleri,
};

export const birlesikTestSynonymleri: SynonymSozluk = {
  ...kalpTestSyn,
  ...ekTestSynonymleri,
  // Lab KB ek test synonymleri
  ast: "AST",
  "sgot": "AST",
  "ast bak": "AST",
  alt: "ALT",
  "sgpt": "ALT",
  "alt bak": "ALT",
  "karaciğer enzim": "KARACIGER_ENZIM",
  "karaciger enzim": "KARACIGER_ENZIM",
  "kc enzim": "KARACIGER_ENZIM",
  "karaciğer paneli": "KARACIGER_ENZIM",
  "bt batın": "BT_ABDOMEN",
  "bt abdomen": "BT_ABDOMEN",
  "batın bt": "BT_ABDOMEN",
  "abdomen bt": "BT_ABDOMEN",
  "pelvik usg": "PELVIK_USG",
  "pelvis usg": "PELVIK_USG",
  "bt kraniyal": "BT_KRANIYAL",
  "beyin bt": "BT_KRANIYAL",
  "kafa bt": "BT_KRANIYAL",
  "usg abdomen": "USG_ABDOMEN",
  "batın usg": "USG_ABDOMEN",
  "göz basıncı": "GOZ_BASINCI",
  "goz basinci": "GOZ_BASINCI",
  "göz tansiyonu": "GOZ_BASINCI",
  "ck": "KREATININ_KINAZ",
  "kreatin kinaz": "KREATININ_KINAZ",
  "bhcg": "BHCG",
  "beta hcg": "BHCG",
  "beta-hcg": "BHCG",
  "gebelik testi": "BHCG",
  "d-dimer": "D_DIMER",
  "d dimer": "D_DIMER",
  ddimer: "D_DIMER",
  pt: "PT",
  inr: "PT",
  "protrombin": "PT",
  aptt: "PTT",
  ptt: "PTT",
};

function katalogBirlestir(
  ...listeler: { key: string; ad: string; kategori: string }[][]
): { key: string; ad: string; kategori: string }[] {
  const map = new Map<string, { key: string; ad: string; kategori: string }>();
  for (const liste of listeler) {
    for (const item of liste) {
      if (!map.has(item.key)) map.set(item.key, item);
    }
  }
  return Array.from(map.values());
}

const ekEksikTestKatalogu: { key: string; ad: string; kategori: string }[] = [
  { key: "KARACIGER_ENZIM", ad: "Karaciğer Enzimleri (AST/ALT)", kategori: "Laboratuvar" },
  { key: "BT_ABDOMEN", ad: "BT Batın", kategori: "Radyoloji" },
  { key: "PELVIK_USG", ad: "Pelvik USG", kategori: "Radyoloji" },
  { key: "BT_KRANIYAL", ad: "BT Kraniyal", kategori: "Radyoloji" },
  { key: "USG_ABDOMEN", ad: "Batın USG", kategori: "Radyoloji" },
  { key: "GOZ_BASINCI", ad: "Göz İçi Basıncı", kategori: "Göz" },
  { key: "KREATININ_KINAZ", ad: "CK (Kreatin Kinaz)", kategori: "Laboratuvar" },
  { key: "BHCG", ad: "Beta-hCG", kategori: "Laboratuvar" },
];

export const birlesikTestKatalogu: { key: string; ad: string; kategori: string }[] =
  katalogBirlestir(kalpKatalog, ekTestKatalogu, labKatalogListesi(), ekEksikTestKatalogu);

// Soru synonym extra merge
Object.assign(birlesikSoruSynonymleri, {
  "aile öyküsü": "AILE_OYKUSU",
  "aile oykusu": "AILE_OYKUSU",
  "ailede hastalık": "AILE_OYKUSU",
  "ilaç öyküsü": "ILAC_OYKUSU",
  "ilac oykusu": "ILAC_OYKUSU",
  "çarpıntı": "CARPINTI_OYKU",
  "carpinti": "CARPINTI_OYKU",
  "uyuşma": "UYUSMA",
  "uyusma": "UYUSMA",
  "yanma hissi": "YANMA",
  "gece artıyor": "GECE_ARTIS",
  "yara var mı": "YARA",
  "dizüri": "DIZURI",
  "dizuri": "DIZURI",
  "pollaküri": "POLLAKURI",
  "pollakuri": "POLLAKURI",
  "idrar rengi": "IDRAR_RENK",
  "ortopne": "ORTOPNE",
  "düz yatınca nefes": "ORTOPNE",
  "kemik ağrısı": "KEMIK_AGRISI",
});

export {
  generateNormalLabs,
  birlestirTestler,
  buildClinicalProfile,
  LAB_TEST_DEFINITIONS,
  patolojiTestAnahtarlari,
} from "./lab-katalog";

export {
  LAB_KAYNAKLARI,
  LAB_FUSION_POLITIKA,
  labKaynakSatirlari,
  labKaynakById,
} from "./lab-kaynaklari";
export type { LabKaynak, LabKaynakDurum } from "./lab-kaynaklari";