# Admin Panel UI/UX Geliştirme Raporu

Bu rapor, gönderilen 9 ekran görüntüsündeki admin panel sayfalarının kullanıcı deneyimi ve arayüz açısından değerlendirmesini içerir. Her sayfa ayrı bir bölümde ele alınmıştır. Rapor, geliştirici ve tasarımcı için doğrudan aksiyon alınabilir öneriler sunar.

---

## 0. Tüm Sayfaları Etkileyen Global Sorunlar

Öncelikle bütün sayfalarda tekrar eden yapısal sorunları belirtmek gerekir. Bu sorunlar tek tek her sayfada çözülmek yerine global bir refactor ile çözülmelidir.

### 0.1 Üst Navigasyon Çubuğu

**Mevcut durum:**
- Navigasyon linkleri yatay olarak sıkışmış durumda
- "Karışık Oyna", "Hasta Tipleri", "Test Durumu", "Tıbbi Görüntüler", "Kural Motoru" gibi başlıklar iki satıra kırılıyor
- Sağ tarafta scroll bar görünüyor, yani içerik çubuğa sığmıyor
- "Sis" başlığı kesik görünüyor (muhtemelen "Sistem" olacak)
- Admin rozeti ve "admin" kullanıcı adı üst üste binmiş
- "Çıkış" butonu ekranın dışına taşmış
- Arka planda yatay scroll bar var, sayfa yatayda kaymış

**Sorunlar:**
- Yatay scroll asla olmamalı, admin paneli tek ekranda görünmeli
- İki satıra kırılan başlıklar okunması zor
- Aktif sayfa (koyu buton) belli oluyor ama diğerleri arasında hiyerarşi yok
- Sağ üst köşedeki kullanıcı bilgisi ile navigasyon karışmış

**Öneriler:**
1. Navigasyonu iki katmana ayır:
   - Üst katman: logo (sol), kullanıcı menüsü (sağ)
   - Alt katman: sekmeler
2. Uzun sekme adlarını kısalt: "Test Durumu" → "Testler", "Tıbbi Görüntüler" → "Görüntüler", "Kural Motoru" → "Kurallar"
3. Sekme sayısı 10'u geçiyorsa gruplandır:
   - **İçerik**: Vakalar, Hasta Tipleri, Görüntüler, Kurallar
   - **Kalite**: Doğrulama, Test Durumu, Analitik
   - **Sistem**: Kullanıcılar, Ayarlar, Loglar, Yedekler, Sistem Tanısı
4. Küçük ekranda hamburger menü + drawer'a düşür
5. Kullanıcı menüsünü avatar+dropdown olarak topla (avatar → menu: Profil, Rol, Çıkış)
6. Aktif sekmenin altında ince bir vurgu çubuğu olsun, siyah blok yerine

### 0.2 Sayfa Başlıkları ve Açıklamalar

**Mevcut durum:**
- Her sayfa "Başlık + tek cümlelik açıklama" yapısında
- Açıklamalar bazen çok teknik ("migration ve çalışma zamanı deposu özetini güvenli biçimde gösterir")
- Bazı sayfalarda başlığın altındaki açıklama gereksiz uzun

**Öneriler:**
1. Başlık altında **iki katman** olsun:
   - Kısa görev cümlesi (ne yapılır?)
   - Küçük bilgi ikonu → tıklayınca detaylı açıklama tooltip/popover
2. Teknik terimleri (migration, deposu, tokenlar) kullanıcı diline çevir
3. Sağ üstteki aksiyon butonları hep aynı hizada olsun (Yenile, Ayarlar, Yeni Ekle)

### 0.3 Boş Durum (Empty State) Tasarımı

**Mevcut durum:**
- "Sistem tanısı yükleniyor…" gibi düz metin
- "Henüz yedek yok. 10 değişiklik sonra otomatik oluşur." tek satır
- "Filtrelerle eşleşen görüntü kaydı bulunamadı." sade metin

**Sorun:** Bu boş durumlar bilgi vermek yerine kullanıcıyı "boş sayfa" hissiyle bırakıyor.

**Öneriler:**
1. Her boş durum için standart bir bileşen:
   - İkon (görsel işaret)
   - Ana mesaj (ne olduğu)
   - Alt mesaj (neden ve nasıl doldurulur)
   - Aksiyon butonu (ne yapabilir)
2. Örnek: "Henüz yedek yok" yerine:
   - 💾 ikon
   - **Henüz yedek alınmadı**
   - "10 değişiklik yapıldığında otomatik yedek oluşur. Şimdi manuel yedek de alabilirsiniz."
   - `[Manuel Yedek Al]` butonu

### 0.4 Renk Sistemi ve Rozetler

**Mevcut durum:**
- Rozet renkleri tutarsız: bazıları gri, bazıları koyu yeşil, bazıları turuncu
- "aktif" rozeti yeşil ama diğer durum rozetleri belirsiz
- Uyarı seviyeleri (Yüksek, Orta) sadece etiket rengiyle ayrılıyor, çok göze çarpmıyor

**Öneriler:**
1. Standart renk paleti tanımla:
   - **Nötr**: gri (log tipleri, meta bilgiler)
   - **Bilgi**: mavi (bilgilendirici rozetler)
   - **Başarı**: yeşil (aktif, geçerli, başarılı)
   - **Uyarı**: sarı/turuncu (dikkat gerektiren)
   - **Hata/Kritik**: kırmızı (geçersiz, sorunlu)
2. Uyarı seviyeleri için soldan renkli çubuk (border-left 4px) + iç rozet birlikte kullanılsın

---

## 1. Sistem Tanısı Sayfası

### Mevcut Durum
- Başlık: "Sistem tanısı"
- Açıklama: teknik dille yazılmış (migration, deposu vb.)
- Sağ üstte "Yeniliyor…" butonu (disabled görünüyor)
- İçerik alanı boş: "Sistem tanısı yükleniyor…"

### Sorunlar
1. Sayfa yükleniyor durumu için gerçek bir loading göstergesi yok, sadece metin var
2. "Yeniliyor…" butonu ne kadar süreceği belirsiz
3. Sistem tanısı ne içerecek belirsiz (kullanıcı beklenti oluşturamıyor)
4. Yükleme başarısız olursa ne olacağı belirsiz

### Öneriler

