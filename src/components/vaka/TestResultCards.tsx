"use client";

import { useState } from "react";
import { Hasta, TestIstegi, TestSonucu, humanizeKey } from "@/lib/types";
import ResmiRapor from "./ResmiRapor";

export function TestSonucKarti({ istek, hasta, hastaneAdi, debugMode }: { istek: TestIstegi; hasta: Hasta; hastaneAdi?: string; debugMode?: boolean }) {
  const { sonuc } = istek;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3 text-left hover:bg-surface-soft transition-colors"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="break-words text-sm font-semibold text-ink">{sonuc.testAdi}</div>
            {sonuc.source === "dataset" && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel" title="Synthea lab-pool — profil eşleşmeli satır">
                dataset
              </span>
            )}
            {sonuc.source === "synthetic" && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel" title="Eski sentetik (kullanımdan kalktı)">
                sentetik
              </span>
            )}
            {sonuc.source === "original" && (
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep" title="Vaka şablonu — patoloji">
                patoloji
              </span>
            )}
          </div>
          <div className="text-xs text-muted">
            {sonuc.tip === "numeric" ? "Sayısal" : sonuc.tip === "json" ? "Detaylı" : sonuc.tip === "image" ? "Radyoloji" : "Rapor"} — raporu {expanded ? "gizle" : "gör"}
          </div>
        </div>
        <span className="shrink-0 text-steel" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="bg-surface-soft p-2">
          <ResmiRapor sonuc={sonuc} hasta={hasta} hastaneAdi={hastaneAdi} compact debugMode={debugMode} />
        </div>
      )}
    </div>
  );
}
export type DebugTestItem = {
  key: string;
  ad: string;
  kategori: string;
  sonuc?: TestSonucu;
  hasSonuc: boolean;
  beklenen: boolean;
  gereksiz: boolean;
  source?: string;
};

export function DebugTestKarti({
  item,
  hasta,
  hastaneAdi,
  defaultOpen = false,
  debugMode,
}: {
  item: DebugTestItem;
  hasta: Hasta;
  hastaneAdi?: string;
  defaultOpen?: boolean;
  debugMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        item.hasSonuc
          ? "border-hairline bg-canvas"
          : "border-dashed border-clinical-orange/40 bg-clinical-orange/5"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-soft/80 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-ink">{item.ad}</span>
            {item.hasSonuc ? (
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                sonuç var
              </span>
            ) : (
              <span className="rounded-full bg-clinical-orange/20 px-1.5 py-0.5 text-[10px] font-medium text-clinical-orange">
                sonuç yok
              </span>
            )}
            {item.beklenen && (
              <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                beklenen
              </span>
            )}
            {item.gereksiz && (
              <span className="rounded-full bg-clinical-red/10 px-1.5 py-0.5 text-[10px] font-medium text-clinical-red">
                gereksiz
              </span>
            )}
            {item.source === "original" && (
              <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                patoloji
              </span>
            )}
            {item.source === "dataset" && (
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-steel">
                dataset
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {item.kategori} · <span>{humanizeKey(item.key)}</span>
            {item.hasSonuc
              ? ` · ${expanded ? "raporu gizle" : "raporu gör"}`
              : " · bu vakada sonuç tanımlı değil"}
          </div>
        </div>
        <span className="shrink-0 text-steel">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-hairline-soft bg-surface-soft p-2">
          {item.hasSonuc && item.sonuc ? (
            <ResmiRapor sonuc={item.sonuc} hasta={hasta} hastaneAdi={hastaneAdi} compact debugMode={debugMode} />
          ) : (
            <div className="rounded-md border border-dashed border-clinical-orange/30 bg-canvas px-3 py-3 text-xs text-steel">
              <div className="font-medium text-clinical-orange">Sonuç yok</div>
              <p className="mt-1 leading-relaxed">
                Bu test katalogda/rubrikte yer alıyor ancak vaka şablonunda veya lab
                havuzunda sonuç üretilmemiş. Admin editöründen sonuç ekleyebilirsiniz.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
