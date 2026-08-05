import { prisma } from "../db";
import { logger } from "../logger";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Eksik ortam değişkeni: ${name}. ${name} .env dosyasında tanımlanmalıdır.`
    );
  }
  return value;
}

/** Env bootstrap credentials — initial admin setup için */
export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: requireEnv("ADMIN_PASSWORD"),
  };
}

/** DB-based password verification (bcrypt) */
export async function verifyAdminPassword(username: string, password: string): Promise<boolean> {
  try {
    const bcrypt = require("bcryptjs");
    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (!user) return false;
    return require("bcryptjs").compareSync(password, user.password);
  } catch {
    return false;
  }
}

/** Audit log */
export async function logAudit(userId: string, action: string, detail?: string) {
  try {
    await prisma.auditLog.create({ data: { userId, action, detail: detail || "", ip: "" } });
  } catch (e) {
    logger.warn("Audit log yazılamadı", { userId, action, error: String(e) });
  }
}

/** İlk deploy'da seed */
export async function seedDefaultAdmin() {
  try {
    const credentials = getAdminCredentials();
    const existing = await prisma.adminUser.findUnique({
      where: { username: credentials.username },
    });
    if (existing) return;
    const bcrypt = require("bcryptjs");
    await prisma.adminUser.create({
      data: {
        username: credentials.username,
        password: bcrypt.hashSync(credentials.password, 10),
        role: "admin",
      },
    });
    await logAudit("system", "seed", "Default admin created");
  } catch (e) {
    logger.error("seedDefaultAdmin failed", { error: String(e) });
  }
}