**Loading durumu için:**
- İçerik alanında **skeleton loader** kullan (kart iskeletleri yanıp sönsün)
- Yükleme aşamasını göster: "Migration kontrolü... ✓ / Veritabanı bağlantısı... ⏳ / Redis... beklemede"

**Sayfanın nihai içeriği için önerilen kartlar:**

```
┌─────────────────────────────────────────────────┐
│ 🟢 Sistem Sağlığı                    Güncelleme │
│    Tümü çalışıyor                    30 sn önce │
└─────────────────────────────────────────────────┘

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Veritabanı       │ │ AI Servisi       │ │ Depolama         │
│ 🟢 Bağlı         │ │ 🟢 Aktif         │ │ 🟡 %78 dolu      │
│ 12ms yanıt       │ │ DeepSeek         │ │ 4.2 GB / 5.4 GB  │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌─────────────────────────────────────────────────┐
│ Migration Durumu                                 │
│ ✓ 0014_hasta_tipi_uslup_cache (uygulandı)      │
│ ✓ 0013_case_studies (uygulandı)                │
│ ⏳ Bekleyen migration yok                       │
└─────────────────────────────────────────────────┘
```

**Aksiyon:** "Yeniliyor…" butonu yerine "Şimdi Yenile" + son güncelleme zamanı

---

## 2. Yedekler Sayfası

### Mevcut Durum
- Başlık ve açıklama net
- "Değişiklik Sayacı: 3", "Sonraki otomatik yedek: 10" iki metrik
- "Manuel yedek al" butonu
- Altta boş durum metni

### Sorunlar
1. **Progress bar eksik**: 3/10 değişiklikte olduğu bir progress bar olarak gösterilebilir, sayısal değer yalnız kalıyor
2. **Yedek listesi yok**: Sayfada sadece "henüz yedek yok" var, alınmış yedeklerin görüneceği alan tasarlanmamış
3. **Manuel yedek alma feedback'i belirsiz**: Butona basınca ne olacağı belli değil (loading, başarı mesajı, indirilme?)
4. **Yedek türü ayrımı yok**: Otomatik vs manuel, hangisinin neyi kapsadığı belirsiz

### Öneriler

**Progress göstergesi:**
```
┌─────────────────────────────────────────────────┐
│ Sonraki Otomatik Yedek                          │
│                                                  │
│ ████████░░░░░░░░░░░░░░░░░░░░░  3 / 10          │
│                                                  │
│ 7 değişiklik sonra otomatik yedek alınacak      │
└─────────────────────────────────────────────────┘
```

**Yedek listesi tasarımı (dolu durum için):**
```
┌─────────────────────────────────────────────────┐
│ 📦 backup_2026_08_17_2043.zip                   │
│    17.08.2026 20:43 · Manuel · admin            │
│    60 vaka · 12.4 MB                            │
│                    [📥 İndir] [🔄 Geri Yükle] [🗑️] │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📦 backup_2026_08_17_auto.zip                   │
│    17.08.2026 10:15 · Otomatik                  │
│    58 vaka · 11.9 MB                            │
│                    [📥 İndir] [🔄 Geri Yükle] [🗑️] │
└─────────────────────────────────────────────────┘
```

**Ek özellikler:**
- Otomatik yedek eşiğini ayarlanabilir yap (10 sabit değil, kullanıcı 5/10/25 seçebilsin)
- Yedeklerin kaç gün saklanacağını göster (retention policy)
- Yedek boyutu + içerik özeti (X vaka, Y kullanıcı, Z kural)
- "Yedekten geri yükle" için onay diyaloğu (yıkıcı işlem uyarısı)

---

## 3. Loglar Sayfası

### Mevcut Durum
- Filtreleme mevcut: işlem türü, kullanıcı, mesaj araması
- "Sadece değişen alanları göster" toggle
- "Yeniden eskiye" sıralama butonu
- Log kartları düz liste halinde
- Bazı kartlarda "1 patch — JSON görüntüle" (undo işlemleri için)

### Sorunlar
1. **Görsel yoğunluk**: Kartlar arasında ayrım az, hızlıca tarama zor
2. **Zaman gruplaması yok**: "Bugün", "Dün", "Bu hafta" grupları olmadan aynı tarihli kayıtlar yığılıyor
3. **İşlem türleri karışık**: user_login, register_student, add_test, seed, undo, update_test_field karışık görünüyor
4. **Kullanıcı filtresi zayıf**: Autocomplete yok, kullanıcı adını tam yazmak gerekiyor gibi
5. **JSON görüntüleme küçük link**: Önemli detay ama fark edilmesi zor
6. **Sayfalama yok görünüyor**: Kaç log gösteriliyor, kaç tane var belli değil

### Öneriler

**Kart tasarımını iyileştir:**
```
┌─────────────────────────────────────────────────┐
│ 🔐 Başarılı kullanıcı girişi                    │
│ ─────────────────────────────────────────────── │
│ 👤 admin  ·  🕐 17.08.2026 20:43:51             │
│ 🏷️ user_login                                    │
└─────────────────────────────────────────────────┘
```

- Sol tarafta işlem türüne göre ikon
- İşlem türü rengine göre soldan renkli border (login=mavi, undo=turuncu, seed=mor)
- Metadata ikonlarla + küçük gri metinle

**Zaman gruplaması:**
```
─── BUGÜN ───

[log 1]
[log 2]

─── DÜN ───

[log 3]
[log 4]

─── GEÇEN HAFTA ───

...
```

**Filtreleme geliştirmeleri:**
- İşlem türü açılır menüsünü çoklu seçim yap (checkbox listesi)
- Kullanıcı filtresi autocomplete + avatar önizleme
- Tarih aralığı seçici ekle (bu ekranda yok)
- "Sadece değişiklikler" toggle'ı üstte, öne çıkarılmış olsun

**JSON önizleme:**
- "1 patch — JSON görüntüle" yerine küçük bir preview accordion:
  ```
  ▶ Değişiklikler (1)
     yorumluCevap: "eski değer" → "yeni değer"
  ```
- Tam JSON'u modal'da göster

**Ek özellikler:**
- Sağ üstte "Log'ları dışa aktar" (CSV, JSON) butonu
- Sonsuz kaydırma veya sayfalama, toplam sayı bilgisi
- Kritik loglar için highlight (kırmızı kenarlık: silme, yıkıcı işlem)

