"use client";

import { useState } from "react";
import { SoruChipi, Vaka } from "@/lib/types";

interface Props {
  vaka: Vaka;
  vakaNo?: string | null;
  mobilGorunur: boolean;
  sorulanAksiyonSayisi: number;
  istenenTestSayisi: number;
  onClinicalHistoryRequest?: () => void;
  clinicalHistoryLoading?: boolean;
  vitalChips?: SoruChipi[];
  onVitalAsk?: (chip: SoruChipi) => void;
  sorulanAksiyonlar?: Set<string>;
  islemYukleniyor?: boolean;
}

export default function VakaHastaPanel({
  vaka,
  vakaNo,
  mobilGorunur,
  sorulanAksiyonSayisi,
  istenenTestSayisi,
  onClinicalHistoryRequest,
  clinicalHistoryLoading = false,
  vitalChips,
  onVitalAsk,
  sorulanAksiyonlar,
  islemYukleniyor = false,
}: Props) {
  const [kaynaklarAcik, setKaynaklarAcik] = useState(false);
  const [vitalAcik, setVitalAcik] = useState(false);
  const [idKopyalandi, setIdKopyalandi] = useState(false);

  const gosterilenId = vakaNo || vaka.id.slice(0, 8);

  const vakaIdKopyala = async () => {
    try {
      await navigator.clipboard.writeText(gosterilenId);
      setIdKopyalandi(true);
      window.setTimeout(() => setIdKopyalandi(false), 2000);
    } catch {
      // Pano erişilemezse kimlik zaten ekranda seçilebilir durumda.
    }
  };

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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand-deep" aria-hidden="true">VK</div>
            <div>
              <div className="text-sm font-semibold text-ink">{vaka.hasta.tamAd || `Hasta ${vaka.hasta.yas}`}</div>
              <div className="text-xs text-steel">
                {vaka.hasta.yas} yaş · {vaka.hasta.cinsiyet === "E" ? "E" : "K"}
              </div>
              <button
                type="button"
                onClick={vakaIdKopyala}
                title="Vaka kimliğini kopyala (hata bildiriminde kullanın)"
                className="mt-0.5 max-w-full cursor-pointer truncate text-left font-mono text-[10px] text-muted hover:text-ink"
              >
                {idKopyalandi ? "✓ Kopyalandı" : `Vaka #${gosterilenId}`}
              </button>
            </div>
          </div>
          <div className="border-t border-hairline-soft pt-3">
            <div className="text-xs font-semibold uppercase text-muted mb-1">Ana Şikayet</div>
            <div className="text-sm text-ink">{vaka.hasta.anaSikayet}</div>
          </div>
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

        {vitalChips && vitalChips.length > 0 && onVitalAsk && (
          <div className="mt-4 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setVitalAcik(!vitalAcik)}
              aria-expanded={vitalAcik}
              className="flex min-h-11 w-full items-center justify-between text-left"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Vital Bulgular
              </h4>
              <span className={`text-xs text-muted transition-transform ${vitalAcik ? "rotate-180" : ""}`}>▾</span>
            </button>
            {vitalAcik && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {vitalChips.map((chip) => {
                  const soruldu = sorulanAksiyonlar?.has(chip.aksiyon);
                  return (
                    <button
                      key={chip.aksiyon}
                      type="button"
                      onClick={() => onVitalAsk(chip)}
                      disabled={!!soruldu || islemYukleniyor}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        soruldu
                          ? "cursor-default border-hairline bg-surface text-muted/60 line-through"
                          : "border-hairline bg-canvas text-steel hover:border-ink/40 hover:text-ink hover:bg-surface"
                      }`}
                    >
                      {chip.etiket}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {onClinicalHistoryRequest && (
          <div className="mt-4 border-t border-hairline pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Klinik geçmiş</h4>
            <p className="mt-2 text-xs leading-5 text-steel">Kimlik bilgileri olmadan önceki tanı, işlem, ilaç ve laboratuvar kayıtlarını görüntüleyin.</p>
            <button
              type="button"
              onClick={onClinicalHistoryRequest}
              disabled={clinicalHistoryLoading}
              className="btn-secondary mt-3 min-h-11 w-full justify-center text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {clinicalHistoryLoading ? "Geçmiş yükleniyor…" : "Klinik geçmişi görüntüle"}
            </button>
          </div>
        )}

        {vaka.kaynaklar && vaka.kaynaklar.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setKaynaklarAcik(!kaynaklarAcik)}
              aria-expanded={kaynaklarAcik}
              className="flex min-h-11 w-full items-center justify-between text-left"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Vaka kaynakları
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
                  Tüm vakalar eğitim amaçlıdır. Lab bazal paneli Synthea sentetik EHR satırlarından örneklenir; gerçek MIMIC erişimi planlanmaktadır. KVKK özel nitelikli kişisel veri işlenmez.
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
