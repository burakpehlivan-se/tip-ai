export type WorkspaceFaz = "anamnez" | "test" | "tani" | "tedavi";

export const FAZLAR: Array<{ id: WorkspaceFaz; sira: number; etiket: string; aciklama: string }> = [
  { id: "anamnez", sira: 1, etiket: "Anamnez", aciklama: "Hastanın öyküsünü netleştir" },
  { id: "test", sira: 2, etiket: "Tetkikler", aciklama: "Gerekli tetkikleri seç" },
  { id: "tani", sira: 3, etiket: "Tanı", aciklama: "Klinik değerlendirmeni kaydet" },
  { id: "tedavi", sira: 4, etiket: "Tedavi", aciklama: "Planını oluştur ve değerlendir" },
];
