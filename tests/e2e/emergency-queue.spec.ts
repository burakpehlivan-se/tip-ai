import { expect, test } from "@playwright/test";

function uniqueStudent() {
  return `e2e.acil.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

test("öğrenci acil simülatöründe ilk hastayı güvenle başlatır", async ({ page }) => {
  const username = uniqueStudent();

  await page.goto("/giris");
  await page.getByRole("button", { name: "Kayıt Ol", exact: true }).click();
  await page.getByLabel("Görünen ad (isteğe bağlı)").fill("Acil E2E Öğrencisi");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre", { exact: true }).fill("e2e-guclu-parola-123");
  await page.getByLabel("Şifre (tekrar)").fill("e2e-guclu-parola-123");
  await page.getByRole("button", { name: "Hesap Oluştur" }).click();

  await expect(page).toHaveURL(/\/profilim$/);
  await page.goto("/cemicegek");
  await expect(page.getByRole("heading", { name: "Çemiçgezek Devlet Hastanesi" })).toBeVisible();

  await page.getByRole("button", { name: /Sıradaki Hastayı Getir/ }).click();
  await expect(page.getByLabel("Hastaya soru sor")).toBeVisible();
});
