import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

/**
 * Kritik öğrenci yolculuğu yalnızca production Next.js sunucusunda ölçülür.
 * Test çalıştırması kendi JSON runtime verisini üretir; bu veri `.gitignore`
 * altındaki `data/` dizinindedir ve dış sistemlere gönderilmez.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }], ["junit", { outputFile: "test-results/e2e-junit.xml" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results/e2e-artifacts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Docker runtime ile aynı Next standalone sunucusu: E2E, `next start`
        // uyumluluk katmanını değil gerçek yayın yolunu denetler.
        // Dockerfile, .next/static dosyalarını standalone sunucunun yanına kopyalar.
        // Yerel üretim koşumu da aynı dosya düzenini kullanmalıdır; aksi halde istemci
        // paketleri 404 döner ve arayüz hydrate olmaz.
        command: `cp -R .next/static .next/standalone/.next/ && HOSTNAME=127.0.0.1 PORT=${port} ADMIN_PASSWORD=e2e-admin-password ADMIN_SESSION_SECRET=e2e-session-secret-at-least-32-characters node .next/standalone/server.js`,
        url: baseURL,
        reuseExistingServer: Boolean(process.env.PLAYWRIGHT_REUSE_SERVER),
        timeout: 120_000,
      },
});
