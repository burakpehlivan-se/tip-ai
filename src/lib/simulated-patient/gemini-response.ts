import type { HastaTipi } from "@/lib/admin/types";
import { geminiChat, geminiYapilandirilmisMi, jsonCikar } from "@/lib/ai/gemini";
import type { Vaka } from "@/lib/types";
import {
  hastaCevabiGuvenliMi,
  izinliHastaGercekleri,
  simulatedPatientAnswer,
  type SimulatedPatientReply,
  type SimulatedPatientTurn,
} from "./engine";

interface GeminiHastaYaniti {
  answer?: unknown;
  usedActions?: unknown;
}

export interface GeminiHastaYanitiIstek {
  vaka: Vaka;
  question: string;
  previousTurns: SimulatedPatientTurn[];
  persona?: HastaTipi;
}

function normalize(metin: string): string {
  return metin
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function personaOzeti(vaka: Vaka, persona?: HastaTipi): string {
  const cinsiyet = vaka.hasta.cinsiyet === "E" ? "erkek" : "kadın";
  const kurallar = persona?.konusmaKurallari?.trim().slice(0, 360);
  return [
    `${vaka.hasta.yas} yaşında ${cinsiyet}; gündelik Türkçe konuşur ve tıbbi terim kullanmaz.`,
    persona?.ad ? `Konuşma profili: ${persona.ad}.` : null,
    kurallar ? `Konuşma kuralı: ${kurallar}` : null,
  ].filter(Boolean).join(" ");
}

function ilgiliGecmisOzeti(turns: SimulatedPatientTurn[], actions: string[]): string[] {
  const actionSet = new Set(actions);
  return turns
    .filter((turn) => turn.channel === "hasta" && turn.actions.some((action) => actionSet.has(action)))
    .slice(-3)
    .map((turn) => turn.answer.slice(0, 240));
}

function ayniAksiyonlarMi(value: unknown, actions: string[]): boolean {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return false;
  const supplied = new Set(value);
  return supplied.size === actions.length && actions.every((action) => supplied.has(action));
}

function ucCumledenUzunMu(answer: string): boolean {
  return answer.split(/[.!?]+/).filter((part) => part.trim()).length > 3;
}

/** İzin verilmeyen başka bir slotun ham gerçeğinin Gemini tarafından taşınmasını engeller. */
function izinVerilmeyenGercekSizdiMi(vaka: Vaka, answer: string, allowedActions: string[]): boolean {
  const normalizedAnswer = normalize(answer);
  return Object.entries(vaka.hastaYanitlari)
    .filter(([action]) => !allowedActions.includes(action))
    .some(([, fact]) => {
      const normalizedFact = normalize(fact);
      return normalizedFact.length >= 18 && normalizedAnswer.includes(normalizedFact);
    });
}

function geminiGerekliMi(reply: SimulatedPatientReply, turns: SimulatedPatientTurn[]): boolean {
  if (reply.channel !== "hasta" || reply.actions.length === 0) return false;
  if (reply.actions.length > 1) return true;
  return turns.some((turn) => turn.channel === "hasta" && turn.actions.includes(reply.actions[0]));
}

async function geminiHastaYaniti(
  vaka: Vaka,
  question: string,
  actions: string[],
  turns: SimulatedPatientTurn[],
  persona?: HastaTipi
): Promise<string | null> {
  const facts = izinliHastaGercekleri(vaka, actions);
  if (Object.keys(facts).length !== actions.length) return null;

  const responseSchema = {
    type: "object",
    properties: {
      answer: { type: "string", description: "Hastanın 1-3 cümlelik doğal Türkçe yanıtı." },
      usedActions: {
        type: "array",
        items: { type: "string", enum: actions },
        description: "Yanıtta kullanılan seçilmiş slot anahtarları.",
      },
    },
    required: ["answer", "usedActions"],
    additionalProperties: false,
  };
  const previous = ilgiliGecmisOzeti(turns, actions);
  const prompt = [
    "DOKTOR SORUSU:", question,
    "", "HASTA PERSONASI:", personaOzeti(vaka, persona),
    "", "YALNIZ KULLANABİLECEĞİN KLİNİK GERÇEKLER:",
    ...Object.entries(facts).map(([action, answer]) => `- ${action}: ${answer}`),
    ...(previous.length ? ["", "AYNI ALAN İÇİN ÖNCEKİ AÇIKLAMALAR:", ...previous.map((answer) => `- ${answer}`)] : []),
    "", "KURALLAR:",
    "- Sadece yukarıdaki gerçekleri hasta ağzıyla aktar; yeni semptom, hastalık, ilaç, sayı veya öykü ekleme.",
    "- Tanı, tetkik, EKG, laboratuvar, görüntüleme, fizik muayene, tedavi veya klinik öneri söyleme.",
    "- 1-3 kısa cümleyle gündelik Türkçe kullan.",
    "- usedActions seçilen anahtarların tamamını, başka anahtar olmadan içermelidir.",
  ].join("\n");

  try {
    const result = await geminiChat({
      messages: [
        {
          role: "system",
          content: "Sen tıp eğitimi simülasyonunda yalnız hasta rolündesin. Klinik gerçek kaynağı değilsin; sadece izin verilen gerçekleri doğal dile çevirirsin.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.45,
      maxTokens: 700,
      responseSchema,
    });
    const parsed = jsonCikar(result.content) as GeminiHastaYaniti | null;
    const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
    if (!answer || answer.length > 600 || ucCumledenUzunMu(answer)) return null;
    if (!ayniAksiyonlarMi(parsed?.usedActions, actions)) return null;
    if (!hastaCevabiGuvenliMi(vaka, answer)) return null;
    if (izinVerilmeyenGercekSizdiMi(vaka, answer, actions)) return null;
    return answer;
  } catch {
    return null;
  }
}

/**
 * Standart tek-slot sorular deterministik yanıtlanır. Çok-slotlu veya tekrar
 * açıklatma isteyen turlarda Gemini yalnız seçilmiş slotları doğal dile çevirir.
 */
export async function simuleHastaYanitla(request: GeminiHastaYanitiIstek): Promise<SimulatedPatientReply> {
  const deterministic = simulatedPatientAnswer(request.vaka, request.question);
  if (!geminiYapilandirilmisMi() || !geminiGerekliMi(deterministic, request.previousTurns)) {
    return deterministic;
  }

  const answer = await geminiHastaYaniti(
    request.vaka,
    request.question,
    deterministic.actions,
    request.previousTurns,
    request.persona
  );
  return answer ? { ...deterministic, answer } : deterministic;
}
