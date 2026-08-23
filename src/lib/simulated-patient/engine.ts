import { normalizeSorular } from "@/lib/nlp/normalize";
import { kanonikHastaAksiyonu } from "@/lib/data/answer-action-aliases";
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

/** Genel Türkçe slotların Synthea/AI vaka sözlüğündeki karşılıkları. */
const GENELDEN_VAKA_AKSIYONUNA: Record<string, string[]> = {
  SIKAYET: ["CHIEF_COMPLAINT"],
  SIKAYET_SURE: ["HISTORY_OF_PRESENT"],
  ESLIK_EDEN: ["HISTORY_OF_PRESENT"],
  PAST_MEDICAL: ["PAST_MEDICAL"],
  ILAC: ["MEDICATIONS"],
  AILE_OYKUSU: ["FAMILY_HISTORY"],
  SIGARA: ["SOCIAL_HISTORY"],
  ALKOL: ["SOCIAL_HISTORY"],
  SOCIAL_HISTORY: ["SOCIAL_HISTORY"],
};

function actionKategori(vaka: Vaka, action: string): ChipKategorisi | undefined {
  return vaka.soruChipleri.find((chip) => chip.aksiyon === action)?.kategori;
}

function hastaKanaliDisiMi(vaka: Vaka, action: string): boolean {
  const kategori = actionKategori(vaka, action);
  return action.startsWith("VITAL_") || action.startsWith("FIZIK_") || (kategori != null && MUAYENE_KATEGORILERI.has(kategori));
}

function vakaAksiyonlariniCoz(vaka: Vaka, question: string): string[] {
  const canonicalQuestion = kanonikHastaAksiyonu(question);
  const rawActions = Object.prototype.hasOwnProperty.call(vaka.hastaYanitlari, question) ||
    Object.prototype.hasOwnProperty.call(vaka.hastaYanitlari, canonicalQuestion)
    ? [question]
    : normalizeSorular(question);
  const resolved: string[] = [];
  const add = (action: string) => {
    if (Object.prototype.hasOwnProperty.call(vaka.hastaYanitlari, action) && !resolved.includes(action)) {
      resolved.push(action);
    }
  };

  for (const rawAction of rawActions) {
    const action = kanonikHastaAksiyonu(rawAction);
    add(action);
    for (const candidate of GENELDEN_VAKA_AKSIYONUNA[action] || []) add(candidate);
  }
  return resolved;
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

/** Gemini çıktısının hasta katmanından çıkmadığını doğrulamak için dışa açılır. */
export function hastaCevabiGuvenliMi(vaka: Vaka, metin: string): boolean {
  return guvenliHastaCevabi(vaka, metin) === metin.trim();
}

/** Yalnız açıkça seçilmiş ve sızıntı içermeyen hasta slotlarını döndürür. */
export function izinliHastaGercekleri(vaka: Vaka, actions: string[]): Record<string, string> {
  return Object.fromEntries(
    actions.flatMap((action) => {
      if (hastaKanaliDisiMi(vaka, action)) return [];
      const answer = guvenliHastaCevabi(vaka, vaka.hastaYanitlari[action]);
      return answer ? [[action, answer]] : [];
    })
  );
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
  const actions = vakaAksiyonlariniCoz(vaka, question);
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
