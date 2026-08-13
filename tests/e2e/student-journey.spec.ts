import { expect, test } from "@playwright/test";

function uniqueStudent() {
  return `e2e.ogrenci.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

test.describe("öğrenci kritik yolculuğu", () => {
  test("kayıt olur, vaka başlatır ve öğrenci admin kullanıcılarını okuyamaz", async ({ page }) => {
    const username = uniqueStudent();

    await page.goto("/giris");
    await page.getByRole("button", { name: "Kayıt Ol", exact: true }).click();
    await page.getByLabel("Görünen ad (isteğe bağlı)").fill("E2E Öğrencisi");
    await page.getByLabel("Kullanıcı adı").fill(username);
    await page.getByLabel("Şifre", { exact: true }).fill("e2e-guclu-parola-123");
    await page.getByLabel("Şifre (tekrar)").fill("e2e-guclu-parola-123");
    await page.getByRole("button", { name: "Hesap Oluştur" }).click();

    await expect(page).toHaveURL(/\/profilim$/);
    await expect(page.getByRole("heading", { name: "E2E Öğrencisi" })).toBeVisible();

    const privacySection = page.locator('section[aria-labelledby="ilgili-kisi-talepleri"]');
    page.once("dialog", (dialog) => dialog.accept());
    await privacySection.getByRole("button", { name: "Talep oluştur" }).first().click();
    await expect(privacySection.getByRole("status")).toContainText("Talebiniz kayda alındı");
    await expect(privacySection.getByRole("button", { name: "Açık talep var" })).toBeVisible();

    const adminStatus = await page.evaluate(async () => (await fetch("/api/admin/users")).status);
    expect([401, 403]).toContain(adminStatus);

    await page.goto("/poliklinik/kardiyoloji");
    const questionInput = page.getByLabel("Hastaya soru sor");
    await expect(questionInput).toBeVisible();

    const skipLink = page.getByRole("link", { name: "Çalışma alanına atla" });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#vaka-calismasi")).toBeFocused();

    await questionInput.fill("Ağrınız ne zaman başladı?");
    await page.getByRole("button", { name: "Sor", exact: true }).click();
    await expect(page.getByRole("log", { name: "Vaka sohbeti" }).getByText("Ağrınız ne zaman başladı?")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Hastaya soru sor")).toBeVisible();
  });
});
