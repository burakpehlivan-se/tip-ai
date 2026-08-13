"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardUser = { active: boolean; role: "admin" | "doktor" | "ogrenci" };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    groups: 0,
    changeCount: 0,
    logCount: 0,
    backupCount: 0,
    users: null as null | { total: number; active: number; students: number },
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/cases").then((r) => r.json()),
      fetch("/api/admin/logs?limit=1").then((r) => r.json()),
      fetch("/api/admin/backups").then((r) => r.json()),
      fetch("/api/admin/users").then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        const users: DashboardUser[] = Array.isArray(data.users) ? data.users : [];
        return {
          total: users.length,
          active: users.filter((user) => user.active).length,
          students: users.filter((user) => user.role === "ogrenci").length,
        };
      }),
    ]).then(([cases, logs, backups, users]) => {
      setStats({
        total: cases.total || 0,
        groups: cases.grouped?.length || 0,
        changeCount: cases.changeCount || 0,
        logCount: logs.total || 0,
        backupCount: backups.backups?.length || 0,
        users,
      });
    }).catch(() => {
      // Özet kartlarının erişilemediği anlarda ekranın diğer bölümleri kullanılabilir kalır.
    });
  }, []);

  const cards = [
    { label: "Toplam vaka", value: stats.total, href: "/admin/panel/vakalar" },
    { label: "Poliklinik", value: stats.groups, href: "/admin/panel/vakalar" },
    { label: "Değişiklik sayacı", value: stats.changeCount, href: "/admin/panel/logs" },
    { label: "Log kaydı", value: stats.logCount, href: "/admin/panel/logs" },
    { label: "Yedek", value: stats.backupCount, href: "/admin/panel/yedekler" },
    { label: "Analitik", value: "→", href: "/admin/panel/analitik" },
    ...(stats.users
      ? [{ label: "Kullanıcı yönetimi", value: stats.users.total, href: "/admin/panel/kullanicilar" }]
      : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Yönetim Özeti</h1>
      <p className="mt-1 text-sm text-steel">
        Vakaları, kullanıcıları ve yayın kalitesini tek yerden yönetin; değişiklikleri ve yedekleri takip edin.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-hairline bg-canvas p-5 transition-shadow hover:shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-ink">{c.value}</div>
          </Link>
        ))}
      </div>

      {stats.users && (
        <section className="mt-8 rounded-xl border border-hairline bg-surface-soft p-5" aria-labelledby="user-management-summary">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="user-management-summary" className="text-base font-semibold text-ink">Kullanıcı yönetimi</h2>
              <p className="mt-1 text-sm text-steel">
                {stats.users.active} aktif hesap · {stats.users.students} öğrenci
              </p>
            </div>
            <Link href="/admin/panel/kullanicilar" className="btn-primary text-sm">
              Kullanıcıları yönet
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-steel">
            Hesap oluşturma, rol ve erişim yönetimi, şifre sıfırlama ile son başarılı girişleri tek ekranda takip edin.
          </p>
        </section>
      )}

      <div className="mt-8 rounded-xl border border-hairline bg-canvas p-5 text-sm text-steel space-y-2">
        <p className="font-medium text-ink">Nasıl çalışır?</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Vakalar → Oyna</strong>: debug modda vaka çöz, sonucu anında gör, vaka özelinde feedback yaz.
          </li>
          <li>Vaka editörü: durum (taslak/aktif/arşiv), etiket, demografi, rubrik JSON, test sonuçları.</li>
          <li>Her test/alan değişikliği loglanır; seçici geri alma ve 10’da bir yedek.</li>
          <li>Çemiçgezek ayarları: geri dönüş eşiği, kalabalıklık, poliklinik filtresi.</li>
          <li>Analitik: oturum, ortalama puan, atlanan red flag / gereksiz test.</li>
          {stats.users && <li>Kullanıcı yönetimi: hesap, rol, erişim ve son başarılı giriş takibi.</li>}
        </ul>
      </div>
    </div>
  );
}
