# TIP-AI

Türkçe klinik karar simülasyonu ve tıp eğitimi vaka platformu.

## Çalıştırma

```bash
npm install
npm run dev
```

Üretim öncesi kontroller:

```bash
npm test
npm run lint
npm run build
npm run validate:vakalar
```

Kimlik doğrulama testleri process-içi PGlite üzerinde migration'ları uygulayarak
koşar; ayrıca gerçek PostgreSQL'e karşı entegrasyon testi vardır:

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/tip_ai_test npm test
```

`TEST_DATABASE_URL` tanımlı değilse entegrasyon testi atlanır.

## JSON → PostgreSQL kullanıcı geçişi

Kullanıcı deposu JSON dosyasından PostgreSQL'e taşınacaktır. Repository geçişin
**altyapısını** içerir: Drizzle şeması + migration, başlangıç migration runner'ı,
tek seferlik idempotent import aracı ve entegrasyon testleri. Runtime kimlik
doğrulama henüz JSON deposunu kullanır; PostgreSQL cutover'ı, shadow-read gözlem
adımından sonra ayrı bir sürüm olarak yapılacaktır.

### Şema

`src/lib/auth/schema.ts` (Drizzle) → `drizzle/0000_init_auth.sql`:

- `users`: `id uuid pk`, `username text unique` (küçük harf), `email text unique`,
  `password_hash text`, `role enum('admin','doktor','ogrenci')`, `active bool`,
  `display_name`, `super_admin bool`, `created_by`, `created_at/updated_at`,
  `last_login_at`
- `auth_audit_logs`: kimlik olayları (giriş başarılı/başarısız, kayıt, rol değişimi).
  Hasta verisi / şifre hash'i içermez.

### Şifre hash sürümleme

- Yeni hash'ler **Argon2id**: `$argon2id$...`
- Eski JSON deposundan taşınan scrypt: `scrypt$v1$<saltHex>:<hashHex>` (açık
  algoritma/sürüm etiketi)
- `verifyPassword` her iki formatı da tanır; `scrypt$v1$` ile başarılı girişte
  hash otomatik Argon2id'e yükseltilir (rehash-on-login).
- Düz şifre hiçbir yerde saklanmaz/loglanmaz; hash'ler ve bağlantı dizgileri de
  loga yazılmaz. `DATABASE_URL` içindeki kimlik bilgileri URL-encode edilir.

### Migration stratejisi

- Migration SQL'leri `drizzle/` klasöründedir (Drizzle Kit üretimi).
- **Yerel:** `npx drizzle-kit migrate`
- **Üretim (Docker):** Container başlangıcında `node scripts/standalone-migrate.mjs`
  koşar (Dockerfile `CMD`'sinde `node server.js` öncesinde). Drizzle'nin resmi
  migrator'unu (`drizzle-orm/node-postgres/migrator`) ve bir **PostgreSQL advisory
  lock** kullanır; eşzamanlı deploy'lar (ör. aynı anda iki replica başlatılırsa)
  migration'ı yarıştırmaz. İkinci süreç kilit boşalıncaya kadar bekler, sonra
  migrator zaten uygulanmış migration'ları atlar (idempotent).
- **Coolify / Nixpacks:** Dockerfile `CMD`si kullanılmıyorsa migration'ı
  uygulama başlangıcına bırakmayın. Coolify'nın **pre-deploy** komutuna
  `npm run db:migrate` koyun; uygulamanın start komutu `npm run start` olarak
  kalsın. Böylece migration başarısızsa yeni sürüm trafik almadan deploy
  başarısız olur ve loglarda ayrı olarak izlenir.

### Tek seferlik import

```bash
DATABASE_URL=postgresql://... ADMIN_PASSWORD=<bootstrap şifresi> \
  npx tsx scripts/import-users.ts --file path/to/data/admin/users.json
