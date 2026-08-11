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

## Üretim depolama ve yedekleme

Uygulamanın kalıcı verisi JSON dosyaları olarak çalışma dizinindeki
`data/admin` altında tutulur. Üretim container'ında bu yol genellikle
`/app/data/admin` olur.

- `/app/data` için kalıcı bir volume mount edilmelidir; ephemeral disk öğrenci
  denemelerini, yönetim vakalarını ve yedekleri süreç yeniden başlatıldığında
  kaybettirir.
- JSON deposu tek yazarlı çalışır. `TIP_AI_REPLICA_COUNT=1` ayarlı olmalıdır;
  birden fazla replica desteklenmez ve uygulama bu yapılandırmada fail-fast
  davranır.
- Yönetim panelinden alınan yedekler `data/admin/backups` altında saklanır.
  Yedek/geri yükleme işlemlerinden önce kalıcı volume'un altyapı yedeğini de
  alın.
- Bozuk öğrenci denemesi dosyaları otomatik olarak `.corrupt-*` adıyla
  karantinaya alınır. Bu olaydan sonra ilgili dosyayı ve uygulama loglarını
  inceleyin; dosya sessizce boş bir depo ile değiştirilmez.

## Gerekli ortam değişkenleri

Üretimde aşağıdaki değişkenler zorunludur:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
TIP_AI_REPLICA_COUNT=1
```

`ADMIN_SESSION_SECRET` uzun, rastgele ve yalnızca gizli yönetim aracında
tutulan bir değer olmalıdır. Gizli değerleri repoya veya istemci tarafına
eklemeyin.

## Yayına alma kontrolü

1. Kalıcı `/app/data` volume'unun bağlı olduğunu doğrulayın.
2. `TIP_AI_REPLICA_COUNT=1` ile tek replica başlatın.
3. Yukarıdaki dört doğrulama komutunu çalıştırın.
4. Bir öğrenci denemesi başlatın, uygulamayı yeniden başlatın ve denemenin
   kaldığı yerden devam ettiğini doğrulayın.
5. Yönetim panelinde geçersiz vaka girdisinin `400`, eksik taslağı aktifleştirme
   isteğinin `422` ve yetkisiz yazma isteğinin `401/403` döndüğünü doğrulayın.