---

## 4. Ayarlar Sayfası

### Mevcut Durum
- İki adet üst kart: "Tıbbi Görüntüler" ve "Test Durumu" (kısa yol)
- "Çemiçgezek" adında ayarlar formu (isim tuhaf, muhtemelen kod adı)
- Form alanları: kalabalıklık, geri dönüş min/max, aktif poliklinikler, aktif hastalıklar
- "Kaydet" butonu formun altında

### Sorunlar
1. **"Çemiçgezek" adı belirsiz**: Bu bir özellik adı mı, kod adı mı? Kullanıcı ne yaptığını anlamaz
2. **Ayarlar sayfası fakir**: Sadece bir form kartı var, diğer sistem ayarları nerede?
3. **Kısa yol kartları karışık**: Neden Tıbbi Görüntüler ve Test Durumu burada? Ayrı sayfaları zaten var
4. **Form alanları teknik**: "virgülle key; boş = hepsi" gibi kullanıcı dostu olmayan yardım metinleri
5. **Placeholder'lar yanıltıcı**: "kardiyoloji, solunum, enfeksiyon" gerçek değer mi placeholder mı belli değil
6. **Alan validasyonu belirsiz**: Min > max girilirse ne olur?
7. **Değişikliklerin etkisi belirsiz**: Kaydet'e basınca sistem yeniden başlar mı, canlı değişir mi?

### Öneriler

**Sayfa yapısını yeniden düzenle:**

```
┌─────────────────────────────────────────────────┐
│ ⚙️  Sistem Ayarları                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ 📁 Sol menü / Sağ içerik yapısı                 │
│                                                  │
│ Sol menü:                                        │
│  • Genel                                         │
│  • Simülasyon Akışı  ← şu anki "Çemiçgezek"    │
│  • İçerik Filtreleri                            │
│  • AI Servisi                                   │
│  • E-posta / Bildirim                           │
│  • Güvenlik                                     │
│  • Yedekleme                                    │
│  • Görünüm                                      │
└─────────────────────────────────────────────────┘
```

**Simülasyon Akışı sekmesi (mevcut form):**

```
Bekleme Odası Kalabalıklığı
┌─────────────────────────────────────┐
│ ○ Sakin        (1-2 hasta bekler)  │
│ ● Orta         (2-3 hasta bekler)  │
│ ○ Yoğun        (4-5 hasta bekler)  │
└─────────────────────────────────────┘
Muayenehanede aynı anda bekleyen hasta sayısını belirler.

Laboratuvar Geri Dönüş Süresi
┌─────────────┐ ┌─────────────┐
│ Min: 2      │ │ Max: 3      │  hasta
└─────────────┘ └─────────────┘
Hasta lab'a gittikten sonra kaç hasta arayla döneceğini belirler.
Örnek: 2-3 arası → 2. veya 3. hastadan sonra döner.
```

**Aktif içerik seçimi (tag input olarak):**

```
Aktif Poliklinikler
┌────────────────────────────────────────────┐
│ [Kardiyoloji ✕] [Solunum ✕] [Enfeksiyon ✕]│
│ + Ekle...                                   │
└────────────────────────────────────────────┘
Boş bırakılırsa tüm poliklinikler aktif olur.
Toplam 8 poliklinikten 3'ü aktif.

Aktif Hastalıklar (opsiyonel)
┌────────────────────────────────────────────┐
│ [Tümü seçili]                              │
│ [Belirli hastalıklar seç...]              │
└────────────────────────────────────────────┘
```

**Kısa yol kartlarını kaldır** veya "Hızlı Bakış" bölümüne taşı, ana form alanını sıkıştırmasın.

**Kaydet davranışı:**
- Kaydet'e basınca kısa "✓ Ayarlar kaydedildi" toast'u
- Etkisi neyi değiştirdiğini söyle: "Yeni oturumlar bu ayarlarla başlayacak"
- "Değişiklik yapıldı" göstergesi (kaydet butonu üstünde sarı nokta)
- Sayfa terk edilirken kaydedilmemiş değişiklik varsa uyar

**Ek özellikler:**
- "Varsayılana Sıfırla" butonu her bölümde ayrı ayrı
- "Ayarları dışa aktar" (JSON) → başka kuruma taşımak için
- Ayar değişiklik geçmişi (loglar sayfasına link)

---

## 5. Kullanıcı Yönetimi Sayfası

### Mevcut Durum
- "Yeni kullanıcı" formu üstte
- Alanlar: kullanıcı adı, şifre, görünen ad, rol
- Altta "Son başarılı girişler" listesi
- Her giriş satırında kullanıcı adı, tarih, rol rozeti

### Sorunlar
1. **Kullanıcı listesi yok**: Sistemdeki tüm kullanıcıları görme yolu yok, sadece son girişler var
2. **Rol yönetimi yüzeysel**: Rol dropdown'ı var ama yetkiler nelerdir belirsiz
3. **Şifre alanı tehlikeli**: Şifreyi düz metin girme, güç göstergesi yok, şifre oluşturucu yok
4. **Görünen ad opsiyonel görünüyor**: Placeholder var ama zorunlu mu belirsiz
5. **Süper admin uyarısı önemli ama zayıf**: "kilitlidir" bilgisi başlık altında kaybolmuş
6. **Aksiyon eksik**: Kullanıcıyı düzenleme, şifre sıfırlatma, pasife alma yok
7. **Son girişler listesi tekrarlı**: Aynı admin defalarca görünüyor, "1 kullanıcı, 5 giriş" gibi topluca gösterilmeli

### Öneriler

**Sayfayı iki bölüme ayır:**

**Bölüm 1: Kullanıcı Listesi (ana içerik)**

