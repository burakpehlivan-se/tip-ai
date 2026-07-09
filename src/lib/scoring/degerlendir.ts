import { Vaka, DegerlendirmeSonuc, AnamnezAnalizi, ChipKategorisi } from "../types";
import { CHIP_KATEGORI_ETIKETLERI } from "../data/case-generator";

export function degerlendir(
  vaka: Vaka,
  sorulanAksiyonlar: string[],
  istenenTestler: string[],
  taniGirildi: string
): DegerlendirmeSonuc {
  const { rubric } = vaka;
  const p = rubric.puanlama;

  const dogruSorular: string[] = [];
  const eksikSorular: string[] = [];
  const dogruTestler: string[] = [];
  const eksikTestler: string[] = [];
  const gereksizTestler: string[] = [];
  const atlananRedFlagler: string[] = [];
  const gucluYonler: string[] = [];
  const zayifYonler: string[] = [];

  let puan = 0;
  let maxPuan = 0;

  // Beklenen sorular
  for (const soru of rubric.beklenenSorular) {
    maxPuan += p.dogru_kritik_soru;
    if (sorulanAksiyonlar.includes(soru.key)) {
      puan += p.dogru_kritik_soru;
      dogruSorular.push(soru.etiket);
    } else {
      eksikSorular.push(soru.etiket);
    }
  }

  // Red flag'ler
  for (const rf of rubric.redFlagler) {
    maxPuan += p.dogru_kritik_soru;
    if (sorulanAksiyonlar.includes(rf.key)) {
      puan += p.dogru_kritik_soru;
      dogruSorular.push(rf.etiket);
    } else {
      puan += p.red_flag_atlama;
      atlananRedFlagler.push(rf.etiket);
      zayifYonler.push(`Kritik red flag atlandı: ${rf.etiket}`);
    }
  }

  // Beklenen testler
  for (const test of rubric.beklenenTestler) {
    maxPuan += p.dogru_test;
    if (istenenTestler.includes(test.key)) {
      puan += p.dogru_test;
      dogruTestler.push(test.etiket);
    } else {
      eksikTestler.push(test.etiket);
      zayifYonler.push(`Gerekli test istenmedi: ${test.etiket}`);
    }
  }

  // Gereksiz testler
  for (const test of rubric.gereksizTestler) {
    if (istenenTestler.includes(test.key)) {
      puan += p.gereksiz_test;
      gereksizTestler.push(test.etiket);
      zayifYonler.push(`Gereksiz/erken test istendi: ${test.etiket}`);
    }
  }

  // Tanı
  maxPuan += p.tani_dogru;
  const taniDogru = rubric.kabulEdilenTani.some((t) =>
    taniGirildi.toLowerCase().includes(t.toLowerCase())
  );
  if (taniDogru) {
    puan += p.tani_dogru;
    gucluYonler.push("Doğru tanı koyuldu");
  } else {
    puan += p.tani_yanlis;
    zayifYonler.push(`Tanı yanlış veya eksik. Kabul edilen: ${rubric.kabulEdilenTani.join(", ")}`);
  }

  // Güçlü yönler
  if (dogruSorular.length >= 4) {
    gucluYonler.push("Anamnez sorularının çoğunu sordu");
  }
  if (dogruTestler.length === rubric.beklenenTestler.length) {
    gucluYonler.push("Tüm gerekli testleri istedi");
  }
  if (atlananRedFlagler.length === 0) {
    gucluYonler.push("Tüm red flag'leri sorguladı");
  }
  if (gereksizTestler.length === 0) {
    gucluYonler.push("Gereksiz test istemedi");
  }

  // ─── Anamnez Analizi ───
  const anamnezAnalizi = hesaplaAnamnezAnalizi(vaka, sorulanAksiyonlar);

  // İdeal yol
  const idealYol: string[] = vaka.idealYol || [
    "1. Anamnez ve red flag sorgulama",
    "2. Vital bulgular",
    "3. Gerekli testler",
    "4. Tanı ve tedavi",
  ];

  const egitimNotu = vaka.egitimNotu || "Bu vaka için eğitim notu mevcut değil.";

  const toplamPuan = Math.max(0, Math.round(puan));

  return {
    toplamPuan,
    maxPuan,
    dogruSorular,
    eksikSorular,
    dogruTestler,
    eksikTestler,
    gereksizTestler,
    atlananRedFlagler,
    taniDogru,
    taniGirildi,
    gucluYonler,
    zayifYonler,
    idealYol,
    egitimNotu,
    tedavi: vaka.tedavi,
    anamnezAnalizi,
  };
}

function hesaplaAnamnezAnalizi(
  vaka: Vaka,
  sorulanAksiyonlar: string[]
): AnamnezAnalizi {
  const kategoriler: ChipKategorisi[] = [
    "anamnez-agri",
    "anamnez-sistemik",
    "anamnez-oyku",
    "soygecmis",
    "vital",
    "fizik",
    "red-flag",
  ];

  const kategoriBazinda = kategoriler.map((kat) => {
    const katChips = (vaka.soruChipleri).filter((c) => c.kategori === kat);
    const relevantChips = katChips.filter((c) =>
      vaka.relevantAksiyonlar.includes(c.aksiyon)
    );
    const sorulduCount = relevantChips.filter((c) =>
      sorulanAksiyonlar.includes(c.aksiyon)
    ).length;
    const beklenen = relevantChips.length;
    const eksik = relevantChips
      .filter((c) => !sorulanAksiyonlar.includes(c.aksiyon))
      .map((c) => c.etiket);

    return {
      kategori: kat,
      etiket: CHIP_KATEGORI_ETIKETLERI[kat],
      soruldu: sorulduCount,
      beklenen,
      eksik,
    };
  });

  const toplamSoruldu = kategoriBazinda.reduce((s, k) => s + k.soruldu, 0);
  const toplamBeklenen = kategoriBazinda.reduce((s, k) => s + k.beklenen, 0);
  const tumKategorilerSoruldu = kategoriBazinda.every((k) => k.beklenen === 0 || k.soruldu === k.beklenen);

  let enCokEksikKategori: string | null = null;
  let maxEksik = 0;
  let enIyiKategori: string | null = null;
  let maxOran = 0;

  for (const k of kategoriBazinda) {
    if (k.beklenen > 0) {
      const eksikSayi = k.beklenen - k.soruldu;
      if (eksikSayi > maxEksik) {
        maxEksik = eksikSayi;
        enCokEksikKategori = k.etiket;
      }
      const oran = k.soruldu / k.beklenen;
      if (oran > maxOran) {
        maxOran = oran;
        enIyiKategori = k.etiket;
      }
    }
  }

  return {
    kategoriBazinda,
    toplamSoruldu,
    toplamBeklenen,
    tumKategorilerSoruldu,
    enCokEksikKategori,
    enIyiKategori,
  };
}
