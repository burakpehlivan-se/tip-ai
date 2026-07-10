"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  username: string;
  role: "admin" | "doktor";
  displayName?: string;
  active: boolean;
  createdAt: number;
  createdBy?: string;
}

export default function KullanicilarPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "doktor" as "admin" | "doktor",
    displayName: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users")
      .then(async (r) => {
        if (r.status === 403) {
          router.replace("/admin/panel");
          return;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setUsers(d.users || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function changeRole(id: string, role: "admin" | "doktor") {
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

  if (loading) {
    return <p className="text-sm text-steel">Yükleniyor…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Kullanıcılar</h1>
        <p className="mt-1 text-sm text-steel">
          Admin: tam yetki · Doktor: vaka düzenleme ve onay
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
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "admin" | "doktor" })
              }
            >
              <option value="doktor">Doktor — vaka düzenle / onayla</option>
              <option value="admin">Admin — tam yetki</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary text-sm">
          Kullanıcı ekle
        </button>
      </form>

      <div className="rounded-xl border border-hairline bg-canvas overflow-hidden">
        <div className="border-b border-hairline px-4 py-3 text-sm font-semibold text-ink">
          Kayıtlı kullanıcılar ({users.length})
        </div>
        <div className="divide-y divide-hairline-soft">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {u.displayName || u.username}{" "}
                  <span className="text-muted font-normal">@{u.username}</span>
                </div>
                <div className="text-[11px] text-muted">
                  {u.role === "admin" ? "Admin" : "Doktor"}
                  {u.active ? "" : " · pasif"}
                  {u.createdBy ? ` · ekleyen: ${u.createdBy}` : ""}
                  {" · "}
                  {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="input text-xs py-1"
                  value={u.role}
                  onChange={(e) =>
                    changeRole(u.id, e.target.value as "admin" | "doktor")
                  }
                >
                  <option value="doktor">Doktor</option>
                  <option value="admin">Admin</option>
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
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="p-4 text-sm text-muted">Henüz kullanıcı yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
