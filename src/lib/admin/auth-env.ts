import { prisma } from "../db";

/** Env bootstrap credentials — initial admin setup için */
export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
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
  } catch {}
}

/** İlk deploy'da seed */
export async function seedDefaultAdmin() {
  try {
    const existing = await prisma.adminUser.findUnique({ where: { username: "admin" } });
    if (existing) return;
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const bcrypt = require("bcryptjs");
    await prisma.adminUser.create({
      data: { username: "admin", password: bcrypt.hashSync(password, 10), role: "admin" },
    });
    await logAudit("system", "seed", "Default admin created");
  } catch (e) {
    console.error("seedDefaultAdmin failed:", e);
  }
}
