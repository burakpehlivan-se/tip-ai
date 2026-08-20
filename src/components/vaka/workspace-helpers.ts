import type { ChatMesaj, TestIstegi, Vaka } from "@/lib/types";

/** Workspace sohbetinin başlangıç mesajı — saf, test edilebilir. */
export function defaultMesajlar(vaka: Vaka): ChatMesaj[] {
  return [
    {
      id: "0",
      rol: "sistem",
      metin: `Vaka başladı. Hasta: ${vaka.hasta.yas} yaş, ${vaka.hasta.cinsiyet === "E" ? "Erkek" : "Kadın"} — ${vaka.hasta.anaSikayet}. Anamnez sorularınızı bekliyorum.`,
      zaman: Date.now(),
    },
  ];
}

/** Lab'dan dönüşte "rapor hazırlanıyor" mesajlarına sonuç ekle — saf. */
export function mesajlaraSonucEkle(mesajlar: ChatMesaj[], testler: TestIstegi[]): ChatMesaj[] {
  return mesajlar.map((m) => {
    if (m.rol !== "sistem" || !m.testAdi || m.testSonucu) return m;
    const eslesen = testler.find((t) => t.testAdi === m.testAdi || m.metin.includes(t.testAdi));
    if (!eslesen) return m;
    return {
      ...m,
      metin: `🧪 ${eslesen.testAdi} — rapor hazır`,
      testSonucu: eslesen.sonuc,
    };
  });
}

export function toReasoningList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/** Serbest metin için sunucu tarafı AI eşleştirme fallback'i. */
export async function aiEslestir(metin: string): Promise<string | null> {
  try {
    const res = await fetch("/api/ai/soru-eslestir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metin }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.chipKey === "string" && data.chipKey ? data.chipKey : null;
  } catch {
    return null;
  }
}
