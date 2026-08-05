# TIP-AI Teknik Borç Uygulama Planı

Tarih: 2026-08-05 · Kaynak: teknik borç denetimi (23.2k LOC, 43 commit, 30 API route, 0 test)

## Kabul Kriterleri (tüm fazlar)
- Her faz sonunda: `npx tsc --noEmit` (0 hata) + `npx next lint` (0 uyarı) + `npm run build` geçer
- Davranış değişmez (refactor; feature değil)
- Her görevde "Doğrula:" satırındaki kontrol çalışır

---

## Faz 1 — Güvenlik Hızlı Düzeltmeleri (2 saat)

| # | Görev | Doğrula |
|---|-------|---------|
| 1.1 | `auth-env.ts`'te `ADMIN_PASSWORD \|\| "admin123"` fallback'ini kaldır; `getAdminCredentials()` env yoksa throw etsin | `getAdminCredentials` çıplak env ile hata fırlatır |
| 1.2 | `seedDefaultAdmin` + login akışı 1.1'i kullansın; hata startup loguna düşsün | Seed env'siz çalışmaz, hata görünür |
| 1.3 | `auth.ts` `secret()`: production'da `ADMIN_SESSION_SECRET` zorunlu (fallback yok); dev'de uyarı | Production build'de eksik secret → hata |
| 1.4 | `prisma/data/tip-ai.db` repo'dan çıkar (`git rm --cached`) + `.gitignore`'a `prisma/data/` ekle | `git ls-files | grep .db` boş |
| 1.5 | `.env.example` tamamla: `DATABASE_URL` + 3 admin değişkeni + açıklama | `.env.example` tüm kullanılan env'leri belgeler |
| 1.6 | `npm audit` bulgularını takip kartına al (Next 16 kırıcı yükseltme — Faz 7) | Rapor güncel |

NFR: varsayılan credential yok · repo'da DB artefaktı yok · env doğrulaması startup'ta.

## Faz 2 — Ölü Kod & Şema Temizliği (4 saat)

| # | Görev | Doğrula |
|---|-------|---------|
| 2.1 | `schema.prisma`: `Session`, `SessionAction`, `StudentProgress`, `Settings`, `AdminOverride` modellerini sil (hiç kullanılmıyor); `AdminUser`, `AuditLog` kalır | `prisma generate` başarılı; grep `prisma\.session` → boş |
| 2.2 | `better-sqlite3` + `@types/better-sqlite3` kaldır (ölü bağımlılık) | `npm ls better-sqlite3` → empty |
| 2.3 | `package.json`: kırık `etl:mimic-demo` script'ini kaldır (dosya yok) | `npm run` listesinde script yok |
| 2.4 | `tsconfig.tsbuildinfo` izleme dışı kalıp `.gitignore`'da olduğunu teyit et | zaten ignore'lu |

NFR: package.json script'leri gerçek dosyalara işaret eder · şema %100 kullanılır.

## Faz 3 — Veri Güvenilirliği: Yazma Kilidi (3 saat)

| # | Görev | Doğrula |
|---|-------|---------|
| 3.1 | `store.ts`'e in-process mutex (`withStoreLock`) ekle; `recordMutation`, `undoLog`, `restoreBackup`, `createBackup`, `addFeedback`, `recordPlaySession`, `saveSettings`, `appendLog` kilit altına al | 2 eşzamanlı mutasyon → seri, veri kaybı yok (test) |
| 3.2 | Çok işlemli (cluster/çok replika) senaryosunu dokümante et; dosya kilidi gerektiğinde SQLite'e geçiş notu | PLAN'a risk notu işlendi |

NFR: tek süreçte eşzamanlı 10 istek → veri kaybı yok · atomic write korunur.

## Faz 4 — Test Altyapısı (12 saat)

