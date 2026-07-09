import { SynonymSozluk } from "../types";
import { synonymSozluk as kalpSoruSyn, testSynonymSozluk as kalpTestSyn, testKatalogu as kalpKatalog } from "./kalp-001";
import { ekSoruSynonymleri, ekTestSynonymleri, ekTestKatalogu } from "./ek-vakalar";

export const birlesikSoruSynonymleri: SynonymSozluk = {
  ...kalpSoruSyn,
  ...ekSoruSynonymleri,
};

export const birlesikTestSynonymleri: SynonymSozluk = {
  ...kalpTestSyn,
  ...ekTestSynonymleri,
};

export const birlesikTestKatalogu: { key: string; ad: string; kategori: string }[] = [
  ...kalpKatalog,
  ...ekTestKatalogu,
];
