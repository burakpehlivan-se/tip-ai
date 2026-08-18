"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function VakaPaylasimPage() {
  const params = useParams();
  const router = useRouter();
  const vakaNo = params.vakaNo as string;
  const [hata, setHata] = useState("");

  useEffect(() => {
    let cancelled = false;
    const baslat = async () => {
      try {
        const oturum = await fetch("/api/student/me");
        if (cancelled) return;
        if (!oturum.ok) {
          router.replace(`/giris?sonraki=${encodeURIComponent(`/vaka/${vakaNo}`)}`);
          return;
        }
        const response = await fetch("/api/student/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vakaNo }),
        });
        if (cancelled) return;
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setHata(data?.error || "Vaka hazırlanamadı.");
          return;
        }
        const poliklinikKey = typeof data?.poliklinikKey === "string" ? data.poliklinikKey : null;
        if (poliklinikKey) {
          router.replace(`/poliklinik/${encodeURIComponent(poliklinikKey)}`);
        } else {
          setHata("Vaka yönlendirilemedi. Lütfen poliklinik listesinden devam edin.");
        }
      } catch {
        if (!cancelled) setHata("Sunucuya bağlanılamadı.");
      }
    };
    void baslat();
    return () => {
      cancelled = true;
    };
  }, [vakaNo, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-sm text-center">
        {hata ? (
          <>
            <p role="alert" className="text-lg font-medium text-clinical-red">{hata}</p>
            <Link href="/vakalar" className="btn-primary mt-5 inline-flex">
              Poliklinikler
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-medium text-ink">Vaka #{vakaNo}</p>
            <p className="mt-2 text-sm text-steel">Vaka hazırlanıyor...</p>
            <div className="mt-6 mx-auto h-1 w-32 overflow-hidden rounded-full bg-surface">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
