"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Sekme = "giris" | "kayit";

function sonrakiYol(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/profilim";
  }
  return value;
}

function GirisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sonraki = useMemo(() => sonrakiYol(searchParams.get("sonraki")), [searchParams]);

  const [sekme, setSekme] = useState<Sekme>("giris");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const session = response.ok ? await response.json() : null;
        if (session?.student) router.replace(sonraki);
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router, sonraki]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (sekme === "kayit" && password !== password2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    try {
      const endpoint = sekme === "kayit" ? "/api/student/register" : "/api/student/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sekme === "kayit"
            ? { username, displayName, password }
            : { username, password }
        ),
      });
      const data = res.headers.get("content-type")?.includes("application/json")
        ? await res.json()
        : null;
      if (!res.ok) {
        setError(data?.error || "İşlem başarısız. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }
      router.replace(sonraki);
    } catch {
      setError("Sunucuya bağlanılamadı.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-steel">Oturum kontrol ediliyor…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-canvas p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-tight text-ink">
            tıp<span className="text-brand">_ai</span>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-ink">
            {sekme === "giris" ? "Giriş Yap" : "Kayıt Ol"}
          </h1>
          <p className="mt-1 text-sm text-steel">
            {sekme === "giris"
              ? "İlerlemeni takip etmek için giriş yap."
              : "Hesap oluştur, ilerlemeni takip et."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1" aria-label="Hesap işlemi seçimi">
          {(["giris", "kayit"] as Sekme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSekme(t);
                setError("");
                setPassword("");
                setPassword2("");
              }}
              aria-pressed={sekme === t}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                sekme === t ? "bg-canvas text-ink shadow-sm" : "text-steel hover:text-ink"
              }`}
            >
              {t === "giris" ? "Giriş Yap" : "Kayıt Ol"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4" aria-busy={loading}>
          {sekme === "kayit" && (
            <div>
              <label htmlFor="giris-displayname" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Görünen ad <span className="normal-case text-steel">(isteğe bağlı)</span>
              </label>
              <input
                id="giris-displayname"
                className="input w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                maxLength={80}
              />
            </div>
          )}
          <div>
            <label htmlFor="giris-username" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Kullanıcı adı
            </label>
            <input
              id="giris-username"
              className="input w-full"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={sekme === "kayit" ? "örn. ali.veli" : ""}
              required
              minLength={3}
              maxLength={30}
              aria-describedby={sekme === "kayit" ? "giris-username-help" : undefined}
              aria-invalid={Boolean(error)}
            />
            {sekme === "kayit" && (
              <p id="giris-username-help" className="mt-1 text-xs text-steel">
                3–30 karakter; harf, rakam, nokta, alt çizgi veya tire kullanabilirsin.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="giris-password" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Şifre
            </label>
            <input
              id="giris-password"
              type="password"
              className="input w-full"
              autoComplete={sekme === "giris" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              maxLength={128}
              aria-describedby={sekme === "kayit" ? "giris-password-help" : undefined}
              aria-invalid={Boolean(error)}
            />
            {sekme === "kayit" && (
              <p id="giris-password-help" className="mt-1 text-xs text-steel">
                En az 6 karakter kullan.
              </p>
            )}
          </div>
          {sekme === "kayit" && (
            <div>
              <label htmlFor="giris-password2" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Şifre (tekrar)
              </label>
              <input
                id="giris-password2"
                type="password"
                className="input w-full"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={6}
                maxLength={128}
                aria-invalid={Boolean(error)}
              />
            </div>
          )}
          {error && (
            <div role="alert" aria-live="assertive" className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading
              ? "İşleniyor…"
              : sekme === "giris"
                ? "Giriş Yap"
                : "Hesap Oluştur"}
          </button>
        </form>

        {sekme === "giris" && (
          <p className="mt-4 text-center text-xs text-steel">
            Hesabın yok mu?{" "}
            <button
              type="button"
              onClick={() => setSekme("kayit")}
              className="font-medium text-brand hover:underline"
            >
              Ücretsiz kayıt ol
            </button>
          </p>
        )}

        <div className="mt-6 border-t border-hairline pt-4 text-center">
          <p className="text-xs text-steel">
            Giriş yapmadan önce{" "}
            <Link href="/deneme" className="font-medium text-brand hover:underline">
              deneme vakasını
            </Link>{" "}
            oynayabilirsin.
          </p>
          <Link href="/" className="mt-2 inline-block text-sm text-steel hover:text-ink">
            ← Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense fallback={null}>
      <GirisForm />
    </Suspense>
  );
}
