/**
 * Hasta yanıtları için son güvenlik katmanı. Model ve şablonlar klinik bağlamı
 * içerir; öğrenciye dönen metin ise gündelik Türkçe kalmalıdır.
 */

const GUNLUK_DIL_DONUSUMLERI: Array<[RegExp, string]> = [
  [/miyokard enfarktüs[üu]/gi, "kalp krizi"],
  [/akut koroner sendrom/gi, "kalple ilgili acil bir sorun"],
  [/koroner arter hastal[ıi]ğ[ıi]/gi, "kalp damarlarında daralma"],
  [/atriyal fibrilasyon/gi, "kalpte ritim düzensizliği"],
  [/hipertansiyon/gi, "yüksek tansiyon"],
  [/hipotansiyon/gi, "düşük tansiyon"],
  [/diabetes mellitus|diyabet/gi, "şeker hastalığı"],
  [/hiperglisemi/gi, "kan şekerinin yüksek olması"],
  [/hipoglisemi/gi, "kan şekerinin düşmesi"],
  [/anemi/gi, "kansızlık"],
  [/dispne/gi, "nefes darlığı"],
  [/sefalji/gi, "baş ağrısı"],
  [/pnömoni/gi, "akciğer enfeksiyonu"],
  [/koah/gi, "uzun süren akciğer rahatsızlığı"],
  [/gastroözofageal reflü|gastroesophageal reflux/gi, "mide asidinin yukarı kaçması"],
  [/ödem/gi, "şişlik"],
  [/dehidratasyon/gi, "susuz kalma"],
  [/lenfadenopati/gi, "bezelerde şişlik"],
  [/hepatosplenomegali/gi, "karındaki organlarda büyüme"],
  [/mukoz[a]?/gi, "ağız içi"],
  [/konjonktiva/gi, "gözün beyaz kısmı"],
  [/sklera/gi, "gözün beyaz kısmı"],
  [/senkop/gi, "bayılma"],
  [/parestezi/gi, "uyuşma veya karıncalanma"],
  [/hematemez/gi, "kanlı kusma"],
  [/melena/gi, "siyah renkli dışkı"],
  [/hematokezya/gi, "makattan taze kan gelmesi"],
  [/hemoptizi/gi, "kanlı balgam"],
  [/polidipsi/gi, "çok susama"],
  [/poliüri|poliuri/gi, "sık idrara çıkma"],
  [/ortopne/gi, "yatınca nefes darlığı"],
  [/taşikardi/gi, "kalbin hızlı çarpması"],
  [/bradikardi/gi, "kalbin yavaş atması"],
  [/SpO2/gi, "oksijen ölçümüm"],
  [/mmHg/gi, "birim"],
];

/** Hasta ağzında kesinlikle görünmemesi gereken yüksek klinik terimler. */
const YUKSEK_TIBBI_TERIMLER = [
  "miyokard", "intrakraniyal", "hepatosplenomegali", "lenfadenopati",
  "dehidratasyon", "siyanoz", "mukoz", "konjonktiva", "sklera",
  "trombo", "metabolik", "anemi", "konjestif", "endikasyon", "etioloji",
];

/** Bilinen teknik sözcükleri günlük dile dönüştürür, kalan yüksek terimleri nötrleştirir. */
export function hastaDilineCevir(metin: string): string {
  let sonuc = metin;
  for (const [aranan, yerine] of GUNLUK_DIL_DONUSUMLERI) sonuc = sonuc.replace(aranan, yerine);
  for (const terim of YUKSEK_TIBBI_TERIMLER) {
    sonuc = sonuc.replace(new RegExp(`\\b${terim}[\\p{L}]*\\b`, "giu"), "sağlık sorunu");
  }
  return sonuc.replace(/\s{2,}/g, " ").trim();
}

export function yuksekTibbiTerimVarMi(metin: string): boolean {
  const normalized = metin.toLocaleLowerCase("tr");
  return YUKSEK_TIBBI_TERIMLER.some((terim) => normalized.includes(terim));
}
