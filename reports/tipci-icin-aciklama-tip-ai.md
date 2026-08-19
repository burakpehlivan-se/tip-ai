# Tıp_ai Sistemi — Tıpçı İçin Sade Özeti

> Bu rapor, sistemi yazılım bilmeden değerlendirecek bir tıp doktoru/uzmanı/öğrenci için yazıldı.
> Teknik terim mümkün olduğunca kullanılmadı; kullanılanlar parantez içinde açıklandı.
> Amacımız: **siz bunu okuduğunuzda, projenin tıbben doğru, öğrenciye yararlı ve desteklemeye değer olup olmadığına karar verebilin.**

---

## 1. Sistemin Amacı (Tek Cümle)

> Bir öğrenciye gerçek bir poliklinik karşılaşmasını yaşatan bir "simülasyon aracı"; tanıya giden yolda sorduğu soruları, istediği testleri ve klinik kararlarını puanlar.

---

## 2. Sistem Ne Yapar? — Somut Bir Senaryo

### Senaryo: "58 yaşında erkek, göğüs ağrısı ile başvuruyor"

| Adım | Öğrenci ne yapar | Sistem ne döner |
|---|---|---|
| 1 | Açılan ekranda hasta kartını görür (yaş, cinsiyet, ana şikayet). | Vaka bilgilerini gösterir. |
| 2 | Serbest metinle soru sorar: "Ağrı yayılıyor mu?" veya *"Ağrının yeri nedir?"* | Hasta yanıtı verir: "Evet, sol kola ve çeneye yayılıyor." |
| 3 | "EKG çek" / "kalp filmi bak" / "kardiyak graf istiyorum" der. | EKG sonucunu (metin/şekil) gösterir. ST elevasyon bkz II, III, aVF. |
| 4 | "Troponin bak" der. | Troponin sonucunu döner (örn. 0.8 ng/mL — yüksek). |
| 5 | Gereksiz test üretirse — örn. "BT anjiyo istiyorum" 1. dakikada | **Yine de sonucu gösterir** ama uyarı verir ve nihai puanda negatif etkilenir. |
| 6 | "Tanı: Akut Koroner Sendrom" yazar ve "Vakayı Tamamla" butonuna basar. | **Değerlendirme ekranı** açılır. |
| 7 | Skor görür, neyi eksik/atladığını okur, kısa eğitim notu görür. | Geri bildirim üretir. |

**Özet:** Sistem, öğrencinin yalnızca *tanı doğruluğunu* değerlendirmez; **klinik yaklaşımını** değerlendirir. OsCE mantığı gibi; tek farkı Türkçe, evinden ve istediği kadar tekrar.

---

## 3. Sistem Ne Değerlendirir? ("Puan kartı" rubrik)

Her hastalık için bir **klinik puan kartı** tanımlıyoruz. İçinde:

- **Sorulması beklenen anamnez soruları** — örn. göğüs ağrısı için: *yer, süre, yayılım, eforla ilişki, eşlik eden semptomlar, aile öyküsü*.
- **Yapılması beklenen fizik muayene adımları** — *vital bulgular, oskültasyon*.
- **İstenmesi gereken testler** — *EKG, troponin*.
- **Erken/boşa istenmemesi gereken testler** — *BT anjiyo ilk 10 dakikada, ekokardiyografi stabil olmayan hastada*.
- **Kritik kırmızı çizgiler (red flags)** — *bayılma öyküsü, aniden yırtılma ağrısı, ortostatik hipotansiyon*.
- **Kabul edilebilir tanı yolları** — *AKS, unstable angina, MI* gibi birden çok doğru yanıta da puan verir.

Puanlama örnekleri:

| Davranış | Puan |
|---|---|
| Doğru kritik soru sordu | +2 |
| Klinik olarak uygun test istedi | +2 |
| Gereksiz erken test | -1 |
| Red flag'i atlattı (ödeme/hışırtı sormadı) | -3 |
| Tehlikeli eksik yaklaşım (torasik anevrizayı düşünmedi) | -5 |

MVP aşamasında bu **kural tabanlı** (deterministik) yapılır, yapay zekaya bırakılmaz. Nedeni: tıp eğitiminde *açıklanabilirlik* ve *güvenilirlik* esnetilemez. AI bazlı serbest yorumlama ileri sürümlere bırakıldı.

---

## 4. Seçilen 5 Hastalık ve Nedenleri

| Hastalık | Klinik Alan | Neden uygun |
|---|---|---|
| **Kalp Hastalığı** (AKS/MI) | Kardiyoloji | Göğüs ağrısı, vital + EKG + biyomarker zinciri. Klasik OsCE. En net rubrik. |
| **Diyabet** | Endokrin | Anamnez, yaşam tarzı, risk faktörü + glukoz/HbA1c isteme. |
| **Kronik Böbrek Hastalığı** | Nefroloji | Laboratuvar zinciri; kreatinin + elektrolitler + idrar analizi + komorbid değerlendirme. |
| **Pnömoni** | Solunum | Öykü + oskültasyon + **röntgen isteme** davranışı ölçülür. |
| **Meme Kanseri** | Onkoloji | Kitle öyküsü + görüntüleme + biyopsi kararı zinciri. |