```
┌─────────────────────────────────────────────────┐
│ 👥 Kullanıcılar                    [+ Yeni Ekle] │
├─────────────────────────────────────────────────┤
│ 🔍 Ara...          Rol: [Tümü ▼]   Durum: [Tümü ▼]│
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 👤 admin                     [Süper Admin]  │ │
│ │    Kilitli hesap · Son giriş: 20 dk önce   │ │
│ │                                              │ │
│ │ [👁️ Detay] [🔑 Şifre Sıfırla] (silinemez)  │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 👤 testogrenci               [Öğrenci]      │ │
│ │    Aktif · Son giriş: 4 saat önce           │ │
│ │    Oynanmış vaka: 12 · Ort. skor: %68       │ │
│ │                                              │ │
│ │ [👁️ Detay] [🔑 Şifre Sıfırla] [🚫 Pasifleştir] │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 👤 burki                     [Öğrenci]      │ │
│ │    Aktif · Son giriş: 2 gün önce            │ │
│ │                                              │ │
│ │ [👁️ Detay] [🔑 Şifre Sıfırla] [🚫 Pasifleştir] │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Bölüm 2: Yeni Kullanıcı Ekleme (modal veya sağ panel)**

```
┌─── Yeni Kullanıcı ─────────────────────────┐
│                                             │
│ Rol *                                       │
│ ┌─────────────────────────────────────────┐│
│ │ ● Öğrenci — vaka oyna                   ││
│ │ ○ Doktor — vaka düzenle / onayla        ││
│ │ ○ Admin — tam yetki                     ││
│ └─────────────────────────────────────────┘│
│                                             │
│ Kullanıcı adı *                             │
│ [___________________]                       │
│ ⓘ 3-20 karakter, sadece harf/rakam         │
│                                             │
│ Görünen ad *                                │
│ [___________________]                       │
│ ⓘ Öğrencilere gösterilen isim              │
│                                             │
│ Şifre *                                     │
│ [___________________] 🎲 Otomatik oluştur   │
│ ▓▓▓▓▓░░░░ Zayıf                            │
│ ⓘ En az 8 karakter, büyük/küçük/rakam      │
│                                             │
│ [ ] İlk girişte şifre değiştirmesini iste  │
│                                             │
│              [İptal]  [Kullanıcı Ekle]      │
└─────────────────────────────────────────────┘
```

**Ek özellikler:**
- Toplu kullanıcı ekleme (CSV yükleme): sınıftaki öğrencileri toplu ekleme için
- Kullanıcı detay sayfası: profil, oynanmış vakalar, log geçmişi, yetkiler
- Şifre sıfırlatma: yeni geçici şifre üret, gösterip kopyala
- Pasifleştirme + silme ayrımı (pasif = giriş yapamaz ama kayıtları durur)
- Rol tanımı tooltip'i: her rolün ne yapabildiğini açıkla

---

## 6. Analitik Sayfası

### Mevcut Durum
- Üstte 4 metrik kartı: Oturum, Vaka, Aktif Vaka, Feedback
- "Vaka bazında" tablosu: vaka adı, n, ort %, tanı %, sık atlanan red flag, sık gereksiz test
- "Poliklinik bazında" küçük kart

### Sorunlar
1. **Veri fakirliği belirgin**: 1 oturum, 0 feedback ile analitik sayfası boş görünüyor
2. **Metrikler donuk**: Sayılar var ama trend, karşılaştırma yok
3. **Vaka tablosu tek satır**: Boş durum güçsüz, "sadece 1 vaka oynanmış" mesajı verilmeli
4. **Poliklinik kartı bilgisiz**: "1 oturum · ort. 0%" tek satır, ne için tıklanır belli değil
5. **Zaman filtresi yok**: Son 7 gün, son 30 gün seçimi olmadan tüm zaman kümülatif
6. **Grafik yok**: Sayısal veri var ama görselleştirme yok
7. **Karşılaştırma yok**: Vakalar arası, kullanıcılar arası, poliklinikler arası mukayese eksik

### Öneriler

**Sayfa yapısı:**

```
┌─────────────────────────────────────────────────┐
│ 📊 Analitik                                      │
│ Öğrenci performansı ve vaka etkinliği          │
│                    [Son 30 gün ▼] [📥 Rapor İndir]│
└─────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Genel Metrikler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Oturum  │ │ Öğrenci │ │ Aktif   │ │ Ort.    │
│         │ │         │ │ Vaka    │ │ Skor    │
│ 1       │ │ 3       │ │ 60      │ │ %68     │
│ ↑ %25   │ │ → aynı  │ │ ↑ +12   │ │ ↓ %3    │
│ geç. haf│ │         │ │         │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zaman Serisi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────┐
│ Günlük Oturum Sayısı                            │
│                                                  │
│    ▁▂▁▃▂▅▇▄▂▁▃▅▇▄▂▁▂▃▄▅▆▇▅▄▃▂▁▂▁               │
│    ─────────────────────────────────            │
│    18 Tem                              17 Ağu   │
└─────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vaka Performansı
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sıralama: [En zorlar ▼]   Filtre: [Tümü ▼]

