"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { vakaUret, poliklinikGetir } from "@/lib/data/case-generator";
import VakaWorkspace from "@/components/vaka/VakaWorkspace";
import { Vaka } from "@/lib/types";

export default function PoliklinikPage() {
  const params = useParams();
  const poliklinikKey = params.key as string;
  const [vaka, setVaka] = useState<Vaka | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const poliklinik = poliklinikGetir(poliklinikKey);

  useEffect(() => {
    const yeniVaka = vakaUret(poliklinikKey);
    setVaka(yeniVaka);
    setYukleniyor(false);
  }, [poliklinikKey]);

  const yeniVakaAl = () => {
    setYukleniyor(true);
    setTimeout(() => {
      const yeni = vakaUret(poliklinikKey);
      setVaka(yeni);
      setYukleniyor(false);
    }, 200);
  };

  if (!poliklinik) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <p className="text-lg text-steel mb-4">Poliklinik bulunamadı.</p>
          <Link href="/vakalar" className="btn-primary">
            ← Polikliniklere Dön
          </Link>
        </div>
      </div>
    );
  }

  if (yukleniyor || !vaka) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="mb-4 text-5xl">{poliklinik.icon}</div>
          <p className="text-lg font-medium text-ink mb-2">{poliklinik.ad} Polikliniği</p>
          <p className="text-sm text-steel">Vaka hazırlanıyor...</p>
          <div className="mt-6 mx-auto h-1 w-32 overflow-hidden rounded-full bg-surface">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar — Poliklinik */}
      <div className="flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4">
        <div className="flex items-center gap-3">
          <Link href="/vakalar" className="text-sm text-steel hover:text-ink transition-colors">
            ← Poliklinikler
          </Link>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium text-ink">
            {poliklinik.icon} {poliklinik.ad}
          </span>
        </div>
        <button onClick={yeniVakaAl} className="btn-secondary text-sm">
          🔄 Yeni Hasta
        </button>
      </div>

      <VakaWorkspace vaka={vaka} key={vaka.id} />
    </div>
  );
}
