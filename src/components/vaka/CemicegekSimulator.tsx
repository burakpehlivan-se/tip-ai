"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { vakaUret, AdminTestOverrides } from "@/lib/data/case-generator";
import { fetchAdminTestOverrides } from "@/lib/data/admin-overrides";
import VakaWorkspace, { WorkspaceSnapshot } from "./VakaWorkspace";
import { Vaka, DegerlendirmeSonuc } from "@/lib/types";

async function uretVaka(overrides?: AdminTestOverrides): Promise<Vaka> {
  const adminTests = overrides || (await fetchAdminTestOverrides());
  return vakaUret(undefined, { adminTests });
}

/** Kaç yeni hasta görüldükten sonra lab’daki hasta geri döner */
const GERI_DONUS_ESIK = 2;

interface HastaKayit {
  id: string;
  vaka: Vaka;
  siraNo: number;
  /** Sohbet + test durumu (hasta lab’a gidince saklanır, dönüşte restore) */
  snapshot: WorkspaceSnapshot;
  /** Test için lab’a gönderildi, sonuç bekliyor */
  labda: boolean;
  /** Geri döndü — raporlar açık */
  raporHazir: boolean;
  tamamlandiMi: boolean;
  sonuc?: DegerlendirmeSonuc;
}

function bosSnapshot(): WorkspaceSnapshot {
  return {
    mesajlar: [],
    testIstekleri: [],
    sorulanAksiyonlar: [],
    faz: "anamnez",
    taniInput: "",
    tedaviInput: "",
  };
}