┌─────────────────────────────────────────────────┐
│ 🫀 Kalp Yetmezliği                      1 oturum│
│    Ort. Skor:  ▓▓▓░░░░░░░  %30                 │
│    Tanı Doğruluğu:  ▓▓░░░░░░░░  %20            │
│    ⚠️ Sık atlanan: Hipoksi (1/1 oturumda)      │
│                                    [Detay →]    │
└─────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Poliklinik Karşılaştırması
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────┐
│ Kardiyoloji     ▓▓▓░░░░░░░  %30  (1 oturum)   │
│ Solunum         ░░░░░░░░░░  —    (0 oturum)   │
│ Enfeksiyon      ░░░░░░░░░░  —    (0 oturum)   │
└─────────────────────────────────────────────────┘
```

**Ek özellikler:**
- Öğrenci bazlı analitik (hangi öğrenci hangi vakada zorlanıyor)
- Hasta tipi bazlı analitik (endişeli hastalarda skor düşük mü?)
- Red flag başarı oranı (hangi red flag'ler en çok kaçırılıyor)
- Isı haritası: hangi soru chip'i hangi vakada az kullanılıyor
- Karşılaştırmalı görünüm: iki dönemi yan yana koy
- CSV/PDF rapor dışa aktarma

**Boş durum tasarımı:**
- Sadece 1 oturum varsa: "Analitik verileri henüz olgunlaşmadı" + gerçekçi tavsiye
- Grafiklerin yerine "En az X oturum sonra grafik görünecek" mesajı

---

## 7. Kural Motoru Sayfası

### Mevcut Durum
- Üstte 4 metrik: Toplam Kural, Aktif, Pasif, Hastalık Aliası
- Test filtresi dropdown, hastalık araması, "Varsayılana sıfırla" butonu
- Kural tablosu: test, hastalık, yön, faktör, açıklama, durum, işlem
- Her satırda "Düzenle" / "Sil" linkleri

### Sorunlar
1. **En işlevsel sayfa ama bilgi yoğunluğu yüksek**: Tablo çok bilgi taşıyor
2. **"Yön" sütunu anlaşılması zor**: "↑ YÜKSEK" ne anlama geliyor bir açıklama yok (yorum bilgisi eksik)
3. **"Faktör" teknik**: ×20, ×3 çarpanların anlamı belirsiz (referans değerin çarpanı mı?)
4. **Açıklama sütunu redundant**: "STEMI → Troponin belirgin yüksek" bilgi tekrarı
5. **Aktif/Pasif durumu az fark ediliyor**: Sadece küçük rozet
6. **Toplu işlem yok**: Birden fazla kuralı toplu aktif/pasif yapamıyorsun
7. **Sil butonu tehlikeli**: Onay yok gibi görünüyor
8. **Yeni kural ekle modalı belirsiz**: Sağ üstteki buton nereye gidiyor?
9. **Hastalık aliası bilgisi kayıp**: 7 alias var ama nerede yönetiliyor belli değil
10. **Test dropdown çok geniş olabilir**: Yüzlerce test varsa nasıl aranır?

### Öneriler

**Sayfayı iki panele böl:**

```
┌─── SOL PANEL (Filtre + Sekmeler) ──┐
│                                     │
│ 🧪 Testler                         │
│  • TROPONIN (3 kural)              │
│  • BNP (3 kural)                   │
│  • GLUKOZ (5 kural)                │
│  • [+ Test ekle]                   │
│                                     │
│ 🏥 Hastalıklar                     │
│  • stemi (5 kural)                 │
│  • nstemi (4 kural)                │
│  • kalp-yetmezligi (7 kural)       │
│                                     │
│ 🔗 Hastalık Aliasları              │
│  • miyokard-infarktüsü → stemi     │
│  • [+ Alias ekle]                  │
│                                     │
└─────────────────────────────────────┘

┌─── SAĞ PANEL (Kural Tablosu) ──────────────────────┐
│                                                     │
│ [🔍 Ara...]  [Filtre ▼]  [Toplu İşlem ▼]  [+ Kural]│
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ ☐ TROPONIN + STEMI                              ││
│ │   Beklenen: ↑ Belirgin Yüksek                   ││
│ │   Referans değerin 20 katı                      ││
│ │   Örnek: normal 0.04 → hesaplanan 0.8 ng/mL     ││
│ │                                                  ││
│ │   🟢 Aktif  ·  Son güncelleme: 3 gün önce       ││
│ │                                    [Düzenle]     ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ ☐ TROPONIN + NSTEMI                             ││
│ │   Beklenen: ↑ Hafif Yüksek                      ││
│ │   Referans değerin 3 katı                       ││
│ │                                                  ││
│ │   🟢 Aktif                          [Düzenle]    ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Yön göstergesi netleştir:**
```
Beklenen Yön:
  🔴 ↑↑ Belirgin Yüksek   (× 5-20)
  🟠 ↑  Hafif Yüksek       (× 1.3-3)
  🟢 →  Normal             (× 0.9-1.1)
  🔵 ↓  Hafif Düşük        (× 0.3-0.7)
  🟣 ↓↓ Belirgin Düşük     (× 0.1-0.2)
```

**Kural düzenleme modalı:**
```
┌─── Kuralı Düzenle ─────────────────────────┐
│                                             │
│ Test:      [TROPONIN ▼]                    │
│ Hastalık:  [stemi ▼]                       │
│                                             │
│ Beklenen Yön:                               │
│ ┌─────────────────────────────────────────┐│
│ │ ○ Normal                                ││
│ │ ○ Hafif yüksek        ● Belirgin yüksek││
│ │ ○ Hafif düşük         ○ Belirgin düşük ││
│ └─────────────────────────────────────────┘│
│                                             │
│ Çarpan Faktörü:  [ 20   ]                  │
│                                             │
│ Önizleme:                                   │
│ ┌─────────────────────────────────────────┐│
│ │ Referans aralığı: 0.00 - 0.04 ng/mL    ││
│ │ Bu kural uygulandığında: ~0.80 ng/mL   ││
│ │ Rastgele varyasyon: ±%10               ││
│ └─────────────────────────────────────────┘│
│                                             │
│ Açıklama (opsiyonel):                       │
│ [STEMI → Troponin belirgin yüksek______]   │
│                                             │
│ [ ] Kural aktif                             │
│                                             │
│           [İptal]  [Değişiklikleri Kaydet]  │
└─────────────────────────────────────────────┘
```

**Silme onayı:**
- Sil'e basınca modal: "Bu kuralı silmek istediğinize emin misiniz? X vakada uygulanıyor."
- Alternatif: "Pasifleştir" öner (geri alınabilir), "Sil" son çare

**Ek özellikler:**
- Bir kuralın hangi vakalarda uygulandığını görme
- Kural çakışması uyarısı: aynı test+hastalık için birden fazla kural varsa uyar
- Bulk aktif/pasif toggle
- Kuralları export/import (JSON) → başka sisteme taşımak için
- Kural şablon galerisi: yaygın hastalıklar için hazır kural setleri

---

## 8. Tıbbi Görüntüler Sayfası

### Mevcut Durum
- Başlık ve açıklama var
- Kırmızı hata bandı: "Tıbbi görüntü kayıtları yüklenemedi."
- 3 metrik: Eşleşmiş vaka (0), Dosyası hazır (0), Bulgu etiketi (0)
- Filtreleme alanı: arama, bulgu etiketi, poliklinik
- Alt kısımda "Filtrelerle eşleşen görüntü kaydı bulunamadı." mesajı
- Sağ üstte "Ayarlar" butonu

### Sorunlar
1. **Hata mesajı çıplak**: "yüklenemedi" ama neden, ne yapılmalı belirsiz
2. **Boş durum tasarımı zayıf**: Sıfır kayıt varken sayfa boş hissediyor
3. **Filtreleme boş halde bile göze batıyor**: Kayıt yokken filtreleri göstermek gereksiz
4. **Bulgu etiketi/poliklinik dropdown'ları boş görünüyor**: Etiket varsa gösterilsin, yoksa gizlensin
5. **Yükleme mekanizması eksik**: Sayfada nasıl görüntü ekleneceği yok
6. **Bağlantısız istatistik**: "0 eşleşmiş vaka" ama nasıl eşleştirileceği belirsiz
7. **"Ayarlar" butonu belirsiz**: Neyi ayarlıyor?

