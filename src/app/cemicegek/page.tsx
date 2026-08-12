"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CemicegekSimulator from "@/components/vaka/CemicegekSimulator";

export default function CemicegekPage() {
  const router = useRouter();
  const [izniVar, setIzniVar] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/me")
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          router.replace(`/giris?sonraki=${encodeURIComponent("/cemicegek")}`);
        } else {
          setIzniVar(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(`/giris?sonraki=${encodeURIComponent("/cemicegek")}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!izniVar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <p className="text-lg font-medium text-ink mb-2">Çemiçgezek Acil</p>
          <p className="text-sm text-steel" role="status">Oturum doğrulanıyor…</p>
        </div>
      </div>
    );
  }

  return <CemicegekSimulator />;
}
