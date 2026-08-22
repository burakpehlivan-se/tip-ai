# Site Yapılacaklar Listesi

> Kaynak: Mobil UI/UX denetimi (2026-08-21, prod + statik analiz).
> Deploy sonrası doğrulamalar `https://tip-ai.burakpehlivan.dev` üzerinde, 390x844 mobil viewport'ta yapılmalı.

---

## 1. Bekleyen Doğrulama (deploy bitince)

- [x] `/profilim` ve `/ayarlar` header: logo, `Vakalar`/`Profilim` linkleri ve `.btn-ghost` ("Çıkış") yükseklikleri **≥44px** olmalı
  - Commit: `151b465512` — ✅ **2026-08-21'de prod'da doğrulandı:** `/profilim` ve `/ayarlar` @390x844 küçük hedef = 0
- [x] Tüm sayfalarda yatay taşma regresyonu yok (önceki tur: `/`, `/giris`, `/vakalar` ✓; bu tur: `/`, `/giris`, `/vakalar`, `/profilim`, `/ayarlar` ✓)

## 2. Canlı Test Edilemeyen Sayfalar (oturum/veri/rol gerekli)

| Sayfa/Bileşen | Engel | Not |
|---|---|---|
| `/vaka/[vakaNo]` çalışma ekranı | Aktif vaka + öğrenci oturumu | `VakaWorkspace` anamnez chip'leri `min-h-11 lg:min-h-8` fix'i görsel doğrulanmadı |
| `CemicegekSimulator` kuyruk şeridi | Simülasyon başlatma gerektiriyor | Hasta seçme hapları ~22px→44px fix'i doğrulanmadı |
| `SonucEkrani.tsx:38` "← vakalar" linki | Vaka tamamlama gerektiriyor | ✅ Statik olarak düzeltildi (`65e51e5e42`): `min-h-11` eklendi; `/deneme` header "← Geri" linki de aynı commit'te düzeltildi |
| `/atamalar`, `/poliklinik/[key]` | Atama kaydı gerektiriyor | Mobil denetim hiç yapılmadı |
| `/admin` | Admin rolü gerektiriyor | Tablolarda `overflow-x-auto` sarmalayıcı eksik olabilir |

## 3. Veri Sorunu: Test Hesabı Boş

- `burak` kullanıcısında poliklinik/atama/deneme verisi **yok** → `/profilim` "Poliklinik Kırılımı" tablosu render olmuyor, tablo sarmalayıcı fix'i (`overflow-x-auto`) görsel olarak doğrulanamıyor.
- **Çözüm önerisi:** Dolu verili bir test hesabı oluştur veya `burak` için birkaç tamamlanmış vaka/atama üret (seed script).

## 4. UX İyileştirmeleri (öncelik sırasıyla)

1. **`/deneme` hata mesajı:** ✅ Kod tamamlandı (`65e51e5e42`) — catch'siz `response.json()` çağrıları güvenli hale getirildi, dostça hata ekranı + "Tekrar Dene" butonu eklendi. *Deploy sonrası doğrulanacak.*
2. **Mobil sticky header çok yüksek:** ✅ Kod tamamlandı (`65e51e5e42`) — ana sayfada chip menüsü sticky kapsamından çıkarıldı; artık sadece 64px üst bar sticky. *Deploy sonrası ölçülecek.*
3. **Admin paneli tabloları:** ✅ Kontrol edildi — 5 tablonun tamamında zaten `overflow-x-auto` sarmalayıcı var, değişiklik gerekmedi.
4. **Cümle içi linkler:** ✅ Kod tamamlandı (`65e51e5e42`) — `/giris` inline linkleri `py-1` ile ≥24px hedefe çıkarıldı (WCAG 2.5.8 AA minimum).

## 5. Ortam Notu (UX dışı)

- Lokal geliştirme ortamında Postgres olmadığı için `/deneme` API 500 dönüyor ("Katalog yüklenemedi") — ortam eksikliği, kod hatası değil. Prod etkilenmiyor.

---

## Tamamlananlar (referans)

- ✅ Dokunma hedefleri 44px: `globals.css` (.btn-*, .input), ana/giriş/vakalar/profilim/ayarlar header'ları, `VakaWorkspace`, `CemicegekSimulator`, `SessionNavigation`
- ✅ `/profilim` tablosuna `overflow-x-auto scrollbar-thin` sarmalayıcı (kod tarafında)
- ✅ Yatay taşma: hiçbir sayfada yok (390/360/768)
- ✅ Viewport meta doğru, input fontları 16px+ (iOS zoom riski yok)
