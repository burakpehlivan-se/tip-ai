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
