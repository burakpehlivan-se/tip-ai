"use client";

import { useState } from "react";
import { Vaka } from "@/lib/types";

interface Props {
  vaka: Vaka;
  mobilGorunur: boolean;
  sorulanAksiyonSayisi: number;
  istenenTestSayisi: number;
}

export default function VakaHastaPanel({
  vaka,
  mobilGorunur,
  sorulanAksiyonSayisi,
  istenenTestSayisi,
}: Props) {
  const [kaynaklarAcik, setKaynaklarAcik] = useState(false);

  return (
    <div
      className={`${mobilGorunur ? "flex" : "hidden"} w-full lg:flex lg:w-72 flex-shrink-0 border-r border-hairline bg-surface-soft overflow-y-auto scrollbar-thin flex-col`}
    >
      <div className="p-4 lg:p-6">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
          Hasta Kartı
        </h3>
        <div className="mb-6 rounded-lg border border-hairline bg-canvas p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-xl">
              👤
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{vaka.hasta.tamAd || `Hasta ${vaka.hasta.yas}`}</div>
              <div className="text-xs text-steel">
                {vaka.hasta.yas} yaş · {vaka.hasta.cinsiyet === "E" ? "E" : "K"}
              </div>
              {vaka.hasta.tc && (
                <div className="text-[10px] text-muted">TC: {vaka.hasta.tc}</div>
              )}
            </div>
          </div>
          <div className="border-t border-hairline-soft pt-3">
            <div className="text-xs font-semibold uppercase text-muted mb-1">Ana Şikayet</div>
            <div className="text-sm text-ink">{vaka.hasta.anaSikayet}</div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Bilinen Bilgiler
          </h4>
          <ul className="space-y-2">
            {vaka.hasta.ozetBilgiler.map((bilgi) => (
              <li key={bilgi} className="flex items-start gap-2 text-sm text-steel">
                <span className="text-brand mt-0.5">•</span>
                <span>{bilgi}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-hairline pt-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            İlerleme
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-brand">✓</span>
              <span className="text-steel">Sorulan: {sorulanAksiyonSayisi} soru</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand">✓</span>
              <span className="text-steel">İstenen: {istenenTestSayisi} test</span>
            </div>
          </div>
        </div>

        {vaka.kaynaklar && vaka.kaynaklar.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setKaynaklarAcik(!kaynaklarAcik)}
              aria-expanded={kaynaklarAcik}
              className="flex min-h-11 w-full items-center justify-between text-left"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                📚 Vaka Kaynakları
              </h4>
              <span className={`text-xs text-muted transition-transform ${kaynaklarAcik ? "rotate-180" : ""}`}>▾</span>
            </button>
            {kaynaklarAcik && (
              <div className="mt-3 space-y-2.5">
                {vaka.kaynaklar.map((k) => (
                  <div
                    key={k}
                    className="rounded-md border border-hairline bg-canvas px-3 py-2.5 text-[11px] text-steel leading-relaxed break-words"
                  >
                    <KaynakMetni metin={k} />
                  </div>
                ))}
                <div className="rounded-md bg-ink/5 px-3 py-2 text-[10px] text-muted italic">
                  ⚠️ Tüm vakalar eğitim amaçlıdır. Lab bazal paneli Synthea sentetik EHR satırlarından örneklenir; gerçek MIMIC erişimi planlanmaktadır. KVKK özel nitelikli kişisel veri işlenmez.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KaynakMetni({ metin }: { metin: string }) {
  const parts = metin.split(/(https?:\/\/[^\s]+)/g);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("http") ? (
          <a
            key={index}
            href={part.replace(/[.,;)]+$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-clinical-blue underline break-all hover:text-ink"
          >
            {part.replace(/[.,;)]+$/, "")}
          </a>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
