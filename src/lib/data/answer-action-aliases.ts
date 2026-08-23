/**
 * Aynı klinik bilgiyi taşıyan eski aksiyon çiftlerini tek soruda toplar.
 * Eski istekler alias ile gelse de hasta yanıtı kanonik anahtardan okunur.
 */
const ACTION_ALIASES: Record<string, string> = {
  SIGARA_OYKUSU: "SIGARA",
  ILAC_OYKUSU: "ILAC",
  DIYABET_OYKUSU: "DIYABET",
};

export function kanonikHastaAksiyonu(action: string): string {
  return ACTION_ALIASES[action] || action;
}

function negatifMi(value: string): boolean {
  return /\byok\b|içmiyorum|icmiyorum|kullanmıyorum|kullanmiyorum|almıyorum|almiyorum|bilinmiyor/i.test(value);
}

/**
 * Detaylı alias cevabı ile genel cevap çelişiyorsa, pozitif/detaylı olanı
 * kanonik anahtara taşır. Alias anahtarları çıktıdan çıkarılır; böylece aynı
 * gerçeğe iki farklı chip veya iki çelişkili yanıt kalmaz.
 */
export function kanonikHastaYanitlari(yanitlar: Record<string, string>): Record<string, string> {
  const result = { ...yanitlar };
  for (const [alias, canonical] of Object.entries(ACTION_ALIASES)) {
    const aliasAnswer = result[alias]?.trim();
    const canonicalAnswer = result[canonical]?.trim();
    if (aliasAnswer && (!canonicalAnswer || (negatifMi(canonicalAnswer) && !negatifMi(aliasAnswer)))) {
      result[canonical] = aliasAnswer;
    }
    delete result[alias];
  }
  return result;
}
