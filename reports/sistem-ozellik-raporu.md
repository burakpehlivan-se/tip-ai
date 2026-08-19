# tıp_ai — Sistem Özellik Raporu

> Kapsamlı özellik dokümantasyonu. Yeni özellikler bu temel sistem üzerine inşa edilecek.
> Tarih: Temmuz 2026 · 18 poliklinik · 57 hastalık şablonu · TypeScript + Next.js 14

---

## 1. Sayfa Haritası

| Sayfa | Route | Açıklama |
|---|---|---|
| Ana Sayfa | `/` | Landing page — hero, özellikler, nasıl çalışır, CTA |
| Vaka Seçimi | `/vakalar` | 18 poliklinik kartı — her birinden rastgele vaka |
| Poliklinik | `/poliklinik/[key]` | 3-panel vaka çalışma ekranı (rastgele vaka) |
| Çemiçgezek Acil | `/cemicegek` | Çoklu hasta acil simülatörü — tüm polikliniklerden rastgele |
| Hakkında | `/hakkinda` | Sistem açıklaması, nasıl çalışır, limitler |
| Doktorlar | `/doktorlar` | Uzman katkı çağrısı — rubrik onayı, vaka üretme |

---

## 2. 3-Panel Vaka Çalışma Ekranı

### Sol Panel — Hasta Kartı
- Hasta adı, TC kimlik no, yaş, cinsiyet
- Ana şikayet, bilinen bilgiler (ozetBilgiler)
- **İlerleme takibi**: sorulan soru sayısı, istenen test sayısı
- **📚 Vaka Kaynakları** (açılır menü):
  - 🆔 Vaka ID (sistem içi benzersiz kimlik)
  - 📊 Veri noktası (yaş, cinsiyet, ana şikayet özeti)
  - Hastalığa özel veri kaynakları (UCI/Kaggle veri setleri, kılavuz referansları)
  - "Tüm vakalar sentetiktir" uyarısı

### Orta Panel — Sohbet / Etkileşim
- **Sistem mesajları**: vaka başlangıcı, test sonuç bildirimleri
- **Hasta yanıtları**: sol tarafta balon
- **Öğrenci soruları**: sağ tarafta balon
- **📋 Test Sonuç Kartı (büyük)**: test istendiğinde sohbette büyük kart:
  - Numerik sonuç: **4xl büyük rakam** + birim + referans aralığı
  - JSON sonuç: 2-sütun grid ile key-value tablosu
  - Text sonuç: okunabilir paragraf
  - 💬 Klinik yorum (yeşil kart içinde)
  - Kaynak referansı
  - Resmi rapor formatı (sağ panelde açılır)

### Sağ Panel — Testler ve Tanı
- **Test arama**: serbest metinle test ara ("ekg çek", "troponin")
- **Test kataloğu**: tüm testler kategori bazlı dropdown (Kardiyak, Lab, Endokrin, Radyoloji, Böbrek, Hematoloji, Patoloji)
- **Test sonuçları**: açılır kartlar → tıklayınca **ResmiRapor** (hastane formatı)
- **Tanı girişi**: serbest metin → "Tanıyı Kaydet ve Tedaviye Geç"
- **Tedavi planı**: textarea → "Vakayı Tamamla ve Puanla"

---

## 3. Faz Akışı

```
Anamnez → Test → Tanı → Tedavi → Puanlama
```

| Faz | Ne yapılır | UI |
|---|---|---|
| **Anamnez** | Hasta kartı okunur, soru sorulur | Chip'ler + serbest metin input |
| **Test** | Test istenir, sonuçlar görülür | Sağ panel test kataloğu |
| **Tanı** | Ön tanı girilir | Text input + "Tedaviye Geç" butonu |
| **Tedavi** | İlaçlar, prosedürler yazılır | Textarea + "Tamamla" butonu |
| **Puanlama** | Değerlendirme ekranı | Puan + analiz + tedavi kartı |

---

## 4. Hızlı Sorular (Chip'ler)

- **108 soru, 7 kategori**, accordion yapısı
- Kategoriye tıklayınca sorular açılır
- Sorulan chip ✓ işareti alır, disable olur
- **Arama**: chip arama input'u — tüm kategorilerde filtreleme
- **Renk kodlaması yok** — öğrenci hangisinin gerekli olduğuna kendi karar verir
- Tüm polikliniklerde **aynı chip havuzu** kullanılır

