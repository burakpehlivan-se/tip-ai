# tıp_ai Design System

> Mintlify DESIGN.md temel alınarak Türkçe klinik tıp uygulaması için uyarlanmıştır.
> Kaynak: https://github.com/VoltAgent/awesome-design-md/ — Mintlify analizinden adaptasyon.

## Visual Theme & Atmosphere

Türkçe klinik karar simülasyon sistemi. Temiz, hijyenik, profesyonel — mint yeşili
aksent (#00d4a4) tıp/sağlık psikolojisi için seçildi. Beyaz canvas, Inter font,
pill butonlar. Klinik yazılım hissi veren sade tasarım dili — bilişsel yükü azaltır,
uzun vaka çalışma seansları için gözü yormaz.

## Color Palette & Roles

| Token | Hex | Rol |
|---|---|---|
| `canvas` | #ffffff | Sayfa arka planı |
| `canvas-dark` | #0a0a0a | Disclaimer banner, koyu yüzeyler |
| `surface` | #f7f7f7 | Özellik kartları, hafif bölümler |
| `surface-soft` | #fafafa | Sol/sağ panel arka planı |
| `surface-code` | #1c1c1e | Kod blokları (ileride) |
| `ink` | #0a0a0a | Başlıklar, primer metin |
| `charcoal` | #1c1c1e | Hover/active状态的 koyu metin |
| `slate` | #3a3a3c | İkincil metin |
| `steel` | #5a5a5c | Üçüncül metin, açıklamalar |
| `stone` | #888888 | Caption, muted label |
| `muted` | #a8a8aa | Disabled, placeholder |
| `hairline` | #e5e5e5 | 1px border'lar |
| `hairline-soft` | #ededed | Hafif divider'lar |
| `brand` | #00d4a4 | Ana aksent — buton, başarı, aktif |
| `brand-deep` | #00b48a | Hover/active aksent |
| `brand-soft` | #7cebcb | Hafif aksent arka plan |
| `clinical-red` | #d45656 | Hata, red flag, negatif puan |
| `clinical-orange` | #f59e0b | Uyarı, orta seviye |
| `clinical-blue` | #3772cf | Bilgi, kategori etiketi |

## Typography Rules

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| hero-display | 72px | 600 | 1.05 | -2px | Ana sayfa hero başlık |
| display-lg | 56px | 600 | 1.10 | -1.5px | Bölüm başlıkları |
| heading-1 | 48px | 600 | 1.10 | -1px | Sayfa başlıkları |
| heading-2 | 36px | 600 | 1.20 | -0.5px | Alt bölüm başlıkları |
| heading-3 | 28px | 600 | 1.25 | 0 | Kart başlıkları |
| heading-4 | 22px | 600 | 1.30 | 0 | Alt kart başlıkları |
| heading-5 | 18px | 600 | 1.40 | 0 | Küçük başlıklar |
| body-md | 16px | 400 | 1.50 | 0 | Varsayılan metin |
| body-sm | 14px | 400 | 1.50 | 0 | İkincil metin, kart içeriği |
| caption | 13px | 400 | 1.40 | 0 | Badge, meta, caption |
| button-md | 14px | 500 | 1.30 | 0 | Buton etiketleri |

Font ailesi: **Inter** (UI) + **Geist Mono** (kod — ileride). Inter Türkçe karakter
desteği mükemmel. Display weight 600, body weight 400.

## Component Stylings

### Buttons
- `btn-primary`: Siyah pill, beyaz metin, rounded-full, 10px×20px padding. Hover: charcoal.
- `btn-accent`: Mint yeşili pill, koyu metin, rounded-full. Hover: brand-deep.
- `btn-secondary`: Şeffaf, hairline border, ink metin. Hover: surface bg.
- `btn-ghost`: Şeffaf, rounded-md, küçük padding.

### Cards
- `card`: Beyaz, hairline border, rounded-lg, 24px padding.
- `card-feature`: Surface bg (gri), rounded-lg, 32px padding.

### Inputs
- `input`: 40px height, hairline border, rounded-md, focus'ta brand border + ring.

### Badges
- `badge-brand`: Brand/15 bg, brand-deep text.
- `badge-red`: Clinical-red/15 bg, clinical-red text.
- `badge-orange`: Clinical-orange/15 bg, clinical-orange text.
- `badge-blue`: Clinical-blue/15 bg, clinical-blue text.
- `badge-steel`: Surface bg, steel text.

## Layout Principles

- 4px spacing sistemi (8px primer artış)
- Maksimum içerik genişliği: 6xl (~1152px) ana sayfa, 4xl (~896px) içerik sayfaları
- Vaka ekranı: tam ekran 3-panel (sol 288px / orta flex / sağ 320px)
- Section padding: 64-96px ana bölümler arası
- Mobilde 3-panel → tabbed/scroll

## Do's and Don'ts

### Do
- Mint yeşili aksent'i sadece başarı, aktif durum ve accent CTA için kullan
- Siyah primer CTA butonları kullan
- Inter font kullan, her zaman
- Beyaz canvas'ı koru — temiz, klinik his
- Pill butonlar (rounded-full) her zaman
- Kartlar için rounded-lg (12px)

### Don't
- Aksent rengini büyük yüzeylerde kullanma
- 600'den daha kalın font weight kullanma
- Ağır gölgeler kullanma — soft shadow yeterli
- İkinci bir aksent renk ekleme (clinical renkler sadece semantic durumlar için)
- Gerçek siyah (#000000) canvas olarak kullanma — #0a0a0a veya #ffffff

## Responsive Behavior

| Breakpoint | Width | Değişiklik |
|---|---|---|
| Mobile | <640px | Tek kolon, hero 36px |
| Tablet | 768px | 2-kolon grid |
| Desktop | 1024px | 3-kolon grid, sol panel görünür |
| Wide | 1280px | 3-panel vaka ekranı tam (sol+orta+sağ) |

Vaka ekranında: <1024px'de sol panel gizli, <1280px'de sağ panel gizli → mobile tabs.

## Agent Prompt Guide

Bu design sistemini kullanarak UI üretirken:
- Renkler: `bg-canvas`, `text-ink`, `bg-brand`, `text-steel`, `border-hairline`
- Butonlar: `.btn-primary`, `.btn-accent`, `.btn-secondary`, `.btn-ghost`
- Kartlar: `.card`, `.card-feature`
- Badge: `.badge .badge-brand`, `.badge .badge-red`, `.badge .badge-steel`
- Input: `.input`
- Font: `font-sans` (Inter), display için `font-semibold tracking-tight`
