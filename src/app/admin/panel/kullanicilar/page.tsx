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

const PRIVACY_REQUEST_LABEL: Record<PrivacyRequest["type"], string> = {
  correction: "Bilgi düzeltme",
  erasure: "Silme / anonimleştirme",
};

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
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "doktor" as UserRow["role"],
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

  const latestLoginByUsername = useMemo(() => {
    const result = new Map<string, RecentLogin>();
    for (const login of recentLogins) {
      const key = login.username.toLowerCase();
      const current = result.get(key);
      if (!current || login.createdAt > current.createdAt) result.set(key, login);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Oluşturulamadı");
      return;
    }
    setMsg(`Kullanıcı eklendi: ${d.user.username} (${d.user.role})`);
    setForm({ username: "", password: "", role: "doktor", displayName: "" });
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
    load();
  }

  async function resetPassword(id: string, username: string) {
    const password = window.prompt(`${username} için yeni şifre (min 6 karakter):`);
    if (!password) return;
    setError("");
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Şifre güncellenemedi");
      return;
    }
    setMsg(`Şifre güncellendi: ${username}`);
  }

  async function removeUser(id: string, username: string) {
    if (!confirm(`${username} silinsin mi?`)) return;
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Kullanıcı yönetimi</h1>
        <p className="mt-1 text-sm text-steel">
          Hesapları oluşturun, rol ve erişim durumlarını yönetin, şifreleri sıfırlayın ve son girişleri takip edin. ·{" "}
          <strong className="text-ink">Süper admin</strong> (bootstrap) yetkileri kilitlidir
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-clinical-red/10 px-3 py-2 text-sm text-clinical-red">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand-deep">{msg}</div>
      )}

      <form
        onSubmit={onCreate}
        className="rounded-xl border border-hairline bg-canvas p-5 space-y-3 max-w-xl"
      >
        <h2 className="text-sm font-semibold text-ink">Yeni kullanıcı</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">Kullanıcı adı</label>
            <input
              className="input w-full"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              minLength={2}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Şifre</label>
            <input
              type="password"
              className="input w-full"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Görünen ad</label>
            <input
              className="input w-full"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Dr. Ayşe"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Rol</label>
            <select
              className="input w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRow["role"] })}
            >
              <option value="doktor">Doktor — vaka düzenle / onayla</option>
              <option value="admin">Admin — tam yetki</option>
              <option value="ogrenci">Öğrenci — vaka çözer</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary text-sm">
          Kullanıcı ekle
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-hairline bg-canvas" aria-labelledby="recent-logins-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 id="recent-logins-title" className="text-sm font-semibold text-ink">Son başarılı girişler</h2>
            <p className="mt-0.5 text-xs text-steel">Kullanıcı adı, rol ve oturum açma zamanı gösterilir.</p>
          </div>
          <button type="button" className="btn-secondary text-xs" onClick={load}>
            Yenile
          </button>
        </div>
        <div className="divide-y divide-hairline-soft">
          {recentLogins.map((login) => (
            <div key={login.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{login.username} giriş yaptı</p>
                <p className="mt-0.5 text-xs text-muted">
                  {new Date(login.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
              {login.role && <span className="badge badge-steel shrink-0">{ROLE_LABEL[login.role]}</span>}
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

      <div className="rounded-xl border border-hairline bg-canvas overflow-hidden">
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
            const latestLogin = latestLoginByUsername.get(u.username.toLowerCase());
            return (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {u.displayName || u.username}{" "}
                  <span className="text-muted font-normal">@{u.username}</span>
                  {locked && (
                    <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">
                      Süper Admin
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted">
                  {locked ? "Süper Admin (kilitli)" : ROLE_LABEL[u.role]}
                  {u.active ? "" : " · pasif"}
                  {u.createdBy ? ` · ekleyen: ${u.createdBy}` : ""}
                  {" · "}
                  {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                  {locked && " · rol/silme korumalı"}
                </div>
                <div className="mt-1 text-[11px] text-steel">
                  Son giriş: {latestLogin ? new Date(latestLogin.createdAt).toLocaleString("tr-TR") : "kayıt yok"}
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
                      Admin · kilitli
                    </span>
                    {isSelf && (
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1"
                        onClick={() => resetPassword(u.id, u.username)}
                        title="Yalnızca kendisi şifre değiştirebilir"
                      >
                        Şifremi değiştir
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <select
                      className="input text-xs py-1"
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as UserRow["role"])}
                    >
                      <option value="doktor">Doktor</option>
                      <option value="admin">Admin</option>
                      <option value="ogrenci">Öğrenci</option>
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1"
                      onClick={() => resetPassword(u.id, u.username)}
                    >
                      Şifre
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
    </div>
  );
}