> ⚠️ **Önerimiz: önce tek bir hastalık (Kalp Hastalığı)** ile sistemi uçtan uca bitirip test etmek. Diğer 4 hastalık *içerik üretmekten ibaret* — mimari yine olsa rubrik + vaka hepsini yeniden yazmak gerekir. 5 hastalığı aynı anda denemek tek geliştiriciyi darlar.

---

## 5. Veriler Nereden Geliyor? — "Gerçek Hasta Verisi Kullanmıyoruz"

| Test tipi | Nereden geliyor | Örnek |
|---|---|---|
| **Numerik laboratuvar** (troponin, kreatinin, HbA1c, hemogram) | Kurallı üretici: hastalık "doğruluktan" + test normal aralığından → tutarlı sayı üretir. Aynı vaka + aynı test = her zaman aynı sonuç. | `{ troponin: 0.8 ng/mL }` (Hastalık: AKS) |
| **EKG** | Her vaka için ilk elden yazılır (örn. "sinüs ritmi, HR 92, ST elevasyon II/III/aVF"). | Tier A statik |
| **Röntgen** | Kaggle açık kaynak "Chest X-Ray Pneumonia" veri setinden PNG. Tanısı pnömoni ise gerçek pnömoni röntgeni gösterilir. | PNG görüntü |
| **MR / BT** | Röntgen görüntü kaynağı yoksa: yazılı radyoloji raporu gösterilir; gerekirse generic placeholder PNG. | "Apikal alanda konsolidasyon..." metni |
| **Hasta yanıtları** | Sorular için önceden yazılmış yanıtlar. İleride yapay zekaya yorumsallık için bırakılabilir ama MVP'de statik. | "Evet, babam kalp krizi geçirdi." |

**Çok önemli:** Sistemde **gerçek hasta yok**. Tüm vakalar sentetiktir. Bu nedenle KVKK/Etik kurul açısından büyük rahatlama.

---

## 6. Gizlilik ve KVKK (Sade)

- **Hasta verisi yok** → KVKK kapsamında "özel nitelikli kişisel veri" sayılmaz.
- Öğrenci kayıt için e-posta bile istemez (ilk sürüm). UUID denen rasgele bir kod atanır.
- E-posta ileride opsiyonel eklenecek.
- Tüm iletişim şifrelidir (HTTPS).
- Hekim/hekim adayı erişimine açık, https://... bir web sayfasındaki gibi açılır.

---

## 7. Sistemin Limitleri (Dürüstçe)

| Limit | Açıklama |
|---|---|
| **Tıbbi doğrulama** | Rubrik'ü tek başına bir yazılımcı yazamaz. **Bir uzman hekim onayı olmadan bu projeyi yayına almamalı**. Yanlış tıp öğretmek, hiç öğretmemekten kötüdür. |
| **Yapay zeka üretimi yok** | Tanı ve test sonuçları yapay zeka ile üretilmez. "Halüsinasyon" riski taşıyan üretim, tıp eğitiminde kabul edilemez. |
| **Görüntüleme DICOM değil** | Röntgenler doğrudan PNG (fotoğraf) olarak gösterilir. Gerçek radyoloji yazılımındaki pencere/level/kontrast araçları yoktur. Eğitim amaçlı görsel tanıma için yeterli. |
| **Süre uzar** | AI ile geliştirme hız verir ama tıbbi içerik (rubrik, vaka yazımı) yine de uzman ister. 5 hastalık = haftalarca sürer. |
| **Sürdürülebilirlik** | Tek kişilik proje. Ha sonra birdenbire rapor gelse de bakım işi birikir. |
| **ChatGPT ile örtüşme var** | ChatGPT "klinik vaka sor" isteyince anlık bir karşılaştırma veriyor. Bu proje birkaç yönüyle ondan farklı (rubrik skorlama, test isteme, Türkçe serbest metin) ama acı seviyesi **vitamin seviyesinde**. |

---

## 8. Size Ne Tür Katkı İstiyoruz?

Sistem tıpçı desteği olmadan **tamamlanamaz**. İstenen:

| Öncelik | Sizden istenen | Kaç dakika alır |
|---|---|---|
| 🔴 **Kritik** | Kalp hastalığı için rubrik gözden geçirme (sözlü/yazılı). "Bu sorunun sorulması zorunlu, bu kısmı atladığında -5 demem doğru mu?" | 60-90 dk |
| 🟡 Orta | 2-3 örnek vaka üretme (yaş, cinsiyet, EKG bulgusu, troponin, beklenen tanı) | 30 dk/vaka |
| 🟢 Düşük | Beta test ederken 3-5 öğrenciyi yönlendirme | 10 dk |
| Sezgici | Eğer §7 limit listesinde bir şey eklenmesi gerekiyorsa söyleyin; **ama fazla özellik eklemekten kaçının — iş yükünü siz üstlenirsiniz**. | — |

---

