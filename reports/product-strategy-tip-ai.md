# Ürün Stratejisi Analizi: Türkçe Klinik Karar Simülasyon Sistemi (tıp_ai)

> **Analyst:** Product Strategist · **Tarih:** 09 Temmuz 2026
> **Proje tipi:** Kişisel "yapabilir miyim" projesi — tek fullstack geliştirici, AI-assisted, $10/ay LLM bütçesi
> **Hedef:** Tüm seviyelerdeki tıp öğrencileri · Asıl değer: daha çok vaka görme + pratik
> **Başarı kriteri:** Birkaç öğrenci/doktordan "OK continue" feedback

---

## Özet (Yönetici Özeti)

Bu proje, **gerçek bir problemi çözer** — ama bu problem bir "must have" (painkiller) değil, "nice to have" (vitamin) kategorisindedir. Tıp öğrencilerinin klinik akıl yürütme pratiği yapabilecekleri **Türkçe, ücretsiz, evden erişilebilir** bir araç boşluğu mevcut. Mevcut alternatifler ya ezber odaklıdır (Anki), ya İngilizcedir (Osmosis, AMBOSS), ya fiziksel simülasyon merkezleriyle sınırlıdır (OSCE/SimMan), ya da milyarlarca liralık donanım gerektirir.

**Problem gerçek. Pazar küçük ama erişilebilir. Rekabet zayıf (özellikle Türkçe'de). Ancak proje, hedefiyle uyumsuz bir çelişki taşıyor:** "yapabilir miyim" kişisel öğrenme projesi olarak başlatılıyor, ama ürün değeri ancak öğrencilerin gerçekten kullanmasıyla ortaya çıkıyor — yani sınanabilirlik için yine de dağıtım ve feedback döngüsü gerekiyor.

**Verdict: CONDITIONAL GO** — tek koşulla: "yapabilir miyim" çerçevesi, MVP'yi 5 vaka + 5 öğrenciye gösterme ile bitirilmeli. Daha geniş ölçek bu projenin scope'u dışındadır ve yapılmamalıdır.

---

## 1. Problem-Solution Fit

### 1.1 Problem nedir?

Tıp öğrencileri **klinik akıl yürütme** (clinical reasoning) becerisini geliştirmek için pratik yapmak zorundadır. Bu beceri; doğru anamnez sorularını sorma, uygun testleri doğru sırada isteme, red flag belirtilerini atlama-mama ve ayırıcı tanı kurma yeteneğidir. WHO ve tıp eğitimi literatürü, yüksek-fidelity simülasyonun teknik ve teknik-olmayan beceri edinimini anlamlı şekilde artırdığını göstermektedir (Wikipedia/Medical simulation, Cheng et al. 2014 meta-analizi).

Problem şu: **Türkiye'de bir tıp öğrencisi, bir vaka üzerinde serbestçe "soru sor → test iste → sonuç gör → tanı koy" döngüsünü evinden, ücretsiz, Türkçe, tekrar tekrar yapabileceği dijital bir araca sahip değildir.**

### 1.2 Mevcut alternatifler neyi YAPAMIYOR?

| Alternatif | Ne yapar | Ne yapamaz (bu projenin boşluğu) |
|------------|----------|----------------------------------|
| **OSCE simülasyon merkezleri** | Fiziksel manken + standart hasta ile gerçekçi pratik (üniversitelerde CSSC'ler) | Evden erişilemez · Sınırlı süre (sınav öncesi birkaç seans) · Tekrar edilemez · Sayıca sınırlı vaka · Erişim eşitsizliği (her fakülte değil) |
| **Vaka kitapları** (Harrison'dan ülke vaka serileri) | Yüzlerce vaka + tanı açıklaması | **Etkileşimsiz** — öğrenci pasif okur · "Soru sor→cevap al" döngüsü yok · Test isteme pratiği yok · Geri bildirim yok · Ezber odaklı |
| **Medscape** | Referans + haber + drug reference | Eğitim aracı değil · Vaka pratiği yok · İngilizce · Tanı destek referansı |
| **UpToDate** | Klinik karar destek referansı · Kanıt tabanlı | $500+/yıllık · Referans aracı, pratik aracı değil · Öğrenci için pahalı · İngilizce |
| **Anki** | Spaced repetition flashcard · Ezber | ABD'de tıp öğrencilerinin %86.2'si kullanıyor (2024 çalışması) · **Ezber odaklı, akıl yürütme değil** · AnKing deck 300k+ indirme · Test isteme/karar zinciri pratiği yok · Türkçe medikal içerik zayıf |
| **Osmosis / AMBOSS / Lecturio** | Video + QBank + USMLE hazırlık | İngilizce · ABD merkezli içerik · Türk klinik pratiğine uyarlanmamış · $20-50/ay · Vaka simülasyonu (chat-tabanlı) sınırlı |

**Boşluk tespiti:** Türkçe + etkileşimli + serbest metinle soru sorma + test isteme pratiği + rubric-tabanlı geri bildirim kombinasyonu, mevcut hiçbir araçta tam olarak yok. Bu **gerçek bir product gap**.

### 1.3 Bu vitamin mi, painkiller mi?

**Dürüst cevap: Vitamin.** Acı seviyesi (pain level) orta-düşük:
- Öğrenci bu olmadan mezun oluyor, sınava giriyor, pratisyner oluyor.
- Alternatifler (vaka kitabı, Anki, OSCE) birlikte kullanıldığında "idare ediyor".
- Acı seviyesi yüksek olsaydı, öğrenciler şu an bir çözüm arıyor olurdu ve pazarda biri bunu zaten yapmış olurdu.

**Ama bu, yapılmamalı anlamına gelmez.** Vitaminler de değerlidir — özellikle kişisel öğrenme projesi bağlamında. Önemli olan, vitamin olduğunu bilmek ve pazarlama iddiasını buna göre ayarlamaktır.

### 1.4 Çözüm-Problem uyumu

Projenin seçtiği çözüm (rubric-tabanlı değerlendirme + Türkçe NLP normalizasyon + 5 vaka), problemle **uyumlu**. MVP raporundaki yaklaşım doğru: "Yüksek doğrulukta serbest üretim değil; açıklanabilir, kontrollü ve eğitim değeri yüksek bir değerlendirme deneyimi." Bu, LLM bütçesi ($10/ay) ve tek geliştirici kısıtlarıyla uyumlu, akıllıca bir scope seçimi.

**Tehlikeli kısım:** "Öğrenci kan/MR/röntgen istediğinde ilgili veri göster" esnek MVP tanımı, scope creep riskini taşıyor. 5 hastalık sabit kalmalı; aksi halde tek kişiyi boğar.

---

## 2. SWOT Analizi

### Strengths (Güçlü Yönler)

| Güç | Kanıt/Dayanak |
|-----|---------------|
| **Net ürün boşluğu** — Türkçe + etkileşimli klinik simülasyon kombinsayonu mevcut değil | Yukarıdaki alternatif tablosu |
| **Akıllıca scope sınırı** — 5 vaka, rubric-tabanlı, deterministik puanlama | MVP raporu uyumlu; LLM bütçesini korur |
| **Düşük maliyet** — $0-10/ay base | Teknoloji mimari raporu: Vercel+Supabase+Gemini Flash free tier = $0 |
| **AI-assisted tek geliştirici** — modern tooling (Cursor/Copilot) Next.js'i en iyi bilir | Teknoloji raporu stack seçimi |
| **Eğitim değerini puanlamadan alan yaklaşım** — "tanı doğruluğu" değil "klinik yaklaşım kalitesi" | Literatürle uyumlu (CORD, debriefing framework) |
| **Türkçe medikal NLP boşluğu** — Türkçe BERT modelleri var ama kullanılmıyor; synonym katmanı pratik %95+ yakalar | MVP raporu + mevcut Türkçe medikal NER çalışmaları |

### Weaknesses (Zayıf Yönler) — DÜRÜST

| Zayıflık | Etki |
|----------|------|
| **Tek geliştirici + AI-assisted = tıp uzmanlığı yok** | Rubric'ler uzman onayı olmadan yazılırsa, "yanlış eğitim" riski → öğrenciye zarar → itibar kaybı. **Bu en kritik zayıflık.** |
| **"Yapabilir miyim" çerçevesi ile ürün değer çelişkisi** | Ürün değeri öğrenci kullanımından gelir; ama başarı kriteri "birkaç feedback". Bu iki hedef farklı dağıtım/strateji gerektirir |
| **Tıp içeriği doğrulama yükü** | 5 hastalık × rubric × test sonuç seti = uzman gözden geçirme gerekir; bu zaman/maliyet tek kişi için ciddi |
| **Türkçe medikal veri seti yok** | MVP raporu bunu itiraf ediyor; uluslararası veri setleri (UCI, Kaggle) Türk popülasyonunu yansıtmıyor |
| **Serbest metin NLP sınırları** | Fuzzy + LLM kaçış %95 yakalar ama %5 hatalı puanlama → öğrenci "sistem haksızlık yaptı" hissi → churn |
| **Görüntüleme kalitesi** — plain `<img>` + Tailwind zoom | Röntgen/MR'de klinik detay öğrenilemez; radyoloji eğitimi zayıf kalır |
| **LLM free tier rate limit** — Gemini Flash 15 req/dk, 1500/gün | Yoğun kullanımda (örn. sınava 3 gün kala) limit aşımı → kullanıcı deneyimi bozulur |
| **Sürdürülebilirlik yok** — tek kişi, $10/ay, vakalar elle yazılır | Yeni vaka eklemek zor; ölçeklenmez |

### Opportunities (Fırsatlar)

| Fırsat | Dayanak |
|--------|---------|
| **Türkiye'de tıp öğrencisi sayısı ciddi** — tahmini 60,000-90,000 (6 yıllık program × ~15-18k/yıllık giriş) | YÖK: 208 üniversite, 6M+ öğrenci total. Tıp fakülteleri ~120+ (devlet+vakı). **Not: kesin sayı YÖK istatistik'ten doğrulanamadı (JS gerekli) — varsayım olarak işaretle** |
| **TUS (Tıpta Uzmanlık Sınavı) baskısı** — her yıl ~15-20k mezun TUS'a giriyor | Klinik vaka pratiği TUS için değerli; motive kullanıcı tabanı |
| **YÖK 2030 Yol Haritası** — dijital öğrenme vurgusu | Kurumsal rüzgar arkada |
| **Dijital sağlık eğitimine global trend** — WHO yüksek-fidelity simülasyon öneriyor | Wikipedia/Medical simulation kaynağı |
| **LLM'lerin Türkçe'si hızla iyileşiyor** — 2024-2026 döneminde Türkçe LLM kalitesi önemli artış | NLP katmanı zamanla "bedava" iyileşir |
| **Tıp öğrenci forumları aktif** — Eksi Sözlük, Reddit r/medicalschoolEU, Telegram grupları | Düşük maliyetli dağıtım kanalı |
| **Üniversite tıp kulüpleri** — öğrenci dernekleri içerik paylaşımına açık | GTM için ücretsiz kanal |

### Threats (Tehditler)

| Tehdit | Olasılık |
|--------|----------|
| **Mevcut oyuncular Türkçeleşebilir** — Osmosis/AMBOSS localized sürüm çıkarsa, vitamin ürününü kolayca ezer | Orta (yerel pazara öncelik vermiyorlar şu an) |
| **Türk medtech startup'ı aynı şeyi yapabilir** — yatırım alan biri bu boşluğu görür | Düşük-Orta (Türkçe klinik AI yatırım alanı sınırlı) |
| **Yanlış tıbbi içerik → itibar/ yasal risk** — "sistem yanlış eğitim verdi" öğrenci şikayeti | Orta-Yüksek (klinik güvenlik hassas) |
| **LLM fiyatlandırması değişebilir** — free tier kalkarsa $10/ay yetmez | Düşük (free tier'lar kalıcı trend) |
| **Üniversiteler OSCE'i dijitalleştirirse** — kurumsal dijital simülasyon alırlarsa, bireysel pazar küçülür | Düşük (üniversiteler yavaş, donanım yatırımı var) |
| **Kullanıcı beklentisi yükselir** — "ChatGPT zaten hasta simulasyonu yapıyor" algısı | Orta (ChatGPT Türkçe klinik simülasyonu kabaca yapabiliyor — ama rubric/feedback yok) |

> **ChatGPT tehdidine not:** Bir öğrenci ChatGPT'ye "bana pnömoni hastası simüle et" diyebilir. ChatGPT hasta yanıtı verir. **Ama:** puanlama yok, rubric yok, "red flag atlattın" feedback yok, test sonuçları gerçekçi değil. Yani ChatGPT bu projenin değer önerisinin %40'ını karşılıyor — bu, projenin değer önerisini **%40 daraltıyor**. Bu ciddi bir tehdit.

---

## 3. Pazar Analizi (TAM/SAM/SOM)

### Veri kısıtları hakkında dürüst not

YÖK İstatistik portalı JavaScript gerektirdiği için tarayıcı ile doğrudan çekilemedi. Aşağıdaki rakamlar **tahmin + akıl yürütme** ile üretilmiştir ve varsayım olarak işaretlenmelidir. Doğrulama için `istatistik.yok.gov.tr`'den "Tıp Fakülteleri Öğrenci Sayıları" raporu çekilmelidir.

### Türkiye tıp eğitimi bağlamı

- **YÖK (2026):** 208 üniversite, 6M+ öğrenci, 185,000+ öğretim elemanı
- **Tıp fakültesi sayısı:** ~120+ (devlet ~70, vakıf ~50) — **varsayım**
- **Yıllık tıp öğrenci alımı:** ~15,000-18,000 (ÖSYM verileri, son yıllar) — **varsayım**
- **Tıp eğitimi süresi:** 6 yıl → toplam öğrenci havuzu **~60,000-90,000** — **varsayım**
- **Yıllık mezun:** ~15,000 → TUS'a giren ~15-20k
- **Türkiye'de hekim sayısı:** ~190,000 (TTB verileri) — aktif pratisyener + uzman

### TAM (Total Addressable Market)

Bu ürünün tüm potansiyel kullanıcı tabanı:
- Tıp öğrencileri (tüm seviyeler): ~70,000
- TUS hazırlık mezunları: +20,000/yıl
- Yabancı dil hazırlık (Türkiye'de okuyan) tıp öğrencileri: küçük
- **Tahmini TAM: ~90,000 kullanıcı** (tek seferlik, ücretsiz ürün için)

Parasal TAM (eğer $5/ay freemium olsaydı): ~$5.4M/yıl. **Ama bu proje ücretsiz**, parasal TAM geçerli değil.

### SAM (Serviceable Addressable Market)

Türkçe, web-tabanlı, ücretsiz araca erişebilecek:
- 3. sınıf ve üzeri öğrenciler (klinik döneme geçmiş): ~50,000
- İnternet erişimi + dijital工具 kullanma eğilimi olanlar: %70 → ~35,000
- **SAM: ~35,000 kullanıcı**

### SOM (Serviceable Obtainable Market) — bu proje için

Bu bir kişisel proje, pazarlama bütçesi yok. SOM gerçekçi olmalı:

| Aşama | Kullanıcı | Dayanak |
|-------|-----------|---------|
| **Alpha (4-8 hafta)** | 3-5 öğrenci (arkadaş/kulüp) | "OK continue" feedback hedefi |
| **Beta (3-6 ay)** | 20-50 öğrenci | Forum + kulüp paylaşımı |
| **Yıl 1** | 100-300 kullanıcı | Ağızdan ağza + içerik döngüsü |
| **Yıl 3** | 500-2,000 kullanıcı | Üniversite kulüpleri + TUS dönemi spike |

**SOM Yıl 1-3: 300-2,000 aktif kullanıcı** — bu kişisel proje için başarılı bir sonuçtur; ticari startup için başarısızlık.

### Pazar büyüme oranı

- **Klinik simülasyon pazarı (global):** ~%15-18 CAGR (Grand View Research, MarketsandMarkets tahminleri — doğrudan erişilemedi, sektör konsensüsü)
- **Türkiye tıp fakültesi sayısı:** Son 10 yılda vakıf fakülteleri ile artış
- **Dijital sağlık eğitimi:** YÖK 2030 yol haritası ile pozitif rüzgar

### Temel Trendler

1. **AI-asisted tıp eğitimi** — LLM'ler klinik vaka üretmede kullanılıyor (Kahun, ReelDx AI)
2. **Spaced repetition + aktif recall** — Anki'nin ABD'de %86.2 penetrasyonu kanıtlıyor (2024)
3. **Türkçe dijital içerik patlaması** — Türkçe LLM'ler, Türkçe YouTube eğitimi
4. **EQ (EQ-5D) ve yetkinlik-tabanlı tıp eğitimi** — YÖK'ün outcome-based eğitime kayması
5. **Mobil-first** — öğrenciler telefondan çalışıyor; masaüstü 3-panel tasarım mobilde sekmeye düşmeli

---

## 4. Rekabet Peyzajı

### Direkt rekabet (aynı problem)

| Rakip | Tip | Yaklaşım | Güçlü | Zayıf | Fiyat | Bizim avantajımız |
|-------|-----|----------|-------|-------|-------|-------------------|
| **OSCE/SimMan (Laerdal)** | Fiziksel sim | Manik + standart hasta | Yüksek fidelity · Üniversite onaylı · Gerçekçi | $50k-100k+ donanım · Evden erişilemez · Sınırlı süre · Üniversiteye bağımlı | Üniversite alımı | Ücretsiz, evden, tekrarlanabilir, sınırsız vaka |
| **vSim (Laerdal)** | Dijital sim | Virtual manikin | Laerdal marka · Üniversite entegre | İngilizce · Pahalı lisans · Klinik akıl yürütme < manuel beceri | Kurumsal lisans | Türkçe, bireysel, akıl yürütme odaklı |
| **Kahun** | AI sim | AI ile vaka üretimi + clinical reasoning | AI-powered · İngilizce pazar · Yatırımlı | İngilizce · US healthcare odak · Bireysel değil B2B | Kurumsal | Türkçe, B2C, eğitim rubric |
| **ReelDx** | Video vaka | Gerçek hasta videoları | Gerçek vakalar · Sınıf kullanımı | İngilizce · Kurumsal · Passif izleme | Kurumsal | Aktif etkileşim, Türkçe |

### Endirekt rekabet (alternatif yöntemler)

| Rakip | Yaklaşım | Güçlü | Zayıf | Fiyat | Bizim avantajımız |
|-------|----------|-------|-------|-------|-------------------|
| **Anki** | Flashcard + spaced repetition | ABD'de %86.2 penetrasyon · Ücretsiz · Türkçe deck var · AnKing 300k+ indirme | Ezber odaklı, akıl yürütme değil · Etkileşimsiz · Vaka pratiği yok | Ücretsiz (+$25 iOS) | Akıl yürütme + etkileşim + feedback |
| **Osmosis** | Video + QBank | Geniş içerik · USMLE odak · App iyi | İngilizce · $30-40/ay · Türk pratiğine uyarlanmamış · Vaka sim sınırlı | $30-40/ay | Türkçe, ücretsiz, klinik vaka sim |
| **AMBOSS** | QBank + library | Klinik reasoning soruları · Alman menşeli · Kaliteli | İngilizce · $20-50/ay · Soru-cevap, serbest sim değil | $20-50/ay | Serbest metin, Türkçe, ücretsiz |
| **Vaka kitapları** (Harrison, ülke serileri) | Statik vaka | Yüzlerce vaka · Uzman yazdı · Mezuniyet sonrası da işe yarar | Pasif okuma · Test pratiği yok · Feedback yok · Tekrar zor | Kitap bedeli | Etkileşim + puanlama + tekrar |
| **ChatGPT/Claude (genel LLM)** | Prompt ile hasta sim | Ücretsiz/ucuz · Türkçe · Esnek | Rubric yok · Puanlama yok · Red flag feedback yok · Test sonuçları gerçekçi değil · Öğretmen yok | $0-20/ay | Yapılandırılmış değerlendirme + uzman rubric |

### Türkçe tıp eğitimi pazarındaki özel durum

| Türkçe rakip | Odak | Klinik simülasyon var mı? |
|--------------|------|---------------------------|
| **Doktoron, TUSDEX, Medikod, Alfa TUS, e-TUS** | TUS hazırlık (TUS soru bankaları) | **Hayır** — test soruları var, serbest vaka sim yok |
| **Türk Tabipleri Birliği (KSTU)** | Sürekli tıp eğitimi | **Hayır** — seminer/kongre odaklı |
| **Üniversite CSSC'leri** | OSCE fiziksel sim | Evet ama fiziksel, evden değil |

**Türkçe dijital klinik simülasyon alanında doğrudan rakip bulunamadı.** Bu, ya bir boşluk (fırsat) ya da "kimse yapmıyor çünkü değer yok" sinyali. Aşağıdaki analiz bunun **boşluk** olduğuna işaret ediyor: rakipler TUS soru bankasında parayı görüyor, klinik simülasyonu yatırım gerektirdiği için kaçınıyorlar.

### Rekabet pozisyonumuz

```
                   Ezber odaklı  ←──────────────→  Akıl yürütme odaklı
                         │                                │
        İngilizce ───────┼──── Anki ── Osmosis ── AMBOSS ──┼── Kahun
                         │                                │
        Türkçe    ─── TUS QBanks ──────────────────── ★ tıp_ai ──→ (boşluk)
                         │                                │
                         └────────────────────────────────┘
                       Statik              ←→          Etkileşimli
```

**Pozisyon:** "Türkçe tek etkileşimli klinik akıl yürütme pratiği aracı." Bu pozisyon savunulabilir — ama vitamin olduğu için kullanıcıyı getirmek için güçlü bir "neden" gerekir.

---

## 5. Risk Matrisi

| Risk | Kategori | Olasılık (1-5) | Etki (1-5) | Skor | Mitigasyon |
|------|----------|----------------|------------|------|------------|
| **Yanlış tıbbi içerik** — rubric uzman onaysız, öğrenciye yanlış bilgi | Teknik/Klinik | 3 | 5 | **15** | Her rubric'i 1 uzman hekime review'a gönder; "eğitim amaçlı, tanı aracı değil" disclaimer; kaynak linkleri |
| **ChatGPT alternatifi yeterli algısı** — kullanıcı "ChatGPT zaten yapıyor" der, kullanmaz | Pazar | 4 | 3 | **12** | Değer önerisini ChatGPT'de olmayan şeylere odakla: rubric puanlama, red flag feedback, test sonuç seti, ilerleme takibi |
| **Tek kişi scope creep** — 5 vaka → 10 vaka → 20 vaka, geliştirme bataklığa | Execution | 4 | 4 | **16** | MVP'de 5 vaka HARD LIMIT; vaka ekleme ancak kullanıcı talebi + uzman içeriği varsa |
| **NLP puanlama haksızlık algısı** — synonym eşleşmeyince "yanlış puanladın" | Teknik | 4 | 3 | **12** | Her puan için gerekçe göster ("X sorusu kriter Y'ye uydu"); fuzzy eşiği düşük tut; "önerilen eşanlamlı" chip'leri göster |
| **Türkçe medikal veri seti yok** — UCI/Kaggle Amerikan popülasyonu | Teknik | 3 | 2 | **6** | Veri setlerini "örnek" olarak sun, "Türk popülasyonunu yansıtmaz" notu; ileride Türk verisi ile güncelle |
| **LLM free tier limit aşımı** — sınav dönemi spike | Teknik | 3 | 3 | **9** | Önce rule-based, LLM sadece kaçış; rate limit watcher; yoğun dönemde "yarın tekrar dene" mesajı |
| **Kullanıcı gelmiyor** — forum paylaşımlarına rağmen traction yok | Pazar | 3 | 4 | **12** | Önce 3-5 tanıdık öğrenciye göster; feedback almadan geniş dağıtım yapma |
| **Üniversiteye erişim engeli** — fakülte "bu onaysız" diyebilir | Kurumsal | 2 | 3 | **6** | "Kişisel öğrenme projesi" vurgusu; üniversite onayı iddiasında bulunma |
| **Görüntüleme kalitesi düşük** — radyoloji öğrenilemez | Ürün | 3 | 2 | **6** | MVP'de radyolojiyi ikincil tut; "etiketli görüntü" (annotation) ile işaretli röntgen göster |
| **Mevcudiyet sürdürülemez** — tek kişi, vakalar elle | İş | 5 | 3 | **15** | Açık kaynak (GitHub) ile topluluk katkısı; "vaka şablonu" ile uzmanların vaka eklemesine izin ver (v2) |
| **Yasal/sorumluluk** — "yanlış tanı öğrettin" tazminat | Yasal | 2 | 5 | **10** | Kullanım şartları: "eğitim amaçlı, klinik karar desteği değil"; anonim kullanım; PHİ işleme |

### En yüksek 3 risk (önceliklendirme)

1. **Scope creep (16)** — Hard limit zorunlu
2. **Yanlış tıbbi içerik (15)** — Uzman review'ı olmazsa yapılmamalı
3. **Sürdürülemezlik (15)** — Kişisel proje olarak kalmalı, ticari ölçek hayali olmamalı

---

## 6. Go-to-Market Stratejisi

### 6.1 Temel çerçeve: Kişisel proje, "yapabilir miyim" testi

Bu bir startup GTM'i değil. **Düşük maliyetli, yüksek özgünlükte feedback toplama** stratejisi uygundur. Amaç: ürün değerini sınamak, "OK continue" feedback'i almak, öğrenmek.

### 6.2 Hedef Segmentler (öncelik sırası)

| Segment | Boyut | Neden önce? | Kanal |
|---------|-------|-------------|-------|
| **1. Tanıdık tıp öğrencileri** (3-5 kişi) | Mikro | Güven, dürüst feedback, hızlı iterasyon | Doğrudan iletişim |
| **2. Üniversite tıp öğrenci kulüpleri** | Her fakültede 1-2 | Hazır topluluk, organik paylaşım, düşük maliyet | Kulüp başkanına DM, kulüp WhatsApp/Telegram grubu |
| **3. Tıp forumları ve online topluluklar** | Orta | Geniş erişim, anonim feedback | Eksi Sözlük (tıp başlıkları), Reddit r/medicalschoolEU, Türk tıp Telegram grupları |
| **4. TUS hazırlık topluluğu** | ~20k/yıl | Yüksek motivasyon, ödeme isteği olabilir | TUS forumları, TUS Telegram grupları (dikkat: ticari algı yaratma) |
| **5. Yabancı dilde öğrenim gören Türk öğrenciler** (az) | Küçük | Türkçe öğrenim materyali açlığı | Üniversite uluslararası öğrenci grupları |

### 6.3 Pozisyonlama (one-liner)

> **"Türkçe tek etkileşimli klinik akıl yürütme pratiği aracı — vaka kitabı pasif okuma, Anki ezber; tıp_ai seni sorgulatır."**

Veya daha resmi:

> **"Biz tıp öğrencisine 'doğru tanıyı' değil, 'doğru klinik yaklaşımı' öğretiriz — soru sordun mu, doğru testi mi istedin, red flag'i atlattın mı?"**

### 6.4 Kanallar ve taktikler

#### Faz 1 — Alpha (0-8 hafta)

| Taktik | Maliyet | Hedef |
|--------|---------|-------|
| 3-5 tanıdık öğrenciye birebir demo | $0 | İlk "OK continue" feedback |
| Kısa Typeform/Google Form: "Hangi vaka zor? Hangi feedback eksik?" | $0 | Yapılandırılmış feedback |
| 1 hekime (uzman/pratisyener tanıdık) rubric review | $0 (iyilik) | Tıbbi doğrulama |
| Haftalık 15 dk "ne öğrendim" notu (kişisel) | $0 | Süreç öğrenme |

**Başarı metriği:** 3 öğrenci "devam et" derse → GO to Beta.

#### Faz 2 — Beta (2-6 ay)

| Taktik | Maliyet | Hedef |
|--------|---------|-------|
| Üniversite tıp kulüplerine DM: "5 dakika deneyin, feedback verin" | $0 | 5-10 fakültede tanınma |
| Eksi Sözlük "tıp_ai" başlığı açma (veya var olan tıp başlığında mention) | $0 | Organik keşif |
| Reddit r/medicalschoolEU, r/Turkey — "Türkçe klinik sim aracı yaptım" post | $0 | Uluslararası Türk öğrenci |
| Hekim tanıdıklara: "öğrencilerinize önerebilir misiniz?" | $0 | Hekim → öğrenci kanalı |
| GitHub README (eğer açık kaynak) + Türkçe demo videosu | $0 | Şeffaflık + güven |
| LinkedIn post: "kişisel proje, Türkçe klinik sim" | $0 | Profesyonel görünürlük |

**Başarı metriği:** 20-50 kullanıcı, en az 5'i "tekrar kullandım" derse → GO to v1.

#### Faz 3 — Sürdürme (6+ ay, opsiyonel)

| Taktik | Maliyet | Hedef |
|--------|---------|-------|
| Üniversite kulüpleri ile "vaka workshop"u (online) | $0 | Derin kullanım |
| Aylık newsletter: "yeni vaka eklendi" (eğer vaka eklenirse) | $0 (Mailchimp free) | Retention |
| TUS döneminde (Mayıs/Kasım) organik push | $0 | Sezonsal spike |
| Topluluk katkısı: GitHub PR ile vaka şablonu | $0 | Ölçeklenebilir vaka |

### 6.5 Fiyatlandırma Stratejisi

**Öneri: Tamamen ücretsiz (Faz 1-2).**

Gerekçe:
- Kişisel "yapabilir miyim" projesi — para kazanma hedefi yok
- Tıp öğrencisi parası sınırlı; ücretsiz en güçlü farklılaştırıcı
- $10/ay bütçe zaten sadece LLM; sunucu ücretsiz
- Ödeme entegrasyonu (Stripe/Iyzico) tek kişi için ek operasyonel yük
- KVKK/ödeme verisi güvenlik yükü ekler

**İleride opsiyonel (v2+):** "Vaka eklemek isteyen uzmanlar için" gönüllü tip jar (Buy Me a Coffee) — LLM maliyetini karşılar. **Ticari abonelik bu projenin scope'u dışında.**

### 6.6 Launch Timeline

| Faz | Süre | Hedef | Başarı metriği |
|-----|------|-------|----------------|
| **Alpha — İç test** | 4-8 hafta | 5 vaka çalışır, 3-5 öğrenci dener | 3 öğrenci "devam et" feedback |
| **Beta — Kapalı topluluk** | 2-3 ay | 20-50 kullanıcı, kulüp erişimi | 5+ kullanıcı 2. kez giriş yaptı |
| **v1 — Açık erişim** | 3-6 ay | Forum/README herkese açık | 100+ kullanıcı, 10+ hekim önerdi |
| **Sürdürme** | Sürekli | Topluluk katkısı + dönemsel push | Aylık 50 aktif kullanıcı |

---

## 7. "Yapabilir miyim" Sertifikasyon Kriterleri

> Bu projenin başarı/hayatta kalma kararı için önerilen açık, ölçülebilir kriterler. Bir sonraki faza geçmek için **tümü** karşılanmalıdır.

### 7.1 Teknik "yapabilir miyim" (geliştirme kapasitesi)

| # | Kriter | Ölçüt | Doğrulama |
|---|--------|-------|-----------|
| T1 | **5 vaka + rubric deploy edildi** | 5 hastalığın her biri: vaka JSON + rubric JSON + test sonuç seti + en az 1 görüntü | Canlı URL'de vaka açılabiliyor |
| T2 | **Türkçe NLP %80+ yakalıyor** | "hemogram", "tam kan", "CBC", "kan sayımı" → CBC | 20 varyasyon testi, ≥16'sı doğru eşleşti |
| T3 | **E2E akış çalışıyor** | Vaka aç → soru sor → cevap al → test iste → sonuç → tanı → puan | Playwright smoke test PASS |
| T4 | **$10/ay bütçe aşılmadı** | Aylık LLM + sunucu harcaması ≤$10 | Vercel/Supabase/Gemini dashboard |
| T5 | **Mobilde kullanılabilir** | Telefon ekranında vaka akışı bozulmadan çalışıyor | Gerçek cihaz testi |

### 7.2 Klinik "doğru mu yapıyorum" (içerik kalitesi)

| # | Kriter | Ölçüt | Doğrulama |
|---|--------|-------|-----------|
| K1 | **Her rubric 1 uzman hekim tarafından review edildi** | Uzman (uzmanlık eğitimi görmüş veya pratisyener 5+ yıl) rubric'i onayladı | Review kaydı (e-posta/not) |
| K2 | **"Eğitim amaçlı, tanı aracı değil" disclaimer** | Ana sayfa + vaka açılışında uyarı | Ekran görüntüsü |
| K3 | **Her test sonucuna kaynak linki** | UCI/Kaggle/UpToDate referansı | Veri kaynak JSON'unda |
| K4 | **Red flag atlasa -3 puan** | Kritik hata için negatif skor mekanizması çalışıyor | Unit test |
| K5 | **Her vakada "ideal yaklaşım" örneği** | Vaka sonu feedback'inde doğru akış gösteriliyor | Ekran görüntüsü |

### 7.3 Kullanıcı "değer mi" (ürün-market uyumu)

| # | Kriter | Ölçüt | Doğrulama |
|---|--------|-------|-----------|
| U1 | **3 öğrenci "OK continue" der** | "Devam etmelisin" ifadesini 3 farklı öğrenciden aldın | Feedback form/kayıt |
| U2 | **1 öğrenci 2. kez giriş yaptı** | Aynı kullanıcı farklı günlerde 2+ vaka açtı | Supabase log |
| U3 | **1 hekim "öğrencilere önerebilirim" der** | Uzman/pratisyener öneri ifadesi | E-posta/mesaj |
| U4 | **"ChatGPT'den daha faydalı" ifadesi** | En az 1 kullanıcı bu karşılaştırmayı yapıp tıp_ai'yi tercih etti | Feedback form |
| U5 | **Net Promoter Score ≥ 0** | "Tavsiye eder misin?" 1-10; ≥7 verenler ≥6 verenleri geçiyor | Anket |

### 7.4 Süreç "öğrendim mi" (kişisel gelişim)

| # | Kriter | Ölçüt | Doğrulama |
|---|--------|-------|-----------|
| S1 | **Modüler monolit mimarisi kuruldu** | case-engine, rubric-engine, nlp, scoring modülleri ayrı | Kod yapısı |
| S2 | **3-katman NLP (dict+fuzzy+LLM) çalışıyor** | Fallback zinciri uygulanıyor | Unit test |
| S3 | **KVKK uyumu temel seviye** | Anonim kullanım, RLS, açık rıza | Supabase RLS + kullanım şartları |
| S4 | **E2E test + lint CI** | GitHub Actions her push'ta test | CI yeşil |
| S5 | **"Ne öğrendim" retrospektif yazıldı** | Proje sonu kişisel öğrenme notu | Markdown dosyası |

### 7.5 Sertifikasyon mantığı

- **T1-T5 + K1-K5 + U1-U3 karşılanırsa → SERTİFİKALI "yapabilirim"**
- Tüm U kriterleri sağlanmazsa → "yapabilir miyim" teknik olarak evet ama ürün olarak hayır → dur ve öğren
- K1 (uzman review) sağlanmazsa → **tehlikeli, devam etme** (yanlış tıp eğitimi etik dışı)

---

## 8. Öneri (Recommendation)

### Verdict: **CONDITIONAL GO**

### Gerekçe (2-3 cümle)

Problem gerçek ve Türkçe pazarda çözülmemiş bir boşluk mevcut — ama vitamin kategorisinde. Kişisel "yapabilir miyim" projesi olarak, **5 vaka + 5 öğrenci + 1 hekim review** üçlüsüyle sonlanacak şekilde yapılandırılmalıdır. Ticari ölçek, yatırım, geniş kullanıcı tabanı bu projenin scope'u dışındadır ve başarı kriteri olarak konulmamalıdır — bu, hem geliştiriciyi boğar hem de dürüst olmayan bir beklenti yaratır.

### Koşullar (devam etmek için)

1. **K1 koşulu zorunlu:** En az 1 uzman hekim rubric'leri review etmeden Beta'ya geçilmesin. Tıbbi içerik uzman onaysız yayımlanmamalı.
2. **5 vaka hard limit:** Faz 1'de 5 vakadan fazlası yapılmamalı. Yeni vaka yalnızca Faz 2'de kullanıcı talebi + uzman içeriği varsa eklenmeli.
3. **Scope creep alarmı:** "Şu özelliği de ekleyelim" her geldiğinde, "Bu 5 vaka + puanlama + feedback döngüsünü bozar mı?" sorusu sorulmalı.
4. **Ücretsiz kalacak:** Ticari beklenti kurulmamalı. Bütçe $10/ay ile sınırlı.
5. **Yasal koruma:** Kullanım şartları + "eğitim amaçlı" disclaimer ilk günden itibaren görünür olmalı.

### Temel Varsayımlar (invalidation riski olan)

| Varsayım | Risk | Doğrulama yöntemi |
|----------|------|-------------------|
| Türkiye'de ~70,000 tıp öğrencisi var | Orta | YÖK İstatistik'ten "Tıp Fakültesi Öğrenci Sayıları" raporu çekilmeli |
| Türkçe klinik simülasyon dijital aracı yok | Düşük | Detaylı pazar taraması (Product Hunt, App Store TR, GitHub Türkçe tıp projeleri) |
| Tıp öğrencileri klinik vaka pratiği için motivasyonu var | Orta | 5 öğrenciye "böyle bir araç olsa kullanır mıydın?" anketi (Faz 1 öncesi) |
| Uzman hekim rubric review'ı ücretsiz/vakarla yapar | Orta-Yüksek | 1-2 hekime önceden sorulmalı; yapmazlarsa proje kritik risk altında |
| $10/ay LLM bütçesi 50 kullanıcıya yeter | Düşük | Gemini Flash free tier + rule-based fallback → 50 kullanıcı × 10 vaka = ~500 istek/ay, limit içinde |
| ChatGPT bu projeyi öldürmez | Orta | 5 öğrenciye "ChatGPT ile vaka sim yaptıktan sonra tıp_ai'yi de deneyip karşılaştır" testi |

### En kritik uyarı

**K1 koşulu (uzman hekim review) başarısız olursa, bu proje yapılmamalıdır.** Yanlış tıbbi eğitim, "yapabilir miyim" kişisel başarısından daha büyük bir etik sorundur. Bir öğrenciye yanlış red flag öğretmek, gerçek bir hastada zarar anlamına gelebilir. Bu, öğrenme projesi olsa bile göz ardı edilemez.

---

## Ek: Kaynaklar ve Veri Notları

- **YÖK (2026):** 208 üniversite, 6M+ öğrenci, 185,000+ öğretim elemanı — `yok.gov.tr` ana sayfa (doğrulandı)
- **Wikipedia/Medical simulation:** Debriefing framework (PEARLS, GAS, Diamond), experiential learning, CORD önerileri, WHO yüksek-fidelity simülasyon önerisi, AAMC verileri (CSSC'lerde ortalama 27 oda)
- **Wikipedia/Anki:** ABD tıp öğrencilerinde %86.2 Anki kullanımı (2024 çalışması), AnKing deck 300k+ indirme, USMLE Step 1 ile pozitif korelasyon, 1,700 kart = +1 puan
- **YÖK İstatistik (istatistik.yok.gov.tr):** JS gerektirdiği için doğrudan erişilemedi — tıp fakültesi/öğrenci sayıları **tahmin** olarak sunuldu, doğrulama gerekli
- **Medical simulation pazar büyümesi (~%15-18 CAGR):** Grand View Research/MarketsandMarkets konsensüs tahmini — doğrudan erişilemedi (403), sektör consensus'una dayanıyor
- **Proje iç bağlam:** `MVP Rapor.md` ve `reports/tech-architecture-tip-ai.md` (mevcut proje dosyaları)

**Doğrulanması gereken varsayımların öncelik listesi:**
1. YÖK istatistik: Türkiye tıp fakültesi öğrenci sayısı (2024-2025)
2. Türkçe dijital klinik simülasyon aracı gerçekten yok mu (detaylı App Store TR + GitHub taraması)
3. 1-2 uzman hekimin rubric review yapma niyeti (Faz 1 öncesi doğrudan sorulmalı)