### Chip Kategorileri

| # | Kategori | Soru sayısı |
|---|---|---|
| 1 | Şikayet & Semptom | 65 |
| 2 | Sistem Sorgusu | 13 |
| 3 | Özgeçmiş | 29 |
| 4 | Soy Geçmiş | 12 |
| 5 | Vital Bulgular | 7 |
| 6 | Fizik Muayene | 20 |
| 7 | Kritik Sorgulama (Red Flags) | 17 |

---

## 5. Türkçe NLP Sistemi

- **Soru normalizasyonu**: serbest metin → aksiyon (dictionary-based)
- **Test normalizasyonu**: serbest metin → test key  
- **İki aşamalı eşleşme**: direkt lookup → kısmi eşleşme (contains)
- **250+ alias**: Türkçe tıbbi terminolojinin varyasyonları
- **Chip'lerde NLP çalışmaz**: aksiyon önceden tanımlı, anında yanıt

---

## 6. Test Sonuç Sistemi

### Test Kataloğu (15 test)

| Kategori | Testler |
|---|---|
| Kardiyak | EKG, Troponin, BNP |
| Laboratuvar | Hemogram, İdrar Tetkiki |
| Endokrin | Açlık Kan Şekeri, HbA1c, TSH, Serbest T4 |
| Enflamasyon | CRP |
| Radyoloji | PA Akciğer, Toraks BT, Mamografi, Meme USG |
| Böbrek | Kreatinin, BUN, Elektrolitler |
| Solunum | Arteriyel Kan Gazı |
| Patoloji | İİAB Biyopsi |
| Hematoloji | Ferritin, Serum Demir + TDBK |

### Resmi Rapor Formatı

Test sonucu tıklandığında gerçek hastane raporu görünümü:
- 🏥 Kurum başlığı: "ÇEMİÇGEZEK DEVLET HASTANESİ"
- Rapor tipi: Laboratuvar / Radyoloji / Patoloji (otomatik)
- Hasta bilgileri: ad, TC, yaş, cinsiyet, tarih
- Rapor No
- Test adı ve sonucu (numeric/json/text/image)
- 💬 Klinik yorum
- Kaynak referansı
- İmza ve kaşe alanı

---

## 7. Puanlama Sistemi (Rubrik)

### Puan Tablosu

| Davranış | Puan |
|---|---|
| Doğru kritik soru | +2 |
| Doğru yardımcı soru | +1 |
| Doğru test | +2 |
| Gereksiz/erken test | -1 |
| Red flag atlandı | -3 |
| Tehlikeli eksik yaklaşım | -5 |
| Doğru tanı | +5 |
| Yanlış tanı | -3 |

### Sonuç Ekranı Bölümleri

1. **Puan**: büyük rakam + yüzde (renkli)
2. **✅ Güçlü Yönler**: yeşil kartlar
3. **⚠️ Geliştirilecek Yönler**: turuncu/kırmızı kartlar
4. **🚨 Atlanan Red Flag'ler**: kırmızı kartlar
5. **🔍 Anamnez Analizi**:
   - Kategori bazlı progress bar (renkli: yeşil ≥%80, turuncu ≥%50, kırmızı <%50)
   - Sorulan/beklenen oranı
   - En iyi ve en eksik kategori
   - Sorulmayan kritik sorular listesi
6. **📋 İdeal Klinik Yaklaşım**: adım adım liste
7. **📚 Eğitim Notu**: hastalık özeti + tedavi yaklaşımı
8. **💊 Tedavi Planı**:
   - Tedavi özeti (yeşil banner)
   - İlaç tablosu (ad, doz, yol, endikasyon)
   - Prosedürler listesi
   - Önemli notlar (turuncu uyarılar)
   - Kaynak kılavuz referansı
9. **Özet Kartları**: doğru/eksik soru ve test sayıları

---

## 8. Vaka Üretim Motoru

### Rastgele Vaka Seçimi

```
Poliklinik seç → Rastgele hastalık şablonu → Rastgele demografi → Vaka üret
```