```

- İşlem başlamadan önce JSON deposunun **zaman damgalı yedeği** alınır
  (`users.json.bak.<ISO-timestamp>`); orijinal dosya silinmez/değiştirilmez.
- Idempotent: aynı kullanıcı adı Postgres'te zaten varsa atlanır.
- Hash'ler doğrudan taşınır; tanınmayan/eksik hash'li kayıtlar atlanır ve
  loglanmaz. Hiçbir hash / bağlantı dizgisi çıktıya yazılmaz.
- Bootstrap admin senkronize edilir ve süper admin olarak kilitlenir.

### Rollback planı

- Eski `data/admin/users.json` ve import öncesi alınan `.bak.<timestamp>` yedeği
  korunur; veritabanından kullanıcı tablosu silinmeden JSON'a dönülebilir.
- **Uyarı:** PostgreSQL'e geçildikten sonra yapılan yazma işlemleri (yeni
  kullanıcı kayıtları, rol değişiklikleri, giriş zamanları, denetim kayıtları)
  JSON deposuna geri kopyalanamaz. Rollback, yalnızca cutover öncesi duruma
  dönüşü güvenli biçimde sağlar; cutover sonrası yazılan veri kaybolur.

### Shadow-read gözlem adımı

Runtime cutover öncesinde `AUTH_SHADOW_READ=1` ile başarılı öğrenci ve yönetim
girişleri JSON kaynağıyla devam ederken PostgreSQL'deki aynı kullanıcının rol ve
aktiflik durumunu karşılaştırır. Bu aşama yazma yapmaz, giriş sonucunu değiştirmez
ve parola, hash, kullanıcı adı veya bağlantı dizgisi loglamaz. Operasyon logları
yalnızca `auth_shadow_read` olayı, route, sonuç ve varsa ayrışan alan adlarını
taşır. En az bir gözlem penceresinde uyumsuzluk `0` doğrulanmadan runtime
PostgreSQL'e geçirilmemelidir.

### Runtime cutover ve geri alma

Kullanıcı deposu seçiminde varsayılan `AUTH_USER_STORE=json` değeridir.
Shadow-read gözlem penceresi temiz tamamlandıktan sonra, tek bir canary uygulama
ortamında `AUTH_USER_STORE=postgres` ile gerçek öğrenci ve yönetim girişleri,
oturum geçersizleştirme ve kullanıcı yönetimi doğrulanır. Canary ortamı aynı
uygulama sürümü ve PostgreSQL migration sürümünü kullanmalıdır.

Bu değer iki depoya yazmaz: seçilen depo tek doğruluk kaynağıdır. Sorun halinde
`AUTH_USER_STORE=json` ayarlayıp uygulamayı yeniden başlatın. PostgreSQL modunda
yeni oluşturulan ya da değiştirilen kullanıcılar JSON'a kopyalanmadığından,
geri alma öncesinde bu değişiklikler için karar ve gerekirse dışa aktarım alın.
Geçersiz bir `AUTH_USER_STORE` değeri sessiz fallback yerine yapılandırma hatası
üretir.

`GET /api/health`, JSON modunda temel canlılık yanıtı döner. PostgreSQL modunda
ise migration journal, zorunlu migration sürümü, `users` ve
`auth_audit_logs` ile `auth_sessions` tablolarını da doğrular; herhangi biri
yoksa `503` döner.
Coolify healthcheck'i bu endpoint'e yönlendirin.

### Merkezi oturum iptali

`AUTH_USER_STORE=postgres` modunda her başarılı giriş için `auth_sessions`
tablosunda yalnızca rastgele oturum kimliği, kullanıcı, rol, süre, iptal zamanı,
son etkinlik ve ham user-agent'tan türetilmiş kısa cihaz etiketi tutulur; cookie,
parola, IP ve tam user-agent saklanmaz. Her istek imza, kullanıcı durumu ve
sunucu tarafındaki oturum kaydını birlikte doğrular. Admin/doktor oturumları
30 dakika idle / 8 saat absolute, öğrenci oturumları 2 saat idle / 12 saat
absolute süreyle sınırlandırılır. Son etkinlik işareti yazma yükünü azaltmak
için en fazla beş dakikada bir yenilenir.

Giriş yapmış kullanıcı `GET /api/sessions` ile yalnızca kendi aktif oturumlarını
görebilir; `DELETE /api/sessions/:id` tek bir cihazı, `POST /api/sessions` tüm
cihazları (mevcut cihaz dahil) kapatır. İptal olayları audit kaydına yazılır.
JSON modunda bu uçlar sahte cihaz verisi üretmez: liste `available: false`
döner, mutation istekleri `409` ile açıkça reddedilir. Çıkış, rol/parola veya
aktiflik değişikliği açık PostgreSQL oturumlarını derhal iptal eder. Bu özellik
`0001_goofy_titanium_man` ve `0005_session_activity_metadata` migration'larını
gerektirir; cutover öncesinde `npm run db:migrate` ile uygulanmalıdır.

### Paylaşımlı rate limit

Giriş ve öğrenci kayıt uçları IP ve hesap boyutlarında kota uygular. Varsayılan
`RATE_LIMIT_STORE=memory` tek replica/geri uyumluluk modudur. Çoklu replica
veya PostgreSQL auth cutover'ında `RATE_LIMIT_STORE=postgres` ayarlanmalıdır:
bu modda anahtarlar SHA-256 özeti olarak `rate_limit_buckets` tablosunda tutulur
ve kota ayırma tek bir atomik UPSERT ile tüm replica'larda ortaklaşır. PostgreSQL
modunda veritabanı hatasında bellek fallback'i yapılmaz; aksi hâlde saldırgan
replica değiştirerek kotayı aşabilir. Süresi geçen kayıtlar best-effort olarak
beş dakikada bir temizlenir. Bu özellik `0006_shared_rate_limits` migration'ını
gerektirir.

### P2 deneme deposu geçişi

`learning_attempts` şeması, öğrenci denemelerini PostgreSQL'e taşımak için
yalnızca **expand** adımıdır. Mevcut runtime hâlâ JSON deneme deposunu kullanır;
bu sürüm veri aktarımı, dual-write veya guest denemelerinin PostgreSQL'e
taşınmasını yapmaz. Sonraki adım, doğrulanabilir bir JSON envanteri/importu ve
feature-flag ile yalnızca giriş yapmış öğrenci denemelerinin canary geçişidir.
Her kayıt başladığı andaki vaka/rubrik gövdesini JSONB olarak kilitler; içerik
sonradan değişse bile geçmiş değerlendirme yeniden yazılmaz.

Mevcut JSON deneme akışında da oynanabilir vaka, kaynak şablonun sürümünü ve
SHA-256 içerik checksum'ını taşır. Deneme tamamlanınca bu damga analitik
oturumuna eklenir; böylece P2 import/canary sonrasında eski denemelerle aynı
vaka sürümü izlenebilir. Checksum, klinik içerik ve rubriği kapsar; etiket,
reviewer veya güncelleme zamanı gibi yayın meta verileri checksum'ı değiştirmez.

### İçerik inceleme akışı

Yeni vakalar taslak olarak oluşturulur. İçeriğin `aktif` olarak yayınlanması
doğrudan PATCH ile yapılamaz: vaka önce `POST /api/admin/cases/:id/review` ile
incelemeye gönderilir, ardından yazardan farklı bir admin/doktor klinik yayın
doğrulamasını geçerek onaylar veya değişiklik ister. Onayda reviewer, zaman ve
klinik içerik checksum'ı audit kaydına bağlanır. Onaylı/yayındaki vakada skoru
etkileyen bir değişiklik yeni sürüm oluşturur, yayını taslağa çeker ve onayı
temizler. Eski içerik için `legacy` inceleme etiketi korunur; bu kayıtlar
otomatik olarak yeniden yayımlanmaz.

## Synthea vaka geçişi

Vaka kataloğu Synthea sentetik hasta verisinden üretilir. JSON'daki elle yazılmış
60 vaka geçişte arşiv olarak kalır; runtime, PostgreSQL'deki `clinical_cases`
tablosunu okur (`CASE_STORE=postgres`).

### Akış

1. Synthea CSV'lerini `data/raw/synthea/`'dan yükle:

   ```bash
   DATABASE_URL=postgresql://... npm run db:load-synthea
   ```

   Loader hem `.csv` hem de `.csv.gz` dosyalarını destekler ve büyük arşivleri
   akış (streaming) ile okur. Çok büyük veri setleri için deterministik örnekleme:

   ```bash
   # 5000 hastayı deterministik biçimde örnekle (SyntheticMass 1M için)
   DATABASE_URL=postgresql://... npx tsx scripts/load-synthea.ts --dir data/raw/synthea --sample 5000
   ```

2. Vakaları üret ve PostgreSQL'e yaz:

   ```bash
   DATABASE_URL=postgresql://... npm run db:generate-synthea-cases -- --wipe --publish
   ```

   - `--dry` : yazmadan yalnızca rapor.
   - `--no-ai` : DeepSeek zenginleştirmesini atla (`DEEPSEEK_API_KEY` yoksa otomatik atlanır).
   - `--publish` : doğrulamadan geçenleri `aktif` yapar (varsayılan `taslak`).
   - `--limit N` : yalnızca ilk N hastayı işler.

3. Runtime'ı PostgreSQL vaka deposuna al:

   ```text
   CASE_STORE=postgres
   ```

### SyntheticMass (büyük veri seti)

[SyntheticMass](https://synthea.mitre.org) 1 milyon sentetik hastayı gzip arşiv
olarak (FHIR, C-CDA ve CSV) sunar. CSV arşivleri bu projedeki küçük örnekle aynı
Synthea şemasındadır; yalnızca çok daha büyüktür.

- `.csv.gz` dosyalarını `data/raw/synthea/` altına indir (patients, conditions,
  observations, medications, procedures, encounters, imaging_studies).
- Belleğe sığması ve eğitim kataloğu için makul kalması için `--sample` ile bir
  alt küme al; örnekleme hash-tabanlı olduğundan aynı `N` aynı hastaları verir.

```bash
DATABASE_URL=postgresql://... npx tsx scripts/load-synthea.ts --dir data/raw/synthea --sample 5000
DATABASE_URL=postgresql://... npm run db:generate-synthea-cases -- --wipe --publish
```

### FHIR Bundle içe aktarımı

CSV yerine Synthea FHIR Bundle dışa aktarımı varsa, mevcut vaka-üretim
tablolarına doğrudan yüklenebilir:

```bash
DATABASE_URL=postgresql://... npm run db:load-synthea-fhir -- --dir reports/output_1/fhir
# Önceden yüklenmiş temel FHIR verisine yalnızca geçmiş kaynaklarını ekler:
DATABASE_URL=postgresql://... npm run db:load-synthea-fhir:history -- --dir reports/output_1/fhir
# Daha önce üretilmiş PostgreSQL vakalarını geçmiş kaynağıyla eşler:
DATABASE_URL=postgresql://... npm run db:backfill-synthea-case-sources
```

- Varsayılan işlem eklemelidir ve FHIR kaynak kimlikleriyle idempotenttir;
  mevcut `synthea_*` kayıtlarını silmez.
- `--replace` yalnızca eğitim veri deposunu yeniden kurmak istendiğinde
  kullanılmalıdır; önce tüm `synthea_*` tablolarını siler.
- Hasta kaynaklarından yalnızca vaka üretiminde gereken demografik alanlar
  (doğum/ölüm tarihi, cinsiyet, ırk, etnik köken, medeni durum) aktarılır.
  Ad, iletişim bilgisi, adres, fotoğraf ve kimlik numaraları aktarılmaz.
- Condition, Observation, MedicationRequest, Procedure, Encounter,
  AllergyIntolerance, Immunization, CarePlan ve DiagnosticReport kaynakları
  ilişkisel tablolara aktarılır. Ek geçmiş kaynaklarını temel yüklemeyi tekrar
  etmeden eklemek için `db:load-synthea-fhir:history` kullanılabilir.
- Vaka üretimi, vaka şablonunu sentetik kaynak hastaya sunucu içinde bağlar.
  Öğrenci “Klinik geçmişi görüntüle”yi seçtiğinde yalnızca kimliksiz klinik
  özet gösterilir ve erişim denetim kaydına yazılır; ad, adres, iletişim,
  kaynak hasta kimliği ve ham FHIR gövdesi tarayıcıya gönderilmez.

JSON deposu rollback yolu olarak korunur; `CASE_STORE=json` ile eski 60 vaka
yeniden kaynak olur. Yabancı (İngilizce) hasta/koşul/ilaç adları kaynaktan olduğu
gibi korunur; yerelleştirme sonraki aşamadadır.

## Üretim depolama ve yedekleme

Uygulamanın kalıcı verisi JSON dosyaları olarak çalışma dizinindeki
`data/admin` altında tutulur (vakalar, kullanıcılar, loglar, yedekler, öğrenci
denemeleri). Üretim container'ında bu yol genellikle `/app/data/admin` olur.
Kullanıcılar PostgreSQL'e geçirildiğinde bu madde ve yedekleme kapsamı yeniden
güncellenecektir.

- `/app/data` için kalıcı bir volume mount edilmelidir.
- Gelecekteki kullanıcı deposu cutover'ı için Postgres volume'unun kalıcı
  olduğundan emin olun.
- JSON deposu tek yazarlı çalışır. `TIP_AI_REPLICA_COUNT=1` ayarlı olmalıdır.
- Yönetim panelinden alınan yedekler `data/admin/backups` altında saklanır.
- Bozuk öğrenci denemesi dosyaları `.corrupt-*` adıyla karantinaya alınır.

## Gerekli ortam değişkenleri (üretim)

```text
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET        # zorunlu; en az 32 byte rastgele değer
DATABASE_URL                # PostgreSQL bağlantı dizgisi
APP_URL
TIP_AI_REPLICA_COUNT=1
RATE_LIMIT_STORE=memory    # çoklu replica/cutover sonrası: postgres
```

Gizli değerleri repoya veya istemci tarafına eklemeyin.

## Yayına alma kontrolü

1. Kalıcı `/app/data` volume'unun ve Postgres kalıcılığının bağlı olduğunu doğrulayın.
2. `TIP_AI_REPLICA_COUNT=1` ile tek replica başlatın.
3. Yukarıdaki doğrulama komutlarını çalıştırın.
4. Eski kullanıcıları `import-users.ts` ile aktarın ve yedek oluştuğunu doğrulayın.
5. Migration'ın başlangıçta koştuğunu (log) ve ikinci bir deploy'un beklemeden
   idempotent biçimde tamamlandığını doğrulayın.