| # | Görev | Doğrula |
|---|-------|---------|
| 4.1 | `vitest` kur (dev dep) + `test` script'i | `npm test` boş suite ile geçer |
| 4.2 | `cdm/validate-report` testleri: geçerli/geçersiz CDM belge, hata raporu | ≥%80 kritik dal coverage |
| 4.3 | `admin/store` testleri: mutasyon+log+undo+backup (temp dir'de) | 10+ senaryo |
| 4.4 | `scoring/degerlendir` testleri: puanlama, red flag, gereksiz test | kritik yollar |
| 4.5 | `lab-motor` testleri: kural motoru + fallback + alias | kural uygulanır/uygulanmaz |
| 4.6 | `pipeline/lab-fill` + `pedagogic-checker` smoke testleri | kritik akış |

NFR: deterministic (zaman bağımlılığı yok) · CI'da <5 dk · piramit %70 unit / %20 integration / %10 E2E · coverage %100 hedef DEĞİL (diminishing returns).

## Faz 5 — Client/Server Sınırı (4 saat)

| # | Görev | Doğrula |
|---|-------|---------|
| 5.1 | `lab-motor`'un `rule-engine-store` importunu kaldır → kuralları API'den asenkron al veya saf fonksiyona çevir | `VakaWorkspace` client bundle'ında `fs` yok |
| 5.2 | `next.config.mjs` `fs:false` fallback'ini kaldır | Build + `npm run start` çalışır |
| 5.3 | `VakaWorkspace.tsx` (1513 satır) lazy parçalara bölme planı çıkar (uygulama Faz 8) | Plan dosyaya işlendi |

NFR: client bundle'da server-only modül yok · ilk yükleme JS'i ölçülür (bundle analyzer ile, önce ölç sonra optimize).

## Faz 6 — CI Pipeline (4 saat)

| # | Görev | Doğrula |
|---|-------|---------|
| 6.1 | `.github/workflows/ci.yml`: `npm ci` → `lint` → `tsc --noEmit` → `vitest` → `next build` | Workflow syntax valid |
| 6.2 | Secret'lar repo env'ine (env dosyası yok) | Workflow `.env` okumaz |

NFR: kırmızı build merge edilemez · pipeline <10 dk.

## Faz 7 — Observability (4 saat) — NOT: Next 16 güvenlik yükseltmesi buraya bağlı

| # | Görev | Doğrula |
|---|-------|---------|
| 7.1 | Basit structured logger (`src/lib/logger.ts`): JSON + requestId; `console.error` çağrılarını taşı | Log formatı JSON |
| 7.2 | API hata şekli standardize: `{ error: string }` (tüm route'lar) | 30 route'ta tutarlı |
| 7.3 | Sessiz `catch`'lerin kritik olanlarını (store, backup) logla | Bozuk yedek/okuma hatası görünür |
| 7.4 | **Ayrı iş:** `next@16` yükseltmesi (npm audit critical'ı) — staging'de doğrula, ayrı PR | audit temiz, build+test yeşil |

NFR: her hata loglanır · hata şekli API boyunca tutarlı.

## Faz 8 — God Dosya Parçalama (16 saat — en son, en riskli, ayrı iş)

| # | Görev | Doğrula |
|---|-------|---------|
| 8.1 | `case-generator.ts` (1880): şablon verisi / üretici mantık ayrımı | Davranış aynı (Faz 4 testleri yeşil) |
| 8.2 | `VakaWorkspace.tsx` (1513): panel bileşenlerine böl (anamnez/fizik/tetkik/tedavi) | Aynı davranış |
| 8.3 | `vakalar/[id]/page.tsx` (1358), `kural-motoru/page.tsx` (972) parçala | Aynı davranış |
| 8.4 | Yeni dosya limiti ~400 LOC kuralı | Rule of thumb uygulanır |

NFR: her parçalama önce testle kilitlenir (Faz 4) · refactor'dur, feature değildir.

---

## Riskler
1. **Faz 7.4 (Next 16):** kırıcı değişiklikler (App Router davranışları) — staging doğrulaması zorunlu
2. **Faz 5:** client bundle değişimi — `VakaWorkspace` oyun akışı kritik; elle test şart
3. **Faz 3:** mutex eklenirken deadlock riski — kilit içinde asenkron beklemek yasak (sync-only)
4. **Faz 8:** god dosya parçalama davranış değiştirme riski — testler olmadan başlanmaz

## Durum Takibi
| Faz | Durum |
|-----|-------|
| 1 Güvenlik | ✅ 1.1–1.5 tamam · 1.6 takip kartına işlendi (Next 16) |
| 2 Ölü Kod | ✅ 2.1–2.3 tamam (schema 2 modele indi, better-sqlite3 kaldırıldı, script silindi) |
| 3 Yazma Kilidi | ✅ 3.1 tamam (`withStoreLock` + undoLog/restoreBackup) · 3.2 dokümante |
| 4 Test Altyapısı | ✅ 4.1–4.6: vitest + 22 test (CDM, store, scoring, lab-motor) |
| 5 Client/Server | 🟡 5.1 runtime izolasyon tamam (guarded loader) · 5.2 fs:false KALDI (Faz 8'e devredildi) |
| 6 CI | ✅ 6.1–6.2 tamam (`.github/workflows/ci.yml`) |
| 7 Observability | 🟡 7.1 logger + 7.3 kritik catch'ler tamam · 7.2/7.4 ayrı iş |
| 8 God Dosyalar | ⏳ Planlandı — ayrı oturum |

## Ek Bulgular (uygulama sırasında)
1. `EXAMPLE_CDM_KBH` fixture'ı `rubric.puanlama` içermiyordu (geçersiz örnek belge) — düzeltildi
2. `rule-engine-store` client'ta HER ZAMAN fallback'e düşüyordu (fs stub) — admin kural değişiklikleri yalnızca sunucu tarafında etkili; runtime izolasyonu netleştirildi
3. Testler 3 gerçek tutarsızlığı ortaya çıkardı: AuditAction tipi, RubrikAksiyon aciklama zorunluluğu, "synthetic" source etiketi
