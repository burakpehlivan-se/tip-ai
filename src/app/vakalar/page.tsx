"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PoliklinikKart {
  key: string;
  ad: string;
  icon: string;
  aciklama: string;
  vakaSayisi: number;
}

export default function VakalarPage() {
  const [girisli, setGirisli] = useState<boolean | null>(null);
  const [poliklinikler, setPoliklinikler] = useState<PoliklinikKart[]>([]);

  useEffect(() => {
    fetch("/api/student/me")
      .then((r) => setGirisli(r.ok))
      .catch(() => setGirisli(false));
  }, []);

  useEffect(() => {
    fetch("/api/cases/templates")
      .then((response) => response.json())
      .then((data) => {
        const grouped = new Map<string, PoliklinikKart>();
        for (const item of data.templates || []) {
          const current = grouped.get(item.poliklinikKey);
          if (current) current.vakaSayisi += 1;
          else grouped.set(item.poliklinikKey, {
            key: item.poliklinikKey,
            ad: item.poliklinikAd,
            icon: item.poliklinikIcon,
            aciklama: item.poliklinikAciklama || "Klinik vaka simülasyonları",
            vakaSayisi: 1,
          });
        }
        setPoliklinikler([...grouped.values()]);
      })
      .catch(() => setPoliklinikler([]));
  }, []);

  const poliklinikHref = (key: string) =>
    girisli ? `/poliklinik/${key}` : `/giris?sonraki=${encodeURIComponent(`/poliklinik/${key}`)}`;

  return (
    <div className="min-h-screen bg-canvas">
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {girisli === false && (
              <Link href="/giris" className="btn-secondary text-sm">
                Giriş Yap
              </Link>
            )}
            {girisli === true && (
              <Link href="/profilim" className="btn-secondary text-sm">
                Profilim
              </Link>
            )}
            <Link
              href="/cemicegek"
              className="rounded-full bg-clinical-red/10 px-4 py-1.5 text-sm font-medium text-clinical-red hover:bg-clinical-red/20 transition-colors"
            >
              🚑 Çemiçgezek Acil
            </Link>
            <Link href="/" className="text-sm font-medium text-steel hover:text-ink transition-colors">
              ← Ana Sayfa
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl" style={{ letterSpacing: "-1.5px" }}>
          Poliklinik Seç
        </h1>
        <p className="mt-4 text-lg text-steel">
          Bir poliklinik seç — sistem o poliklinikten rastgele bir vaka üretecek. Her seferinde farklı hasta, farklı senaryo.
        </p>
      </div>

      {girisli === false && (
        <div className="mx-auto max-w-6xl px-6 pb-8">
          <Link href="/deneme" className="block">
            <div className="rounded-lg border border-brand/30 bg-brand-soft/10 p-6 transition-all hover:shadow-card">
              <div className="flex items-center gap-5">
                <div className="text-4xl">🔓</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-ink mb-1">Deneme Vakası — ücretsiz</h3>
                  <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>
                    Giriş yapmadan tam olarak oynayabileceğin tek vaka. Platformu dene, sonra ücretsiz kayıt olup ilerlemeni takip et.
                  </p>
                </div>
                <div className="hidden sm:block">
                  <span className="btn-primary">Vakayı Aç →</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {poliklinikler.map((p) => (
            <Link
              key={p.key}
              href={poliklinikHref(p.key)}
              className="card group cursor-pointer transition-all hover:shadow-card hover:border-brand"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{p.icon}</div>
                <span className="badge badge-brand">{p.vakaSayisi} vaka tipi</span>
              </div>
              <h3 className="text-xl font-semibold text-ink mb-2">{p.ad}</h3>
              <p className="text-sm text-steel mb-4" style={{ lineHeight: "1.5" }}>
                {p.aciklama}
              </p>
              <span className="btn-primary w-full justify-center text-center">
                {girisli === false ? "🔒 Giriş Yapıp Oyna →" : "Bu Poliklinikten Vaka Al →"}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <Link href={girisli === false ? `/giris?sonraki=${encodeURIComponent("/cemicegek")}` : "/cemicegek"} className="block">
          <div className="rounded-lg border border-clinical-red/20 bg-clinical-red/5 p-8 transition-all hover:shadow-card">
            <div className="flex items-center gap-6">
              <div className="text-5xl">🚑</div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-ink mb-1">
                  Çemiçgezek Devlet Hastanesi — Acil Simülatör
                </h3>
                <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>
                  Rastgele poliklinik, rastgele vaka. Acile gelen ilk hastayı sen karşıla. Her seferinde farklı senaryo.
                </p>
              </div>
              <div className="hidden sm:block">
                <span className="btn-primary bg-clinical-red text-white hover:bg-clinical-red/80">
                  {girisli === false ? "🔒 Giriş Yapıp Başla →" : "Acile Başla →"}
                </span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="card-feature flex items-start gap-4">
          <div className="text-2xl">💡</div>
          <div>
            <h3 className="text-lg font-semibold text-ink mb-1">Nasıl Çalışır?</h3>
            <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>
              Bir poliklinik seçtiğinde sistem o polikliğe ait rastgele bir vaka üretir — farklı yaş, cinsiyet, hastalık şablonu. Her seferinde yeni bir karşılaşma. Vaka çalışma ekranında serbest Türkçe metinle anamnez sor, test iste, tanı koy, puanını al.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
