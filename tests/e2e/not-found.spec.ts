import { expect, test } from "@playwright/test";

test("bulunamayan bir sayfa erişilebilir biçimde ana sayfaya yönlendirir", async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/bu-sayfa-yok");

    await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
    const homeLink = page.getByRole("link", { name: "Ana sayfaya dön" });
    await expect(homeLink).toBeVisible();
    await homeLink.focus();
    await expect(homeLink).toBeFocused();

    const hasNoPageOverflow = await page.locator("html").evaluate(
      (element) => element.scrollWidth <= window.innerWidth
    );
    expect(hasNoPageOverflow).toBe(true);
  }
});
