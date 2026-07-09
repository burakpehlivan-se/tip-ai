"use client";

import { TestSonucu, Hasta } from "@/lib/types";

interface Props {
  sonuc: TestSonucu;
  hasta: Hasta;
  hastaneAdi?: string;
  tarih?: string;
}

export default function ResmiRapor({ sonuc, hasta, hastaneAdi = "ÇEMİÇGEZEK DEVLET HASTANESİ", tarih }: Props) {
  const tarihStr = tarih || new Date().toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const raporNo = `RPT-${Date.now().toString().slice(-8)}`;

  return (
    <div className="my-2 overflow-hidden rounded-md border-2 border-ink/80 bg-white font-mono text-xs shadow-md print:shadow-none" style={{ fontFamily: "'Courier New', 'Geist Mono', monospace" }}>
      {/* Kurum Başlığı */}
      <div className="border-b-2 border-ink/80 bg-ink/5 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-base">🏥</span>
        </div>
        <div className="text-sm font-bold uppercase tracking-wider text-ink">{hastaneAdi}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-steel">
          {sonuc.testAdi.includes("Mamografi") || sonuc.testAdi.includes("USG") || sonuc.testAdi.includes("Grafisi") || sonuc.testAdi.includes("BT")
            ? "RADYOLOJİ RAPORU"
            : sonuc.testAdi.includes("Biyopsi")
            ? "PATOLOJİ RAPORU"
            : "LABORATUVAR SONUÇ RAPORU"}
        </div>
      </div>

      {/* Hasta Bilgileri */}
      <div className="border-b border-ink/30 px-4 py-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="text-muted">Hasta Adı:</span>{" "}
            <span className="font-bold text-ink">{hasta.tamAd || hasta.ad}</span>
          </div>
          <div>
            <span className="text-muted">TC Kimlik No:</span>{" "}
            <span className="font-bold text-ink">{hasta.tc || "—"}</span>
          </div>
          <div>
            <span className="text-muted">Yaş/Cins:</span>{" "}
            <span className="text-ink">{hasta.yas} / {hasta.cinsiyet === "E" ? "E" : "K"}</span>
          </div>
          <div>
            <span className="text-muted">Tarih:</span>{" "}
            <span className="text-ink">{tarihStr}</span>
          </div>
        </div>
        <div className="mt-1 border-t border-dashed border-ink/20 pt-1">
          <span className="text-muted">Rapor No:</span>{" "}
          <span className="text-ink">{raporNo}</span>
        </div>
      </div>

      {/* Test Adı */}
      <div className="border-b border-ink/30 bg-ink/5 px-4 py-1.5">
        <span className="text-muted">İstenen Tetkik: </span>
        <span className="font-bold uppercase text-ink">{sonuc.testAdi}</span>
      </div>

      {/* Sonuç */}
      <div className="px-4 py-3">
        {sonuc.tip === "numeric" && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">SONUÇ</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">
                {String((sonuc.sonuc as Record<string, string | number>).deger ?? "—")}
              </span>
              <span className="text-sm text-steel">
                {String((sonuc.sonuc as Record<string, string | number>).birim ?? "")}
              </span>
            </div>
            {(sonuc.sonuc as Record<string, string | number>).referansAralik && (
              <div className="mt-1 text-[11px] text-muted">
                Referans Aralığı: <span className="text-steel">{String((sonuc.sonuc as Record<string, string | number>).referansAralik)}</span>
              </div>
            )}
          </div>
        )}

        {sonuc.tip === "json" && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">SONUÇ</div>
            <div className="space-y-0.5">
              {Object.entries(sonuc.sonuc as Record<string, unknown>).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b border-dotted border-ink/10 py-0.5">
                  <span className="text-steel">{key}:</span>
                  <span className="font-bold text-ink">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sonuc.tip === "text" && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">BULGULAR</div>
            <div className="text-ink whitespace-pre-line" style={{ lineHeight: "1.6" }}>
              {String(sonuc.sonuc)}
            </div>
          </div>
        )}

        {sonuc.tip === "image" && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">RADYOLOJİK BULGU</div>
            <div className="text-ink whitespace-pre-line" style={{ lineHeight: "1.6" }}>
              {String(sonuc.sonuc)}
            </div>
          </div>
        )}

        {/* Yorum */}
        {sonuc.yorum && (
          <div className="mt-3 border-t border-dashed border-ink/20 pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">YORUM</div>
            <div className="text-ink" style={{ lineHeight: "1.5" }}>
              {sonuc.yorum}
            </div>
          </div>
        )}

        {sonuc.referans && (
          <div className="mt-1 text-[10px] text-muted">
            Kaynak: {sonuc.referans}
          </div>
        )}
      </div>

      {/* İmza / Kaşe */}
      <div className="border-t-2 border-ink/30 bg-ink/5 px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Onay</div>
            <div className="mt-4 text-[10px] text-muted">İmza</div>
            <div className="mt-0.5 w-24 border-t border-ink/30" />
          </div>
          <div className="rotate-[-8deg] rounded-md border-2 border-clinical-red/60 px-3 py-1 text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-clinical-red">
              {hastaneAdi.split(" ")[0]}
            </div>
            <div className="text-[8px] text-clinical-red/70">ONAYLI</div>
          </div>
        </div>
      </div>
    </div>
  );
}
