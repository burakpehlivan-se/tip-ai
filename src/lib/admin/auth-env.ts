/** Env bootstrap credentials — users.ts ile circular import kırmak için ayrıldı */

export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
  };
}