- **18 poliklinik** × **1-4 hastalık şablonu** = her seferinde farklı
- Rastgele yaş (hastalığa özgü aralıkta)
- Rastgele cinsiyet (hastalık eğilimine göre)
- Rastgele dummy isim (20 erkek + 20 kadın isim)
- **TC Kimlik No**: resmi TC algoritmasına göre (11 haneli, check digit kontrollü)

### Hastalık Şablonu Yapısı

Her şablon şunları içerir:
- `rubric`: beklenen sorular, beklenen testler, gereksiz testler, red flag'ler, kabul edilen tanılar, puanlama ağırlıkları
- `statikTestler`: önceden yazılmış test sonuçları (hastalığa özel, klinik referans bazlı)
- `hastaYanitlari`: her normalize aksiyon için hasta yanıtı
- `idealYol`: vaka sonu ideal klinik yaklaşım adımları
- `egitimNotu`: hastalık eğitim metni
- `tedavi`: yapılandırılmış tedavi planı (ilaçlar, prosedürler, notlar, kaynak)

---

## 9. Çemiçgezek Devlet Hastanesi — Acil Simülatör

- `/cemicegek` — tüm polikliniklerden rastgele vaka
- **Menü ekranı**: hero + nasıl çalışır + poliklinik dağılımı
- **"Sıradaki Hastayı Getir"** butonu → rastgele vaka
- **"Sıradaki Hasta →"** butonu → çalışma sırasında yeni hasta
- Acil teması: kırmızı aksent, "Çemiçgezek Devlet Hastanesi" başlığı
- Test istendiğinde: "Numune alındı, rapor hazırlanıyor" mesajı
- Çoklu hasta akışı için altyapı hazır (mod, onTestIstendi, raporHazir prop'ları)

---

## 10. Poliklinikler ve Hastalıklar

| # | Poliklinik | Hastalık sayısı | Örnek hastalıklar |
|---|---|---|---|
| 1 | ❤️ Kardiyoloji | 4 | STEMI, NSTEMI, Kalp Yetmezliği, AF |
| 2 | 🩸 Endokrin | 4 | Tip 2 DM, Hipotiroidi, Hipertiroidi, Hipoglisemi |
| 3 | 🫁 Göğüs Hastalıkları | 4 | Pnömoni, KOAH, Astım, TBC |
| 4 | 🧪 Nefroloji | 3 | KBH, ABH, Nefrotik Sendrom |
| 5 | 🎗️ Onkoloji | 3 | Meme CA, Akciğer CA, Kolon CA |
| 6 | 🩸 Hematoloji | 3 | DEA, İTP, Hemofili A |
| 7 | 🦠 Enfeksiyon | 3 | İYE, Gastroenterit, Hepatit B |
| 8 | 🏥 Genel Cerrahi | 5 | Apandisit, Kolesistit, Herni, Pankreatit, Koledokolitiazis |
| 9 | 👁️ Göz Hastalıkları | 3 | Glokom, Konjonktivit, Katarakt |
| 10 | 👂 KBB | 3 | Tonsillit, Otit, Epistaksis |
| 11 | 🪨 Üroloji | 3 | BPH, Ürolitiazis, Prostat CA |
| 12 | 🦴 Ortopedi | 3 | Kalça Kırığı, OA, Menisküs |
| 13 | 🤰 Kadın Doğum | 3 | Preeklampsi, Ektopik, Endometriozis |
| 14 | 🧠 Beyin Cerrahisi | 3 | SDH, LDH, Kafa Travması |
| 15 | 🫀 KVC | 3 | AAA, PAH, Varis |
| 16 | 🫁 Göğüs Cerrahisi | 4 | Pnömotoraks, Plevral Ef., Akciğer CA cerrahi, Med. Kitle |
| 17 | ✂️ Plastik Cerrahi | 3 | Yanık, El Tendon, Bası Yarası |
| 18 | 👶 Çocuk Cerrahisi | 3 | İnvajinasyon, Pilor Stenozu, ÖA |
| | **Toplam** | **57** | |

---

## 11. Dummy Veri Üretimi

| Veri | Yöntem |
|---|---|
| **Hasta adı** | 20 erkek + 20 kadın Türk ismi havuzundan rastgele |
| **Soyadı** | 30 Türk soyadı havuzundan rastgele |
| **TC Kimlik No** | 11 haneli, resmi TC algoritması (tek/çift kontrolü, check digit) |
| **Yaş** | Hastalık şablonunda tanımlı aralıktan rastgele |
| **Cinsiyet** | Hastalık eğilimine göre (E/K/herhangi) |
| **Vaka ID** | `poliklinikKey-hastalikKey-timestamp-random` formatı |
| **Test sonuçları** | Sentetik, klinik referans aralıklarına uygun |
| **Hasta yanıtları** | Sentetik, uzman onaylı şablonlardan |

---

## 12. Tasarım Sistemi (Mintlify DESIGN.md Tabanlı)

| Bileşen | Değer |
|---|---|
| **Font** | Inter (UI), Geist Mono (kod) |
| **Canvas** | #ffffff (beyaz) |
| **Aksent** | #00d4a4 (mint yeşili — tıp/sağlık) |
| **Primer buton** | Siyah pill, rounded-full |
| **Aksent buton** | Mint yeşili pill |
| **Kartlar** | rounded-lg, hairline border |
| **Semantik renkler** | Kırmızı (hata/red flag), Turuncu (uyarı), Mavi (bilgi) |
| **Typography** | 600 weight display, 400 weight body, negative letter-spacing |
| **Spacing** | 4px base, 8px increments |

---

## 13. Teknik Mimari

```
Next.js 14 App Router
├── app/
│   ├── page.tsx              — Ana sayfa
│   ├── vakalar/page.tsx       — Vaka seçimi
│   ├── poliklinik/[key]/page.tsx — Poliklinik modu
│   ├── cemicegek/page.tsx     — Acil simülatör
│   ├── hakkinda/page.tsx
│   └── doktorlar/page.tsx
├── components/vaka/
│   ├── VakaWorkspace.tsx      — 3-panel interaktif ekran
│   └── ResmiRapor.tsx         — Hastane raporu formatı
└── lib/
    ├── types.ts               — Tip tanımları
    ├── data/
    │   ├── case-generator.ts  — Vaka üretim motoru (poliklinik+şablon)
    │   ├── kalp-001.ts        — Kalp synonym'leri
    │   ├── ek-vakalar.ts      — Ek synonym'ler + test kataloğu
    │   └── index.ts           — Birleşik export
    ├── nlp/
    │   └── normalize.ts       — Türkçe normalizasyon
    └── scoring/
        └── degerlendir.ts     — Rubrik puanlama motoru
```

---

## 14. Yeni Özellik Ekleme Rehberi

### Yeni hastalık ekleme

`src/lib/data/case-generator.ts` içinde ilgili polikliniğin `hastalikSablonlari` dizisine yeni şablon eklenir. Her şablon şu alanları içermelidir:

- `hastalikKey`, `hastalikAdi` — benzersiz kimlik
- `semptomSablonu`, `anaSikayetSablonu`, `ozetBilgilerSablonu` — hasta sunumu
- `yasAraligi`, `cinsiyetTercih`, `seviye` — demografik
- `rubric` — beklenenSorular, beklenenTestler, gereksizTestler, redFlagler, kabulEdilenTani, puanlama
- `statikTestler` — test sonuçları
- `hastaYanitlari` — aksiyon → yanıt mapping
- `soruChipleri` — string[] (CHIP_HAVUZU'ndaki etiketler)
- `idealYol` — klinik yaklaşım adımları
- `egitimNotu` — eğitim metni

### Yeni poliklinik ekleme

`poliklinikler` dizisine yeni obje:

```ts
{ key: "pol-key", ad: "Poliklinik Adı", icon: "🆕", aciklama: "...", hastalikSablonlari: [...] }
```

Ayrıca `TEDAVI_SABLONLARI` ve `KAYNAKLAR_SABLONLARI`'na hastalıkKey için giriş eklenmelidir.

### Yeni chip ekleme

`CHIP_HAVUZU` dizisine yeni `SoruChipi` objesi eklenir. Otomatik olarak tüm polikliniklerde görünür.

### Yeni test ekleme

1. `ek-vakalar.ts` → `ekTestSynonymleri` ve `ekTestKatalogu` güncellenir
2. `case-generator.ts` → `gen_template` fonksiyonundaki statik test üreticiye yeni test key eklenir
3. Hastalık şablonlarının `statikTestler` ve `rubric.beklenenTestler` alanları güncellenir
