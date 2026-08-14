"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SessionSummary = {
  username: string;
  displayName: string;
  role: "admin" | "doktor" | "ogrenci";
  href: string;
};

type SessionState = {
  student: SessionSummary | null;
  admin: SessionSummary | null;
};

function shortName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function SessionNavigation({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => setSession(data))
      .catch(() => {
        if (!controller.signal.aborted) setSession({ student: null, admin: null });
      });
    return () => controller.abort();
  }, []);

  async function logout() {
    await fetch("/api/session/logout", { method: "POST" });
    setSession({ student: null, admin: null });
    router.replace("/");
    router.refresh();
  }

  if (session === null) {
    return <div className={`h-9 ${compact ? "w-14" : "w-24"} rounded-full bg-surface ${className}`} aria-label="Oturum yükleniyor" />;
  }

  const primary = session.student || session.admin;
  if (!primary) {
    if (compact) {
      return (
        <Link href="/giris" className={`btn-secondary text-sm ${className}`}>
          Giriş
        </Link>
      );
    }
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Link href="/giris" className="text-sm font-medium text-steel transition-colors hover:text-ink">
          Giriş Yap
        </Link>
        <Link href="/vakalar" className="btn-primary text-sm">
          Vakaya Başla
        </Link>
      </div>
    );
  }

  if (compact) {
    return (
      <Link href={primary.href} className={`btn-secondary text-sm ${className}`}>
        {session.student ? "Profilim" : "Panel"}
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      {session.student && (
        <Link href="/ayarlar" aria-label="Ayarlar" className="hidden text-sm font-medium text-steel transition-colors hover:text-ink sm:inline">
          Merhaba, {shortName(session.student.displayName)}
        </Link>
      )}
      {session.admin && (
        <Link href={session.admin.href} className="btn-secondary text-sm">
          Yönetim Paneli
        </Link>
      )}
      <Link href={primary.href} className="btn-primary text-sm">
        {session.student ? "Profilim" : "Panele Git"}
      </Link>
      <button type="button" onClick={() => void logout()} className="btn-ghost text-sm text-steel hover:text-ink">
        Çıkış
      </button>
    </div>
  );
}
