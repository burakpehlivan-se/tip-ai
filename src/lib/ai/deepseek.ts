/**
 * DeepSeek istemcisi — OpenAI uyumlu Chat Completions ucu.
 *
 * Ortam değişkenleri:
 *   DEEPSEEK_API_KEY   (zorunlu)
 *   DEEPSEEK_BASE_URL  (varsayılan: https://api.deepseek.com)
 *   DEEPSEEK_MODEL     (varsayılan: deepseek-v4-flash)
 */

export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

export interface DeepseekMesaj {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepseekChatParametreleri {
  messages: DeepseekMesaj[];
  temperature?: number;
  maxTokens?: number;
}

export interface DeepseekSonuc {
  content: string;
  /** Reasoning modellerinde düşünme zinciri ayrı alanda döner. */
  reasoningContent?: string;
  /** "stop" = doğal bitiş, "length" = token limitine takıldı (kesik yanıt). */
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
}

/** DeepSeek anahtarı tanımlı mı? */
export function deepseekYapilandirilmisMi(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function deepseekChat(
  params: DeepseekChatParametreleri
): Promise<DeepseekSonuc> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY tanımlı değil.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 8000,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const govde = await res.text().catch(() => "");
      throw new Error(`DeepSeek API ${res.status}: ${govde.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      reasoningContent: data.choices?.[0]?.message?.reasoning_content,
      finishReason: data.choices?.[0]?.finish_reason,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
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
