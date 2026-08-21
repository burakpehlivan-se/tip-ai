"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Role = "admin" | "doktor";

type NavGroup = {
  title: string;
  items: { href: string; label: string; roles: Role[] }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "İçerik",
    items: [
      { href: "/admin/panel", label: "Özet", roles: ["admin", "doktor"] },
      { href: "/admin/panel/vakalar", label: "Vakalar", roles: ["admin", "doktor"] },
      { href: "/admin/panel/oyna/karisik", label: "Oyna", roles: ["admin", "doktor"] },
      { href: "/admin/panel/hasta-tipleri", label: "Hasta Tipleri", roles: ["admin", "doktor"] },
      { href: "/admin/panel/tibbi-goruntuler", label: "Görüntüler", roles: ["admin", "doktor"] },
      { href: "/admin/panel/kural-motoru", label: "Kurallar", roles: ["admin"] },
    ],
  },
  {
    title: "Kalite",
    items: [
      { href: "/admin/panel/dogrulama", label: "Doğrulama", roles: ["admin", "doktor"] },
      { href: "/admin/panel/test-durumu", label: "Testler", roles: ["admin", "doktor"] },
      { href: "/admin/panel/analitik", label: "Analitik", roles: ["admin"] },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/panel/kullanicilar", label: "Kullanıcılar", roles: ["admin"] },
      { href: "/admin/panel/ayarlar", label: "Ayarlar", roles: ["admin"] },
      { href: "/admin/panel/logs", label: "Loglar", roles: ["admin"] },
      { href: "/admin/panel/yedekler", label: "Yedekler", roles: ["admin"] },
      { href: "/admin/panel/diagnostics", label: "Sistem Tanısı", roles: ["admin"] },
    ],
  },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("admin");
  const [ready, setReady] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  const isPlayMode = pathname.includes("/oyna/");

  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((n) => n.roles.includes(role)),
      })).filter((group) => group.items.length > 0),
    [role]
  );
  const allNav = useMemo(() => navGroups.flatMap((g) => g.items), [navGroups]);
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
    const restricted = allNav.find(
      (n) =>
        n.href !== "/admin/panel" &&
        pathname.startsWith(n.href) &&
        !n.roles.includes(role)
    );
    if (restricted) {
      router.replace("/admin/panel/vakalar");
    }
  }, [ready, pathname, role, router, allNav]);

  // Dış tıklamada açılır menüleri kapat
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const activeItem = mobileNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    activeItem?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname, ready]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

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

  const roleBadge = (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        role === "admin" ? "bg-ink/10 text-ink" : "bg-brand/15 text-brand-deep"
      }`}
    >
      {role === "admin" ? "Admin" : "Doktor"}
    </span>
  );

  const userMenu = (
    <div className="relative" ref={userMenuRef}>
      <button
        type="button"
        onClick={() => setUserMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
        aria-label="Kullanıcı menüsü"
        className="flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-canvas px-2 py-1 hover:bg-surface"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
          {(username || "A").slice(0, 1).toLocaleUpperCase("tr")}
        </span>
        <span className="hidden max-w-24 truncate text-xs font-medium text-ink sm:block">
          {username}
        </span>
        {roleBadge}
        <svg className="h-3 w-3 text-muted" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {userMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-lg border border-hairline bg-canvas p-1 shadow-lg"
        >
          <div className="border-b border-hairline-soft px-3 py-2 text-xs text-muted">
            {username}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-clinical-red hover:bg-clinical-red/5"
          >
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  );

  // lg+: 14 bağlantı + grup ayraçları yatay bar'a sığmadığı için (1024–1280px'te
  // taşma, 1920px'te bile yatay kaydırma) kalıcı sol sidebar kullanılır.
  const sidebarNav = (
    <aside className="hidden w-56 shrink-0 border-r border-hairline bg-canvas lg:sticky lg:top-14 lg:block lg:max-h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-y-auto">
      <nav aria-label="Panel gezinme" className="p-3">
        {navGroups.map((group, groupIndex) => (
          <div key={group.title} className={groupIndex > 0 ? "mt-4" : undefined}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</p>
            <ul>
              {group.items.map((n) => {
                const active = isActiveNav(n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                        active
                          ? "bg-brand/10 text-ink"
                          : "text-steel hover:bg-surface hover:text-ink"
                      }`}
                    >
                      {n.label}
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );

  const mobileNav = (
    <nav
      ref={mobileNavRef}
      className="flex gap-1 overflow-x-auto border-t border-hairline-soft px-2 py-1.5 lg:hidden"
      aria-label="Mobil panel gezinme"
    >
      {allNav.map((n) => {
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
                {allNav.map((n) => {
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
            <div className="flex shrink-0 items-center gap-2">{userMenu}</div>
          </div>
        </header>
        <main id="panel-icerik" tabIndex={-1} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {skipLink}
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin/panel" className="shrink-0 text-sm font-semibold tracking-tight">
              tıp<span className="text-brand">_ai</span>{" "}
              <span className="text-muted font-normal">panel</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">{userMenu}</div>
        </div>
        {mobileNav}
      </header>
      <div className="lg:flex lg:items-start">
        {sidebarNav}
        <main
          id="panel-icerik"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 lg:max-w-none lg:px-6 xl:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
