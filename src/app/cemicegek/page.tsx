"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { vakaUret, poliklinikler } from "@/lib/data/case-generator";
import VakaWorkspace from "@/components/vaka/VakaWorkspace";
import { Vaka } from "@/lib/types";

export default function CemicegekPage() {
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [mod, setMod] = useState<"menu" | "calisma">("menu");
  const [poliklinikBilgisi, setPoliklinikBilgisi] = useState<string>("");

  const acileHastaGetir = () => {
    const yeni = vakaUret();
    setVaka(yeni);
    setPoliklinikBilgisi(yeni.alan);
    setMod("calisma");
  };

  if (mod === "calisma" && vaka) {
    return (
      <div className="flex h-screen flex-col bg-canvas">
        {/* Acil Top Bar */}
        <div className="flex h-14 items-center justify-between border-b border-clinical-red/20 bg-clinical-red/5 px-4">
          <div className="flex items-center gap-3">
            <Link href="/cemicegek" className="text-sm text-steel hover:text-ink transition-colors">
              ← Acil Çıkış
            </Link>
            <span className="text-muted">/</span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-clinical-red">
              🚑 Çemiçgezek Devlet Hastanesi
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-blue">{poliklinikBilgisi}</span>
            <button onClick={acileHastaGetir} className="btn-primary text-sm">
              🔄 Sıradaki Hasta →
            </button>
          </div>
        </div>

        <VakaWorkspace vaka={vaka} key={vaka.id} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <Link href="/vakalar" className="text-sm font-medium text-steel hover:text-ink transition-colors">
            ← Poliklinikler
          </Link>
        </div>
      </nav>

      {/* Hero — Acil */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-clinical-red/10 via-canvas to-canvas" />
        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-clinical-red/15 px-4 py-1.5 text-sm font-semibold text-clinical-red">
            <span>🚑</span> Çemiçgezek Devlet Hastanesi · Acil Simülatör
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-ink sm:text-6xl" style={{ letterSpacing: "-2px", lineHeight: "1.05" }}>
            Acile hasta geldi.
            <br />
            <span className="text-clinical-red">İlk karşılaşma senin.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-steel">
            Rastgele poliklinik, rastgele vaka, rastgele hasta. Her seferinde farklı senaryo. Acil tıbbi karar verme pratiği — gerçek hastane koşullarını simüle eder.
          </p>
          <div className="mt-12">
            <button
              onClick={acileHastaGetir}
              className="inline-flex items-center gap-2 rounded-full bg-clinical-red px-10 py-4 text-lg font-semibold text-white shadow-card transition-all hover:bg-clinical-red/80 active:scale-95"
            >
              🚑 Sıradaki Hastayı Getir →
            </button>
          </div>
        </div>
      </div>

      {/* Nasıl Çalışır */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight text-ink" style={{ letterSpacing: "-1px" }}>
          Nasıl Çalışır?
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card-feature text-center">
            <div className="mb-3 text-3xl">🎲</div>
            <h3 className="mb-2 text-lg font-semibold text-ink">Rastgele Vaka</h3>
            <p className="text-sm text-steel">
              5 poliklinik, 8+ hastalık şablonu. Her seferinde farklı hasta, farklı yaş, farklı cinsiyet, farklı senaryo.
            </p>
          </div>
          <div className="card-feature text-center">
            <div className="mb-3 text-3xl">🩺</div>
            <h3 className="mb-2 text-lg font-semibold text-ink">Tam Etkileşim</h3>
            <p className="text-sm text-steel">
              Serbest Türkçe anamnez, esnek test isteme, gerçek test sonuçları, tanı koyma — hepsi acil koşullarında.
            </p>
          </div>
          <div className="card-feature text-center">
            <div className="mb-3 text-3xl">📊</div>
            <h3 className="mb-2 text-lg font-semibold text-ink">Rubrik Puanlama</h3>
            <p className="text-sm text-steel">
              Her karşılaşma sonunda klinik yaklaşımın puanlanır. Red flag atlamaları, eksik testler, yanlış tanı — heksi değerlendirme.
            </p>
          </div>
        </div>
      </div>

      {/* Poliklinik Dağılımı */}
      <div className="mx-auto max-w-4xl px-6 pb-24">
        <div className="card-feature">
          <h3 className="mb-4 text-lg font-semibold text-ink">Acile Gelebilecek Vaka Tipleri</h3>
          <div className="flex flex-wrap gap-2">
            {poliklinikler.map((p) => (
              <span key={p.key} className="badge badge-steel">
                {p.icon} {p.ad} ({p.hastalikSablonlari.length})
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-steel" style={{ lineHeight: "1.5" }}>
            Çemiçgezek Devlet Hastanesi acil simülatörü tüm polikliniklerden rastgele vaka üretir. Kardiyoloji, Endokrin, Solunum, Nefroloji, Onkoloji — hangisinden hasta geleceğini önceden bilemezsin.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-hairline bg-surface-soft py-12">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-steel">
            ⚕️ Bu simülasyon eğitim amaçlıdır. Gerçek hasta verisi içermez. Sentetik vaka şablonları kullanılır.
          </p>
        </div>
      </footer>
    </div>
  );
}
