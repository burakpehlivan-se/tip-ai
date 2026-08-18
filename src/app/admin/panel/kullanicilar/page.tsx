"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  username: string;
  role: "admin" | "doktor" | "ogrenci";
  displayName?: string;
  active: boolean;
  superAdmin?: boolean;
  createdAt: number;
  createdBy?: string;
  istatistik?: { vakaSayisi: number; ortalamaPuanYuzde: number; taniDogruSayi: number };
}

interface RecentLogin {
  id: string;
  username: string;
  role: UserRow["role"] | null;
  createdAt: number;
}

interface PrivacyRequest {
  id: string;
  username: string;
  type: "correction" | "erasure";
  status: "pending" | "resolved";
  requestedAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

const ROLE_LABEL: Record<UserRow["role"], string> = {
  admin: "Admin",
  doktor: "Doktor",
  ogrenci: "Öğrenci",
};

const ROLE_ACIKLAMA: Record<UserRow["role"], string> = {
  admin: "Tam yetki — kullanıcı, vaka, ayarlar ve sistem yönetimi",
  doktor: "Vaka düzenle / onayla",
  ogrenci: "Vaka oyna ve değerlendir",
};

const ROLE_KARTLARI: { deger: UserRow["role"]; ad: string; aciklama: string }[] = [
  { deger: "ogrenci", ad: "Öğrenci", aciklama: "Vaka oyna ve değerlendir" },
  { deger: "doktor", ad: "Doktor", aciklama: "Vaka düzenle / onayla" },
  { deger: "admin", ad: "Admin", aciklama: "Tam yetki — sistem yönetimi" },
];

const PRIVACY_REQUEST_LABEL: Record<PrivacyRequest["type"], string> = {
  correction: "Bilgi düzeltme",
  erasure: "Silme / anonimleştirme",
};

function sifreUret(): string {
  const buyuk = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const kucuk = "abcdefghijkmnpqrstuvwxyz";
  const rakam = "23456789";
  const sembol = "!@#$%";
  const havuz = buyuk + kucuk + rakam + sembol;
  const rnd = (s: string) => s[Math.floor(Math.random() * s.length)];
  const parcalar = [rnd(buyuk), rnd(kucuk), rnd(rakam), rnd(sembol)];
  for (let i = 4; i < 14; i++) parcalar.push(rnd(havuz));
  return parcalar.sort(() => Math.random() - 0.5).join("");
}

function sifreGuclu(sifre: string): { seviye: 0 | 1 | 2 | 3; etiket: string } {
  if (!sifre) return { seviye: 0, etiket: "" };
  let puan = 0;
  if (sifre.length >= 8) puan++;
  if (sifre.length >= 12) puan++;
  if (/[a-z]/.test(sifre) && /[A-Z]/.test(sifre)) puan++;
  if (/\d/.test(sifre) && /[^a-zA-Z0-9]/.test(sifre)) puan++;
  if (puan <= 1) return { seviye: 1, etiket: "Zayıf" };
  if (puan === 2) return { seviye: 2, etiket: "Orta" };
  return { seviye: 3, etiket: "Güçlü" };
}

function GrupOlusturucu({
  children,
  onKapat,
}: {
  children: React.ReactNode;
  onKapat: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-canvas p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Yeni kullanıcı</h3>
          <button type="button" onClick={onKapat} aria-label="Kapat" className="rounded-md p-1 text-muted transition-colors hover:text-ink">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function KullanicilarPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [privacyBusy, setPrivacyBusy] = useState<string | null>(null);
  const [meUsername, setMeUsername] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRow["role"]>("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "ogrenci" as UserRow["role"],
    displayName: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, loginsResponse, privacyResponse] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/users/recent-logins?limit=20"),
        fetch("/api/admin/privacy-requests?limit=100"),
      ]);
      if (usersResponse.status === 403 || loginsResponse.status === 403 || privacyResponse.status === 403) {
        router.replace("/admin/panel");
        return;
      }
      const [usersData, loginsData, privacyData] = await Promise.all([
        usersResponse.json(),
        loginsResponse.json(),
        privacyResponse.json(),
      ]);
      if (!usersResponse.ok) throw new Error(usersData.error || "Kullanıcılar yüklenemedi");
      if (!loginsResponse.ok) throw new Error(loginsData.error || "Son girişler yüklenemedi");
      if (!privacyResponse.ok) throw new Error(privacyData.error || "Gizlilik talepleri yüklenemedi");
      setUsers(usersData.users || []);
      setRecentLogins(loginsData.logins || []);
      setPrivacyRequests(privacyData.requests || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setMeUsername(d.username || ""))
      .catch(() => {});
  }, [load]);

  const loginSummary = useMemo(() => {
    const result = new Map<string, { son: number; sayi: number }>();
    for (const login of recentLogins) {
      const key = login.username.toLowerCase();
      const current = result.get(key);
      if (!current) {
        result.set(key, { son: login.createdAt, sayi: 1 });
      } else {
        current.sayi += 1;
        if (login.createdAt > current.son) current.son = login.createdAt;
      }
    }
    return result;
  }, [recentLogins]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.username.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
        user.displayName?.toLocaleLowerCase("tr-TR").includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesActivity =
        activityFilter === "all" || (activityFilter === "active" ? user.active : !user.active);
      return matchesQuery && matchesRole && matchesActivity;
    });
  }, [activityFilter, query, roleFilter, users]);

  const activeUserCount = useMemo(() => users.filter((user) => user.active).length, [users]);

  const usernameGecersiz = useMemo(() => {
    const v = form.username.trim();
    return v !== "" && !/^[a-zA-Z0-9]{2,20}$/.test(v);
  }, [form.username]);

  const sifreGucu = sifreGuclu(form.password);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (usernameGecersiz) {
      setError("Kullanıcı adı 2-20 karakter olmalı, yalnızca harf ve rakam içermeli.");
      return;
    }
    if (form.password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        username: form.username.trim(),
        displayName: form.displayName.trim(),
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Oluşturulamadı");
      return;
    }
    setMsg(
      `Kullanıcı eklendi: ${d.user.displayName || d.user.username} (${
        ROLE_LABEL[d.user.role as UserRow["role"]] || d.user.role
      })`
    );
    setForm({ username: "", password: "", role: "ogrenci", displayName: "" });
    setShowCreate(false);
    load();
  }

  async function setActive(id: string, active: boolean) {
    setError("");
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Güncellenemedi");
      return;
    }
    load();
  }

  async function changeRole(id: string, role: UserRow["role"]) {
    setError("");
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Rol değiştirilemedi");
      return;
    }
    setMsg(`Rol güncellendi: ${ROLE_LABEL[role]}`);
    load();
  }

  function sifreResetAc(user: UserRow) {
    setResetTarget({ id: user.id, username: user.username });
    setResetPasswordValue(sifreUret());
    setResetBusy(false);
    setError("");
  }

  async function sifreResetUygula() {
    if (!resetTarget) return;
    if (resetPasswordValue.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    setResetBusy(true);
    setError("");
    const res = await fetch(`/api/admin/users/${encodeURIComponent(resetTarget.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPasswordValue }),
    });
    const d = await res.json();
    setResetBusy(false);
    if (!res.ok) {
      setError(d.error || "Şifre güncellenemedi");
      return;
    }
    setMsg(`Şifre güncellendi: ${resetTarget.username}`);
    setResetTarget(null);
  }

  async function removeUser(id: string, username: string) {
    if (!confirm(`${username} silinsin mi? Kalıcıdır.`)) return;
    setError("");
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Silinemedi");
      return;
    }
    setMsg(`Silindi: ${username}`);
    load();
  }

  async function resolvePrivacyRequest(request: PrivacyRequest) {
    if (!confirm(`${request.username} kullanıcısının talebi çözümlenmiş olarak kaydedilsin mi?`)) return;
    setError("");
    setPrivacyBusy(request.id);
    try {
      const res = await fetch(`/api/admin/privacy-requests/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Talep güncellenemedi");
      setPrivacyRequests((items) => items.map((item) => (item.id === request.id ? data.request : item)));
      setMsg("Gizlilik talebi çözümlenmiş olarak kaydedildi.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Talep güncellenemedi");
    } finally {
      setPrivacyBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-steel">Yükleniyor…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-steel">
            Hesapları yönetin, şifreleri sıfırlayın ve son girişleri takip edin.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          + Yeni Kullanıcı
        </button>
      </div>

      <div className="rounded-xl border border-hairline bg-canvas">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Kayıtlı kullanıcılar ({users.length})</h2>
            <p className="mt-0.5 text-xs text-steel">{activeUserCount} aktif hesap</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Kullanıcı filtreleri">
            <label className="sr-only" htmlFor="user-search">Kullanıcı ara</label>
            <input
              id="user-search"
              className="input w-44 text-xs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ad veya kullanıcı adı"
              type="search"
            />
            <label className="sr-only" htmlFor="user-role-filter">Role göre filtrele</label>
            <select
              id="user-role-filter"
              className="input text-xs"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
            >
              <option value="all">Tüm roller</option>
              <option value="admin">Admin</option>
              <option value="doktor">Doktor</option>
              <option value="ogrenci">Öğrenci</option>
            </select>
            <label className="sr-only" htmlFor="user-status-filter">Duruma göre filtrele</label>
            <select
              id="user-status-filter"
              className="input text-xs"
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value as typeof activityFilter)}
            >
              <option value="all">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-hairline-soft">
          {filteredUsers.map((u) => {
            const locked = !!u.superAdmin;
            const isSelf = meUsername.toLowerCase() === u.username.toLowerCase();
            const login = loginSummary.get(u.username.toLowerCase());
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    <span className="truncate">{u.displayName || u.username}</span>
                    <span className="text-muted font-normal">@{u.username}</span>
                    <span className={`badge ${u.active ? "badge-brand" : "badge-steel"} shrink-0`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                    {locked && (
                      <span className="badge badge-red shrink-0" title="Bootstrap süper admin — rol, aktiflik ve silme kilitlidir">
                        Süper Admin · kilitli
                      </span>
                    )}
                    {!u.active && (
                      <span className="badge badge-orange shrink-0">Pasif</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {ROLE_ACIKLAMA[u.role]}
                    {u.createdBy ? ` · ekleyen: ${u.createdBy}` : ""}
                    {" · "}
                    {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                  <div className="mt-1 text-[11px] text-steel">
                    {login
                      ? `${login.sayi} giriş · son giriş: ${new Date(login.son).toLocaleString("tr-TR")}`
                      : "Son giriş: kayıt yok"}
                  </div>
                  {u.role === "ogrenci" && u.istatistik && u.istatistik.vakaSayisi > 0 && (
                    <div className="mt-1 text-[11px] text-steel">
                      {u.istatistik.vakaSayisi} vaka · ort. %{u.istatistik.ortalamaPuanYuzde} ·{" "}
                      {u.istatistik.taniDogruSayi} doğru tanı
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {locked ? (
                    <>
                      <span className="rounded-md border border-hairline bg-surface-soft px-2 py-1 text-[11px] text-steel">
                        Kilitli hesap
                      </span>
                      {isSelf && (
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1"
                          onClick={() => sifreResetAc(u)}
                          title="Yalnızca kendisi şifre değiştirebilir"
                        >
                          Şifremi değiştir
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="sr-only" htmlFor={`role-${u.id}`}>Rol değiştir</label>
                      <select
                        id={`role-${u.id}`}
                        className="input text-xs py-1"
                        value={u.role}
                        title={ROLE_ACIKLAMA[u.role]}
                        onChange={(e) => changeRole(u.id, e.target.value as UserRow["role"])}
                      >
                        <option value="doktor">Doktor</option>
                        <option value="admin">Admin</option>
                        <option value="ogrenci">Öğrenci</option>
                      </select>
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1"
                        onClick={() => sifreResetAc(u)}
                        title="Yeni şifre oluştur ve göster"
                      >
                        Şifre sıfırla
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1"
                        onClick={() => setActive(u.id, !u.active)}
                      >
                        {u.active ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-clinical-red hover:underline"
                        onClick={() => removeUser(u.id, u.username)}
                      >
                        Sil
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <p className="p-4 text-sm text-muted">Henüz kullanıcı yok.</p>
          )}
          {users.length > 0 && filteredUsers.length === 0 && (
            <p className="p-4 text-sm text-muted">Bu filtrelere uyan kullanıcı yok.</p>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-hairline bg-canvas" aria-labelledby="recent-logins-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 id="recent-logins-title" className="text-sm font-semibold text-ink">Son başarılı girişler</h2>
            <p className="mt-0.5 text-xs text-steel">Kullanıcı başına toplu gösterilir.</p>
          </div>
          <button type="button" className="btn-secondary text-xs" onClick={load}>
            Yenile
          </button>
        </div>
        <div className="divide-y divide-hairline-soft">
          {Array.from(loginSummary.entries())
            .sort((a, b) => b[1].son - a[1].son)
            .map(([username, info]) => (
              <div key={username} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {username} · {info.sayi} giriş
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Son giriş: {new Date(info.son).toLocaleString("tr-TR")}
                  </p>
                </div>
                {(() => {
                  const rol = users.find((u) => u.username.toLowerCase() === username)?.role;
                  return rol ? <span className="badge badge-steel shrink-0">{ROLE_LABEL[rol]}</span> : null;
                })()}
              </div>
            ))}
          {recentLogins.length === 0 && (
            <p className="px-4 py-5 text-sm text-steel">Henüz başarılı giriş kaydı yok.</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-hairline bg-canvas" aria-labelledby="privacy-requests-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 id="privacy-requests-title" className="text-sm font-semibold text-ink">Gizlilik talepleri</h2>
            <p className="mt-0.5 text-xs text-steel">
              Talep türü ve işlem durumu gösterilir; serbest metin veya klinik içerik saklanmaz.
            </p>
          </div>
          <span className="badge badge-steel shrink-0">
            {privacyRequests.filter((request) => request.status === "pending").length} açık
          </span>
        </div>
        <div className="divide-y divide-hairline-soft">
          {privacyRequests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{request.username} · {PRIVACY_REQUEST_LABEL[request.type]}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Talep: {new Date(request.requestedAt).toLocaleString("tr-TR")}
                  {request.resolvedAt ? ` · Çözüm: ${new Date(request.resolvedAt).toLocaleString("tr-TR")}` : ""}
                </p>
              </div>
              {request.status === "resolved" ? (
                <span className="badge badge-brand shrink-0">Çözümlendi</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void resolvePrivacyRequest(request)}
                  disabled={privacyBusy !== null}
                  className="btn-secondary shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {privacyBusy === request.id ? "Kaydediliyor…" : "Çözümlendi olarak kaydet"}
                </button>
              )}
            </div>
          ))}
          {privacyRequests.length === 0 && (
            <p className="px-4 py-5 text-sm text-steel">Henüz gizlilik talebi yok.</p>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{msg}</div>
      )}

      {showCreate && (
        <GrupOlusturucu onKapat={() => setShowCreate(false)}>
          <form onSubmit={onCreate} className="mt-4 space-y-4">
            <fieldset>
              <legend className="text-xs font-medium text-muted">Rol *</legend>
              <div className="mt-2 grid gap-2">
                {ROLE_KARTLARI.map((opt) => (
                  <label
                    key={opt.deger}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                      form.role === opt.deger
                        ? "border-brand bg-surface-soft"
                        : "border-hairline bg-white hover:border-brand"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.deger}
                      checked={form.role === opt.deger}
                      onChange={() => setForm({ ...form, role: opt.deger })}
                      className="mt-0.5 accent-brand"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{opt.ad}</span>
                      <span className="block text-xs text-muted">{opt.aciklama}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="text-xs font-medium text-muted" htmlFor="new-username">
                Kullanıcı adı *
              </label>
              <input
                id="new-username"
                className="input w-full"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                minLength={2}
                maxLength={20}
                pattern="[a-zA-Z0-9]*"
                autoComplete="off"
                aria-invalid={usernameGecersiz}
              />
              <p className={`mt-1 text-[11px] ${usernameGecersiz ? "text-clinical-red" : "text-muted"}`}>
                2-20 karakter, yalnızca harf ve rakam.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted" htmlFor="new-displayname">
                Görünen ad
              </label>
              <input
                id="new-displayname"
                className="input w-full"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Dr. Ayşe Yılmaz"
                autoComplete="off"
              />
              <p className="mt-1 text-[11px] text-muted">Öğrencilere gösterilen isim; boş bırakılırsa kullanıcı adı kullanılır.</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-muted" htmlFor="new-password">
                  Şifre *
                </label>
                <button
                  type="button"
                  className="text-xs text-brand-deep underline-offset-2 hover:underline"
                  onClick={() => setForm({ ...form, password: sifreUret() })}
                >
                  🎲 Otomatik oluştur
                </button>
              </div>
              <input
                id="new-password"
                type="password"
                className="input w-full"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                autoComplete="new-password"
              />
              {sifreGucu.seviye > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-8 rounded-full ${
                          i <= sifreGucu.seviye
                            ? sifreGucu.seviye === 1
                              ? "bg-clinical-red"
                              : sifreGucu.seviye === 2
                                ? "bg-clinical-orange"
                                : "bg-brand"
                            : "bg-surface-soft"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      sifreGucu.seviye === 1
                        ? "text-clinical-red"
                        : sifreGucu.seviye === 2
                          ? "text-clinical-orange"
                          : "text-brand-deep"
                    }`}
                  >
                    {sifreGucu.etiket}
                  </span>
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted">En az 6 karakter.</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-4">
              <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>
                İptal
              </button>
              <button type="submit" className="btn-primary text-sm">
                Kullanıcı ekle
              </button>
            </div>
          </form>
        </GrupOlusturucu>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-canvas p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-ink">Şifre sıfırla — {resetTarget.username}</h3>
            <p className="mt-1 text-xs text-muted">Yeni geçici şifreyi kullanıcıya iletin. İsterseniz değiştirin.</p>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                className="input w-full font-mono text-sm"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                aria-label="Yeni şifre"
              />
              <button
                type="button"
                className="btn-secondary shrink-0 text-xs"
                onClick={() => void navigator.clipboard?.writeText(resetPasswordValue)}
                title="Kopyala"
              >
                Kopyala
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">En az 6 karakter. Kaydedilmeden önce süreç tamamlanmaz.</p>
            {resetPasswordValue.length < 6 && (
              <p className="mt-1 text-[11px] font-medium text-clinical-red">Şifre en az 6 karakter olmalı.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-4">
              <button type="button" className="btn-secondary text-sm" onClick={() => setResetTarget(null)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => void sifreResetUygula()}
                disabled={resetBusy || resetPasswordValue.length < 6}
              >
                {resetBusy ? "Kaydediliyor…" : "Şifreyi kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}