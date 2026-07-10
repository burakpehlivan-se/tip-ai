import { AdminVaka } from "./types";
import { poliklinikler } from "../data/case-generator";
import { Hasta } from "../types";

function dummyHasta(): Hasta {
  return {
    ad: "Seed",
    tamAd: "Seed Hasta",
    tc: "10000000146",
    yas: 50,
    cinsiyet: "E",
    anaSikayet: "",
    ozetBilgiler: [],
  };
}

/** Kod içi şablonlardan serializable admin vaka listesi üretir */
export function seedCasesFromTemplates(): AdminVaka[] {
  const now = Date.now();
  const out: AdminVaka[] = [];
  const h = dummyHasta();

  for (const p of poliklinikler) {
    for (const s of p.hastalikSablonlari) {
      let anaSikayet = "";
      let ozetBilgiler: string[] = [];
      let semptomSablon = "";
      try {
        anaSikayet = s.anaSikayetSablonu(h);
      } catch {
        anaSikayet = s.hastalikAdi;
      }
      try {
        ozetBilgiler = s.ozetBilgilerSablonu(h);
      } catch {
        ozetBilgiler = [];
      }
      try {
        semptomSablon = s.semptomSablonu(h);
      } catch {
        semptomSablon = s.hastalikAdi;
      }

      let statikTestler = {};
      let hastaYanitlari = {};
      try {
        statikTestler = s.statikTestler();
      } catch {
        statikTestler = {};
      }
      try {
        hastaYanitlari = s.hastaYanitlari();
      } catch {
        hastaYanitlari = {};
      }

      const id = `${p.key}::${s.hastalikKey}`;
      out.push({
        id,
        poliklinikKey: p.key,
        poliklinikAd: p.ad,
        poliklinikIcon: p.icon,
        poliklinikAciklama: p.aciklama,
        hastalikKey: s.hastalikKey,
        hastalikAdi: s.hastalikAdi,
        seviye: s.seviye,
        yasAraligi: s.yasAraligi,
        cinsiyetTercih: s.cinsiyetTercih,
        anaSikayet,
        ozetBilgiler,
        semptomSablon,
        rubric: s.rubric,
        statikTestler,
        hastaYanitlari,
        idealYol: s.idealYol || [],
        egitimNotu: s.egitimNotu || "",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return out;
}
