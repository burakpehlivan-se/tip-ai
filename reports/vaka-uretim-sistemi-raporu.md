# tıp_ai — Vaka Üretim Sistemi ve Test Etkileşim Mimarisi

> Bu rapor, sistemin bir vaka üretmekten kullanıcı test isteyip resmi rapor görmesine kadar olan tüm akışı adım adım anlatır.
> Hedef: sistemin "kısım kısım nasıl çalıştığını" bir yazılımcıya değil, sistemi inceleyen bir okuyucuya anlatır gibi net biçimde ortaya koymak.

---

## 1. Genel Mimari — Bir Bakışta

Sistem iki temel moddan birinde çalışır:

| Mod | Giriş | Vaka kaynağı | Akış |
|---|---|---|---|
| **Poliklinik modu** | `/vakalar` → poliklinik kartı → `/poliklinik/[key]` | Seçilen poliklinikten rastgele | Tek hasta, anamnez→test→tanı→puan |
| **Çemiçgezek acil modu** | `/cemicegek` → "Sıradaki Hastayı Getir" | Tüm polikliniklerden rastgele | Çoklu hasta akışı + rapor geri dönüşü |

Her iki mod da aynı `VakaWorkspace` bileşenini kullanır. Çemiçgezek modu ek bir koordinatör katmanı ekler.

```
Kullanıcı
   │
   ├── /vakalar → poliklinik seç → vakaUret(key) ──→ VakaWorkspace (normal mod)
   │
   └── /cemicegek → vakaUret() ─────────────────────→ CemicegekSimulator → VakaWorkspace (cemicegek modu)
                                                                    │
                                                                    └── onTestIstendi → yeni hasta
```

---

## 2. Vaka Üretim Motoru — `case-generator.ts`

### 2.1 Veri Yapısı: 3 Katmanlı Şablon Sistemi

Vaka üretimi 3 katmanlı bir şablon hiyerarşisinden gelir:

```
Poliklinik (5 tane)
├── Kardiyoloji
│   ├── STEMI şablonu
│   └── NSTEMI şablonu
├── Endokrin
│   ├── Tip 2 Diyabet şablonu
│   └── Hipotiroidi şablonu
├── Solunum
│   ├── Pnömoni şablonu
│   └── KOAH Ekspazerbasyon şablonu
├── Nefroloji
│   └── Kronik Böbrek Hastalığı şablonu
└── Onkoloji
    ├── Meme Kanseri şablonu
    └── Akciğer Kanseri şablonu
```

- **Poliklinik**: bir alan adı + icon + hastalık şablonları listesi
- **Hastalık Şablonu**: bir hastalığın tüm klinik verisini üreten fonksiyonlar kümesi
- **Vaka**: şablondan üretilmiş, somut bir hasta karşılaşması

### 2.2 Her Hastalık Şablonu Ne İçerir?

Her `HastalikSablonu` şu alanları tanımlar:

| Alan | Tip | Ne yapar |
|---|---|---|
| `yasAraligi` | `[min, max]` | Bu hastalık için olası yaş aralığı |
| `cinsiyetTercih` | `"E"` / `"K"` / `"herhangi"` | Hastalık cinsiyet eğilimi |
| `seviye` | `"baslangic"` / `"orta"` / `"ileri"` | Eğitim zorluk seviyesi |
| `semptomSablonu(h)` | fonksiyon | Hasta kartında görünecek özet metin |
| `anaSikayetSablonu(h)` | fonksiyon | Hastanın ana şikayeti |
| `ozetBilgilerSablonu(h)` | fonksiyon | Sol panelde görünecek bilinen bilgiler listesi |
| `rubric` | nesne | Beklenen sorular, testler, red flag'ler, kabul edilen tanılar, puanlama ağırlıkları |
| `statikTestler()` | fonksiyon | Bu hastalık için önceden yazılmış test sonuçları (EKG, troponin, vb.) |
| `hastaYanitlari()` | fonksiyon | Her normalize aksiyon için önceden yazılmış hasta yanıtı |
| `soruChipleri` | string[] | Bu hastalık için önerilen hazır soruların etiketleri |
| `idealYol` | string[] | Vaka sonunda gösterilecek ideal klinik yaklaşım adımları |
| `egitimNotu` | string | Vaka sonunda gösterilecek kısa eğitim metni |

### 2.3 `vakaUret()` — Üretim Adımları

`vakaUret(poliklinikKey?)` fonksiyonu çağrıldığında:

```
1. Poliklinik seç
   ├─ poliklinikKey verilmişse → o poliklinik
   └─ verilmemişse → rastgele bir poliklinik (Çemiçgezek modu için)

2. Hastalık şablonu seç
   └─ Seçilen poliklinikteki hastalık şablonlarından rastgele biri

3. Hasta demografisi üret
   ├─ yas = rastgeleInt(yasAraligi[0], yasAraligi[1])
   ├─ cinsiyet = rastgeleCinsiyet(cinsiyetTercih)
   ├─ tamAd = uretTamAd(cinsiyet) → "Ahmet Yılmaz" tarzı rastgele Türk isim
   └─ tc = uretTC() → 11 haneli rastgele TC kimlik no (dummy)

4. Hasta nesnesi oluştur
   ├─ ad, tamAd, tc, yas, cinsiyet
   ├─ anaSikayet = sablon.anaSikayetSablonu(hasta)
   └─ ozetBilgiler = sablon.ozetBilgilerSablonu(hasta)

5. Chip'leri çözümle
   ├─ sablon.soruChipleri = ["Ağrının yeri nerede?", "Yayılıyor mu?", ...]
   ├─ Her etiketi CHIP_HAVUZU'nda ara
   └─ SoruChipi nesnelerine çevir: { etiket, aksiyon, kategori }

6. Relevant aksiyonları hesapla
   ├─ Beklenen soruların key'leri
   ├─ Red flag'lerin key'leri
   ├─ Beklenen testlerin key'leri
   ├─ + Her zaman relevant olanlar: vital bulgular, sigara, diyabet, ilaç, alerji
   └─ → relevantAksiyonlar listesi

7. Vaka nesnesini döndür
   ├─ id: "kardiyoloji-stemi-1700000000000-4823"
   ├─ semptom, hastalik, alan, seviye, hasta
   ├─ beklenenTani, rubric
   ├─ statikTestler (fonksiyon çağrılarak üretilir)
   ├─ hastaYanitlari (fonksiyon çağrılarak üretilir)
   ├─ soruChipleri (çözümlenmiş SoruChipi nesneleri)
   ├─ relevantAksiyonlar
   ├─ idealYol, egitimNotu
   └─ → VakaWorkspace'e prop olarak geç
```

**Önemli:** Her `vakaUret()` çağrısı farklı bir vaka üretir. Aynı poliklinikten iki kez çağrılsa bile farklı yaş, cinsiyet, isim, TC — ve hatta farklı hastalık şablonu (eğer poliklinikte >1 şablon varsa) gelir.

### 2.4 Dummy Hasta Verisi

- **İsim üretimi**: Cinsiyete göre 20 erkek + 20 kadın isminden rastgele biri + 30 soyisimden rastgele biri
- **TC üretimi**: 11 haneli, ilk hanesi 1-9, geri kalanı 0-9 rastgele
- **Not**: Bu veriler gerçek kişi verisi değildir. Tamamen sentetiktir.

---

## 3. Anamnez — Soru Sorma ve Yanıt Alma

### 3.1 İki Yolla Soru Sorulabilir

| Yol | Nasıl | NLP çalışır mı? |
|---|---|---|
| **Serbest metin** | Input alanına yaz + Enter | ✅ Evet — `normalizeSoru()` |
| **Hazır chip** | Kategorize edilmiş butona tıkla | ❌ Hayır — aksiyon direkt biliniyor |

### 3.2 Serbest Metin Akışı

```
Kullanıcı: "Ağrı yayılıyor mu?" yazıp Enter
    │
    ▼
normalizeSoru("Ağrı yayılıyor mu?")
    │
    ├─ 1. Direkt lookup: birlesikSoruSynonymleri["ağrı yayılıyor mu"]
    │      → Hit varsa: "AGRI_YAYILIM"
    │
    ├─ 2. Kısmi eşleşme: metin bir alias içeriyor mu?
    │      → "yayılıyor mu" alias'ı içeriyor → "AGRI_YAYILIM"
    │
    └─ 3. Hit yok: "OZEL" (özel/sınıflandırılamamış)
    │
    ▼
normalized = "AGRI_YAYILIM"
    │
    ├─ Hasta yanıtı: vaka.hastaYanitlari["AGRI_YAYILIM"]
    │   → "Evet, sol kola ve çeneye yayılıyor. Çok şiddetli."
    │
    ├─ Relevant kontrol: aksiyonRelevantMi(vaka, "AGRI_YAYILIM")
    │   → vaka.relevantAksiyonlar listesinde var mı?
    │   → Evet → relevant = true
    │
    └─ Sorulan aksiyonlar listesine ekle (tekrar puanlanmasın)
```

