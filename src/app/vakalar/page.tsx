"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SessionNavigation } from "@/components/auth/SessionNavigation";
import { poliklinikAciklama } from "@/lib/data/poliklinik-aciklamalari";

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
  const [arama, setArama] = useState("");
  const [katalogDurumu, setKatalogDurumu] = useState<"yukleniyor" | "hazir" | "hata">("yukleniyor");
  const [katalogHatasi, setKatalogHatasi] = useState("");

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const session = await response.json();
        return Boolean(session.student);
      })
      .then(setGirisli)
      .catch(() => setGirisli(false));
  }, []);

  const katalogYukle = useCallback(async () => {
    setKatalogDurumu("yukleniyor");
    setKatalogHatasi("");
    try {
      const response = await fetch("/api/cases/templates");
      if (!response.ok) throw new Error("Vaka kataloğu şu anda yüklenemedi.");
      const data = await response.json();
      const grouped = new Map<string, PoliklinikKart>();
      for (const item of data.templates || []) {
        const current = grouped.get(item.poliklinikKey);
        if (current) current.vakaSayisi += 1;
        else grouped.set(item.poliklinikKey, {
          key: item.poliklinikKey,
          ad: item.poliklinikAd,
          icon: item.poliklinikIcon,
          aciklama: poliklinikAciklama(item.poliklinikKey, item.poliklinikAciklama),
          vakaSayisi: 1,
        });
      }
      setPoliklinikler([...grouped.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr")));
      setKatalogDurumu("hazir");
    } catch (error) {
      setPoliklinikler([]);
      setKatalogHatasi(error instanceof Error ? error.message : "Vaka kataloğu şu anda yüklenemedi.");
      setKatalogDurumu("hata");
    }
  }, []);

  useEffect(() => {
    void katalogYukle();
  }, [katalogYukle]);

  const poliklinikHref = (key: string) =>
    girisli ? `/poliklinik/${key}` : `/giris?sonraki=${encodeURIComponent(`/poliklinik/${key}`)}`;
  const filtrelenmisPoliklinikler = useMemo(() => {
    const sorgu = arama.trim().toLocaleLowerCase("tr");
    if (!sorgu) return poliklinikler;
    return poliklinikler.filter((poliklinik) =>
      `${poliklinik.ad} ${poliklinik.aciklama}`.toLocaleLowerCase("tr").includes(sorgu)
    );
  }, [arama, poliklinikler]);

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#ana-icerik" className="skip-link">İçeriğe atla</a>
      <nav className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-ink">
              tıp<span className="text-brand">_ai</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <SessionNavigation compact />
            <Link
              href="/cemicegek"
              className="rounded-full bg-clinical-red/10 px-3 py-3 text-sm font-medium text-clinical-red transition-colors hover:bg-clinical-red/20 sm:px-4 sm:py-1.5"
            >
              <span className="sm:hidden">Acil</span>
              <span className="hidden sm:inline">🚑 Çemiçgezek Acil</span>
            </Link>
            <Link href="/" className="hidden text-sm font-medium text-steel transition-colors hover:text-ink sm:inline">
              ← Ana Sayfa
            </Link>
          </div>
        </div>
      </nav>

      <main id="ana-icerik" tabIndex={-1}>
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl" style={{ letterSpacing: "-1.5px" }}>
          Poliklinik Seç
        </h1>
        <p className="mt-4 text-lg text-steel">
          Bir poliklinik seç — sistem o poliklinikten rastgele bir vaka üretecek. Her seferinde farklı hasta, farklı senaryo.
        </p>
      </div>

      {girisli === false && (
        <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <Link href="/deneme" className="group block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <div className="rounded-lg border border-brand/30 bg-brand-soft/10 p-4 transition-[border-color,box-shadow] hover:border-brand hover:shadow-card sm:p-6">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="text-4xl" aria-hidden="true">🔓</div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-ink mb-1">Deneme Vakası — ücretsiz</h3>
                  <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>
                    Giriş yapmadan tam olarak oynayabileceğin tek vaka. Platformu dene, sonra ücretsiz kayıt olup ilerlemeni takip et.
                  </p>
                </div>
                <span className="btn-primary w-full justify-center sm:w-auto">Vakayı Aç →</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6" aria-labelledby="poliklinik-listesi-baslik">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="poliklinik-listesi-baslik" className="text-lg font-semibold text-ink">Poliklinikler</h2>
            <p className="mt-1 text-sm text-steel" aria-live="polite">
              {katalogDurumu === "hazir" ? `${filtrelenmisPoliklinikler.length} poliklinik bulundu.` : "Katalog hazırlanıyor."}
            </p>
          </div>
          <div className="w-full sm:max-w-sm">
            <label htmlFor="poliklinik-arama" className="sr-only">Poliklinik ara</label>
            <input
              id="poliklinik-arama"
              type="search"
              value={arama}
              onChange={(event) => setArama(event.target.value)}
              className="input"
              placeholder="Poliklinik ara"
              disabled={katalogDurumu !== "hazir"}
            />
          </div>
        </div>

        {katalogDurumu === "yukleniyor" && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Poliklinikler yükleniyor">
            {["bir", "iki", "uc"].map((id) => <div key={id} className="card h-56 animate-pulse bg-surface" />)}
          </div>
        )}

        {katalogDurumu === "hata" && (
          <div className="card max-w-xl border-clinical-red/30" role="alert">
            <h3 className="text-lg font-semibold text-ink">Katalog yüklenemedi</h3>
            <p className="mt-2 text-sm text-steel">{katalogHatasi}</p>
            <button type="button" onClick={() => void katalogYukle()} className="btn-primary mt-5">
              Tekrar dene
            </button>
          </div>
        )}

        {katalogDurumu === "hazir" && filtrelenmisPoliklinikler.length === 0 && (
          <div className="card max-w-xl">
            <h3 className="text-lg font-semibold text-ink">Eşleşen poliklinik bulunamadı</h3>
            <p className="mt-2 text-sm text-steel">Arama ifadenizi değiştirin veya tüm poliklinikleri görmek için aramayı temizleyin.</p>
            <button type="button" onClick={() => setArama("")} className="btn-secondary mt-5">Aramayı temizle</button>
          </div>
        )}

        {katalogDurumu === "hazir" && filtrelenmisPoliklinikler.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtrelenmisPoliklinikler.map((p) => (
            <Link
              key={p.key}
              href={poliklinikHref(p.key)}
              className="card group flex min-h-56 cursor-pointer flex-col transition-[border-color,box-shadow] hover:border-brand hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{p.icon}</div>
                <span className="badge badge-brand">{p.vakaSayisi} vaka tipi</span>
              </div>
              <h3 className="text-xl font-semibold text-ink mb-2">{p.ad}</h3>
              <p className="mb-5 text-sm text-steel" style={{ lineHeight: "1.5" }}>
                {p.aciklama}
              </p>
              <span className="btn-primary mt-auto w-full justify-center text-center">
                {girisli === false ? "🔒 Giriş Yapıp Oyna →" : "Bu Poliklinikten Vaka Al →"}
              </span>
            </Link>
          ))}
        </div>
        )}
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <Link href={girisli === false ? `/giris?sonraki=${encodeURIComponent("/cemicegek")}` : "/cemicegek"} className="group block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clinical-red">
          <div className="rounded-lg border border-clinical-red/20 bg-clinical-red/5 p-4 transition-[border-color,box-shadow] hover:border-clinical-red/50 hover:shadow-card sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="text-5xl" aria-hidden="true">🚑</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-semibold text-ink mb-1">
                  Çemiçgezek Devlet Hastanesi — Acil Simülatör
                </h3>
                <p className="text-sm text-steel" style={{ lineHeight: "1.5" }}>
                  Rastgele poliklinik, rastgele vaka. Acile gelen ilk hastayı sen karşıla. Her seferinde farklı senaryo.
                </p>
              </div>
              <span className="btn-primary w-full justify-center bg-clinical-red text-white hover:bg-clinical-red/80 sm:w-auto">
                {girisli === false ? "🔒 Giriş Yapıp Başla →" : "Acile Başla →"}
              </span>
            </div>
          </div>
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
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
      </main>
    </div>
  );
}
