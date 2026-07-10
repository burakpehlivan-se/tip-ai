/**
 * Admin panel kullanıcı deposu
 * - admin: tam yetki
 * - doktor: vaka düzenleme + onay
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import {
  AdminRole,
  AdminUser,
  UsersStore,
} from "./types";
import { usersPath } from "./paths";
import { getAdminCredentials } from "./auth-env";

const SCRYPT_KEYLEN = 64;

/** Env bootstrap kullanıcı adı (varsayılan: admin) */
export function superAdminUsername(): string {
  return getAdminCredentials().username;
}

/** Süper admin — yetkileri değiştirilemez */
export function isSuperAdminUser(u: Pick<AdminUser, "username" | "superAdmin" | "createdBy">): boolean {
  if (u.superAdmin === true) return true;
  const boot = superAdminUsername().toLowerCase();
  if (u.username.toLowerCase() === boot) return true;
  if (u.createdBy === "system" || u.createdBy === "env") {
    return u.username.toLowerCase() === boot;
  }
  return false;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, data: unknown): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function hashPassword(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  try {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function ensureBootstrapAdmin(store: UsersStore): UsersStore {
  const creds = getAdminCredentials();
  let dirty = false;

  // Mevcut bootstrap kullanıcıyı superAdmin kilitle
  for (const u of store.users) {
    if (u.username.toLowerCase() === creds.username.toLowerCase()) {
      if (!u.superAdmin || u.role !== "admin" || !u.active) {
        u.superAdmin = true;
        u.role = "admin";
        u.active = true;
        if (!u.displayName || u.displayName === u.username) {
          u.displayName = "Süper Admin";
        }
        dirty = true;
      }
    }
  }

  const existing = store.users.find(
    (u) => u.username.toLowerCase() === creds.username.toLowerCase()
  );
  if (existing) {
    if (dirty) {
      store.updatedAt = Date.now();
      writeJsonAtomic(usersPath(), store);
    }
    return store;
  }

  // Env admin yoksa seed et (ilk kurulum)
  if (store.users.length === 0 || !store.users.some((u) => u.role === "admin")) {
    const now = Date.now();
    store.users.push({
      id: `user_${now}_bootstrap`,
      username: creds.username,
      passwordHash: hashPassword(creds.password),
      role: "admin",
      displayName: "Süper Admin",
      active: true,
      superAdmin: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
    });
    store.updatedAt = now;
    writeJsonAtomic(usersPath(), store);
  }
  return store;
}

export function loadUsersStore(): UsersStore {
  const empty: UsersStore = { version: 1, updatedAt: 0, users: [] };
  let store = readJson<UsersStore>(usersPath(), empty);
  if (!store.users) store.users = [];
  store = ensureBootstrapAdmin(store);
  return store;
}

export function saveUsersStore(store: UsersStore): void {
  store.updatedAt = Date.now();
  writeJsonAtomic(usersPath(), store);
}

export function findUserByUsername(username: string): AdminUser | undefined {
  const store = loadUsersStore();
  return store.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.active
  );
}

export function findUserById(id: string): AdminUser | undefined {
  return loadUsersStore().users.find((u) => u.id === id);
}

export function listUsersPublic(): Array<{
  id: string;
  username: string;
  role: AdminRole;
  displayName?: string;
  active: boolean;
  superAdmin?: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}> {
  return loadUsersStore().users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    superAdmin: isSuperAdminUser(u),
    displayName: u.displayName,
    active: u.active,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    createdBy: u.createdBy,
  }));
}

