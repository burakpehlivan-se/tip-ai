"use client";

/**
 * Hasta tipi seçici — oturum başlamadan önce öğrencinin hasta kişiliğini
 * seçmesini sağlar. "Rastgele" bırakılırsa sistem otomatik atar.
 */

const TIP_EMOJILERI: Record<string, string> = {
  sakin: "😊",
  endiseli: "😰",
  ketum: "😶",
  konuskan: "🗣️",
  agresif: "😠",
  dramatik: "😱",
};

export function tipEmoji(id: string): string {
  return TIP_EMOJILERI[id] || "🎭";
}

export interface HastaTipiSecim {
  id: string;
  ad: string;
  aciklama: string;
}

export function HastaTipiSecici({
  tipler,
  seciliTipId,
  onSelect,
}: {
  tipler: HastaTipiSecim[];
  /** null = rastgele */
  seciliTipId: string | null;
  onSelect: (tipId: string | null) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Hasta tipi seçimi">
      <button
        type="button"
        role="radio"
        aria-checked={seciliTipId === null}
        onClick={() => onSelect(null)}
        className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          seciliTipId === null ? "border-brand bg-brand-soft/30" : "border-hairline bg-canvas hover:border-brand"
        }`}
      >
        <span className="text-2xl" aria-hidden="true">🎲</span>
        <span className="text-sm font-semibold text-ink">Rastgele</span>
        <span className="text-xs text-steel">Sistem rastgele bir hasta tipi atasın</span>
      </button>
      {tipler.map((tip) => (
        <button
          key={tip.id}
          type="button"
          role="radio"
          aria-checked={seciliTipId === tip.id}
          onClick={() => onSelect(tip.id)}
          className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            seciliTipId === tip.id ? "border-brand bg-brand-soft/30" : "border-hairline bg-canvas hover:border-brand"
          }`}
        >
          <span className="text-2xl" aria-hidden="true">{tipEmoji(tip.id)}</span>
          <span className="text-sm font-semibold text-ink">{tip.ad}</span>
          <span className="text-xs text-steel">{tip.aciklama}</span>
        </button>
      ))}
    </div>
  );
}
