/**
 * Gemini GenerateContent istemcisi.
 *
 * Ortam değişkenleri:
 *   GEMINI_API_KEY (zorunlu)
 *   GEMINI_MODEL   (varsayılan: gemini-flash-latest)
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiMesaj {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GeminiChatParametreleri {
  messages: GeminiMesaj[];
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiSonuc {
  content: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
}

/** Gemini anahtarı tanımlı mı? */
export function geminiYapilandirilmisMi(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** OpenAI-benzeri mesaj dizisini Gemini systemInstruction + contents biçimine çevirir. */
function geminiIstekGovdesi(params: GeminiChatParametreleri) {
  const system = params.messages
    .filter((mesaj) => mesaj.role === "system")
    .map((mesaj) => mesaj.content)
    .join("\n\n");
  const contents = params.messages
    .filter((mesaj) => mesaj.role !== "system")
    .map((mesaj) => ({
      role: mesaj.role === "assistant" ? "model" : "user",
      parts: [{ text: mesaj.content }],
    }));

  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxTokens ?? 8000,
    },
  };
}

export async function geminiChat(params: GeminiChatParametreleri): Promise<GeminiSonuc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY tanımlı değil.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(geminiIstekGovdesi(params)),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const govde = await res.text().catch(() => "");
      throw new Error(`Gemini API ${res.status}: ${govde.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const candidate = data.candidates?.[0];

    return {
      content: candidate?.content?.parts?.map((part) => part.text || "").join("") || "",
      finishReason: candidate?.finishReason,
      promptTokens: data.usageMetadata?.promptTokenCount,
      completionTokens: data.usageMetadata?.candidatesTokenCount,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Model yanıtından JSON çıkarır (markdown kod bloğu dahil). */
export function jsonCikar(content: string): unknown | null {
  let metin = content.trim();
  if (!metin) return null;

  const fence = metin.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) metin = fence[1].trim();

  try {
    return JSON.parse(metin);
  } catch {
    const bas = metin.indexOf("{");
    const son = metin.lastIndexOf("}");
    if (bas === -1 || son === -1 || son <= bas) return null;
    try {
      return JSON.parse(metin.slice(bas, son + 1));
    } catch {
      return null;
    }
  }
}
