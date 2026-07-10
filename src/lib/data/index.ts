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
  "karaciğer enzim": "AST",
  "karaciger enzim": "AST",
  "kc enzim": "AST",
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

export const birlesikTestKatalogu: { key: string; ad: string; kategori: string }[] =
  katalogBirlestir(kalpKatalog, ekTestKatalogu, labKatalogListesi());

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