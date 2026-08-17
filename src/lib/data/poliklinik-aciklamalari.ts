/**
 * Poliklinik kısa açıklamaları — tek cümlelik, kullanıcıya gösterilen minik özet.
 * Synthea/MIMIC ETL'leri `poliklinikAciklama` alanına jenerik bir kaynak notu
 * yazdığı için, kullanıcıya dönük doğru metni bu kanonik haritadan çözeriz.
 */

export const POLIKLINIK_ACIKLAMALARI: Record<string, string> = {
  cerrahi: "Akut apandisit, kolesistit ve fıtık gibi cerrahi vakalar",
  dahiliye: "Ayırıcı tanı gerektiren genel iç hastalıkları vakaları",
  dermatoloji: "Cilt döküntüsü ve dermatolojik muayene vakaları",
  endokrin: "Diyabet, tiroid ve metabolik hastalık vakaları",
  enfeksiyon: "İdrar yolu enfeksiyonu ve enfeksiyöz hastalık vakaları",
  "kadin-dogum": "Gebelik, preeklampsi ve jinekolojik aciller",
  kardiyoloji: "Göğüs ağrısı, çarpıntı ve kalp yetmezliği vakaları",
  kbb: "Sinüzit, farenjit ve orta kulak enfeksiyonu vakaları",
  nefroloji: "Böbrek hastalıkları ve elektrolit bozuklukları",
  noroloji: "İnme, epilepsi ve nörolojik aciller",
  onkoloji: "Meme, akciğer ve gastrointestinal kanserler",
  ortopedi: "Kırık, burkulma ve kas-iskelet yaralanmaları",
  romatoloji: "Romatizmal ve otoimmün eklem hastalıkları",
  solunum: "Pnömoni, astım ve KOAH vakaları",
};

/** Poliklinik açıklamasını çözer; kaynak değere ve jenerik metne düşer. */
export function poliklinikAciklama(key: string, fallback?: string | null): string {
  return POLIKLINIK_ACIKLAMALARI[key] || fallback || "Klinik vaka simülasyonları";
}
