/** API mutation gövdeleri için uygulama genelindeki üst sınır (1 MiB). */
export const MAX_API_MUTATION_BODY_BYTES = 1024 * 1024;

/**
 * Content-Length yalnızca geçerli, negatif olmayan tam sayıysa güvenilir bir
 * erken reddetme sinyalidir. Chunked istekler Next.js proxy tampon limiti ve
 * route seviyesindeki JSON ayrıştırma tarafından ayrıca sınırlandırılır.
 */
export function exceedsApiMutationBodyLimit(
  contentLength: string | null,
  limit = MAX_API_MUTATION_BODY_BYTES
): boolean {
  if (!contentLength || !/^\d+$/.test(contentLength)) return false;
  return Number(contentLength) > limit;
}
