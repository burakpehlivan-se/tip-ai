"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { vakaUret } from "@/lib/data/case-generator";
import VakaWorkspace from "./VakaWorkspace";
import { Vaka, ChatMesaj, TestIstegi, DegerlendirmeSonuc } from "@/lib/types";

type HastaDurum = "NEW" | "TEST_ORDERED" | "WAITING_RESULTS" | "RESULTS_READY" | "COMPLETED";
type Kalabalik = "az" | "orta" | "cok";

interface HastaKayit {
  id: string;
  vaka: Vaka;
  durum: HastaDurum;
  mesajlar: ChatMesaj[];
  testIstekleri: TestIstegi[];
  sorulanAksiyonlar: string[];
  taniInput: string;
  tedaviInput: string;
  siraNo: number;
  sonuc?: DegerlendirmeSonuc;
}

const KALABALIK_THRESHOLD: Record<Kalabalik, number> = { az: 1, orta: 3, cok: 5 };

export default function CemicegekSimulator() {
  const [kalabalik, setKalabalik] = useState<Kalabalik>("orta");
  const [hastaKayitlari, setHastaKayitlari] = useState<HastaKayit[]>([]);
  const [aktifHastaIndex, setAktifHastaIndex] = useState<number>(-1);
  const [toplamHastaSayisi, setToplamHastaSayisi] = useState(0);
  const [banner, setBanner] = useState<{ metin: string; tip: "yeni" | "donus" } | null>(null);

  const ilkHastayiGetir = useCallback(() => {
    const vaka = vakaUret();
    const kayit: HastaKayit = {
      id: vaka.id,
      vaka,
      durum: "NEW",
      mesajlar: [],
      testIstekleri: [],
      sorulanAksiyonlar: [],
      taniInput: "",
      tedaviInput: "",
      siraNo: 1,
    };
    setHastaKayitlari([kayit]);
    setAktifHastaIndex(0);
    setToplamHastaSayisi(1);
    setBanner({ metin: `Yeni hasta: ${vaka.hasta.yas} yaş, ${vaka.hasta.cinsiyet === "E" ? "erkek" : "kadın"} — ${vaka.hasta.anaSikayet}`, tip: "yeni" });
    setTimeout(() => setBanner(null), 4000);
  }, []);

  const testIstendi = useCallback((vakaId: string, _testKey: string) => {
    setHastaKayitlari((prev) => {
      const yeni = [...prev];
      const mevcutIndex = yeni.findIndex((k) => k.id === vakaId);
      if (mevcutIndex < 0) return prev;

      // Aktif hastayı WAITING_RESULTS yap
      yeni[mevcutIndex] = { ...yeni[mevcutIndex], durum: "WAITING_RESULTS" };

      // Threshold kontrolü: bekleyen hastalardan RESULTS_READY olması gereken var mı?
      const threshold = KALABALIK_THRESHOLD[kalabalik];
      const yeniToplam = toplamHastaSayisi + 1;
      
      yeni.forEach((k, i) => {
        if (k.durum === "WAITING_RESULTS" && yeniToplam - k.siraNo >= threshold) {
          yeni[i] = { ...yeni[i], durum: "RESULTS_READY" };
        }
      });

      // Yeni hasta üret
      const hastaVaka = vakaUret();
      const yeniKayit: HastaKayit = {
        id: hastaVaka.id,
        vaka: hastaVaka,
        durum: "NEW",
        mesajlar: [],
        testIstekleri: [],
        sorulanAksiyonlar: [],
        taniInput: "",
        tedaviInput: "",
        siraNo: yeniToplam,
      };
      yeni.push(yeniKayit);

      setToplamHastaSayisi(yeniToplam);
      setAktifHastaIndex(yeni.length - 1);
      setBanner({ metin: `Yeni hasta: ${hastaVaka.hasta.yas} yaş, ${hastaVaka.hasta.cinsiyet === "E" ? "erkek" : "kadın"} — ${hastaVaka.hasta.anaSikayet}`, tip: "yeni" });
      setTimeout(() => setBanner(null), 4000);

      return yeni;
    });
  }, [kalabalik, toplamHastaSayisi]);

  const hastayaGeriDon = useCallback((kayitIndex: number) => {
    setHastaKayitlari((prev) => {
      const yeni = [...prev];
      const k = yeni[kayitIndex];
      yeni[kayitIndex] = { ...yeni[kayitIndex], durum: "NEW" }; // tekrar aktif
      setAktifHastaIndex(kayitIndex);
      setBanner({ metin: `Daha önce test istediğiniz hasta tekrar geldi. Sonuçları hazır.`, tip: "donus" });
      setTimeout(() => setBanner(null), 4000);
      return yeni;
    });
  }, []);

  const vakaTamamlandi = useCallback((kayitIndex: number, sonuc: DegerlendirmeSonuc) => {
    setHastaKayitlari((prev) => {
      const yeni = [...prev];
      yeni[kayitIndex] = { ...yeni[kayitIndex], durum: "COMPLETED", sonuc };
      return yeni;
    });
  }, []);

  const sadeceSira = useCallback(() => {
    const vaka = vakaUret();
    const yeniToplam = toplamHastaSayisi + 1;
    const yeniKayit: HastaKayit = {
      id: vaka.id,
      vaka,
      durum: "NEW",
      mesajlar: [],
      testIstekleri: [],
      sorulanAksiyonlar: [],
      taniInput: "",
      tedaviInput: "",
      siraNo: yeniToplam,
    };

    setHastaKayitlari((prev) => [...prev, yeniKayit]);
    setToplamHastaSayisi(yeniToplam);
    setAktifHastaIndex((prev) => prev + 1);
    setBanner({ metin: `Yeni hasta: ${vaka.hasta.yas} yaş, ${vaka.hasta.cinsiyet === "E" ? "erkek" : "kadın"} — ${vaka.hasta.anaSikayet}`, tip: "yeni" });
    setTimeout(() => setBanner(null), 4000);
  }, [toplamHastaSayisi]);

  // Menü: henüz başlamadıysa
  if (hastaKayitlari.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">🚑</div>
          <h2 className="text-2xl font-semibold text-ink mb-2">Çemiçgezek Devlet Hastanesi</h2>
          <p className="text-sm text-steel mb-6">Acil simülatör — hastalar test isteyince sıraya girer, kalabalıklık seviyesine göre sonuçlarıyla geri döner.</p>
          <div className="mb-6">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 block">Kalabalıklık</label>
            <div className="flex justify-center gap-2">
              {(["az","orta","cok"] as Kalabalik[]).map((k) => (
                <button key={k} onClick={() => setKalabalik(k)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${kalabalik === k ? "bg-ink text-white border-ink" : "border-hairline bg-canvas text-steel hover:border-ink/30"}`}>
                  {k === "az" ? "Az (1 hasta)" : k === "orta" ? "Orta (3 hasta)" : "Çok (5 hasta)"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={ilkHastayiGetir} className="btn-accent px-8 py-3 text-lg">
            🚑 Sıradaki Hastayı Getir →
          </button>
          <div className="mt-4">
            <Link href="/vakalar" className="text-xs text-muted hover:text-ink">← Polikliniklere dön</Link>
          </div>
        </div>
      </div>
    );
  }

  const aktifKayit = hastaKayitlari[aktifHastaIndex];
  if (!aktifKayit) return null;

  // RESULTS_READY hastaları göster
  const resultsReady = hastaKayitlari
    .map((k, i) => ({ ...k, index: i }))
    .filter((k) => k.durum === "RESULTS_READY");

  const bekleyenSayisi = hastaKayitlari.filter((k) => k.durum === "WAITING_RESULTS").length;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Çemiçgezek Top Bar */}
      <div className="flex h-11 lg:h-12 items-center justify-between border-b border-hairline bg-clinical-red/5 px-3 lg:px-4">
        <div className="flex items-center gap-2 lg:gap-3">
          <Link href="/vakalar" className="text-steel hover:text-ink transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-sm font-semibold text-ink truncate">🚑 Çemiçgezek Acil</span>
          <span className="text-[10px] lg:text-xs text-steel hidden sm:inline">
            {aktifKayit.siraNo}. hasta · {bekleyenSayisi} bekleyen
          </span>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2">
          {/* Kalabalıklık pill */}
          <div className="hidden sm:flex items-center gap-0.5 bg-surface rounded-full p-0.5">
            {(["az","orta","cok"] as Kalabalik[]).map((k) => (
              <button key={k} onClick={() => setKalabalik(k)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${kalabalik === k ? "bg-ink text-white" : "text-steel"}`}>
                {k === "az" ? "Az" : k === "orta" ? "Orta" : "Çok"}
              </button>
            ))}
          </div>
          <button onClick={sadeceSira} className="btn-secondary text-[10px] lg:text-xs h-8 px-2 lg:px-3">+ Hasta</button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`px-4 py-2 text-center text-xs font-medium animate-pulse ${
          banner.tip === "donus" ? "bg-brand/10 text-brand-deep" : "bg-clinical-red/5 text-clinical-red"
        }`}>
          {banner.metin}
        </div>
      )}

      {/* RESULTS_READY listesi */}
      {resultsReady.length > 0 && (
        <div className="border-b border-brand/20 bg-brand/5 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-brand-deep">📋 Sonuçları hazır:</span>
            {resultsReady.map((k) => (
              <button key={k.id} onClick={() => hastayaGeriDon(k.index)}
                className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-deep hover:bg-brand/25 transition-colors">
                #{k.siraNo} {k.vaka.hasta.tamAd} — {k.vaka.hasta.anaSikayet.slice(0, 25)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aktif Hasta Workspace */}
      <VakaWorkspace
        key={aktifKayit.id}
        vaka={aktifKayit.vaka}
        mod="cemicegek"
        raporHazir={aktifKayit.durum !== "WAITING_RESULTS"}
        onTestIstendi={(testKey) => testIstendi(aktifKayit.id, testKey)}
        hastaneAdi="ÇEMİÇGEZEK DEVLET HASTANESİ"
      />
    </div>
  );
}
