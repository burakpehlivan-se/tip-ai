# Teknik Borç Denetimi ve İyileştirme Planı

> Tarih: 2026-08-21 · Kapsam: src + scripts (~53k LOC, 64 test dosyası)
> Yöntem: tech-debt-audit protokolü — 9 boyut, 3 paralel denetim, tüm bulgular `dosya:satır` kanıtlı.
> Kısıtlar: Performans mevcut seviyede tutulacak (regresyon yok), aşırı mühendislik yok, bakım yükü artmayacak.

---

## Yönetici Özeti

Genel sağlık **iyi**: strict TypeScript (2 `any`), 0 CVE, SQL tamamen parametreli, tutarlı `{ error }` sözleşmesi, kaliteli rate-limit. En zayıf alanlar: **admin API'lerinde sorgu verimsizliği** (bir Critical N+1) ve **gözlemlenebilirlik** (33 sessiz catch bloğu). Hızlı kazanım sayısı: ~10 madde, toplam ~1 gün.

## Zihinsel Model

Türkçe tıp eğitimi klinik simülasyon platformu. Next.js (App Router, client component ağırlıklı) + Drizzle ORM + PostgreSQL; AI yanitları DeepSeek proxy'sinden gelir. Veri katmanı iki modlu (`STORE_MODE=postgres` prod'da; JSON store test/legacy). Modüller: `lib/auth` (oturum/şifre), `lib/student` (deneme akışı + attempt store), `lib/admin` (vaka yönetimi + panel API'leri), `lib/vaka|data` (katalog/şablonlar), `app/admin/panel/*` (yoğun admin UI).

## Bulgular Tablosu

| ID | Boyut | Konum | Şiddet | Efor | Sorun | Öneri |
|----|-------|-------|--------|------|-------|-------|
| F1 | Perf | `api/admin/ekg-sources/route.ts:47-62` | **Critical** | 1-2s | N+1: ~535 satır × garanti-miss `getRuntimeCaseById` = sayfa başına ~536 boşuna sorgu + paginasyon yok | Per-row lookup'ı at, SQL GROUP BY ile aggregate et |
| F2 | Perf | `lib/admin/postgres-case-store.ts:130-163` | High | 4-6s | Tüm vaka korpusu (~595 satır full JSONB) her admin isteğinde belleğe yükleniyor; ≥10 route kullanıyor | Kullanım başına projeksiyon sorgusu (aşamalı) |
| F3 | Perf | `api/student/attempts/route.ts:71-77` | High | 1-2s | Aynı sourceCaseId 3 kez çözülüyor; 7 sıralı DB turu — öğrenci hot path'i | Tek çözüm + `Promise.all`, ideal: EXISTS join |
| F4 | Güvenlik | `api/ai/soru-eslestir/route.ts:14-17` | High | 0.5s | Oturumsuz + rate-limitsiz AI proxy → faturalandırma istismarı vektörü | Session check + `takeRateLimit` ekle |
| F5 | Gözlem | `api/student/login/route.ts:61-63` | High | 0.25s | Auth path'te sessiz catch — DB kesintisi kötü girişten ayırt edilemiyor | `logger.exception` + 503 ayrımı |
| F6 | Test | `api/admin/users/recent-logins/route.test.ts:26-27` | High | 0.5s | Test hardcoded DB URL'e bağlanıyor → `npm test` kapısı sürekli kırık | `TEST_DATABASE_URL` gate'i uygula (postgres.integration.test.ts deseni) |
| F7 | Test | `lib/student/public-case.ts` | High | 2-3s | Misafir/PHI-strip akışı sıfır test | Saf fonksiyon unit testleri (infra gerekmez) |
| F8 | Mimari | `admin/panel/vakalar/[id]/page.tsx:102-1646` | High | 8h+ | 1545 LOC god component, 34 useState, en yüksek churn #2 | **Şimdilik bölme** — kural: daha fazla büyütme; dokunulduğunda tab-tab çıkar |
| F9 | Mimari | `components/vaka/VakaWorkspace.tsx:101-1363` | High | 8h+ | 1263 LOC, 61 hook, churn şampiyonu (52 commit); React test infra'su yok | Aynı kural: büyütme, dokununca reducer/hook'a taşı |
| F10 | Gözlem | ~33 API catch bloğu log'suz (`admin/users/recent-logins:36` vb.) | Medium | 1-2s | Sessiz 503'ler üretimde görünmez | Kritik path'lere tek satır `logger.warn/error` |
| F11 | Güvenlik | `api/student/register/route.ts:51-53` | Medium | 0.25s | Dahili hata mesajı anonim istemciye sızmıyor mu kontrol + log yok | Mesaj sanitizasyonu + log |
| F12 | Tip | `api/admin/pipeline/fill/route.ts:22` | Medium | 0.25s | `as { id?: string }` doğrulanmamış cast mutation recorder'a akıyor | typeof guard |
| F13 | Bundle | `app/profilim/page.tsx:6-7` | Medium | 0.1s | Tip-only import value olarak yapılıyor → fs + 1473 LOC zinciri client bundle'a | `import type` |
| F14 | Tutarlılık | API error mesajları: `"Vaka bulunamadı."` ×14 vs ×3 noktalama drift; kod yok | Medium | 2-3s | İstemci string'e güvenerek branch edemiyor | Aşamalı: sadece yeni kodda sabit mesajlar; kod sistemi ekleme |
| F15 | Config | `.env.example`:12-13 `GUEST_CASE_ID` ölü; :25-26 shadow-read "kullanılmıyor" ama kod duruyor; README:291 env listesi eksik (5 değişken) | Medium | 1s | Doc/kod çelişkisi deployer'ları yanıltır | Ölü var sil, listeyi senkle |
| F16 | Mimari | `lib/admin/store.ts:48,211,225,248` ölü exportlar; `attempt-store.ts:32 ↔ postgres-attempt-store.ts:15` tip-döngüsü | Low | 0.5s | Legacy JSON-store yüzeyi kalıntısı | Export kaldır / tipleri ayır |
| F17 | Gözlem | `app/global-error.tsx` yok | Low | 0.25s | Root layout hatalarında framework default ekranı | Minimal global-error ekle |
| F18 | Test | `auth/password.ts` hash testleri skip'li integration dosyasında; `postgres-attempt-store.ts` kapsamsız | Medium | 2-4s | Varsayılan `npm test` bu kritik yolları hiç çalıştırmıyor | Her zaman açık unit testler |
| F19 | Perf | `postgres-case-store.ts:146-153` seed döngüsü satır-satır insert | Medium | 0.5s | Yüzlerce sıralı await | `onConflictDoNothing()` bulk insert |

## İlk 5 Öncelik (etki/efor)

1. **F1** ekg-sources N+1 — kritik prod etkisi, 1-2 saat
2. **F4+F5+F11+F12** güvenlik/gözlem paketi — ~1 saatte 4 delik kapanır
3. **F3** öğrenci hot-path sorgu optimizasyonu — 1-2 saat
4. **F6** kırık test kapısını onar — CI güveni, 30 dk
5. **F13+F16+F19** mikro temizlik paketi — 1 saat

## Hızlı Kazanımlar (<30 dk each)

- [ ] F13 `import type` düzeltmesi (2 satır)
- [ ] F4 soru-eslestir'a session+rate-limit (~15 satır)
- [ ] F5 login catch'ine log (~3 satır)
- [ ] F11 register sanitizasyonu (~5 satır)
- F12 typeof guard (~3 satır)
- [ ] F17 global-error.tsx (~20 satır)
- [ ] F19 bulk insert (~10 satır)
- [ ] F15 .env.example temizliği + README env listesi

## "Kötü Görünüyor Ama Sorun Değil"

1. **Türkçe domain + English infra isim karışımı** (`sorulanAksiyonlar` vs `recordPlaySession`) — proje konvansiyonu (UI Türkçe, altyapı İngilizce); yeniden adlandırma yüksek risk/düşük getiri.
2. **`case-templates.ts` 1473 LOC** — salt-veri dosyası; içerik büyüklüğü, mantık karmaşası değil.
3. **`rate-limit.ts:101` empty catch** — fail-closed cleanup, bilinçli ve yorumlu.
4. **15 skipped test** — hepsi `TEST_DATABASE_URL` koşullu integration seti; bilinçli tasarım (README:21-28).
5. **VakaWorkspace'in scoring motorunu client'a alması** — offline değerlendirme gereksinimi, bilinçli trade-off.

## Açık Sorular

1. Admin analitik route'larında korpus-yükleme (F2): gerçek kullanım sıklığı nedir? Sadece admin kullanıyorsa geciktirilebilir.
2. God component'ler (F8/F9): bir sonraki feature hangisine dokunacak? O an bölme planlanmalı.
3. Shadow-read modülü (`lib/auth/shadow-read.ts`): silinecek mi resmen?

---

# Implementasyon Planı

> İlke: her adım bağımsız merge edilebilir; performans sadece iyileşir; net satır borcu düşer; yeni soyutlama katmanı açılmaz.

## Faz 1 — Güvenlik & Doğruluk (yarım gün, 6 PR-lik küçük commit)

| Adım | İş | Doğrulama |
|------|-----|-----------|
| 1.1 | `soru-eslestir`: `getStudentSessionFromRequest` + `takeRateLimit` ekle | Oturumsuz POST → 401; limit aşımı → 429 |
| 1.2 | `student/login`: catch'e `logger.exception`; DB hatası → 503 | Yanlış şifre 400, outage 503 + log satırı |
| 1.3 | `register`: `e.message` yerine güvenli mesaj + server log | Anonim client'a dahili string sızmaz |
| 1.4 | `pipeline/fill`: typeof guard | `{"id":123}` → 400 |
| 1.5 | `recent-logins` testini `TEST_DATABASE_URL` gate'ine al (mevcut desen kopyala) | `npm test` yeşil, DB olmadan |
| 1.6 | `global-error.tsx` minimal ekle | Root layout hatası → markalı hata ekranı |

## Faz 2 — Performans (1 gün; mevcut davranış korunur, sadece sorgu/bant genişliği azalır)

| Adım | İş | Doğrulama |
|------|-----|-----------|
| 2.1 | `ekg-sources`: per-row `getRuntimeCaseById` çağrısını kaldır (schema zaten FK'sız → sonuç zaten boş); label aggregate SQL'e; LIMIT/paginasyon | Route response öncekiyle aynı şekil; query sayısı 536→1 |
| 2.2 | `attempts/route.ts` GET: sourceCaseId tek sefer çöz, 3 kontrolü `Promise.all` ile paralelleştir | Aynı JSON yanıtı; DB turu 7→~3 |
| 2.3 | Seed döngüsü → tek bulk insert `onConflictDoNothing()` | Seed çıktısı birebir aynı |
| 2.4 | `profilim`: `import type` düzeltmesi | Bundle'dan fs/case-templates zinciri düşer (build output karşılaştır) |

**Performans bütçesi:** Bu fazdan sonra ölçüm: öğrenci vaka-açılışı p95 ve admin vaka-listesi p95, önce/sonra kaydet. Regresyon = geri al.

## Faz 3 — Bakım Borcu (yarım gün)

| Adım | İş | Doğrulama |
|------|-----|-----------|
| 3.1 | `public-case.ts` unit testleri (PHI-strip + seçim mantığı; saf fonksiyonlar) | Yeni test dosyası, infra gerekmez |
| 3.2 | `password.ts` format testlerini her-zaman-açık unit teste taşı | Skip'siz çalışır |
| 3.3 | Ölü kod: `store.ts` 4 export kaldır, `GUEST_CASE_ID` sil, shadow-read kararı (soru 3) | grep ile sıfır referans; `npm test` yeşil |
| 3.4 | Kritik sessiz 503'lere `logger.warn` (F10'un ilk 4 noktası) | Log çıktısı görünür |
| 3.5 | `.env.example` + README env listesi senkronu | Liste = kod gerçekliği |

## Bilinçli Erteleme Kararları (aşırı mühendislik önleme)

- **Zod benimseme (77 route)** → ERTelenir. Mevcut manuel validasyon tutarlı; tek güvenlik deliği Faz 1'de kapatıldı. Yeni route'larda shared validator yazılacaksa o an karar verilir.
- **God component bölmeleri (F8/F9)** → ERTelenir; **kural:** bu dosyalara satır EKLEMEYEN değişiklikte bölme yok; dokunulurken ilgili tab/faz hook'a taşınır ve dosya küçülür.
- **Error-code sistemi (F14)** → ERTelenir; sadece yeni kodda mevcut kanonik mesajlar kopyalanır.
- **React testing-library kurulumu** → VakaWorkspace'e feature yazılana kadar ertelendi.
- **F2 korpus-projeksiyonu** → Admin analitik kullanımı ölçülmeden yapılmaz (açık soru 1); N+1 gibi somut ispat yoksa optimize etme.

## Non-Functional Gereksinimler (planın parçası)

| NFR | Hedef | Nasıl korunuyor |
|-----|-------|-----------------|
| Performans | Regresyon sıfır; öğrenci hot-path sorgu sayısı düşer (F3) | Faz 2 ölçüm kapısı; her PR tek davranış-değişikliği |
| Güvenlik | Kimlik doğrulamasız mutasyon/AI çağrısı = 0 | Faz 1.1; mevcut guard deseni kopyalanır, yeni pattern icat edilmez |
| Gözlemlenebilirlik | Auth/attempt path'inde sessiz hata = 0 | Faz 1.2 + 3.4; logger mevcut altyapı |
| Basitlik | Net LOC düşüşü; yeni bağımlılık = 0 | Plan bilinçli ertemeler; tüm düzeltmeler mevcut desenlerin kopyası |
| Bakım yükü | Dosya büyüme kuralı: F8/F9 küçülerek dokunulur | Büyütmeme kuralı + test kapısı Faz 3.1 ile güçlenir |