### 3.3 Hazır Chip Akışı (AI çalışmaz)

Chip'ler önceden kategorize edilmiştir ve her chip'in aksiyonu bellidir. NLP'ye gerek yok:

```
Kullanıcı: "Ağrının yeri nerede?" chip'ine tıklar
    │
    ▼
chip.aksiyon = "AGRI_YER" (önceden tanımlı)
    │
    ├─ Hasta yanıtı: vaka.hastaYanitlari["AGRI_YER"] → direkt ver
    ├─ Relevant kontrol: aksiyonRelevantMi(vaka, "AGRI_YER")
    └─ Sorulan listesine ekle
```

**Neden AI çalışmaz?** Chip'in aksiyonu `CHIP_HAVUZU`'nda zaten tanımlı. Serbest metin NLP'si sadece kullanıcı kendi cümlesini yazdığında devreye girer. Bu, gereksiz LLM çağrısı yapmamayı sağlar.

### 3.4 Chip Kategorileri

Chip'ler 6 kategoriye ayrılır ve her kategori farklı renkle gösterilir:

| Kategori | Renk | İçerik |
|---|---|---|
| 🚩 Red Flag | Kırmızı | Bayılma, yırtılma ağrısı, hemoptizi, konfüzyon |
| Anamnez — Semptom | Yeşil (relevant) / Turuncu (değil) | Ağrı yeri, süre, yayılım, öksürük, balgam |
| Anamnez — Sistemik | Yeşil / Turuncu | Eşlik eden semptom, aile öyküsü |
| Öykü — Risk Faktörleri | Yeşil / Turuncu | Sigara, diyabet, ilaç, alerji, KOAH öyküsü |
| Vital Bulgular | Yeşil | Tansiyon, nabız, ateş, SpO2 |
| Hastalığa Özel | Yeşil | Kitle süresi, akıntı, menopoz, etc. |

### 3.5 Relevant Renk Kodlaması

Her chip, o vaka için "kritik mi, değil mi" durumuna göre renk alır:

| Durum | Renk | Anlamı |
|---|---|---|
| ✅ Relevant | Yeşil border + yeşil bg | Bu soru bu vaka için klinik olarak kritik |
| ⚠️ Gereksiz | Turuncu border + turuncu bg | Bu soru bu vaka için kritik değil (ama sorulabilir) |
| 🚩 Red Flag (relevant) | Kırmızı border + kırmızı bg | Kritik red flag — mutlaka sorulmalı |
| 🚩 Red Flag (değil) | Açık kırmızı | Bu vaka için bu red flag ilgili değil |
| ✓ Soruldu | Açık yeşil + disable | Tekrar sorulamaz |

**Relevant mantığı**: `relevantAksiyonlar` listesi vaka üretildiğinde hesaplanır. Bu liste şunları içerir:
- Vakanın rubrik'inde "beklenen sorular" olarak tanımlanan tüm aksiyonlar
- Vakanın red flag'leri
- Vakanın beklenen testleri
- Her zaman relevant olan genel aksiyonlar (vital, sigara, diyabet, ilaç, alerji)

### 3.6 Gereksiz Soru Uyarısı

Eğer kullanıcı bir soru sorar (serbest metin veya chip) ve o sorunun aksiyonu `relevantAksiyonlar` listesinde yoksa:

```
⚠️ "Ağrı yayılımı" bu vaka için kritik bir soru değil.
Puanlamayı etkilemez ama klinik yaklaşımın odak noktası farklı olmalı.
```

Bu uyarı turuncu renkte sistem mesajı olarak sohbet akışında görünür. Puanlamayı etkilemez — sadece geri bildirim amaçlıdır.

---

## 4. Test İsteme — Tam Etkileşim

### 4.1 Test İsteme Yolları

| Yol | Nasıl | NLP çalışır mı? |
|---|---|---|
| **Katalog dropdown** | Tüm testler kategori bazında listelenir, tıkla | ❌ Hayır — testKey direkt biliniyor |
| **Serbest metin** | "EKG çek" veya "troponin bak" yaz + İste | ✅ Evet — `normalizeTest()` |

### 4.2 Tam Test Kataloğu

Sağ paneldeki test dropdown'ı **sistemdeki tüm testleri** her zaman gösterir — vakanın hastalığına bakılmaksızın. Kategorilere göre gruplanır:

