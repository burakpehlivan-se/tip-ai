/**
 * Synthea ilaç adı yerelleştirme — RxNorm kodu → Türkçe jenerik ad.
 * Sık kullanılan ilaçlar için küratörlü harita; bilinmeyen kodlar için kaynak
 * (İngilizce) açıklama olduğu gibi korunur.
 */

export const RX_NORM_TO_TURKISH: Record<string, string> = {
  // Kardiyovasküler
  "314076": "Lisinopril",
  "314077": "Lisinopril",
  "308136": "Amlodipin",
  "310798": "Hidroklorotiyazid",
  "200033": "Karvedilol",
  "866412": "Metoprolol",
  "897685": "Verapamil",
  "197604": "Digoksin",
  "705129": "Nitrogliserin",
  "314231": "Simvastatin",
  "312961": "Simvastatin",
  "309362": "Klopidogrel",
  "855332": "Varfarin",
  "313988": "Furosemid",
  "1719286": "Furosemid",
  "979492": "Losartan",
  // Endokrin / metabolik
  "860975": "Metformin",
  "106892": "İnsülin (NPH + regüler)",
  "904419": "Alendronik asit",
  // Analjezik / antienflamatuar
  "209387": "Parasetamol",
  "313782": "Parasetamol",
  "198440": "Parasetamol",
  "313820": "Parasetamol",
  "1049625": "Parasetamol + Oksikodon",
  "856987": "Parasetamol + Hidrokodon",
  "857005": "Parasetamol + Hidrokodon",
  "993770": "Parasetamol + Kodein",
  "206905": "İbuprofen",
  "198405": "İbuprofen",
  "310965": "İbuprofen",
  "849574": "Naproksen",
  "835603": "Tramadol",
  "1049504": "Oksikodon",
  "1860491": "Hidrokodon",
  "245134": "Fentanil",
  // Antibiyotikler
  "562251": "Amoksisilin + Klavulanat",
  "308192": "Amoksisilin",
  "834061": "Penisilin V",
  // Solunum
  "630208": "Salbutamol (inhalasyon)",
  "245314": "Salbutamol (inhalasyon)",
  "896209": "Flutikazon + Salmeterol",
  "896001": "Flutikazon",
  "351109": "Budesonid",
  // Antikoagülasyon
  "854235": "Enoksaparin",
  "854252": "Enoksaparin",
  // Diğer
  "205923": "Epoetin alfa",
  "1535362": "Sodyum florür (diş jeli)",
  "313521": "Tropikamid (göz damlası)",
  "1664463": "Takrolimus",
  "108515": "Takrolimus",
  "1870230": "Epinefrin (adrenalin oto-enjektör)",
  "389221": "Etonogestrel implant",
  "1000126": "Medroksiprogesteron",
  "748962": "Noretindron (doğum kontrolü)",
  "757594": "Noretindron (doğum kontrolü)",
};

/** RxNorm kodu biliniyorsa Türkçe jenerik ad; değilse kaynak açıklama. */
export function localizeMedicationName(
  code: string | null | undefined,
  description: string | null | undefined
): string {
  if (code) {
    const localized = RX_NORM_TO_TURKISH[String(code).trim()];
    if (localized) return localized;
  }
  return (description && description.trim()) || "İlaç";
}
