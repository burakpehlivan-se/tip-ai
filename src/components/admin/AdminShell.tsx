"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Role = "admin" | "doktor";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/admin/panel", label: "Özet", roles: ["admin", "doktor"] },
  { href: "/admin/panel/vakalar", label: "Vakalar", roles: ["admin", "doktor"] },
  { href: "/admin/panel/oyna/karisik", label: "🎲 Karışık Oyna", roles: ["admin", "doktor"] },
  { href: "/admin/panel/hasta-tipleri", label: "Hasta Tipleri", roles: ["admin", "doktor"] },
  { href: "/admin/panel/dogrulama", label: "Doğrulama", roles: ["admin", "doktor"] },
  { href: "/admin/panel/test-durumu", label: "Test Durumu", roles: ["admin", "doktor"] },
  { href: "/admin/panel/kural-motoru", label: "Kural Motoru", roles: ["admin"] },
  { href: "/admin/panel/analitik", label: "Analitik", roles: ["admin"] },
  { href: "/admin/panel/kullanicilar", label: "Kullanıcılar", roles: ["admin"] },
  { href: "/admin/panel/ayarlar", label: "Ayarlar", roles: ["admin"] },
  { href: "/admin/panel/logs", label: "Loglar", roles: ["admin"] },
  { href: "/admin/panel/yedekler", label: "Yedekler", roles: ["admin"] },
  { href: "/admin/panel/diagnostics", label: "Sistem", roles: ["admin"] },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("admin");
  const [ready, setReady] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);

  const isPlayMode = pathname.includes("/oyna/");

  const navItems = useMemo(
    () => NAV.filter((n) => n.roles.includes(role)),
    [role]
  );
  const isActiveNav = (href: string) =>
    href === "/admin/panel" ? pathname === href : pathname.startsWith(href);

  useEffect(() => {
    fetch("/api/admin/me")
      .then(async (r) => {
        if (!r.ok) {
          router.replace("/admin");
          return;
        }
        const d = await r.json();
        setUsername(d.username);
        setRole((d.role as Role) || "admin");
        setReady(true);
      })
      .catch(() => router.replace("/admin"));
  }, [router]);

  // Rolün erişemediği sayfaya gelirse yönlendir
  useEffect(() => {
    if (!ready) return;
    const restricted = NAV.find(
      (n) =>
        n.href !== "/admin/panel" &&
        pathname.startsWith(n.href) &&
        !n.roles.includes(role)
    );
    if (restricted) {
      router.replace("/admin/panel/vakalar");
    }
  }, [ready, pathname, role, router]);

  useEffect(() => {
    const activeItem = mobileNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activeItem?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname, ready]);

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

  const skipLink = (
    <a href="#panel-icerik" className="skip-link">
      İçeriğe atla
    </a>
  );

  const roleBadge =
    role === "admin" ? (
      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold text-ink">
        Admin
      </span>
    ) : (
      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
        Doktor
      </span>
    );

  if (isPlayMode) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface-soft">
        {skipLink}
        <header className="z-40 shrink-0 border-b border-hairline bg-canvas">
          <div className="flex h-11 items-center justify-between gap-3 px-3 lg:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/admin/panel"
                className="shrink-0 text-sm font-semibold tracking-tight"
              >
                tıp<span className="text-brand">_ai</span>{" "}
                <span className="text-muted font-normal">panel</span>
              </Link>
              <nav className="hidden items-center gap-0.5 md:flex" aria-label="Panel gezinme">
                {navItems.map((n) => {
                  const active = isActiveNav(n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
              {roleBadge}
              <span className="hidden text-[11px] text-muted sm:inline">{username}</span>
              <button
                onClick={logout}
                className="btn-secondary inline-flex min-h-11 items-center px-2.5 text-[11px]"
              >
                Çıkış
              </button>
            </div>
          </div>
        </header>
        <main id="panel-icerik" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {skipLink}
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin/panel" className="text-sm font-semibold tracking-tight">
              tıp<span className="text-brand">_ai</span>{" "}
              <span className="text-muted font-normal">panel</span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Panel gezinme">
              {navItems.map((n) => {
                const active = isActiveNav(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
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
            {roleBadge}
            <span className="hidden text-xs text-muted sm:inline">{username}</span>
            <button onClick={logout} className="btn-secondary inline-flex min-h-11 items-center text-xs px-3">
              Çıkış
            </button>
          </div>
        </div>
        <nav
          ref={mobileNavRef}
          className="flex gap-1 overflow-x-auto border-t border-hairline-soft px-2 py-1.5 lg:hidden"
          aria-label="Mobil panel gezinme"
        >
          {navItems.map((n) => {
            const active = isActiveNav(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-medium ${
                  active ? "bg-ink text-white" : "bg-surface text-steel"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="panel-icerik" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
