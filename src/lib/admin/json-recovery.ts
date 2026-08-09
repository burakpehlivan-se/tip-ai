import fs from "fs";
import { logger } from "../logger";

/**
 * Bozuk JSON'u aynı dosya sisteminde atomik olarak karantinaya alır.
 * Böylece fallback sonrası yapılacak ilk yazma, özgün veriyi ezmez.
 */
export function quarantineCorruptJson(file: string, error: unknown, store: string): void {
  const quarantinedFile = `${file}.corrupt-${Date.now()}`;

  try {
    fs.renameSync(file, quarantinedFile);
    logger.exception(`${store} okunamadı; dosya karantinaya alındı`, error, {
      file,
      quarantinedFile,
    });
  } catch (quarantineError) {
    logger.exception(`${store} okunamadı; dosya karantinaya alınamadı`, error, { file });
    logger.exception(`${store} için karantina işlemi başarısız`, quarantineError, {
      file,
      quarantinedFile,
    });
  }
}
