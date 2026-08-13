import {
  pgEnum,
  pgTable,
  boolean,
  jsonb,
  index,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Panel rolleri — "ogrenci" öğrenci tarafı hesabıdır (panel erişimi yok) */
export const userRole = pgEnum("user_role", ["admin", "doktor", "ogrenci"]);

/**
 * Tek kimlik deposu: yalnızca giriş bilgileri ve rol tutulur.
 * Hasta/sağlık verisi asla buraya yazılmaz.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** normalize edilmiş küçük harf benzersiz kullanıcı adı */
  username: text("username").notNull().unique(),
  /** opsiyonel; doluysa benzersiz olmalı */
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("ogrenci"),
  active: boolean("active").notNull().default(true),
  displayName: text("display_name"),
  /** Bootstrap süper admin — rol/aktiflik/silme değiştirilemez */
  superAdmin: boolean("super_admin").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export type UserRole = "admin" | "doktor" | "ogrenci";

export const authAuditLogs = pgTable("auth_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * login_failed | register_student | role_change | account_deactivated ...
   * Kişisel/hasta verisi içermez. Yalnızca giriş olayı ve rol değişikliği.
   */
  event: text("event").notNull(),
  username: text("username").notNull(),
  role: text("role"),
  actor: text("actor"),
  ip: text("ip"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthAuditLog = typeof authAuditLogs.$inferSelect;

/**
 * PostgreSQL runtime modunda imzalı cookie'nin sunucu tarafındaki kaydı.
 * Token saklanmaz; yalnızca rastgele oturum kimliği, kullanıcı ve süre tutulur.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)]
);

export type AuthSession = typeof authSessions.$inferSelect;
