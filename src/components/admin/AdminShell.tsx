"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

const NAV = [
  { href: "/admin/panel", label: "Özet" },
  { href: "/admin/panel/vakalar", label: "Vakalar" },
  { href: "/admin/panel/analitik", label: "Analitik" },
  { href: "/admin/panel/ayarlar", label: "Ayarlar" },
  { href: "/admin/panel/logs", label: "Loglar" },
  { href: "/admin/panel/yedekler", label: "Yedekler" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /** Debug oynama: tam ekran workspace — max-w ve py yok */
  const isPlayMode = pathname.includes("/oyna/");

  useEffect(() => {
    fetch("/api/admin/me")
      .then(async (r) => {
        if (!r.ok) {
          router.replace("/admin");
          return;
        }
        const d = await r.json();
        setUsername(d.username);
        setReady(true);
      })
      .catch(() => router.replace("/admin"));
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-steel">Yükleniyor…</p>
      </div>
    );
  }

  if (isPlayMode) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface-soft">
        <header className="z-40 shrink-0 border-b border-hairline bg-canvas">
          <div className="flex h-10 items-center justify-between gap-3 px-3 lg:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/admin/panel"
                className="shrink-0 text-sm font-semibold tracking-tight"
              >
                tıp<span className="text-brand">_ai</span>{" "}
                <span className="text-muted font-normal">admin</span>
              </Link>
              <nav className="hidden items-center gap-0.5 md:flex">
                {NAV.map((n) => {
                  const active =
                    n.href === "/admin/panel"
                      ? pathname === n.href
                      : pathname.startsWith(n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-ink text-white"
                          : "text-steel hover:bg-surface hover:text-ink"
                      }`}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-[11px] text-muted sm:inline">{username}</span>
              <button
                onClick={logout}
                className="btn-secondary px-2.5 py-1 text-[11px]"
              >
                Çıkış
              </button>
            </div>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin/panel" className="text-sm font-semibold tracking-tight">
              tıp<span className="text-brand">_ai</span>{" "}
              <span className="text-muted font-normal">admin</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((n) => {
                const active =
                  n.href === "/admin/panel"
                    ? pathname === n.href
                    : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-ink text-white"
                        : "text-steel hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{username}</span>
            <button onClick={logout} className="btn-secondary text-xs py-1.5 px-3">
              Çıkış
            </button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-hairline-soft px-2 py-2 sm:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                pathname.startsWith(n.href) ? "bg-ink text-white" : "bg-surface text-steel"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