export default function CemicegekSimulator() {
  const [kuyruk, setKuyruk] = useState<HastaKayit[]>([]);
  const [aktifIndex, setAktifIndex] = useState<number>(-1);
  const [siraSayaci, setSiraSayaci] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [toplamGorulen, setToplamGorulen] = useState(0);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Snapshot callback stabil kalsın diye ref
  const aktifIndexRef = useRef(aktifIndex);
  aktifIndexRef.current = aktifIndex;

  const bannerGoster = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5500);
  };

  const ilkHastayiGetir = useCallback(async () => {
    const vaka = await uretVaka();
    const yeniSira = 1;
    const kayit: HastaKayit = {
      id: vaka.id,
      vaka,
      siraNo: yeniSira,
      snapshot: bosSnapshot(),
      labda: false,
      raporHazir: false,
      tamamlandiMi: false,
    };
    setKuyruk([kayit]);
    setAktifIndex(0);
    setSiraSayaci(yeniSira);
    setToplamGorulen(1);
    bannerGoster(`🚑 Yeni hasta: ${vaka.hasta.tamAd || vaka.hasta.ad} — ${vaka.hasta.anaSikayet}`);
  }, []);

  /** Workspace state’ini aktif hastaya yaz */
  const onSnapshotChange = useCallback((snap: WorkspaceSnapshot) => {
    const idx = aktifIndexRef.current;
    if (idx < 0) return;
    setKuyruk((prev) => {
      if (idx >= prev.length) return prev;
      const cur = prev[idx];
      // Lab’da bekleyen / tamamlanan hastanın snapshot’ını bozma
      if (cur.labda && !cur.raporHazir) return prev;
      const yeni = [...prev];
      yeni[idx] = { ...cur, snapshot: snap };
      return yeni;
    });
  }, []);

  /**
   * Test için gönder:
   * 1) Aktif hastayı lab’a koy (snapshot saklı)
   * 2) Yeni hasta getir VEYA eşiği dolmuş lab hastasını geri getir
   * 3) Geri dönen hastada sohbet + testler restore, raporlar açık
   */
  const hastaGonder = useCallback(async () => {
    if (aktifIndex < 0 || gonderiliyor) return;
    const aktif = kuyruk[aktifIndex];
    if (!aktif) return;
    if (aktif.labda && !aktif.raporHazir) return;
    if (aktif.snapshot.testIstekleri.length === 0) {
      bannerGoster("⚠ Önce en az bir test isteyin, sonra lab’a gönderin.");
      return;
    }

    setGonderiliyor(true);
    try {
      const yeniVaka = await uretVaka();
      const gidenSira = aktif.siraNo;
      const yeniSira = siraSayaci + 1;
      const yeniToplam = toplamGorulen + 1;

      setKuyruk((prev) => {
        const yeni = prev.map((k, i) =>
          i === aktifIndex
            ? {
                ...k,
                labda: true,
                raporHazir: false,
                // snapshot zaten onSnapshotChange ile güncel
              }
            : k
        );

        // Eşiği dolan lab hastası var mı? (şimdi gönderilen hariç)
        let donecekIndex = -1;
        for (let i = 0; i < yeni.length; i++) {
          const k = yeni[i];
          if (!k.labda || k.raporHazir || k.tamamlandiMi) continue;
          if (k.siraNo === gidenSira) continue; // az önce giden henüz dönmez
          // Görülen hasta sayısı − bu hastanın siraNo’su ≥ eşik
          // Not: yeni hasta eklenecek → eşik kontrolü yeniToplam ile
          if (yeniToplam - k.siraNo >= GERI_DONUS_ESIK) {
            donecekIndex = i;
            break;
          }
        }

        if (donecekIndex >= 0) {
          // Geri dönen hasta: raporlar aç, snapshot korunur
          yeni[donecekIndex] = {
            ...yeni[donecekIndex],
            labda: false,
            raporHazir: true,
          };
          // Yeni hasta da kuyruğa eklenir (kalabalık artar) ama aktif geri dönen
          const yeniKayit: HastaKayit = {
            id: yeniVaka.id,
            vaka: yeniVaka,
            siraNo: yeniSira,
            snapshot: bosSnapshot(),
            labda: false,
            raporHazir: false,
            tamamlandiMi: false,
          };
          yeni.push(yeniKayit);
          setAktifIndex(donecekIndex);
          const d = yeni[donecekIndex];
          bannerGoster(
            `📋 ${d.vaka.hasta.tamAd || "Hasta"} (#${d.siraNo}) lab’dan döndü — sohbet ve test sonuçları hazır. (Yeni hasta kuyrukta)`
          );
        } else {
          // Sadece yeni hasta
          const yeniKayit: HastaKayit = {
            id: yeniVaka.id,
            vaka: yeniVaka,
            siraNo: yeniSira,
            snapshot: bosSnapshot(),
            labda: false,
            raporHazir: false,
            tamamlandiMi: false,
          };
          yeni.push(yeniKayit);
          setAktifIndex(yeni.length - 1);
          bannerGoster(
            `🧪 Test için gönderildi. Yeni hasta: ${yeniVaka.hasta.tamAd || yeniVaka.hasta.ad} — ${yeniVaka.hasta.anaSikayet}`
          );
        }

        return yeni;
      });

      setSiraSayaci(yeniSira);
      setToplamGorulen(yeniToplam);
    } finally {
      setGonderiliyor(false);
    }
  }, [aktifIndex, gonderiliyor, kuyruk, siraSayaci, toplamGorulen]);

  // Menü
  if (kuyruk.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">🚑</div>
          <h2 className="text-2xl font-semibold text-ink mb-2">Çemiçgezek Devlet Hastanesi</h2>
          <p className="text-sm text-steel mb-2">Acil simülatör</p>
          <ol className="text-left text-sm text-steel mb-6 space-y-1.5 list-decimal pl-5">
            <li>Hastaya anamnez sorun, test isteyin.</li>
            <li>
              <strong className="text-ink">Test için gönder</strong> ile hastayı lab’a yollayın.
            </li>
            <li>Yeni hasta gelir; kalabalık artar.</li>
            <li>
              {GERI_DONUS_ESIK} hasta sonra lab’daki hasta <strong className="text-ink">önceki sohbetiyle</strong> ve
              sonuçlarıyla geri döner.
            </li>
          </ol>
          <button onClick={ilkHastayiGetir} className="btn-accent px-8 py-3 text-lg">
            🚑 Sıradaki Hastayı Getir →
          </button>
          <div className="mt-4">
            <Link href="/vakalar" className="text-xs text-muted hover:text-ink">
              ← Polikliniklere dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const aktif = kuyruk[aktifIndex];
  if (!aktif) return null;

  const isReturning = aktif.raporHazir && !aktif.tamamlandiMi;
  const labdaBekleyen = kuyruk.filter((k) => k.labda && !k.raporHazir && !k.tamamlandiMi).length;
  const testVar = aktif.snapshot.testIstekleri.length > 0;
  const gonderebilir = testVar && !aktif.labda && !aktif.tamamlandiMi && !isReturning;

  // Geri dönen hastada: restore snapshot + raporlar açık
  // Yeni hastada: boş başlangıç (VakaWorkspace default mesaj üretir)
  const restoreSnapshot =
    aktif.snapshot.mesajlar.length > 0 || aktif.snapshot.testIstekleri.length > 0
      ? aktif.snapshot
      : null;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar */}
      <div className="flex h-12 items-center justify-between border-b border-hairline bg-clinical-red/5 px-3 lg:px-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/vakalar" className="text-steel hover:text-ink shrink-0" title="Poliklinikler">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-ink truncate">🚑 Çemiçgezek Acil</span>
          <span className="text-[10px] text-steel hidden sm:inline shrink-0">
            #{aktif.siraNo} · {toplamGorulen} görüldü
            {labdaBekleyen > 0 ? ` · ${labdaBekleyen} lab’da` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gonderebilir && (
            <button
              onClick={hastaGonder}
              disabled={gonderiliyor}
              className="inline-flex items-center gap-1.5 rounded-full bg-clinical-red px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-clinical-red/90 disabled:opacity-60"
            >
              {gonderiliyor ? "Gönderiliyor…" : "🧪 Test için gönder →"}
            </button>
          )}
          {isReturning && (
            <span className="rounded-full bg-brand/15 px-3 py-1.5 text-[11px] font-medium text-brand-deep">
              Lab’dan döndü
            </span>
          )}
          {aktif.labda && !aktif.raporHazir && (
            <span className="text-[11px] text-muted">Lab’da…</span>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`px-4 py-2 text-center text-xs font-medium shrink-0 ${
            isReturning ? "bg-brand/10 text-brand-deep" : "bg-clinical-red/5 text-clinical-red"
          }`}
        >
          {banner}
        </div>
      )}

      {isReturning && (
        <div className="bg-brand/10 border-b border-brand/20 px-4 py-2 text-center text-xs font-semibold text-brand-deep shrink-0">
          📋 Bu hasta lab’a gitmişti — önceki sohbetiniz ve test sonuçları yüklendi. Tanı/tedaviye devam
          edebilirsiniz.
        </div>
      )}

      {/* Kuyruk şeridi (mobil/desktop) */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-hairline bg-surface-soft px-2 py-1.5 shrink-0 scrollbar-none">
        {kuyruk.map((k, i) => {
          const durum = k.tamamlandiMi
            ? "✓"
            : k.raporHazir
              ? "📋"
              : k.labda
                ? "🧪"
                : i === aktifIndex
                  ? "👤"
                  : "⏳";
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                // Sadece aktif veya rapor hazır / tamamlanmış görüntülenebilir; lab’dakine tıklama engeli
                if (k.labda && !k.raporHazir) {
                  bannerGoster(`#${k.siraNo} lab’da — sonuçlar gelince otomatik dönecek.`);
                  return;
                }
                setAktifIndex(i);
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors ${
                i === aktifIndex
                  ? "border-ink bg-ink text-white"
                  : k.labda && !k.raporHazir
                    ? "border-hairline bg-surface text-muted"
                    : "border-hairline bg-canvas text-steel hover:border-ink/40"
              }`}
              title={k.vaka.hasta.tamAd}
            >
              {durum} #{k.siraNo}
            </button>
          );
        })}
      </div>

      <VakaWorkspace
        key={`${aktif.id}-${aktif.raporHazir ? "donus" : "ilk"}`}
        vaka={aktif.vaka}
        mod="cemicegek"
        embed
        // İlk görüşmede test sonuçları gizli; lab dönüşünde açık
        raporHazir={aktif.raporHazir}
        onTestIstendi={() => {
          bannerGoster("Test kaydedildi. Bitince üstteki «Test için gönder»e basın.");
        }}
        onSnapshotChange={onSnapshotChange}
        initialSnapshot={restoreSnapshot}
        hastaneAdi="ÇEMİÇGEZEK DEVLET HASTANESİ"
      />
    </div>
  );
}