| Kategori | Testler |
|---|---|
| **Kardiyak** | EKG (12 Derivasyon), Troponin I, BNP |
| **Laboratuvar** | Hemogram, Tam İdrar Tetkiki |
| **Endokrin** | Açlık Kan Şekeri, HbA1c, TSH, Serbest T4 |
| **Enflamasyon** | CRP |
| **Radyoloji** | PA Akciğer Grafisi, Toraks BT, Mamografi, Meme USG |
| **Böbrek** | Serum Kreatinin, BUN, Elektrolitler |
| **Solunum** | Arteriyel Kan Gazı |
| **Patoloji** | İnce İğne Aspirasyon Biyopsisi |

**Neden tüm testler her zaman görünür?** Gerçek klinik pratikde hekim her testi isteyebilir. Sistemin doğru davranışı:
- İlgili test istenirse → sonuç göster + puanla
- İlgisiz test istenirse → sonuç göster (varsa) + negatif puan
- Sistemde kayıtlı olmayan test → "Bu test şu anda sistemde kayıtlı değil" mesajı

### 4.3 Test İsteme Akışı (Normal Mod)

```
Kullanıcı: dropdown'dan "EKG (12 Derivasyon)" seçer
   VEYA: "ekg çek" yazar + İste
    │
    ▼
testIstey("EKG")
    │
    ├─ 1. Statik sonuç var mı? vaka.statikTestler["EKG"]
    │      → Evet → TestSonucu nesnesi al
    │      → Hayır → "Bu test şu anda sistemde kayıtlı değil" mesajı, dur
    │
    ├─ 2. Zaten istendi mi?
    │      → Evet → "EKG zaten istendi" mesajı, dur
    │
    ├─ 3. TestIstegi nesnesi oluştur
    │      { testKey: "EKG", testAdi: "EKG (12 Derivasyon)", sonuc, zaman }
    │
    ├─ 4. testIstekleri state'ine ekle → sağ panelde görün
    │
    ├─ 5. Sohbet'e sistem mesajı ekle:
    │      "📋 EKG (12 Derivasyon) istendi. Sonuç sağ panelde görüntülendi."
    │
    └─ 6. Rubric için istenen testler listesine ekle (puanlama için)
```

### 4.4 Test İsteme Akışı (Çemiçgezek Modu — Rapor Hazır Değilse)

Çemiçgezek acil modunda, hasta test istediğinde **rapor hemen gelmez**. Akış farklıdır:

```
Kullanıcı: "Troponin" ister
    │
    ▼
testIstey("TROPONIN")
    │
    ├─ 1-4. Aynı (statik sonuç al, tekrar kontrolü, istek nesnesi oluştur)
    │
    ├─ 5. Sohbet mesajı FARKLI:
    │      "📋 Troponin I istendi. Numune alındı — rapor hazırlanıyor.
    │       Sıradaki hasta geliyor..."
    │
    └─ 6. onTestIstendi("TROPONIN") callback'ini çağır (500ms sonra)
           → CemicegekSimulator bu sinyali alır
           → Yeni hasta üretir, ekrana getirir
           → İlk hasta beklemeye alınır
```

### 4.5 Rapor Geri Dönüşü (Çemiçgezek Modu)

Çemiçgezek modunda hasta, test istedikten birkaç hasta sonra raporuyla geri gelir:

```
Zaman çizelgesi:
   │
   T0: 1. Hasta gelir (örn: Kalp — STEMI)
   │     └─ Öğrenci anamnez sorar, EKG ister
   │        → "Numune alındı, rapor hazırlanıyor. Sıradaki hasta..."
   │
   T1: 2. Hasta gelir (örn: Solunum — Pnömoni)
   │     └─ Öğrenci anamnez sorar, röntgen ister
   │        → "Numune alındı, rapor hazırlanıyor. Sıradaki hasta..."
   │
   T2: 3. Hasta gelir (örn: Endokrin — Diyabet)
   │     └─ Öğrenci anamnez sorar, HbA1c ister
   │        → "Numune alındı, rapor hazırlanıyor. Sıradaki hasta..."
   │
   T3: 1. Hasta RAPORUYLA geri gelir
   │     └─ "EKG raporu hazır!" → sağ panelde resmi rapor görünür
   │     └─ Öğrenci raporu okur, tanı koyar, vakayı tamamla
   │
   T4: 4. Hasta gelir (yeni)
   │     └─ ... devam eder
```

**Kalabalık seviyesi**: Çemiçgezek modunda kaç hasta sonra raporun geleceği ayarlanabilir. Varsayılan: 2-3 hasta sonra ilk hasta raporuyla döner. Bu, gerçek acil koşullarını simüle eder — laboratuvar sonuçları anında gelmez.

