import { afterEach, describe, expect, it, vi } from "vitest";
import { GEMINI_MODEL, geminiChat, geminiYapilandirilmisMi } from "./gemini";

const originalApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;
});

describe("geminiChat", () => {
  it("sistem ve sohbet mesajlarını GenerateContent gövdesine çevirir", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "düşünce", thought: true }, { text: "Merhaba" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const sonuc = await geminiChat({
      messages: [
        { role: "system", content: "Sadece Türkçe yanıtla." },
        { role: "user", content: "Merhaba" },
        { role: "assistant", content: "Selam" },
      ],
      temperature: 0.2,
      maxTokens: 256,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/models/${GEMINI_MODEL}:generateContent`),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-goog-api-key": "test-key" }),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Sadece Türkçe yanıtla." }] },
          contents: [
            { role: "user", parts: [{ text: "Merhaba" }] },
            { role: "model", parts: [{ text: "Selam" }] },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
      })
    );
    expect(sonuc).toEqual({ content: "Merhaba", finishReason: "STOP", promptTokens: 12, completionTokens: 3 });
  });

  it("anahtar yoksa yapılandırılmamış sayar ve istek göndermez", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(geminiYapilandirilmisMi()).toBe(false);
    await expect(geminiChat({ messages: [{ role: "user", content: "test" }] }))
      .rejects.toThrow("GEMINI_API_KEY tanımlı değil.");
  });

  it("JSON schema verildiğinde Structured Output biçimini kullanır", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await geminiChat({
      messages: [{ role: "user", content: "test" }],
      responseSchema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      generationConfig: {
        responseFormat: { text: { mimeType: "application/json", schema: { type: "object" } } },
      },
    });
  });
});
