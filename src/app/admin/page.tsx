"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => {
        if (r.ok) router.replace("/admin/panel");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Giriş başarısız.");
        setLoading(false);
        return;
      }
      router.replace("/admin/panel");
    } catch {
      setError("Sunucuya bağlanılamadı.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-steel">Oturum kontrol ediliyor…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-canvas p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-tight text-ink">
            tıp<span className="text-brand">_ai</span>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-ink">Admin Girişi</h1>
          <p className="mt-1 text-sm text-steel">Yönetim paneline erişmek için giriş yapın.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Kullanıcı adı
            </label>
            <input
              className="input w-full"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Şifre
            </label>
            <input
              type="password"
              className="input w-full"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-steel hover:text-ink">
            ← Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