### Öneriler

**Boş durum için özel tasarım:**

```
┌─────────────────────────────────────────────────┐
│ 🖼️  Tıbbi Görüntüler                             │
│ Vakalara EKG, akciğer grafisi ve diğer          │
│ görüntüleri bağlayın.                            │
│                     [⚙️ Kaynak Ayarları] [+ Görüntü Ekle]│
├─────────────────────────────────────────────────┤
│                                                  │
│                                                  │
│                    🖼️                            │
│                                                  │
│         Henüz görüntü kaynağı bağlı değil       │
│                                                  │
│    Vakalarınıza radyolojik görüntü ve EKG       │
│    eklemek için önce kaynak ayarlarını         │
│    yapılandırın veya doğrudan görüntü yükleyin. │
│                                                  │
│    ┌────────────────┐  ┌────────────────┐      │
│    │ 📁 Görüntü     │  │ 🔗 Dış Kaynak  │      │
│    │    Yükle       │  │    Bağla       │      │
│    │                 │  │                 │      │
│    │ Elinizdeki      │  │ NIH ChestX-ray │      │
│    │ PNG/JPG'leri    │  │ veya PhysioNet │      │
│    │ toplu yükleyin  │  │ import edin    │      │
│    │                 │  │                 │      │
│    │  [Başla]        │  │  [Bağla]        │      │
│    └────────────────┘  └────────────────┘      │
│                                                  │
│    📖 [Yardım] Görüntüleri nasıl eklerim?      │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Dolu durum için tasarım:**

```
┌─── Görüntü Kütüphanesi ─────────────────────────┐
│                                                  │
│ 🔍 Ara...                                       │
│                                                  │
│ Modalite: [Tümü ▼]  Etiket: [Tümü ▼]           │
│ Poliklinik: [Tümü ▼]  Durum: [Tümü ▼]          │
│                                                  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│ │ [thumbnail]│ │ [thumbnail]│ │ [thumbnail]│  │
│ │            │ │            │ │            │  │
│ │ CXR        │ │ EKG        │ │ CXR        │  │
│ │ Pnömoni    │ │ İnf. STEMI │ │ Normal     │  │
│ │ Sağ alt lob│ │ 58y, E     │ │ 24y, K     │  │
│ │ 🔗 3 vaka  │ │ 🔗 1 vaka  │ │ 🔗 5 vaka  │  │
│ └────────────┘ └────────────┘ └────────────┘  │
│                                                  │
│ ┌────────────┐ ┌────────────┐                  │
│ │ [thumbnail]│ │ [thumbnail]│                  │
│ │            │ │            │                  │
│ │ CXR        │ │ EKG        │                  │
│ │ Ödem       │ │ AF         │                  │
│ │ Bilateral  │ │ Hızlı VR   │                  │
│ │ 🔗 2 vaka  │ │ 🔗 4 vaka  │                  │
│ └────────────┘ └────────────┘                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Hata durumu için:**

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Görüntü kayıtları yüklenemedi                │
│                                                  │
│ Sunucudaki tıbbi görüntü volume'üne             │
│ erişilemiyor. Bu durum genellikle şu             │
│ sebeplerden kaynaklanır:                        │
│                                                  │
│ • Dosya yolu hatalı (config: /data/images)     │
│ • Volume mount edilmemiş                        │
│ • İzin sorunu                                   │
│                                                  │
│ [🔄 Tekrar Dene]  [⚙️ Ayarları Kontrol Et]     │
│ [📖 Hata Detayları] (developer için)           │
└─────────────────────────────────────────────────┘
```

**Ek özellikler:**
- Görüntü yükleme modal'ı: sürükle-bırak alanı, toplu upload, otomatik etiketleme
- Etiket düzenleyici: her görsel için bulgu etiketi, taraf, şiddet vb.
- Vaka eşleştirme aracı: bir görsele hangi vakaların bağlı olduğunu gör
- Otomatik eşleştirme önerisi: kural bazlı "bu görsel şu vakalara uygun"
- Görüntü önizlemesi: modal'da tam boyut + zoom
- DICOM meta bilgi görüntüleyici (gizlilik uyarısıyla)

---

## 9. Test Durumu Sayfası

### Mevcut Durum
- 4 üst kart: Toplam Vaka (60), Eksiksiz Vaka (54/60), Test Kapsamı (%97), Dikkat Gereken Vaka (6)
- Alt bilgi satırı: "OK sonuç satırı 212 · Sonuç bulunan vaka 60"
- "Eksik testleri doldur" butonu ve yanında not
- "Sorunlu Vakalar (6)" listesi, her satırda vaka key ve etiket
- Her satırda "Statik → BT_TORAKS" gibi teknik etiketler ve tanı adı

### Sorunlar
1. **En bilgi yoğun sayfalardan biri ama sunumu düz**
2. **Metrikler arasında ilişki belirsiz**: 54/60 eksiksiz, 6 dikkat gereken (54+6=60 mı?)
3. **"Test Kapsamı %97" tek başına anlamlı değil**: Neyin %97'si?
4. **"Sorunlu Vakalar" başlığı olumsuz**: "Aksiyon gereken" veya "İnceleme bekleyen" daha nötr
5. **"Statik → BT_TORAKS" teknik**: Öğretmen okuyor gibi değil, geliştirici okuyor gibi
6. **Vaka listesi tıklanabilir mi belirsiz**: Direkt vaka düzenlemeye gitmeli
7. **"Statik gerekli: 6 (görüntüleme/patoloji — yazar eklemeli)" karışık**: Ne yapılacağı açık değil
8. **Eylem butonları az**: "Eksik testleri doldur" var ama tek tek düzenlemek için ne var?
9. **Filtreleme/sıralama yok**: 6 vaka fazla değil ama ileride 100 olursa nasıl bulunacak?

### Öneriler

**Üst metrikleri anlamlı hale getir:**

```
┌─────────────────────────────────────────────────┐
│ 🧪 Test Durumu                                   │
│ Vakalardaki test kapsamı ve eksikleri yönetin.  │
│                              [🔄 Yeniden Tara]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────┬──────────────────┐        │
│  │ Vaka Sağlığı     │ Test Kapsamı     │        │
│  │                   │                   │        │
│  │  ▓▓▓▓▓▓▓▓▓░ 90%  │  ▓▓▓▓▓▓▓▓▓▓ 97% │        │
│  │  54/60 tam       │  212/218 sonuç  │        │
│  │                   │                   │        │
│  │  Eksiksiz vakalar│  Test girdilerin│        │
│  │                   │  in cevap oranı │        │
│  └──────────────────┴──────────────────┘        │
│                                                  │
│  ⚠️  6 vaka için manuel test eklemesi gerekiyor │
│  (görüntüleme/patoloji verisi — otomatik         │
│  doldurulamaz, uzman girmeli)                    │
│                                                  │
│  [🔧 Eksik Lab Testlerini Otomatik Doldur (0)]  │
│  Lab motoru şu an için doldurabilecek eksik     │
│  test bulamadı. Statik veriler için aşağıdaki   │
│  listeden manuel giriş yapın.                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Sorunlu vakalar listesi iyileştirmesi:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manuel Aksiyon Gereken Vakalar (6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sıralama: [Kritiklik ▼]  Filtre: [Tümü ▼]  🔍 Ara

┌─────────────────────────────────────────────────┐
│ 🫀 ST Elevasyonlu MI                            │
│    kardiyoloji::stemi                            │
│                                                  │
│    Eksik test: 🖼️ BT Toraks (statik veri)      │
│    Neden: Bu görüntüleme testi lab motoruyla    │
│    üretilemiyor. Uzmanın manuel girmesi lazım.  │
│                                                  │
│    [📝 Vakayı Düzenle] [🖼️ Görüntü Ekle]        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🫀 Non-ST Elevasyonlu MI (NSTEMI)               │
│    kardiyoloji::nstemi                           │
│                                                  │
│    Eksik test: 🖼️ BT Toraks (statik veri)      │
│                                                  │
│    [📝 Vakayı Düzenle] [🖼️ Görüntü Ekle]        │
└─────────────────────────────────────────────────┘

... [4 vaka daha]
```

**Vaka kartı için ek bilgiler:**
- Vakanın son güncelleme tarihi
- Vakayı düzenleyen kişi
- Kaç öğrenci oynamış (hazır değilse pasif olabilir)
- Vaka aktif mi/pasif mi göstergesi

**Test tipi ikonları:**
- 🔬 Lab (otomatik doldurulabilir)
- 🖼️ Görüntüleme (statik gerekli)
- 🧫 Patoloji (statik gerekli)
- 🩻 Radyoloji
- 💉 Diğer

**Ek özellikler:**
- "Tümünü aç" veya "Toplu düzenleme" modu
- Vakaları toplu pasifleştirme (eksik olanları öğrenci görmesin)
- Otomatik doldurma öncesi önizleme: hangi vakada ne dolacak
- Doldurma sonrası özet raporu
- Excel'e vaka listesi + eksiklik dışa aktarma

---

## 10. Vaka Doğrulama Raporu Sayfası

### Mevcut Durum
- Başlık: "Vaka doğrulama raporu"
- Alt başlık: "TIP-AI CDM v1 · zorunlu alan, lab/rubrik uyumu, vitals, klinik tutarlılık"
- Versiyon ve tarih küçük gri metin
- Sağ üstte "Yenile" ve "Metin rapor" butonları
- 4 üst metrik kartı: Toplam (60), Geçerli (0), Uyarılı (60), Geçersiz (0)
- "Vaka iyileştirme kuyruğu" bölümü
- Uyarı kartları: Yüksek/Orta seviye, kod (MISSING_RESPIRATORY_RATE), açıklama, "vakasını düzenle" linki, sağda "60 vaka" sayacı

### Sorunlar
1. **Metrik kartları zayıf**: "Geçerli 0" korkutucu, açıklaması yok (kritik = 0 aslında iyi)
2. **Uyarı seviyeleri sadece rozet**: Görsel hiyerarşi zayıf, hepsi eşit görünüyor
3. **Uyarı kodu teknik**: "MISSING_RESPIRATORY_RATE" — kullanıcı dilinde de olsun
4. **"vakasını düzenle" linki tek**: Her uyarı için sadece 1 vaka linki var ama 60 vaka etkileniyor
5. **Toplu düzeltme yok**: 60 vakada aynı sorun varsa toplu düzeltme aracı yok
6. **Rapor gerekçesi belirsiz**: Neden bu rapor gerekli, nasıl kullanılır açıklaması yok
7. **CDM v1 belirsiz**: Kullanıcı bunun ne olduğunu bilmeyebilir
8. **Filtreleme yok**: Sadece Yüksek uyarıları görmek için filtre yok
9. **Doğrulama tarihi kayıp**: 17.08.2026 21:24:40 küçük gri, önemli bilgi
10. **"Metin rapor" butonu belirsiz**: Ne indirir/gösterir?

### Öneriler

**Sayfa başlığı ve özet:**

```
┌─────────────────────────────────────────────────┐
│ ✅ Vaka Doğrulama Raporu                        │
│ Vakaların tıbbi tutarlılığını ve içerik         │
│ eksikliklerini kontrol eder.                    │
│                                                  │
│ Son tarama: 17.08.2026 21:24 · CDM v1           │
│                    [📄 Rapor İndir] [🔄 Tekrar Tara]│
└─────────────────────────────────────────────────┘
```

**Metrik kartlarını yeniden yorumla:**

```
┌────────────────────────────────────────────────────┐
│                                                     │
│      📊 60 Vaka Tarandı                            │
│                                                     │
│      ┌──────────┬──────────┬──────────┐            │
│      │   ✅     │    ⚠️     │    ❌    │            │
│      │  Sorunsuz│  Uyarılı │  Kritik  │            │
│      │          │           │          │            │
│      │    0     │    60    │    0     │            │
│      │          │           │          │            │
│      └──────────┴──────────┴──────────┘            │
│                                                     │
│      Tüm vakalarda iyileştirme fırsatı var         │
│      ancak hiçbiri öğrencilerden gizlenmedi.        │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Uyarı seviyesi rozetleri:**
- 🔴 Kritik (öğrenciler bunu yaşamaya devam edemez)
- 🟠 Yüksek (yakında düzeltilmeli)
- 🟡 Orta (kalite iyileştirmesi)
- 🔵 Düşük (öneri)

**Uyarı kartı iyileştirmesi:**

```
┌─────────────────────────────────────────────────┐
│ 🟠 YÜKSEK  ·  Vital bulgu eksik                 │
│                                                  │
│ Etkilenen: 60 vaka                              │
│ Kod: MISSING_RESPIRATORY_RATE                    │
│                                                  │
│ Vital bulgulara solunum sayısı ekleyin. Solunum │
│ sayısı, akut hastalıkların değerlendirilmesinde │
│ kritik bir parametredir.                        │
│                                                  │
│ 📌 Etkilenen vakalar:                           │
│   • ST Elevasyonlu MI                           │
│   • Non-ST Elevasyonlu MI                       │
│   • Kalp Yetmezliği                             │
│   • ... [57 daha]                               │
│                                                  │
│ [👁️ Tümünü Göster] [🔧 Toplu Düzelt] [📝 Tekli] │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🟠 YÜKSEK  ·  Tedavi planı eksik                │
│                                                  │
│ Etkilenen: 60 vaka                              │
│ Kod: NO_TREATMENT_PLAN                          │
│                                                  │
│ Öğrenme hedefiyle uyumlu, gözden geçirilmiş bir │
│ tedavi planı ekleyin. Tanı sonrası öğrencinin   │
│ değerlendirmesi için gerekli.                   │
│                                                  │
│ [👁️ Tümünü Göster] [🔧 Toplu Düzelt] [📝 Tekli] │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🔴 KRİTİK  ·  Tanı-lab çelişkisi                │
│                                                  │
│ Etkilenen: 2 vaka                               │
│ Kod: DIAGNOSIS_CONTRADICTION                    │
│                                                  │
│ Tanı, laboratuvar sonucu ve referans aralığı    │
│ arasındaki klinik tutarlılığı gözden geçirin.   │
│                                                  │
│ 📌 Etkilenen vakalar:                           │
│   • Nefrotik Sendrom                            │
│   • [1 daha]                                    │
│                                                  │
│ [📝 Nefrotik Sendrom'u Düzenle]                 │
└─────────────────────────────────────────────────┘
```

**Filtreleme ve sıralama:**

```
┌─────────────────────────────────────────────────┐
│ Seviye: [Tümü ▼]  Tür: [Tümü ▼]  🔍 Ara       │
│                                                  │
│ Sıralama: ● Kritiklik  ○ Etki (vaka sayısı)   │
│           ○ Alfabetik   ○ En yeni              │
└─────────────────────────────────────────────────┘
```

**Toplu düzeltme aracı:**
- "Toplu Düzelt" butonuna basınca modal:
  - Etkilenen vakaların listesi checkbox'larla
  - Ortak alan doldurma formu (örn. tüm vakalara "solunum: 16/dk" ekle)
  - Önizleme + onay

**Ek özellikler:**
- "Doğrulama Geçmişi": önceki taramaları görme, iyileşme trendini takip
- Doğrulama kurallarını görme/düzenleme sayfası (bu uyarılar nereden geliyor?)
- Belirli uyarıları "yoksay" işaretleme (kabul edildi, öncelik değil)
- Otomatik doğrulama zamanlaması: her yeni vaka eklendiğinde tara

---

## Genel Yol Haritası ve Öncelikler

Tüm sayfalar için önerileri şu öncelikte uygulamak mantıklı:

### Faz 1 — Kritik UX Düzeltmeleri (1-2 hafta)
1. **Global navigasyon**: yatay scroll, taşan başlıklar, kullanıcı menüsü
2. **Empty state standardizasyonu**: tüm boş durumlara ikon+mesaj+aksiyon
3. **Loading state standardizasyonu**: skeleton loader bileşeni
4. **Renk sistemi**: rozet, uyarı seviyesi, durum renkleri
5. **Onay diyalogları**: yıkıcı işlemler için (sil, geri yükle)

### Faz 2 — Sayfa Bazlı İyileştirmeler (2-4 hafta)
6. **Kural Motoru**: iki panelli düzen, netleştirilmiş dil
7. **Test Durumu**: metrik anlamlandırma, aksiyon butonları
8. **Doğrulama Raporu**: uyarı hiyerarşisi, toplu düzeltme
9. **Kullanıcılar**: kullanıcı listesi, detay sayfası
10. **Ayarlar**: sekmeli düzen, kullanıcı diline çevrilmiş formlar

### Faz 3 — Zenginleştirme (4-8 hafta)
11. **Analitik**: grafikler, karşılaştırma, filtreleme
12. **Loglar**: gelişmiş filtre, gruplama, dışa aktarma
13. **Yedekler**: liste, detay, tarihçe
14. **Sistem Tanısı**: gerçek sağlık kartları, canlı durum
15. **Tıbbi Görüntüler**: yükleme akışı, eşleştirme aracı

### Faz 4 — İleri Özellikler (ileride)
- Klavye kısayolları
- Karanlık tema
- Rol bazlı görünüm (doktor rolü ile admin rolü farklı)
- Toplu işlem araçları
- Aktivite akışı (bildirim merkezi)

---

## Tasarım Sistem Önerileri

Uygulama boyunca tutarlılık için:

**Tipografi:**
- Sayfa başlığı: 24px, semibold
- Bölüm başlığı: 18px, semibold
- Kart başlığı: 15px, medium
- Metin: 14px, regular
- Meta bilgi: 12px, gri

**Boşluklar (spacing scale):**
- 4, 8, 12, 16, 24, 32, 48, 64 px

**Kart standardı:**
- Border-radius: 12px
- Border: 1px solid gri
- Padding: 20-24px
- Gap: 16px

**Buton hiyerarşisi:**
- **Primary**: siyah/koyu, ana aksiyon (Kaydet, Ekle)
- **Secondary**: outline, ikincil aksiyon (İptal, Geri)
- **Tertiary**: sadece metin, üçüncül (Detay, Daha fazla)
- **Danger**: kırmızı, yıkıcı (Sil, Geri Yükle)

Bu rapor, her sayfayı ayrı ayrı bir tasarımcıya veya geliştiriciye vermek için yeterli detayda hazırlanmıştır. Her bölüm bağımsız uygulanabilir.