---

## 5. Resmi Rapor Formatı — `ResmiRapor.tsx`

### 5.1 Rapor Bileşeni Yapısı

Test sonucu, sağ panelde tıklandığında açılan bir resmi hastane raporu formatında gösterilir:

```
┌─────────────────────────────────────┐
│         🏥                          │
│   ÇEMİÇGEZEK DEVLET HASTANESİ       │  ← Kurum başlığı (kalın, ortalanmış)
│      LABORATUVAR SONUÇ RAPORU       │  ← Rapor tipi (uppercase, küçük)
├─────────────────────────────────────┤
│ Hasta Adı:    Ahmet Yılmaz          │  ← Dummy isim
│ TC Kimlik No: 12345678901           │  ← Dummy TC
│ Yaş/Cins:     58 / E               │
│ Tarih:        9 Temmuz 2026, 15:30  │
│ Rapor No:     RPT-12345678          │
├─────────────────────────────────────┤
│ İstenen Tetkik: EKG (12 DERİVASYON) │  ← Test adı (kalın)
├─────────────────────────────────────┤
│ SONUÇ                               │
│   Ritim:              Sinüs ritmi   │  ← JSON tipinde sonuç
│   Kalp Hızı:          92            │
│   ST Elevasyon:       II, III, aVF  │
│   ST Depresyon:       I, aVL        │
│   Açıklama:           İnferior...   │
├─────────────────────────────────────┤
│ YORUM                               │
│ İnferior STEMI bulguları mevcuttur. │  ← Klinik yorum
│ Kaynak: ESC 2023                    │
├─────────────────────────────────────┤
│ Onay                    [KAŞE]      │
│ İmza                    ÇEMİÇGEZEK  │
│ ──────                  ONAYLI      │
└─────────────────────────────────────┘
```

### 5.2 Rapor Tipleri

Test sonucunun `tip` alanına göre rapor farklı bölüm gösterir:

| Tip | İçerik | Örnek testler |
|---|---|---|
| `numeric` | Büyük sayı + birim + referans aralık | Troponin, HbA1c, Kreatinin, CRP |
| `json` | Key-value tablosu | EKG, Hemogram, Elektrolit, İdrar |
| `text` | Serbest metin (bulgular) | Mamografi, Meme USG, Biyopsi, BT Toraks |
| `image` | Radyolojik bulgu metni | PA Akciğer Grafisi |

### 5.3 Rapor Üst Başlığı Otomatik Seçilir

Test adına göre rapor tipi başlığı otomatik belirlenir:

| Test adı içerir | Başlık |
|---|---|
| "Mamografi", "USG", "Grafisi", "BT" | RADYOLOJİ RAPORU |
| "Biyopsi" | PATOLOJİ RAPORU |
| Diğer | LABORATUVAR SONUÇ RAPORU |

### 5.4 Hasta Bilgileri Raporda

Rapor üst bölümünde hasta kartındaki bilgiler görünür:
- **Hasta Adı**: `hasta.tamAd` (örn: "Ayşe Demir")
- **TC Kimlik No**: `hasta.tc` (11 haneli dummy)
- **Yaş/Cins**: `hasta.yas / hasta.cinsiyet`
- **Tarih**: Rapor görüntülenme anı (Türkçe format)
- **Rapor No**: `RPT-` + timestamp'in son 8 hanesi

---

## 6. Puanlama — Vaka Tamamlandığında

### 6.1 Puanlama Motoru — `degerlendir.ts`

Kullanıcı "Vakayı Tamamla ve Puanla" butonuna bastığında:

```
degerlendir(vaka, sorulanAksiyonlar, istenenTestler, taniGirildi)
    │
    ├─ 1. Beklenen soruları kontrol et
    │      Her beklenen soru için:
    │      ├─ Soruldu mu? → +2 puan, dogruSorular'a ekle
    │      └─ Sorulmadı mı? → eksikSorular'a ekle
    │
    ├─ 2. Red flag'leri kontrol et
    │      Her red flag için:
    │      ├─ Soruldu mu? → +2 puan
    │      └─ Atlandı mı? → -3 puan, atlananRedFlagler'e ekle, zayifYonler'e ekle
    │
    ├─ 3. Beklenen testleri kontrol et
    │      Her beklenen test için:
    │      ├─ İstendi mi? → +2 puan, dogruTestler'e ekle
    │      └─ İstenmedi mi? → eksikTestler'e ekle, zayifYonler'e ekle
    │
    ├─ 4. Gereksiz testleri kontrol et
    │      Her gereksiz test için:
    │      └─ İstendi mi? → -1 puan, gereksizTestler'e ekle
    │
    ├─ 5. Tanıyı kontrol et
    │      ├─ Doğru mu? (kabulEdilenTani listesinde var mı) → +5 puan
    │      └─ Yanlış mı? → -3 puan
    │
    ├─ 6. Güçlü/zayıf yönleri otomatik üret
    │      ├─ ≥4 doğru soru → "Anamnez sorularının çoğunu sordu"
    │      ├─ Tüm testler doğru → "Tüm gerekli testleri istedi"
    │      ├─ Red flag atlanmadı → "Tüm red flag'leri sorguladı"
    │      └─ Gereksiz test yok → "Gereksiz test istemedi"
    │
    ├─ 7. İdeal yol + eğitim notu (vaka'dan al)
    │
    └─ 8. Negatif puanı 0'a yükselt (min 0)
```

### 6.2 Puanlama Tablosu

| Davranış | Puan |
|---|---|
| Doğru kritik soru sordu | +2 |
| Doğru yardımcı soru sordu | +1 |
| Doğru test istedi | +2 |
| Gereksiz/erken test istedi | -1 |
| Red flag'i atlattı | -3 |
| Tehlikeli eksik yaklaşım | -5 |
| Doğru tanı koydu | +5 |
| Yanlış tanı koydu | -3 |

### 6.3 Sonuç Ekranı

Vaka tamamlandığında sonuç ekranı şu bölümleri içerir:

1. **Puan**: `78/100` — büyük rakamla, yüzde olarak
2. **Güçlü Yönler**: Yeşil kartlar
3. **Geliştirilecek Yönler**: Turuncu/kırmızı kartlar
4. **Atlanan Red Flag'ler**: Kırmızı kartlar (varsa)
5. **İdeal Klinik Yaklaşım**: Adım adım liste
6. **Eğitim Notu**: Hastalığın kısa özeti + tedavi yaklaşımı
7. **Özet Kartları**: Doğru/eksik sorular ve testler (sayısal)
8. **Aksiyonlar**: "Yeni Vaka Seç" / "Ana Sayfa"

---

## 7. Çemiçgezek Devlet Hastanesi — Çoklu Hasta Akışı

### 7.1 Senaryo

Çemiçgezek acil modu, gerçek acil servis koşullarını simüle eder:

1. İlk hasta gelir → anamnez + test iste
2. Test istendi → "Numune alındı, rapor hazırlanıyor"
3. **Sıradaki hasta gelir** (yeni rastgele vaka)
4. Anamnez + test iste
5. Birkaç hasta sonra → **ilk hasta raporuyla geri gelir**
6. Rapor sağ panelde resmi formatta görünür
7. Tanı koy, vakayı tamamla
8. Sıradaki hasta gelir, akış devam eder

### 7.2 Kalabalık Seviyesi

Kaç hasta sonra raporun geleceği ayarlanabilir. Bu, acil servisin yoğunluğunu simüle eder:

| Seviye | Anlamı | Rapor kaç hasta sonra gelir |
|---|---|---|
| Az kalabalık | Sessiz acil | 1 hasta sonra |
| Orta kalabalık | Normal acil | 2-3 hasta sonra |
| Çok kalabalık | Yoğun acil | 4-5 hasta sonra |

### 7.3 Akış Diyagramı

```
[CemicegekSimulator]
    │
    ├─ hastaKuyrugu: Vaka[] (aktif bekleyen hastalar)
    ├─ raporHazirHastalar: { vakaId, testKey }[] (raporu hazır olanlar)
    ├─ kalabalikSeviyesi: "az" | "orta" | "cok"
    │
    ├─ acileHastaGetir()
    │   └─ vakaUret() → kuyruğa ekle → aktif hasta yap
    │
    ├─ onTestIstendi(testKey)
    │   ├─ Aktif hastayı "rapor bekliyor" durumuna al
    │   ├─ { vakaId, testKey } → raporHazirHastalar'a ekle
    │   ├─ Kalabalık seviyesine göre N hasta daha üret
    │   └─ Sıradaki hastayı aktif yap
    │
    ├─ raporGeriDondu(vakaId)
    │   ├─ Raporu hazir olan hastayı aktif yap
    │   ├─ testIstekleri'ne rapor sonucunu ekle
    │   └─ "EKG raporu hazır!" mesajı göster
    │
    └─ vakaTamamlandi(vakaId)
        ├─ Puanlama yap
        ├─ Kuyruktan çıkar
        └─ Sıradaki hastayı aktif yap (varsa)
```