export function authenticateUser(
  username: string,
  password: string
): { user: AdminUser } | null {
  const store = loadUsersStore();
  const user = store.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (user) {
    if (!user.active) return null;
    if (!verifyPasswordHash(password, user.passwordHash)) return null;
    return { user };
  }

  // Geriye dönük: env credentials (henüz store’da yoksa)
  const creds = getAdminCredentials();
  try {
    const uOk =
      username.length === creds.username.length &&
      timingSafeEqual(Buffer.from(username), Buffer.from(creds.username));
    const pOk =
      password.length === creds.password.length &&
      timingSafeEqual(Buffer.from(password), Buffer.from(creds.password));
    if (uOk && pOk) {
      // bootstrap ekle ve dön
      const now = Date.now();
      const bootstrap: AdminUser = {
        id: `user_${now}_env`,
        username: creds.username,
        passwordHash: hashPassword(creds.password),
        role: "admin",
        displayName: "Süper Admin",
        active: true,
        superAdmin: true,
        createdAt: now,
        updatedAt: now,
        createdBy: "env",
      };
      store.users.push(bootstrap);
      saveUsersStore(store);
      return { user: bootstrap };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function createUser(input: {
  username: string;
  password: string;
  role: AdminRole;
  displayName?: string;
  createdBy: string;
}): AdminUser {
  const username = input.username.trim();
  if (!username || username.length < 2) {
    throw new Error("Kullanıcı adı en az 2 karakter olmalı.");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("Şifre en az 6 karakter olmalı.");
  }
  if (input.role !== "admin" && input.role !== "doktor") {
    throw new Error("Geçersiz rol (admin | doktor).");
  }

  const store = loadUsersStore();
  if (store.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Bu kullanıcı adı zaten var.");
  }

  const now = Date.now();
  const user: AdminUser = {
    id: `user_${now}_${createHash("sha1").update(username + now).digest("hex").slice(0, 8)}`,
    username,
    passwordHash: hashPassword(input.password),
    role: input.role,
    displayName: input.displayName?.trim() || username,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  store.users.push(user);
  saveUsersStore(store);
  return user;
}

export function updateUser(
  id: string,
  patch: {
    role?: AdminRole;
    displayName?: string;
    active?: boolean;
    password?: string;
  },
  actor?: { username: string; userId?: string }
): AdminUser {
  const store = loadUsersStore();
  const idx = store.users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("Kullanıcı bulunamadı.");

  const user = store.users[idx];
  const locked = isSuperAdminUser(user);

  if (locked) {
    // Süper admin: rol ve aktiflik asla değişmez
    if (patch.role !== undefined && patch.role !== "admin") {
      throw new Error("Süper admin rolü değiştirilemez.");
    }
    if (patch.active === false) {
      throw new Error("Süper admin pasifleştirilemez.");
    }
    // Şifre: yalnızca kendisi değiştirebilir
    if (patch.password) {
      const self =
        actor &&
        (actor.userId === user.id ||
          actor.username.toLowerCase() === user.username.toLowerCase());
      if (!self) {
        throw new Error("Süper admin şifresini yalnızca kendisi değiştirebilir.");
      }
    }
    // superAdmin bayrağı her zaman koru
    user.superAdmin = true;
    user.role = "admin";
    user.active = true;
  }

  if (patch.role && !locked) {
    if (patch.role !== "admin" && patch.role !== "doktor") {
      throw new Error("Geçersiz rol.");
    }
    if (user.role === "admin" && patch.role !== "admin") {
      const admins = store.users.filter((u) => u.role === "admin" && u.active && u.id !== id);
      if (admins.length === 0) {
        throw new Error("Son admin kullanıcının rolü değiştirilemez.");
      }
    }
    user.role = patch.role;
  }
  if (patch.displayName !== undefined && !locked) {
    user.displayName = patch.displayName;
  }
  // Süper admin displayName opsiyonel sabit "Süper Admin" bırakılabilir; izin ver hafif güncelleme
  if (patch.displayName !== undefined && locked) {
    // isim estetik; yetki değil — serbest
    user.displayName = patch.displayName;
  }
  if (patch.active !== undefined && !locked) {
    if (user.role === "admin" && patch.active === false) {
      const admins = store.users.filter((u) => u.role === "admin" && u.active && u.id !== id);
      if (admins.length === 0) {
        throw new Error("Son admin pasifleştirilemez.");
      }
    }
    user.active = patch.active;
  }
  if (patch.password) {
    if (patch.password.length < 6) throw new Error("Şifre en az 6 karakter olmalı.");
    user.passwordHash = hashPassword(patch.password);
  }
  user.updatedAt = Date.now();
  store.users[idx] = user;
  saveUsersStore(store);
  return user;
}

export function deleteUser(id: string): void {
  const store = loadUsersStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) throw new Error("Kullanıcı bulunamadı.");
  if (isSuperAdminUser(user)) {
    throw new Error("Süper admin silinemez.");
  }
  if (user.role === "admin") {
    const admins = store.users.filter((u) => u.role === "admin" && u.active && u.id !== id);
    if (admins.length === 0) throw new Error("Son admin silinemez.");
  }
  store.users = store.users.filter((u) => u.id !== id);
  saveUsersStore(store);
}

export function publicUser(u: AdminUser) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    active: u.active,
    superAdmin: isSuperAdminUser(u),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    createdBy: u.createdBy,
  };
}