## 9. Maliyet ve Zaman Çizelgesi (Sade)

| Bölüm | Maliyet |
|---|---|
| Sunucu, veritabanı, alan adı | ~$0 (ilk sürüm ücretsiz limitler içinde) |
| Yapay zeka desteği (gerekirse normalleşme için) | ~$10/ay içine sığar |
| Yapay zeka geliştirme yardımcısı (Cursor, vb.) | $10-20/ay (gizli maliyet — dikkate alınmalı) |
| Toplam ilk 6 ay kestirim | **~$200-400** |

| Aşama | Tahmini süre | İçerik |
|---|---|---|
| **Spike (ispat)** | 3 hafta | Tek vaka (Kalp) end-to-end, doktor onayı alıncaya kadar |
| **MVP v0.1** | 5 hafta daha | Kalp + 3 vaka, NLP güçlendirmesi, puanlama |
| **Tüm 5 hastalık** | 8-10 hafta daha | Her hastalık için rubrik + 3-5 vaka |
| **Toplam** | ~16-20 hafta | "Yapabilir miyim" cevap kararı ~4. haftada verilir |

---

## 10. Karar Durumu

Yapılan analizlerin **örtüşen ortak kararı**:

> **KOŞULLU BAŞLA — ama tıbbi rubrik doğrulaması zorunlu**

Yani:
- ✅ Sistem teknik olarak tek başına yapılabilir.
- ✅ Tek bir hastalıkla uçtan uca bir prototip 3-4 hafta içinde ortaya konulabilir.
- ✅ "Yapabilir miyim" sorusunun cevabı 3-4 haftalık prototip sonunda netleşir.
- 🔴 **AMA: Bir uzman hekim onayı olmadan rubrik kabul edilemez.** Yanlış tıp öğretmek, hiç öğretmemekten kötüdür.
- 🔴 **AMA: İlk prototipten sonra "bu iş olmaz" çıkarsa, geliştirmeyi durdurma kriteri bellidir** (bkz. aşağıdaki "Kırmızı Çizgiler").
- 🔴 **AMA: 5 hastalık "MVP" beklentisi agresif** — önce tek hastalıkla (Kalp) uçtan uca bitirilmeli. Diğer 4 hastalık içerik işidir, mimari tekrarıdır.

## 11. Kırmızı Çizgiler (Bitirme/Ara Verme Kriterleri)

1. **3 hafta spike sonunda tek vaka çalışmıyorsa** → dur.
2. **4 haftada bir uzman hekim onayı alınamazsa** → kişisel deneme olarak devam et, kimseye açma.
3. **Test üretici klinik olarak imkansız sonuç üretirse** (örn. sağlıklı hastada kritik yüksek troponin) → o kolu kapat, statik veriye dön.
4. **Geri dönüt alınamıyorsa** → "5 hastalık daha ekleyeyim" hatasına düşme; toggle'lanmış bir tek hastalık doğru çalışıp olmadığını öğren daha değerli.

---

## 12. Sonuç — Size Açıkça Verdiğimiz Cevap

Bu proje, **doğru, sade ve rubrik kontrollü bir** klinik vaka "pratik aracı" olabilir. Tıp eğitiminde "daha çok vaka görme ve klinik akıl yürütme mantığını geliştirme" derdine **has bir araç** olma potansiyeli var.

Bu proje aşağıdakilerin yerine geçmez:

- ChatGPT'nin "klinik vaka sor" versiyonu değildir (ChatGPT rubrik puanlamaz — sadece sohbet eder).
- OSCE sınavı değildir (sınav yerine geçmez, pratik için yardımcıdır).
- Tanı yordamlı seri değildir (odak "tanıyı bilmek" değil, "yolu doğru yürütmek"tir).
- TUS soru bankası değildir (test çözme aracı değil).

Fakat tüm bunlardan farklı olarak: **rubrik tabanlı puanlama + Türkçe serbest metin + esnek test isteme** birleşimini sunan tek Türkçe araç olma özelliğini taşır.

**Özet:** Doğru hekim onayı + doğru klinik rubriklerle yapılırsa, Türk tıp eğitimine gerçek bir katkı sağlayabilir. Yapılmazsa (uzman olmadan, rubrik doğrulanmadan) ChatGPT çoğu özelliği zaten karşılar. **Buradaki ölçü, sizin uzman tutarlılığınız ve tıbbi doğrulamanızdır.**

---

> Detay için bakınız:
> - "Teknik Mimari": `reports/tech-architecture-tip-ai.md`
> - "Ürün Stratejisi": `reports/product-strategy-tip-ai.md`
> - "Fizibilite": `reports/feasibility-tip-ai.md`
> - "Eklenebilir Özellikler": `reports/features-tip-ai.md`
> - "Yazılım Araçları": `reports/mcp-tools-tip-ai.md`

**Buraya kadar okuduğunuz için teşekkür ederiz.** Projeye destek vermek isterseniz — bir rubrik gözden geçirmesi (60-90 dk) veya 2-3 örnek vaka paylaşımı (30 dk/vaka) büyük katkı sağlar.