---

## 8. NLP Sistemi — Türkçe Normalizasyon

### 8.1 İki Ayrı Sözlük

| Sözlük | Ne eşler | Örnek |
|---|---|---|
| `birlesikSoruSynonymleri` | Serbest metni → soru aksiyonuna | "ağrı yayılıyor mu" → "AGRI_YAYILIM" |
| `birlesikTestSynonymleri` | Serbest metni → test key'ine | "ekg çek" → "EKG" |

### 8.2 Eşleştirme Stratejisi — 2 Aşamalı

```
1. Direkt lookup: sözlük[metin] → tam eşleşme
2. Kısmi eşleşme: metin bir alias içeriyor mu? → contains
3. Hit yok: "OZEL" (soru) veya null (test)
```

**Neden fuzzy/LLM yok?** MVP spike için dictionary-based yaklaşım yeterlidir. ~250+ alias tanımlıdır ve Türkçe tıbbi terminolojinin yaygın varyasyonlarını kapsar. İleride fuzzy matching (rapidfuzz) ve LLM fallback eklenebilir.

### 8.3 Chip Seçildiğinde NLP Çalışmaz

Chip'lerin aksiyonu önceden tanımlıdır (`CHIP_HAVUZU`). Chip tıklandığında:
- `normalizeSoru()` çağrılmaz
- Direkt `chip.aksiyon` kullanılır
- Hasta yanıtı `vaka.hastaYanitlari[chip.aksiyon]`'dan alınır

Bu, gereksiz NLP işlemi yapmayı engeller ve yanıtı anında gösterir.

---

## 9. Dosya Yapısı Özeti

```
src/
├── app/
│   ├── page.tsx                    → Ana sayfa (landing)
│   ├── vakalar/page.tsx            → Poliklinik seçim ekranı
│   ├── poliklinik/[key]/page.tsx   → Poliklinik modu (rastgele vaka)
│   ├── cemicegek/page.tsx          → Çemiçgezek acil modu
│   ├── hakkinda/page.tsx           → Hakkında
│   └── doktorlar/page.tsx          → Doktor katkı çağrısı
│
├── components/
│   └── vaka/
│       ├── VakaWorkspace.tsx       → 3-panel vaka çalışma ekranı (ana bileşen)
│       └── ResmiRapor.tsx          → Resmi hastane raporu formatı
│
└── lib/
    ├── types.ts                    → TypeScript tipleri
    ├── data/
    │   ├── case-generator.ts       → Poliklinik + şablon + vaka üretim motoru
    │   ├── kalp-001.ts             → Kalp synonym'leri + test kataloğu
    │   ├── ek-vakalar.ts           → Ek synonym'ler + test kataloğu
    │   └── index.ts                → Birleşik synonym + katalog export
    ├── nlp/
    │   └── normalize.ts            → Türkçe normalizasyon (soru + test)
    └── scoring/
        └── degerlendir.ts          → Rubrik tabanlı puanlama motoru
```

---

## 10. Veri Akışı — Uçtan Uca Senaryo

### Senaryo: Kullanıcı Çemiçgezek acile girer, Kardiyoloji hastasıyla karşılaşır

