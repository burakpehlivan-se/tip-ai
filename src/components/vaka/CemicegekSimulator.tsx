"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { vakaUret } from "@/lib/data/case-generator";
import VakaWorkspace from "./VakaWorkspace";
import { Vaka, ChatMesaj, TestIstegi, DegerlendirmeSonuc } from "@/lib/types";

const GERI_DONUS_ESIK = 2; // kaç hasta sonra geri gelir

interface HastaKayit {
  id: string;
  vaka: Vaka;
  siraNo: number;
  mesajlar: ChatMesaj[];
  testIstekleri: TestIstegi[];
  sorulanAksiyonlar: string[];
  taniInput: string;
  tedaviInput: string;
  sonuc?: DegerlendirmeSonuc;
  testIstendiMi: boolean;
  tamamlandiMi: boolean;
}

export default function CemicegekSimulator() {
  const [kuyruk, setKuyruk] = useState<HastaKayit[]>([]);
  const [aktifIndex, setAktifIndex] = useState<number>(-1);
  const [siraSayaci, setSiraSayaci] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [toplamGorulen, setToplamGorulen] = useState(0);

  const bannerGoster = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  const ilkHastayiGetir = useCallback(() => {
    const vaka = vakaUret();
    const yeniSira = siraSayaci + 1;
    const kayit: HastaKayit = {
      id: vaka.id, vaka, siraNo: yeniSira,
      mesajlar: [], testIstekleri: [], sorulanAksiyonlar: [],
      taniInput: "", tedaviInput: "", testIstendiMi: false, tamamlandiMi: false,
    };
    setKuyruk([kayit]);
    setAktifIndex(0);
    setSiraSayaci(yeniSira);
    setToplamGorulen(1);
    bannerGoster(`🚑 Yeni hasta: ${vaka.hasta.yas} yaş — ${vaka.hasta.anaSikayet}`);
  }, [siraSayaci]);

  // Test istendi + "gönder" → hasta kuyruğa, yeni hasta gelir
  const hastaGonder = useCallback(() => {
    setKuyruk((prev) => {
      const yeni = [...prev];
      if (aktifIndex < 0 || aktifIndex >= yeni.length) return prev;
      
      // Aktif hastayı "test istendi" olarak işaretle
      yeni[aktifIndex] = { ...yeni[aktifIndex], testIstendiMi: true };
      const gidenSira = yeni[aktifIndex].siraNo;

      // Yeni hasta üret
      const vaka = vakaUret();
      const yeniSira = siraSayaci + 1;
      const yeniKayit: HastaKayit = {
        id: vaka.id, vaka, siraNo: yeniSira,
        mesajlar: [], testIstekleri: [], sorulanAksiyonlar: [],
        taniInput: "", tedaviInput: "", testIstendiMi: false, tamamlandiMi: false,
      };
      yeni.push(yeniKayit);

      const yeniToplam = toplamGorulen + 1;
      
      // Threshold kontrolü: test istemiş hastalardan GERI_DONUS_ESIK kadar
      // yeni hasta görüldüyse RESULTS_READY yap
      yeni.forEach((k, i) => {
        if (!k.testIstendiMi || k.tamamlandiMi) return;
        if (yeniToplam - k.siraNo >= GERI_DONUS_ESIK) {
          // Bu hasta geri gelmeli — ama sadece tamamlanmamış olan
          // Eğer aktif index'teki değilse, onu aktif yap
        }
      });

      setSiraSayaci(yeniSira);
      setToplamGorulen(yeniToplam);
      setAktifIndex(yeni.length - 1);
      bannerGoster(`🧪 Test için gönderildi. ${vaka.hasta.yas} yaş yeni hasta: ${vaka.hasta.anaSikayet}`);

      return yeni;
    });
  }, [aktifIndex, siraSayaci, toplamGorulen]);

  // Geri dönecek hastaları kontrol et ve aktif yap
  const geriDonenKontrol = useCallback(() => {
    setKuyruk((prev) => {
      // Tamamlanmamış + test istemiş + eşik aşılmış hastayı bul
      for (let i = 0; i < prev.length; i++) {
        const k = prev[i];
        if (k.tamamlandiMi || !k.testIstendiMi) continue;
        if (toplamGorulen - k.siraNo >= GERI_DONUS_ESIK) {
          setAktifIndex(i);
          bannerGoster(`📋 Daha önce test istediğiniz hasta tekrar geldi. Test sonuçları hazır.`);
          return prev;
        }
      }
      return prev;
    });
  }, [toplamGorulen]);

  // Vaka tamamlandı
  const vakaTamamlandi = useCallback((sonuc: DegerlendirmeSonuc) => {
    setKuyruk((prev) => {
      const yeni = [...prev];
      if (aktifIndex >= 0 && aktifIndex < yeni.length) {
        yeni[aktifIndex] = { ...yeni[aktifIndex], tamamlandiMi: true, sonuc };
      }
      // Sıradaki hastayı getir
      geriDonenKontrol();
      return yeni;
    });
  }, [aktifIndex, geriDonenKontrol]);

  // Menü ekranı
  if (kuyruk.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">🚑</div>
          <h2 className="text-2xl font-semibold text-ink mb-2">Çemiçgezek Devlet Hastanesi</h2>
          <p className="text-sm text-steel mb-6">
            Acil simülatör — hastadan test iste, "Test için gönder", yeni hasta gelir. {GERI_DONUS_ESIK} hasta sonra ilk hasta sonuçlarıyla geri döner.
          </p>
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

  const aktif = kuyruk[aktifIndex];
  if (!aktif) return null;

  const isReturning = aktif.testIstendiMi && !aktif.tamamlandiMi;
  const bekleyenSayisi = kuyruk.filter((k) => k.testIstendiMi && !k.tamamlandiMi && k.id !== aktif.id).length;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar */}
      <div className="flex h-11 lg:h-12 items-center justify-between border-b border-hairline bg-clinical-red/5 px-3 lg:px-4">
        <div className="flex items-center gap-2">
          <Link href="/vakalar" className="text-steel hover:text-ink shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <span className="text-sm font-semibold text-ink truncate">🚑 Çemiçgezek Acil</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-steel hidden sm:inline">
            {aktif.siraNo}. hasta · {toplamGorulen} görüldü{bekleyenSayisi > 0 ? ` · ${bekleyenSayisi} bekliyor` : ""}
          </span>
          {/* Test için gönder butonu — sadece test istenmiş ve geri dönmemiş hastada */}
          {aktif.testIstekleri.length > 0 && !isReturning && (
            <button onClick={hastaGonder} className="btn-accent text-xs h-8 px-3">
              Test için gönder →
            </button>
          )}
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`px-4 py-2 text-center text-xs font-medium animate-pulse ${
          isReturning ? "bg-brand/10 text-brand-deep" : "bg-clinical-red/5 text-clinical-red"
        }`}>
          {banner}
        </div>
      )}

      {/* Geri dönen hasta uyarısı */}
      {isReturning && (
        <div className="bg-brand/10 border-b border-brand/20 px-4 py-2 text-center text-xs font-semibold text-brand-deep">
          📋 Bu hasta daha önce test istemişti — test sonuçları aşağıda hazır
        </div>
      )}

      <VakaWorkspace
        key={aktif.id}
        vaka={aktif.vaka}
        mod="cemicegek"
        raporHazir={isReturning}
        onTestIstendi={() => {}} // test istendi ama hemen gönderme — kullanıcı butona basacak
        hastaneAdi="ÇEMİÇGEZEK DEVLET HASTANESİ"
      />
    </div>
  );
}
