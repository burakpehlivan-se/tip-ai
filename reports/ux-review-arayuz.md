# UX Denetim Raporu — Arayüz (2026-08-07)

Kapsam: landing, vaka listesi, oyun modu (VakaWorkspace), giriş formu, deneme vakası.

## Düzeltilen Bulgular

| # | Sorun | Konum | Çözüm |
|---|-------|-------|-------|
| 1 | Sistem mesajı + test raporu yan yana düşüyordu (flex-row) | `VakaWorkspace.tsx` `MesajBalonu` | `flex-col items-center` — rapor mesajın altında |
| 2 | Back link (sadece svg) screen reader'da adsız | `VakaWorkspace.tsx:442` | `aria-label="Vakalara dön"` |
| 3 | Soru drawer kapat butonu adsız, ESC kapamıyor, odak taşınmıyor | `VakaWorkspace.tsx` | `aria-label`, `role="dialog"` + `aria-modal` + `aria-label`, açılışta odak kapat butonuna, window ESC listener |
| 4 | Faz sekmeleri + mobil alt tab'lar durum bildirmiyor | `VakaWorkspace.tsx` (4 yer) | `aria-pressed` |
| 5 | Test sonucu kartları genişletme durumu bildirmiyor | `VakaWorkspace.tsx` `TestSonucKarti`/`DebugTestKarti` | `aria-expanded` |
| 6 | Klinik kırmızı #d45656 = 4.0:1 (WCAG AA FAIL) | `tailwind.config.ts` + `globals.css` | #b33939 → 5.9:1 ✓ |
| 7 | Klinik turuncu #f59e0b = 2.2:1 (WCAG AA FAIL) | `tailwind.config.ts` + `globals.css` | #b45309 → 5.0:1 ✓ |
| 8 | Giriş formunda label'lar input'a bağlı değildi (WCAG 1.3.1) | `giris/page.tsx` | `htmlFor`/`id` eklendi (4 alan) |
| 9 | Hasta kartında "Göğüste baskı hissi (erkek, 50 yaş)" — üretilen hasta ile tutarsız | `data/admin/cases.json` + `case-generator.ts:295` | Parantezli sabit metin kaldırıldı — yaş/cinsiyet kartta zaten gösteriliyor |
| 10 | Konsol: favicon 404 | `src/app` | `app/icon.svg` eklendi |

## Doğrulama

- `tsc --noEmit` ✓ · `next lint` ✓ · `vitest` 38/38 ✓
- Tarayıcı: mesaj+rapor alt alta ✓, drawer ESC + odak ✓, `[pressed]` durumları ✓, konsol 0 hata ✓

## Açık Öneriler (düşük öncelik)

- Soru drawer odak kapanışta "Tümü" butonuna dönmüyor (focus trap tam değil) — sonraki iterasyon
- Kategori dropdown dış tıklamada kapanmıyor
- Tedavi fazı orta panel textarea tek satır (`rows={1}`) — sağ panelde çok satırlı alternatif mevcut
