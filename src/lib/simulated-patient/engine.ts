import { normalizeSorular } from "@/lib/nlp/normalize";
import type { ChipKategorisi, Vaka } from "@/lib/types";

export type SimulatedPatientChannel = "hasta" | "muayene" | "tetkik" | "belirsiz";

export interface SimulatedPatientReply {
  channel: SimulatedPatientChannel;
  actions: string[];
  answer: string;
}

/** Kalıcı oturum belleğinde tutulan, hastanın verdiği tek konuşma turu. */
export interface SimulatedPatientTurn extends SimulatedPatientReply {
  question: string;
  /** Eski devam oturumlarıyla uyum için ilk açılan aksiyon. */
  aksiyon?: string;
}

const MUAYENE_KATEGORILERI = new Set<ChipKategorisi>(["vital", "fizik"]);
const TEST_VE_TANI_IFADELERI = [
  /\bekg\b/i,
  /elektrokardiy/i,
  /troponin/i,
  /hemogram/i,
  /biyokimya/i,
  /radyoloji/i,
  /tomografi/i,
  /manyetik rezonans/i,
  /\bst elevasyon/i,
  /kesin tan[ıi]/i,
  /tedavi plan[ıi]/i,
];
const TETKIK_ISTEGI_IFADELERI = [
  /\bekg\b/i,
  /elektrokardiy/i,
  /troponin/i,
  /hemogram/i,
  /biyokimya/i,
  /röntgen|rontgen/i,
  /tomografi/i,
  /manyetik rezonans|\bmr\b/i,
  /ultrason|\busg\b/i,
  /kan tahlili/i,
];

function actionKategori(vaka: Vaka, action: string): ChipKategorisi | undefined {
  return vaka.soruChipleri.find((chip) => chip.aksiyon === action)?.kategori;
}

function hastaKanaliDisiMi(vaka: Vaka, action: string): boolean {
  const kategori = actionKategori(vaka, action);
  return action.startsWith("VITAL_") || action.startsWith("FIZIK_") || (kategori != null && MUAYENE_KATEGORILERI.has(kategori));
}

function metinIceriyorMu(metin: string, ifade: string): boolean {
  const temiz = ifade.trim().toLocaleLowerCase("tr");
  return temiz.length >= 3 && metin.toLocaleLowerCase("tr").includes(temiz);
}

function sizintiVarMi(vaka: Vaka, metin: string): boolean {
  if (TEST_VE_TANI_IFADELERI.some((ifade) => ifade.test(metin))) return true;

  const gizliTaniVeTestler = [
    ...vaka.beklenenTani,
    ...vaka.rubric.kabulEdilenTani,
    ...Object.values(vaka.statikTestler).flatMap((test) => [test.testAdi, test.testKey]),
  ];
  return gizliTaniVeTestler.some((ifade) => metinIceriyorMu(metin, ifade));
}

function guvenliHastaCevabi(vaka: Vaka, metin: string | undefined): string | null {
  const temiz = metin?.trim();
  if (!temiz || sizintiVarMi(vaka, temiz)) return null;
  return temiz;
}

function birlestir(cevaplar: string[]): string {
  return cevaplar.slice(0, 4).join(" ");
}

/**
 * Hasta sohbetinin tek doğruluk kaynağı. Bu motor test, muayene ve gizli
 * klinik gerçeklere erişmez; sadece açıkça hasta-yanıtı olarak tanımlanmış
 * slotları birleştirir.
 */
export function simulatedPatientAnswer(vaka: Vaka, question: string): SimulatedPatientReply {
  // Eski istemciler yalnız chip anahtarını gönderiyordu. Geçiş boyunca bu
  // anahtarlar da aynı güvenlik duvarından geçirilir; istemci yanıtı seçemez.
  const actions = Object.prototype.hasOwnProperty.call(vaka.hastaYanitlari, question)
    ? [question]
    : normalizeSorular(question);
  const hastaActions = actions.filter((action) => !hastaKanaliDisiMi(vaka, action));
  const muayeneIstegiVar = actions.some((action) => hastaKanaliDisiMi(vaka, action));

  if (TETKIK_ISTEGI_IFADELERI.some((ifade) => ifade.test(question))) {
    return {
      channel: "tetkik",
      actions: [],
      answer: "Tetkik sonucu hasta sohbetinden verilmez. İlgili tetkiki istem aşamasından seçin.",
    };
  }

  if (hastaActions.length > 0) {
    const answers = hastaActions
      .map((action) => guvenliHastaCevabi(vaka, vaka.hastaYanitlari[action]))
      .filter((answer): answer is string => answer != null);
    if (answers.length > 0) {
      return { channel: "hasta", actions: hastaActions, answer: birlestir(answers) };
    }
  }

  if (muayeneIstegiVar) {
    return {
      channel: "muayene",
      actions: actions.filter((action) => hastaKanaliDisiMi(vaka, action)),
      answer: "Bu bilgi hasta sohbetinden verilmez. Uygun muayene isteğini muayene aşamasından yapın.",
    };
  }

  const fallback = guvenliHastaCevabi(vaka, vaka.hastaYanitlari.OZEL);
  return {
    channel: "belirsiz",
    actions: [],
    answer: fallback || "Hangi yakınmamı sorduğunuzu biraz açar mısınız doktor bey?",
  };
}
