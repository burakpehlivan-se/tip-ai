/**
 * Öğrenci ilerleme özeti — analytics.json'daki oturumları kullanıcıya göre filtreler.
 */

import { loadAnalytics } from "@/lib/admin/store";
import { PlaySession } from "@/lib/admin/types";
import { poliklinikGetir } from "@/lib/data/case-generator";

export interface PoliklinikOzet {
  poliklinikKey: string;
  ad: string;
  vakaSayisi: number;
  ortalamaPuanYuzde: number;
  taniDogruSayi: number;
}

export interface StudentProgress {
  username: string;
  toplamVaka: number;
  ortalamaPuanYuzde: number;
  taniDogruOran: number;
  toplamAtlananRedFlag: number;
  poliklinikler: PoliklinikOzet[];
  son20: PlaySession[];
}

export interface UserSessionStats {
  vakaSayisi: number;
  ortalamaPuanYuzde: number;
  taniDogruSayi: number;
}

/** Tüm kullanıcıların (actor bazında) oturum istatistikleri — admin paneli için */
export function getSessionStatsByActor(): Record<string, UserSessionStats> {
  const acc = new Map<string, { vakaSayisi: number; puanToplami: number; taniDogruSayi: number }>();
  for (const s of loadAnalytics().sessions) {
    const key = s.actor.toLowerCase();
    const row = acc.get(key) || { vakaSayisi: 0, puanToplami: 0, taniDogruSayi: 0 };
    row.vakaSayisi += 1;
    if (s.maxPuan > 0) row.puanToplami += (s.toplamPuan / s.maxPuan) * 100;
    if (s.taniDogru) row.taniDogruSayi += 1;
    acc.set(key, row);
  }
  const out: Record<string, UserSessionStats> = {};
  acc.forEach((row, key) => {
    out[key] = {
      vakaSayisi: row.vakaSayisi,
      ortalamaPuanYuzde: row.vakaSayisi > 0 ? Math.round(row.puanToplami / row.vakaSayisi) : 0,
      taniDogruSayi: row.taniDogruSayi,
    };
  });
  return out;
}

export function getStudentProgress(username: string): StudentProgress {
  const sessions = loadAnalytics().sessions.filter(
    (s) => s.mode === "ogrenci" && s.actor.toLowerCase() === username.toLowerCase()
  );

  const puanYuzdeleri = sessions
    .filter((s) => s.maxPuan > 0)
    .map((s) => (s.toplamPuan / s.maxPuan) * 100);
  const taniDogruSayi = sessions.filter((s) => s.taniDogru).length;

  const poliklinikMap = new Map<string, { toplam: number; puanToplami: number; taniDogru: number }>();
  for (const s of sessions) {
    const row = poliklinikMap.get(s.poliklinikKey) || { toplam: 0, puanToplami: 0, taniDogru: 0 };
    row.toplam += 1;
    if (s.maxPuan > 0) row.puanToplami += (s.toplamPuan / s.maxPuan) * 100;
    if (s.taniDogru) row.taniDogru += 1;
    poliklinikMap.set(s.poliklinikKey, row);
  }

  const poliklinikler: PoliklinikOzet[] = Array.from(poliklinikMap.entries())
    .map(([key, row]) => ({
      poliklinikKey: key,
      ad: poliklinikGetir(key)?.ad || key,
      vakaSayisi: row.toplam,
      ortalamaPuanYuzde: row.toplam > 0 ? Math.round(row.puanToplami / row.toplam) : 0,
      taniDogruSayi: row.taniDogru,
    }))
    .sort((a, b) => b.vakaSayisi - a.vakaSayisi);

  return {
    username,
    toplamVaka: sessions.length,
    ortalamaPuanYuzde:
      puanYuzdeleri.length > 0
        ? Math.round(puanYuzdeleri.reduce((a, b) => a + b, 0) / puanYuzdeleri.length)
        : 0,
    taniDogruOran:
      sessions.length > 0 ? Math.round((taniDogruSayi / sessions.length) * 100) : 0,
    toplamAtlananRedFlag: sessions.reduce((acc, s) => acc + (s.atlananRedFlagler?.length || 0), 0),
    poliklinikler,
    son20: sessions.slice(0, 20),
  };
}
