"use client";

import { useState } from "react";
import { TestSonucu, Hasta } from "@/lib/types";

interface Props {
  sonuc: TestSonucu;
  hasta: Hasta;
  hastaneAdi?: string;
  tarih?: string;
  compact?: boolean;
  /** Admin debug modunda bulgu etiketi görünür; öğrencide gizlenir. */
  debugMode?: boolean;
}

export default function ResmiRapor({ sonuc, hasta, hastaneAdi = "ÇEMİÇGEZEK DEVLET HASTANESİ", tarih, compact, debugMode = false }: Props) {
  const [imageError, setImageError] = useState(false);
  const measured = sonuc.measuredAt ? new Date(sonuc.measuredAt) : null;
  const tarihStr = tarih || (measured
    ? measured.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—");
  const raporNo = sonuc.episodeId
    ? `RPT-${sonuc.episodeId.slice(-8).toUpperCase()}`
    : `RPT-${sonuc.testKey.slice(-8).toUpperCase()}`;

  const rapText = sonuc.testAdi.includes("Mamografi") || sonuc.testAdi.includes("USG") || sonuc.testAdi.includes("Grafisi") || sonuc.testAdi.includes("BT")
    ? "RADYOLOJİ RAPORU" : sonuc.testAdi.includes("Biyopsi") ? "PATOLOJİ RAPORU" : "LABORATUVAR SONUÇ RAPORU";

  const fs = compact ? "text-[10px]" : "text-[clamp(10px,1.6vw,13px)]";
  const fsSm = compact ? "text-[9px]" : "text-[clamp(8px,1.2vw,11px)]";
  const fsHeading = compact ? "text-xs" : "text-[clamp(11px,1.8vw,14px)]";

  return (
    <div className="w-full overflow-hidden rounded-md border border-ink/30 bg-white shadow-sm print:shadow-none"
         style={{ fontFamily: "'Courier New', 'Geist Mono', monospace" }}>
      
      <div className={`border-b border-ink/30 bg-ink/5 px-3 py-2 text-center ${compact ? "py-1.5" : "py-2"}`}>
        <div className={`${fsHeading} font-bold uppercase tracking-wider text-ink`}>{hastaneAdi}</div>
        <div className={`${fsSm} mt-0.5 uppercase tracking-widest text-steel`}>{rapText}</div>
      </div>

      <div className={`border-b border-ink/20 px-3 py-1.5 ${fs}`}>
        <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
          <div className="break-words"><span className="text-muted">Hasta:</span> <span className="font-semibold text-ink">{hasta.tamAd || hasta.ad}</span></div>
          <div className="break-words"><span className="text-muted">Vaka No:</span> <span className="font-semibold text-ink">{hasta.tc || "—"}</span></div>
          <div><span className="text-muted">Yaş/Cins:</span> <span className="text-ink">{hasta.yas}/{hasta.cinsiyet}</span></div>
          <div className="break-words"><span className="text-muted">Tarih:</span> <span className="text-ink">{tarihStr}</span></div>
        </div>
        <div className="mt-1 border-t border-dashed border-ink/20 pt-0.5">
          <span className="text-muted">Rapor No:</span> <span className="text-ink">{raporNo}</span>
        </div>
      </div>

      <div className={`border-b border-ink/20 bg-ink/5 px-3 py-1 ${fsSm}`}>
        <span className="text-muted">Tetkik: </span>
        <span className="break-words font-bold uppercase text-ink">{sonuc.testAdi}</span>
      </div>

      <div className={`px-3 py-2 ${fs}`}>
        {sonuc.tip === "numeric" && (
          <div>
            <div className={`${fsSm} uppercase tracking-wider text-muted mb-1`}>SONUÇ</div>
            <div className="flex items-baseline gap-2">
              <span className={`${compact ? "text-xl" : "text-2xl sm:text-3xl"} font-bold text-ink`}>
                {String((sonuc.sonuc as Record<string,string|number>).deger ?? "—")}
              </span>
              <span className={fs}>{String((sonuc.sonuc as Record<string,string|number>).birim ?? "")}</span>
            </div>
            {(sonuc.sonuc as Record<string,string|number>).referansAralik && (
              <div className={`mt-0.5 text-muted`}>
                Ref: <span className="text-steel">{String((sonuc.sonuc as Record<string,string|number>).referansAralik)}</span>
              </div>
            )}
          </div>
        )}

        {sonuc.tip === "json" && (
          <div className="space-y-0.5">
            <div className={`${fsSm} uppercase tracking-wider text-muted mb-1`}>SONUÇ</div>
            {Object.entries(sonuc.sonuc as Record<string,unknown>).map(([k, v]) => (
              <div key={k} className="flex gap-3 border-b border-dotted border-ink/10 py-0.5">
                <span className="min-w-0 break-words text-steel">{k}:</span>
                <span className="min-w-0 break-words text-right font-semibold text-ink">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {sonuc.tip === "text" && (
          <div>
            <div className={`${fsSm} uppercase tracking-wider text-muted mb-1`}>BULGULAR</div>
            <div className="text-ink whitespace-pre-line leading-relaxed">{String(sonuc.sonuc)}</div>
          </div>
        )}

        {sonuc.tip === "image" && (
          <div>
            <div className={`${fsSm} uppercase tracking-wider text-muted mb-1`}>RADYOLOJİK BULGU</div>
            {typeof sonuc.sonuc === "object" && sonuc.sonuc !== null && "imageUrl" in sonuc.sonuc && !imageError ? (
              <figure>
                {/* API rotasından gelen dinamik görüntü; next/image burada uygun değil. */}
                <a
                  href={String((sonuc.sonuc as Record<string, unknown>).imageUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${sonuc.testAdi} görüntüsünü yeni sekmede aç`}
                  className="group block"
                  title="Yeni sekmede aç"
                >
                  {/* API rotasından gelen dinamik görüntü; next/image burada uygun değil. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={String((sonuc.sonuc as Record<string, unknown>).imageUrl)}
                    alt={debugMode && (sonuc.sonuc as Record<string, unknown>).findingLabel
                      ? `Görüntü bulgusu: ${String((sonuc.sonuc as Record<string, unknown>).findingLabel)}`
                      : sonuc.testAdi}
                    className="mx-auto h-auto max-h-[28rem] w-full rounded border border-hairline object-contain group-hover:border-brand/50"
                    loading="lazy"
                    onLoad={() => setImageError(false)}
                    onError={() => setImageError(true)}
                  />
                </a>
                {debugMode && (sonuc.sonuc as Record<string, unknown>).findingLabel ? (
                  <figcaption className="mt-2 rounded border border-clinical-orange/40 bg-clinical-orange/10 px-2 py-1.5 text-center text-xs font-semibold text-clinical-orange">
                    DEBUG · Bulgu etiketi: {String((sonuc.sonuc as Record<string, unknown>).findingLabel)}
                  </figcaption>
                ) : null}
              </figure>
            ) : typeof sonuc.sonuc === "object" && sonuc.sonuc !== null && "imageUrl" in sonuc.sonuc ? (
              <p role="status" className="rounded border border-clinical-orange/30 bg-clinical-orange/5 px-3 py-3 text-steel">
                Görüntü yüklenemedi. Görüntü kaynağının hazır olduğunu kontrol edip tetkiki yeniden isteyin.
              </p>
            ) : (
              <div className="text-ink whitespace-pre-line leading-relaxed">{String(sonuc.sonuc)}</div>
            )}
          </div>
        )}

        {sonuc.yorum && (
          <div className="mt-2 border-t border-dashed border-ink/20 pt-1.5">
            <div className={`${fsSm} uppercase tracking-wider text-muted mb-0.5`}>YORUM</div>
            <div className="text-ink leading-relaxed">{sonuc.yorum}</div>
          </div>
        )}

        {sonuc.referans && (
          <div className={`mt-1 text-muted`}>Kaynak: {sonuc.referans}</div>
        )}
        {sonuc.source && (
          <div className={`mt-0.5 text-muted`}>
            Veri:{" "}
            {sonuc.source === "original"
              ? "vaka şablonu (patoloji)"
              : sonuc.source === "dataset"
                ? "Synthea lab-pool (profil eşleşmeli)"
                : "sentetik (eski)"}
            {sonuc.patientId ? ` · hasta ${sonuc.patientId.slice(0, 3)}***` : ""}
          </div>
        )}
      </div>

      <div className="border-t border-ink/30 bg-ink/5 px-3 py-2">
        <div className="flex items-end justify-between">
          <div>
            <div className={`${fsSm} uppercase tracking-wider text-muted`}>Onay</div>
            <div className={`mt-2 text-muted`}>İmza</div>
            <div className="mt-0.5 w-16 border-t border-ink/30" />
          </div>
          <div className="rotate-[-8deg] rounded border border-clinical-red/60 px-2 py-0.5 text-center">
            <div className={`font-bold uppercase tracking-wider text-clinical-red ${compact ? "text-[8px]" : "text-[9px]"}`}>
              {hastaneAdi.split(" ")[0]}
            </div>
            <div className="text-[7px] text-clinical-red/70">ONAYLI</div>
          </div>
        </div>
      </div>
    </div>
  );
}
