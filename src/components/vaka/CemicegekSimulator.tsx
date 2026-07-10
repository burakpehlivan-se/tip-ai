"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { vakaUret, AdminTestOverrides } from "@/lib/data/case-generator";
import { fetchAdminTestOverrides } from "@/lib/data/admin-overrides";
import VakaWorkspace, { WorkspaceSnapshot } from "./VakaWorkspace";
import { Vaka, DegerlendirmeSonuc } from "@/lib/types";

async function uretVaka(overrides?: AdminTestOverrides): Promise<Vaka> {
  const adminTests = overrides || (await fetchAdminTestOverrides());
  return vakaUret(undefined, { adminTests });
}

/** Fallback — admin ayarlarından override edilir */
const DEFAULT_GERI_DONUS = 2;

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

function labDonusHazirMi(k: HastaKayit, toplamGorulen: number, esik: number): boolean {
  return k.labda && !k.raporHazir && !k.tamamlandiMi && toplamGorulen - k.siraNo >= esik;
}

export default function CemicegekSimulator() {
  const [kuyruk, setKuyruk] = useState<HastaKayit[]>([]);
  const [aktifIndex, setAktifIndex] = useState<number>(-1);
  const [siraSayaci, setSiraSayaci] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [toplamGorulen, setToplamGorulen] = useState(0);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [geriDonusEsik, setGeriDonusEsik] = useState(DEFAULT_GERI_DONUS);

  const aktifIndexRef = useRef(aktifIndex);
  aktifIndexRef.current = aktifIndex;
  const kuyrukRef = useRef(kuyruk);
  kuyrukRef.current = kuyruk;
  const toplamRef = useRef(toplamGorulen);
  toplamRef.current = toplamGorulen;
  const siraRef = useRef(siraSayaci);
  siraRef.current = siraSayaci;
  const esikRef = useRef(geriDonusEsik);
  esikRef.current = geriDonusEsik;

  useEffect(() => {
    fetch("/api/admin/settings/public")
      .then((r) => r.json())
      .then((d) => {
        const c = d.cemicegek;
        if (!c) return;
        const min = Number(c.geriDonusMin) || DEFAULT_GERI_DONUS;
        const max = Math.max(min, Number(c.geriDonusMax) || min);
        const esik = min + Math.floor(Math.random() * (max - min + 1));
        setGeriDonusEsik(esik);
      })
      .catch(() => {});
  }, []);

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

  const onSnapshotChange = useCallback((snap: WorkspaceSnapshot) => {
    const idx = aktifIndexRef.current;
    if (idx < 0) return;
    setKuyruk((prev) => {
      if (idx >= prev.length) return prev;
      const cur = prev[idx];
      if (cur.labda && !cur.raporHazir) return prev;
      const yeni = [...prev];
      yeni[idx] = { ...cur, snapshot: snap };
      return yeni;
    });
  }, []);

  /**
   * Sonraki hastayı seç:
   * 1) Lab eşiğini doldurmuş hasta → sonuçlarla dön
   * 2) Kuyrukta bekleyen (lab’da değil, tamamlanmamış)
   * 3) Yoksa yeni hasta üret
   */
  const secSonraki = useCallback(
    async (
      liste: HastaKayit[],
      excludeIndex: number,
      opts: { toplam: number; sira: number; esik: number; uretYeni: boolean }
    ): Promise<{ liste: HastaKayit[]; aktif: number; banner: string; yeniToplam?: number; yeniSira?: number }> => {
      // 1) Lab dönüşü (eşiği dolan)
      for (let i = 0; i < liste.length; i++) {
        if (i === excludeIndex) continue;
        const k = liste[i];
        if (labDonusHazirMi(k, opts.toplam, opts.esik)) {
          const kopya = [...liste];
          kopya[i] = { ...kopya[i], labda: false, raporHazir: true };
          return {
            liste: kopya,
            aktif: i,
            banner: `📋 ${k.vaka.hasta.tamAd || "Hasta"} (#${k.siraNo}) lab’dan döndü — sohbet ve test sonuçları hazır.`,
          };
        }
      }

      // 2) Bekleyen (odada / kuyrukta, lab’da değil)
      let best = -1;
      for (let i = 0; i < liste.length; i++) {
        if (i === excludeIndex) continue;
        const k = liste[i];
        if (k.tamamlandiMi || k.labda) continue;
        if (best < 0 || k.siraNo < liste[best].siraNo) best = i;
      }
      if (best >= 0) {
        const k = liste[best];
        return {
          liste,
          aktif: best,
          banner: `👤 Sıradaki hasta: ${k.vaka.hasta.tamAd || k.vaka.hasta.ad} (#${k.siraNo}) — ${k.vaka.hasta.anaSikayet}`,
        };
      }

      // 2b) Kuyruk boşsa lab’daki en eski hastayı sonuçlarıyla getir
      {
        let oldestLab = -1;
        for (let i = 0; i < liste.length; i++) {
          if (i === excludeIndex) continue;
          const k = liste[i];
          if (!k.labda || k.raporHazir || k.tamamlandiMi) continue;
          if (oldestLab < 0 || k.siraNo < liste[oldestLab].siraNo) oldestLab = i;
        }
        if (oldestLab >= 0) {
          const k = liste[oldestLab];
          const kopya = [...liste];
          kopya[oldestLab] = { ...kopya[oldestLab], labda: false, raporHazir: true };
          return {
            liste: kopya,
            aktif: oldestLab,
            banner: `📋 ${k.vaka.hasta.tamAd || "Hasta"} (#${k.siraNo}) lab’dan çağrıldı — test sonuçları hazır.`,
          };
        }
      }

      // 3) Yeni üret
      if (opts.uretYeni) {
        const vaka = await uretVaka();
        const yeniSira = opts.sira + 1;
        const yeniToplam = opts.toplam + 1;
        const kayit: HastaKayit = {
          id: vaka.id,
          vaka,
          siraNo: yeniSira,
          snapshot: bosSnapshot(),
          labda: false,
          raporHazir: false,
          tamamlandiMi: false,
        };
        // Yeni hasta eklenince lab eşiği dolmuş olabilir — önce lab dönüşü dene
        let liste2 = [...liste, kayit];
        for (let i = 0; i < liste2.length; i++) {
          const k = liste2[i];
          if (labDonusHazirMi(k, yeniToplam, opts.esik)) {
            liste2[i] = { ...liste2[i], labda: false, raporHazir: true };
            return {
              liste: liste2,
              aktif: i,
              banner: `📋 ${k.vaka.hasta.tamAd || "Hasta"} (#${k.siraNo}) lab’dan döndü. (Yeni hasta kuyruğa eklendi: #${yeniSira})`,
              yeniToplam,
              yeniSira,
            };
          }
        }
        return {
          liste: liste2,
          aktif: liste2.length - 1,
          banner: `🚑 Yeni hasta: ${vaka.hasta.tamAd || vaka.hasta.ad} — ${vaka.hasta.anaSikayet}`,
          yeniToplam,
          yeniSira,
        };
      }

      return {
        liste,
        aktif: excludeIndex >= 0 ? excludeIndex : 0,
        banner: "Kuyrukta hasta kalmadı.",
      };
    },
    []
  );

  /**
   * Test için lab’a gönder → aktif lab’a gider, sonra sıradaki (veya lab dönüşü / yeni)
   */
  const testIcinGonder = useCallback(async () => {
    if (aktifIndex < 0 || gonderiliyor) return;
    const aktif = kuyrukRef.current[aktifIndex];
    if (!aktif) return;
    if (aktif.labda && !aktif.raporHazir) return;
    if (aktif.snapshot.testIstekleri.length === 0) {
      bannerGoster("⚠ Önce en az bir test isteyin, sonra lab’a gönderin.");
      return;
    }

    setGonderiliyor(true);
    try {
      const esik = esikRef.current;
      const gidenSira = aktif.siraNo;
      let liste = kuyrukRef.current.map((k, i) =>
        i === aktifIndex ? { ...k, labda: true, raporHazir: false, tamamlandiMi: false } : { ...k }
      );

      // Yeni hasta her lab gönderiminde kuyruğu besler (kalabalık)
      const vaka = await uretVaka();
      const yeniSira = siraRef.current + 1;
      const yeniToplam = toplamRef.current + 1;
      liste.push({
        id: vaka.id,
        vaka,
        siraNo: yeniSira,
        snapshot: bosSnapshot(),
        labda: false,
        raporHazir: false,
        tamamlandiMi: false,
      });

      // Lab dönüşü (az önce giden hariç)
      let donecek = -1;
      for (let i = 0; i < liste.length; i++) {
        const k = liste[i];
        if (k.siraNo === gidenSira) continue;
        if (labDonusHazirMi(k, yeniToplam, esik)) {
          donecek = i;
          break;
        }
      }

      if (donecek >= 0) {
        liste[donecek] = { ...liste[donecek], labda: false, raporHazir: true };
        setKuyruk(liste);
        setAktifIndex(donecek);
        setSiraSayaci(yeniSira);
        setToplamGorulen(yeniToplam);
        const d = liste[donecek];
        bannerGoster(
          `📋 ${d.vaka.hasta.tamAd || "Hasta"} (#${d.siraNo}) lab’dan döndü. Yeni hasta kuyrukta (#${yeniSira}).`
        );
      } else {
        // Bekleyen (yeni eklenen) → odaya al
        setKuyruk(liste);
        setAktifIndex(liste.length - 1);
        setSiraSayaci(yeniSira);
        setToplamGorulen(yeniToplam);
        bannerGoster(
          `🧪 Test için gönderildi. Yeni hasta: ${vaka.hasta.tamAd || vaka.hasta.ad} — ${vaka.hasta.anaSikayet}`
        );
      }
    } finally {
      setGonderiliyor(false);
    }
  }, [aktifIndex, gonderiliyor]);

  /**
   * Hastayı gönder / sıradaki:
   * Mevcut muayene bitti (lab dönüşü sonrası tanı vb.) →
   * sıradaki bekleyen veya lab’dan dönen veya yeni hasta
   */
  const hastayiGonderSiradaki = useCallback(async () => {
    if (aktifIndex < 0 || gonderiliyor) return;
    setGonderiliyor(true);
    try {
      const esik = esikRef.current;
      const toplam = toplamRef.current;
      const sira = siraRef.current;

      // Aktifi tamamlandı say
      let liste = kuyrukRef.current.map((k, i) =>
        i === aktifIndex
          ? { ...k, tamamlandiMi: true, labda: false }
          : { ...k }
      );

      const sonuc = await secSonraki(liste, aktifIndex, {
        toplam,
        sira,
        esik,
        uretYeni: true,
      });

      setKuyruk(sonuc.liste);
      setAktifIndex(sonuc.aktif);
      if (sonuc.yeniSira != null) setSiraSayaci(sonuc.yeniSira);
      if (sonuc.yeniToplam != null) setToplamGorulen(sonuc.yeniToplam);
      bannerGoster(sonuc.banner);
    } finally {
      setGonderiliyor(false);
    }
  }, [aktifIndex, gonderiliyor, secSonraki]);

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
              <strong className="text-ink">Test için gönder</strong> → hasta lab’a gider, yeni hasta gelir.
            </li>
            <li>
              {geriDonusEsik} hasta sonra lab hastası <strong className="text-ink">sohbetiyle + sonuçlarıyla</strong>{" "}
              döner.
            </li>
            <li>
              Dönen hastayı bitirince <strong className="text-ink">Hastayı gönder · sıradaki</strong> ile devam edin.
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
  const kuyruktaBekleyen = kuyruk.filter(
    (k, i) => i !== aktifIndex && !k.tamamlandiMi && !k.labda
  ).length;
  const testVar = aktif.snapshot.testIstekleri.length > 0;
  /** İlk muayene: test var, henüz lab’a gitmedi, dönen hasta değil */
  const testGonderebilir =
    testVar && !aktif.labda && !aktif.tamamlandiMi && !isReturning;
  /**
   * Sıradaki: lab’dan dönen hasta, veya test göndermeden/sevk ile geçiş,
   * veya tanı sonrası devam — her zaman mevcut hasta “bitti” sayılır
   */
  const siradakiGoster = !aktif.labda || aktif.raporHazir;

  const restoreSnapshot =
    aktif.snapshot.mesajlar.length > 0 || aktif.snapshot.testIstekleri.length > 0
      ? aktif.snapshot
      : null;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar */}
      <div className="flex h-12 items-center justify-between border-b border-hairline bg-clinical-red/5 px-3 lg:px-4 shrink-0 gap-2">
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
            {kuyruktaBekleyen > 0 ? ` · ${kuyruktaBekleyen} kuyrukta` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {testGonderebilir && (
            <button
              onClick={testIcinGonder}
              disabled={gonderiliyor}
              className="inline-flex items-center gap-1.5 rounded-full bg-clinical-red px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-clinical-red/90 disabled:opacity-60"
            >
              {gonderiliyor ? "…" : "🧪 Test için gönder"}
            </button>
          )}
          {siradakiGoster && (
            <button
              onClick={hastayiGonderSiradaki}
              disabled={gonderiliyor}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-charcoal disabled:opacity-60"
              title="Mevcut hastayı bitir, sıradaki veya lab’dan dönen hastayı al"
            >
              {gonderiliyor ? "…" : "➡️ Hastayı gönder · sıradaki"}
            </button>
          )}
          {isReturning && (
            <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand-deep">
              Lab’dan döndü
            </span>
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
          📋 Lab dönüşü — sohbet ve test sonuçları yüklendi. Bitince{" "}
          <span className="underline">Hastayı gönder · sıradaki</span> ile devam edin.
        </div>
      )}

      {/* Kuyruk şeridi */}
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
                if (k.labda && !k.raporHazir) {
                  bannerGoster(`#${k.siraNo} lab’da — eşik dolunca veya «sıradaki» ile dönebilir.`);
                  return;
                }
                if (k.tamamlandiMi) {
                  bannerGoster(`#${k.siraNo} muayenesi tamamlandı.`);
                  return;
                }
                setAktifIndex(i);
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors ${
                i === aktifIndex
                  ? "border-ink bg-ink text-white"
                  : k.labda && !k.raporHazir
                    ? "border-hairline bg-surface text-muted"
                    : k.tamamlandiMi
                      ? "border-hairline bg-surface text-muted line-through"
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
        key={`${aktif.id}-${aktif.raporHazir ? "donus" : "ilk"}-${aktif.tamamlandiMi ? "done" : "act"}`}
        vaka={aktif.vaka}
        mod="cemicegek"
        embed
        raporHazir={aktif.raporHazir}
        onTestIstendi={() => {
          bannerGoster("Test kaydedildi. Bitince «Test için gönder» veya tanı sonrası «Hastayı gönder · sıradaki».");
        }}
        onSnapshotChange={onSnapshotChange}
        initialSnapshot={restoreSnapshot}
        hastaneAdi="ÇEMİÇGEZEK DEVLET HASTANESİ"
      />
    </div>
  );
}
