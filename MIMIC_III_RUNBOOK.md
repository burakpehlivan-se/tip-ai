# MIMIC-III v1.4 entegrasyon runbook'u

Bu akış yalnızca eğitim amaçlı vaka taslağı üretir. Ham MIMIC-III verisi, kaynak kimlikleri ve türetilmiş çıktı dosyaları git deposuna, uygulama veri deposuna veya istemciye konulmaz. Her çıktı `taslak` ve `uzmanOnayi: false` olarak kalır.

## Ön koşullar

- PhysioNet'te MIMIC-III v1.4 için credentialed erişim, CITI *Data or Specimens Only Research* eğitimi ve imzalı DUA olmalı.
- Ham CSV/SQL yalnız erişim yetkisi olan, şifreli bir ortamda bulunmalı. Uygulama çalışma dizini ve build/log dizinleri bunun dışında olmalı.
- Güçlü ve saklanmayan bir `MIMIC_EPISODE_HASH_SALT` tanımlanmalı. Bu sır olmadan gerçek MIMIC/OMOP importu bilinçli olarak çalışmaz.
- Kaynak sürümü, ETL commit'i, dışa aktarma zamanı, dosya bütünlük özeti ve uzman onayı erişim-kontrollü denetim kaydına yazılmalı.

## Akış

1. Yetkili PostgreSQL ortamında yalnız seçilecek yatış için `scripts/mimic-iii-export-episode.sql` çalıştırılır. Sorgu `NOTEEVENTS` veya serbest metin içermez; yalnız gerekli yapılandırılmış tabloları okur.
2. JSON güvenli, depo dışı bir dizine yazılır. MIMIC-III `DIAGNOSES_ICD` ICD-9'tur; adapter bunu explicit olarak işaretler. HADM_ID'siz outpatient laboratuvar satırları yatışa bağlanmaz.
3. CDM taslağı ve kimliksiz kalite manifest'i yine depo dışına üretilir:

```bash
MIMIC_EPISODE_HASH_SALT='secret-from-vault' \
  npm run etl:mimic-iii:episode -- \
  --input /secure/mimic/episode.json \
  --output /secure/tip-ai/case.json \
  --manifest /secure/tip-ai/case.manifest.json
```

4. CDM validasyonu, ICD-9/lab eşleme oranı, yaş kalite bayrağı ve klinik/rubrik içerik uzman tarafından incelenir. Onaydan önce vaka aktif edilmez.

## Non-functional gereksinimler

| Alan | Uygulanan kural |
| --- | --- |
| Gizlilik | `subject_id`/`hadm_id` public vaka kimliğine veya ETL meta çıktısına geçmez; HMAC tabanlı opak epizod anahtarı kullanılır. |
| Lisans | Credentialed Health Data License/DUA kapsamındaki ham veya türetilmiş veri paylaşılmaz; kaynak atfı korunur. |
| Performans | Tüm `LABEVENTS` dosyası uygulama belleğine alınmaz; seçili yatış filtrelemesi kaynak veritabanında yapılır. |
| Güvenilirlik | CDM doğrulaması geçmeden çıktı yazılmaz; çıktı dosyaları `0600` izinleriyle üretilir. |
| İzlenebilirlik | Manifest kaynak sürümünü, eşleme kalite özetini, opak epizod anahtarını ve çıktı SHA-256'sını taşır. |
| Klinik güvenlik | ICD-9 faturalama tanıları klinik gerçeklik yerine geçmez; belirsiz ICD-9 `250.*` otomatik Tip 2 diyabet olarak etiketlenmez. |

Kaynaklar: [MIMIC-III v1.4](https://physionet.org/content/mimiciii/1.4/), [MIMIC-III tablo dokümantasyonu](https://mimic.mit.edu/docs/III/tables/), [DIAGNOSES_ICD](https://mimic.mit.edu/docs/iii/tables/diagnoses_icd.html), [LABEVENTS](https://mimic.mit.edu/docs/III/tables/labevents/).
