import { AdminVaka } from "./types";
import { Vaka, Hasta, Cinsiyet } from "../types";
import { birlestirTestler, buildClinicalProfile } from "../data/lab-katalog";
import { enrichHastaYanitlari } from "../data/hasta-yanit-enrich";
import { CHIP_HAVUZU } from "../data/case-generator";

function rastgeleInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ERKEK = ["Ahmet", "Mehmet", "Ali", "Mustafa", "Hüseyin"];
const KADIN = ["Ayşe", "Fatma", "Zeynep", "Elif", "Merve"];
const SOY = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin"];

/** Admin deposundaki vaka şablonundan oynanabilir Vaka üretir */
export function adminVakaToPlayable(av: AdminVaka): Vaka {
  const cinsiyet: Cinsiyet =
    av.cinsiyetTercih === "E"
      ? "E"
      : av.cinsiyetTercih === "K"
        ? "K"
        : Math.random() > 0.5
          ? "E"
          : "K";
  const yas = rastgeleInt(av.yasAraligi[0], av.yasAraligi[1]);
  const ad = `${cinsiyet === "E" ? ERKEK[rastgeleInt(0, ERKEK.length - 1)] : KADIN[rastgeleInt(0, KADIN.length - 1)]} ${SOY[rastgeleInt(0, SOY.length - 1)]}`;
  const tc = String(10000000000 + rastgeleInt(100000000, 899999999));
  const episodeZamani = Date.now();
  const vakaId = `admin-play-${av.id}-${episodeZamani}`;

  const hasta: Hasta = {
    ad,
    tamAd: ad,
    tc,
    yas,
    cinsiyet,
    anaSikayet: av.anaSikayet,
    ozetBilgiler: av.ozetBilgiler || [],
  };

  const taniListesi = [
    ...(av.rubric?.kabulEdilenTani || []),
    ...(av.conditions || []).map((c) => c.ad),
  ];
  const profile = buildClinicalProfile({
    yas,
    cinsiyet,
    hastalikKey: av.hastalikKey,
    taniListesi,
    poliklinikKey: av.poliklinikKey,
    comorbidities: av.patientProfil?.komorbiditeler,
  });
  if (av.patientProfil?.bmi != null) {
    profile.bmi = av.patientProfil.bmi;
  }

  const original = { ...(av.statikTestler || {}), ...(av.generatedTests || {}) };
  const statikTestler = birlestirTestler(original, profile, {
    patientId: tc,
    episodeId: vakaId,
    measuredAt: episodeZamani,
  });

  const relevantAksiyonlar = [
    ...(av.rubric?.beklenenSorular || []).map((s) => s.key),
    ...(av.rubric?.redFlagler || []).map((r) => r.key),
    ...(av.rubric?.beklenenTestler || []).map((t) => t.key),
  ];

  // CDM vitals → ozetBilgiler / yanıt zenginleştirme
  const ozet = [...(av.ozetBilgiler || [])];
  if (av.vitals?.tansiyon && !ozet.some((x) => /tansiyon|kb/i.test(x))) {
    ozet.push(`KB: ${av.vitals.tansiyon}`);
  }
  if (av.patientProfil?.komorbiditeler?.length) {
    const kom = `Komorbidite: ${av.patientProfil.komorbiditeler.join(", ")}`;
    if (!ozet.includes(kom)) ozet.push(kom);
  }
  hasta.ozetBilgiler = ozet;

  const tedavi = av.tedavi
    ? {
        aciklama: av.tedavi.aciklama || av.egitimNotu || "",
        ilaclar: (av.tedavi.ilaclar || []).map((i) => ({
          ad: i.ad,
          doz: i.doz,
          yol: i.yol,
          endikasyon: i.endikasyon,
        })),
        prosedurler: av.tedavi.prosedurler || [],
        notlar: av.tedavi.onemliNotlar || [],
        kaynak: av.cdmVersion || "admin",
      }
    : undefined;

  return {
    id: vakaId,
    semptom: av.semptomSablon || av.hastalikAdi,
    hastalik: av.hastalikKey,
    alan: av.poliklinikAd,
    seviye: av.seviye,
    hasta,
    profile,
    episodeZamani,
    beklenenTani: av.rubric?.kabulEdilenTani || [],
    rubric: av.rubric,
    statikTestler,
    hastaYanitlari: enrichHastaYanitlari(av.hastaYanitlari || {}, {
      chipHavuzu: CHIP_HAVUZU,
      anaSikayet: av.anaSikayet,
      semptom: av.semptomSablon,
    }),
    soruChipleri: [...CHIP_HAVUZU],
    relevantAksiyonlar,
    idealYol: av.idealYol,
    egitimNotu: av.egitimNotu,
    tedavi,
    kaynaklar: [
      `Admin play · ${av.id}`,
      `Durum: ${av.durum} · Sürüm: v${av.surum}`,
      av.cdmVersion ? `CDM: ${av.cdmVersion}` : "CDM: legacy-flat",
    ],
  };
}
