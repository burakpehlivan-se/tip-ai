import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Kullanıcı adı").fill("admin");
  await page.getByLabel("Şifre").fill("e2e-admin-password");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/admin\/panel$/);
}

test.describe("admin sistem tanısı", () => {
  test("yetkili admin tanı özetini farklı ekran genişliklerinde yenileyebilir", async ({ page }) => {
    await loginAsAdmin(page);

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/panel/diagnostics");

      await expect(page.getByRole("heading", { name: "Sistem tanısı" })).toBeVisible();
      await expect(page.getByText("Kimlik deposu", { exact: true })).toBeVisible();
      await expect(page.getByText("Tümü çalışıyor", { exact: true })).toBeVisible();
      const navigation = page.getByRole("navigation", {
        name: viewport.width < 1024 ? "Mobil panel gezinme" : "Panel gezinme",
      });
      await expect(navigation.getByRole("link", { name: "Sistem Tanısı" })).toHaveAttribute("aria-current", "page");
      const hasNoPageOverflow = await page.locator("html").evaluate(
        (element) => element.scrollWidth <= window.innerWidth
      );
      expect(hasNoPageOverflow).toBe(true);
    }

    const refresh = page.getByRole("button", { name: "Durumu yenile" });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/api/admin/diagnostics") && candidate.request().method() === "GET"
    );
    await refresh.click();
    await expect((await response).status()).toBe(200);
    await expect(page.getByText("Tümü çalışıyor", { exact: true })).toBeVisible();
  });
});
