"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-10">
      <section
        aria-labelledby="hata-baslik"
        aria-describedby="hata-aciklama"
        className="w-full max-w-md rounded-xl border border-hairline bg-canvas p-6 text-center shadow-sm sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-clinical-orange">Sistem durumu</p>
        <h1 id="hata-baslik" className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Bu sayfa şu anda açılamadı
        </h1>
        <p id="hata-aciklama" className="mt-3 text-sm leading-6 text-steel">
          Geçici bir sorun oluştu. Çalışmanızın kaybolmaması için sayfayı yeniden deneyebilir veya ana sayfaya dönebilirsiniz.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-secondary inline-flex min-h-11 items-center justify-center px-5 text-sm">
            Ana sayfaya dön
          </Link>
          <button ref={retryRef} type="button" onClick={reset} className="btn-primary min-h-11 px-5 text-sm">
            Yeniden dene
          </button>
        </div>
      </section>
    </main>
  );
}
