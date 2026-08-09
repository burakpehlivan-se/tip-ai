export {
  birlesikTestKatalogu,
  MOTOR_CAPABLE_KEYS,
  TEST_VISIBILITY_MAP,
  testCatalogueWithMeta,
} from "./test-catalogue";
export type { TestCatalogItem } from "./test-catalogue";
export { birlesikSoruSynonymleri, birlesikTestSynonymleri } from "./synonyms";

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
