"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    groups: 0,
    changeCount: 0,
    logCount: 0,
    backupCount: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/cases").then((r) => r.json()),
      fetch("/api/admin/logs?limit=1").then((r) => r.json()),
      fetch("/api/admin/backups").then((r) => r.json()),
    ]).then(([cases, logs, backups]) => {
      setStats({
        total: cases.total || 0,
        groups: cases.grouped?.length || 0,
        changeCount: cases.changeCount || 0,
        logCount: logs.total || 0,
        backupCount: backups.backups?.length || 0,
      });
    });
  }, []);

  const cards = [
    { label: "Toplam vaka", value: stats.total, href: "/admin/panel/vakalar" },
    { label: "Poliklinik", value: stats.groups, href: "/admin/panel/vakalar" },
    { label: "Değişiklik sayacı", value: stats.changeCount, href: "/admin/panel/logs" },
    { label: "Log kaydı", value: stats.logCount, href: "/admin/panel/logs" },
    { label: "Yedek", value: stats.backupCount, href: "/admin/panel/yedekler" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Yönetim Özeti</h1>
      <p className="mt-1 text-sm text-steel">
        Vakaları düzenleyin, test değerlerini değiştirin, loglardan seçici geri alın, yedekleri yönetin.
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

      <div className="mt-8 rounded-xl border border-hairline bg-canvas p-5 text-sm text-steel space-y-2">
        <p className="font-medium text-ink">Nasıl çalışır?</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Her test alanı değişikliği ayrı log satırı üretir.</li>
          <li>Loglardan yalnızca seçtiğiniz işlemi geri alabilirsiniz; sonraki işlemler etkilenmez.</li>
          <li>Her 10 değişiklikte tüm vaka deposunun otomatik yedeği alınır.</li>
          <li>İstediğiniz zaman yedekten geri yükleyebilirsiniz (önce güvenlik yedeği alınır).</li>
        </ul>
      </div>
    </div>
  );
}
