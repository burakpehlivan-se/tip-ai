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

Kullanıcı deposu JSON dosyasından PostgreSQL'e taşınır. Bu repository, geçişin
**altyapısını** içerir: Drizzle şeması + migration, başlangıç migration runner'ı,
tek seferlik idempotent import aracı ve entegrasyon testleri.

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

## Üretim depolama ve yedekleme

Uygulamanın kalıcı verisi JSON dosyaları olarak çalışma dizinindeki
`data/admin` altında tutulur (vakalar, loglar, yedekler, öğrenci denemeleri;
**kullanıcılar hariç** — bunlar Postgres'e taşınır). Üretim container'ında bu
yol genellikle `/app/data/admin` olur.

- `/app/data` için kalıcı bir volume mount edilmelidir.
- **Kullanıcılar ve oturum kayıtları Postgres'te olduğundan, Postgres volume'unun**
  kalıcı olduğundan emin olun.
- JSON deposu tek yazarlı çalışır. `TIP_AI_REPLICA_COUNT=1` ayarlı olmalıdır.
- Yönetim panelinden alınan yedekler `data/admin/backups` altında saklanır.
- Bozuk öğrenci denemesi dosyaları `.corrupt-*` adıyla karantinaya alınır.

## Gerekli ortam değişkenleri (üretim)

```text
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET        # veya AUTH_SECRET (en az 32 byte rastgele)
DATABASE_URL                # PostgreSQL bağlantı dizgisi
APP_URL
TIP_AI_REPLICA_COUNT=1
```

Gizli değerleri repoya veya istemci tarafına eklemeyin.

## Yayına alma kontrolü

1. Kalıcı `/app/data` volume'unun ve Postgres kalıcılığının bağlı olduğunu doğrulayın.
2. `TIP_AI_REPLICA_COUNT=1` ile tek replica başlatın.
3. Yukarıdaki doğrulama komutlarını çalıştırın.
4. Eski kullanıcıları `import-users.ts` ile aktarın ve yedek oluştuğunu doğrulayın.
5. Migration'ın başlangıçta koştuğunu (log) ve ikinci bir deploy'un beklemeden
   idempotent biçimde tamamlandığını doğrulayın.