```
1. Kullanıcı /cemicegek sayfasını açar
   → "Sıradaki Hastayı Getir" butonuna tıklar

2. cemicegek/page.tsx → acileHastaGetir()
   → vakaUret() çağrılır (poliklinikKey yok → tüm polikliniklerden rastgele)
   → Kardiyoloji → STEMI şablonu seçilir
   → Hasta üretilir: "Ahmet Yılmaz", 58, E, TC: 12345678901
   → Vaka nesnesi: { id, hasta, rubric, statikTestler, hastaYanitlari, soruChipleri, relevantAksiyonlar, ... }
   → VakaWorkspace mod="cemicegek" raporHazir={false} ile render

3. VakaWorkspace açılır
   → İlk mesaj: "58 yaş, Erkek — Göğüste baskı hissi"
   → Sol panel: Hasta kartı (isim, TC, yaş, ana şikayet, bilinen bilgiler)
   → Orta panel: Sohbet akışı + chip'ler (kategorize, renkli)
   → Sağ panel: Test katalog dropdown (tüm testler) + boş sonuç alanı

4. Kullanıcı "Ağrı yayılıyor mu?" chip'ine tıklar (yeşil — relevant)
   → chipSor({ etiket, aksiyon: "AGRI_YAYILIM", kategori })
   → NLP çalışmaz (chip aksiyonu direkt biliniyor)
   → Hasta yanıtı: "Evet, sol kola ve çeneye yayılıyor."
   → relevant=true → sohbet balonu yeşil etiketli "kritik"
   → sorulanAksiyonlar'a "AGRI_YAYILIM" eklendi

5. Kullanıcı serbest metinle "ekg çek" yazar + İste
   → serbestTestIstey() → normalizeTest("ekg çek") → "EKG"
   → testIstey("EKG")
   → statikTestler["EKG"] var → TestSonucu al
   → testIstekleri'ne ekle → sağ panelde TestSonucKarti görünür
   → Sohbet mesajı: "📋 EKG istendi. Numune alındı — rapor hazırlanıyor. Sıradaki hasta..."
   → onTestIstendi("EKG") callback → CemicegekSimulator'a haber

6. CemicegekSimulator onTestIstendi'yi alır
   → Aktif hastayı "rapor bekliyor" durumuna al
   → { vakaId: "kardiyoloji-stemi-...", testKey: "EKG" } → raporHazirHastalar'a ekle
   → Kalabalık seviyesine göre 2 yeni hasta üret
   → 2. Hasta aktif olur → VakaWorkspace yeniden render (yeni vaka)

7. Kullanıcı 2. ve 3. hastalarla da anamnez + test yapar

8. 3. hastadan sonra → 1. hastanın raporu hazır
   → CemicegekSimulator → 1. hastayı tekrar aktif yap
   → testIstekleri'ne EKG sonucunu ekle (raporHazir=true)
   → Sohbet mesajı: "✅ EKG raporu hazır! Sağ panelde görüntüleyin."
   → Sağ panelde TestSonucKarti açılır → ResmiRapor render

9. Kullanıcı raporu açar (tıklar)
   → ResmiRapor görünür:
      ÇEMİÇGEZEK DEVLET HASTANESİ
      Hasta: Ahmet Yılmaz, TC: 12345678901, 58/E
      EKG (12 Derivasyon)
      Ritim: Sinüs, HR: 92, ST Elevasyon: II,III,aVF
      Yorum: İnferior STEMI bulguları

10. Kullanıcı "Akut Koroner Sendrom" yazar + "Vakayı Tamamla"
    → degerlendir() çağrılır
    → Puanlama: doğru sorular +2, red flag sorgulama +2, EKG +2, tanı +5
    → Sonuç ekranı: 78/100, güçlü/zayıf yönler, ideal yol, eğitim notu
    → "Yeni Vaka Seç" → sıradaki hasta gelir
```

---

## 11. Özet — Sistemin Çalışma Prensibi

| Bileşen | Ne yapar | Ne zaman çalışır |
|---|---|---|
| `vakaUret()` | Rastgele vaka üretir | Poliklinik seçildiğinde / Çemiçgezek "Sıradaki Hasta" |
| `normalizeSoru()` | Serbest metni aksiyona çevirir | Kullanıcı input'a yazıp Enter'a basınca |
| `normalizeTest()` | Serbest metni test key'ine çevirir | Kullanıcı test adı yazıp İste'ye basınca |
| `aksiyonRelevantMi()` | Aksiyon bu vaka için kritik mi? | Her soru/test sonrası |
| `testIstey()` | Test sonucu üretir/gösterir | Dropdown seçim veya serbest metin |
| `degerlendir()` | Rubrik puanlama yapar | "Vakayı Tamamla" butonu |
| `ResmiRapor` | Hastane raporu formatında gösterir | Test sonucu kartı tıklandığında |
| `CemicegekSimulator` | Çoklu hasta + rapor geri dönüşü | Çemiçgezek modunda test istendiğinde |

**Temel ilkeler:**
1. **Vaka üretimi rastgele** — her seferinde farklı hasta, farklı demografi
2. **Chip'lerde NLP çalışmaz** — aksiyon önceden tanımlı, anında yanıt
3. **Serbest metinde NLP çalışır** — dictionary bazlı normalizasyon
4. **Relevant kontrolü renkli** — yeşil kritik, turuncu gereksiz, kırmızı red flag
5. **Test kataloğu tam** — tüm testler her zaman görünür, ilgili olmayana negatif puan
6. **Rapor resmi formatta** — hastane başlığı, hasta TC, imza/kaşe
7. **Çemiçgezek modu çoklu hasta** — test isteyince yeni hasta, rapor sonra gelir
8. **Puanlama deterministik** — kural tabanlı, LLM yok, açıklanabilir
