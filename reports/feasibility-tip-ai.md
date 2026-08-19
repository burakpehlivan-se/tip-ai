# Fizibilite Değerlendirmesi: Türkçe Klinik Karar Simülasyon Sistemi (tıp_ai)

> **Rol**: Reality Checker — iyimserliği değil, çatlakları arar.
> **Girdi**: `MVP Rapor.md` + `reports/tech-architecture-tip-ai.md`
> **Constraint'ler**: Tek fullstack dev (AI-assisted) · $10/ay LLM + Colab · Zaman sınırı yok · 5 hastalık · 3-katmanlı değerlendirme · 3-panel frontend
> **Tarih**: 2026-07-09
> **Varsayılan tutum**: NEEDS WORK — üstesinden gelmek için ezici kanıt ister.

---

## 0. Özet Karar

| Boyut | Skor | Eğilim |
|---|---|---|
| Technical Feasibility | **2/3** | Yapılabilir, ama bir parça ispatlanmamış |
| Timeline Feasibility | **1/3** | Mevcut tahminler 2× iyimser |
| Cost Feasibility | **2/3** | Infra $0 doğru, ama gizli maliyetler bütçeyi deler |
| Operational Feasibility | **1/3** | Bus factor=1 + klinik doğrulama yok = sürdürülebilir değil |
| **TOPLAM** | **6/12** | **CONDITIONALLY FEASIBLE** |

**Net karar**: TEKNİK olarak yapılabilir. İKİ koşula bağlıdır:
1. **Scope KESİN olarak 1 hastalığa (Kalp) indirilmeli** — "yapabilir miyim" testi için.
2. **En az 1 doktor rubric doğrulaması sağlanmalı** — yoksa yanlış tıp öğretiyorsun, bu etik bir sorun.

Aksi halde proje "çalışır" ama eğitim değeri sorgulanabilir hale gelir. Çalışan ama yanlış öğreten bir tıp aracı, hiç olmamasından daha kötü.

---

## 1. Technical Feasibility: 2/3

| Kriter | Skor | Kanıt / Not |
|---|---|---|
| **Teknoloji Olgunluğu** | 3/3 | Next.js 14, Supabase, Gemini Flash, rapidfuzz — hepsi production-ready. Mimari dokümanı açıkça microservice/DICOM/LLM-in-loop tuzaklarını baştan reddetmiş. Doğru kararlar. |
| **Entegrasyon Karmaşıklığı** | 2/3 | 3 dış bağımlılık: Supabase (DB+storage), Gemini (NLP fallback), Colab (offline). Hepsi düşük risk. Supabase storage imzalı URL mantığı (24h) bir tuzak — örnekte "API route on-demand yeni imza" denmiş, bu her test görüntülemede bir DB yazma demek → maliyet değil ama latency ve karmaşıklık. |
| **Takım Kapasitesi** | 1/3 | **TEK KİŞİ**. AI-assisted kodu hızlandırır AMA **klinik yargıyı hızlandırmaz**. Rubric yazmak, hasta yanıtlarını tıbben tutarlı yazmak, abnormal aralıkları doğru girmek — bunlar LLM ile draftlanabilir ama doğrulanamaz. Bu projenin darboğazı kod değil, **içerik kalitesi**. |
| **Infra Karmaşıklığı** | 3/3 | Vercel + Supabase free tier. Tek deploy. Düşük. |
| **Veri Gereksinimleri** | 2/3 | Açık veri setleri var (UCI/Kaggle). AMA bunlar **eğitim vakası değil, sınıflandırma datası**. UCI Heart Disease satırı → gerçek bir hastanın özetlenmiş özellikleri. Bunu "eğitim vaka senaryosu"na çevirmek manuel mapping işi. Mimari dokümanı Tier C'de bunu kabul ediyor ama "mapping statik dosyalama, Colab'de" diyor — bu bir günden fazla iş. |
| **Güvenlik Gereksinimleri** | 3/3 | Sentetik vaka → PHI yok. KVKK "özel nitelikli kişisel veri" kapsamı dışında. Anonim session UUID. Bu proje için güvenlik en kolay boyut. Tek not: e-posta eklenirse (v1.1) KVKK bilgilendirme metni şart. |

**Teknik Assessment**: Mimari sağlam. Tuzaklar doğru tespit edilmiş. **İki ispatlanmamış parça var**:

1. **3-tier deterministik test üretimi** (Tier A statik → B generator → C dataset). Generator, her test için "normal + abnormal aralık" tablosu gerektirir. 20 test × 5 hastalık = **100 klinik referans tablosu**. Bunları LLM'a yazdırırsan halüsinasyon riski var (troponin cutoff 0.04 mü 0.4 mü? — yanlış = öğrenci yanlış öğrenir). Doğru yazmak için her test için referans aralık doğrulaması gerek. Bu mimarinin en riskli yeni parçası — **prototipi İLK yapılmalı**.

2. **Türkçe NLP 3-katman** (dictionary → fuzzy → LLM). "Fuzzy threshold 0.85 ile %95+ yakalar" iddiası **test edilmeden inanılmaz**. Türkçe agglutinatif: "Ağrıyı sordu" vs "Ağrısı var mı" vs "Acısı ne durumda" — fuzzy bunları aynı aksiyona bağlamayabilir. Kalibrasyon gerekir (s. Gizli Maliyetler).

**Yapılabilir mi?** Evet — tek hastalık + 3 vaka + statik test sonuçları ile. 5 hastalık + generator + dataset extraction → **çok daha zordur**, içerik kalitesi darboğazıdır.

---

## 2. Timeline Feasibility: 1/3

Mimari dokümanındaki tahmin: **M0 (1-2 hafta) + M1-M4 (4 hafta) = 6-8 hafta**.

Bu **Hofstadter's Law'a uymaz**. Gerçekçi ×1.5-2.0.

### Faz bazında tahmin (tek dev, AI-assisted, part-time değil full-time varsayımı)

| Faz | İyimser | Gerçekçi | Pesimist | Kritik Bağımlılık |
|---|---|---|---|---|
| **F0 — Mimari spike (sadece iskelet)** | 2 hafta | 3 hafta | 5 hafta | Test generator prototipi |
| **F1 — Kalp: end-to-end 1 vaka** | 1 hafta | 3 hafta | 5 hafta | Rubric doğrulaması (doktor) |
| **F2 — Kalp: 3 vaka + synonym genişletme** | 1 hafta | 2 hafta | 4 hafta | NLP kalibrasyon |
| **F3 — Pnömoni (X-ray yolu)** | 1 hafta | 3 hafta | 5 hafta | Kaggle PNG → Türkçe rapor mapping |
| **F4 — Diyabet** | 1 hafta | 2 hafta | 3 hafta | Rubric + hasta yanıtları |
| **F5 — CKD** | 1 hafta | 2 hafta | 3 hafta | 24 özellik dataset mapping |
| **F6 — Meme Kanseri** | 1 hafta | 2 hafta | 3 hafta | FNA numeric → klinik anlatım |
| **F7 — Test, bug fix, içerik tutarlılık** | 1 hafta | 3 hafta | 6 hafta | Gerçek öğrenci testi |
| **TOPLAM (5 hastalık)** | 9 hafta | **20 hafta** | **34 hafta** | — |
| **SADECE KALP (1 hastalık, 3 vaka)** | 4 hafta | **8 hafta** | 14 hafta | — |

### Kritik Path
1. **Rubric yazarlığı** → her hastalıkta beklenen aksiyonlar + red flags + scoring ağırlıkları. Bu **kod değil klinik karar ağacı**. AI draftlar, insan doğrular. Doğrulayıcı yoksa → kalite belirsiz.
2. **Hasta yanıtı içeriği** → 25 vaka × ~20 anamnez sorusu = **500 hasta yanıtı**. Her biri vakayla tıbben tutarlı olmalı. Bu "statik mapping" sanıldığı kadar kolay değil — bir MI vakasında "aile öyküsü" sorusu farklı, stabil angina'da farklı.
3. **Test generator range tabloları** → 100 klinik referans. Manuel.
4. **Doktor review checkpoint** → her hastalıkta 1 kez. Bu dış bağımlılık, senin kontrolünde DEĞİL.

### Neden iyimser tahmin yanlış?
- AI-assisted dev **kodu** hızlandırır (component, API route, SQL migration). Hızlandırdığı şey: "boilerplate".
- AI **içeriği** hızlandırmaz: rubric'in doğru mu yanlış mı olduğunu AI söyleyemez. Sen de (muhtemelen) doktor değilsin.
- "1 vaka seed ~2 saat" tahmini → vakayı yazmak 2 saat, **tıbben tutarlı olduğunu doğrulamak** 2-4 saat. Doğrulama kısmı genelde göz ardı edilir.
- Tek kişi = paralelleşme yok. Bir hastalıkta takılırsan, hepsi gecikir.

**Tek hastalık mı, 5 birden mi?** → **KESİNLİKLE tek hastalık (Kalp).** Mimari dokümanı bunu söylüyor ve doğru. Neden:
- Mimari + içerik iki farklı problem. Mimari ilk hastalıkta doğrulanır, sonra tekrar etmez.
- İçerik **linear effort** — ama her hastalık yeni klinik alan, yeni rubric, yeni dataset mapping. "Linear" derken "kolay" demiyoruz.
- Motivasyon riski: 5 hastalığı aynı anda yapmak = her şey yarı bitik. 1 hastalık bitmiş = "yaptım" hissi, motivasyon artar.

**Timeline Assessment**: **6-8 hafta tahmini gerçekçi değil.** Kalp için 8 hafta, 5 hastalık için 20 hafta gerçekçi. İyimser tahmin,_pesimist değil.

---

## 3. Cost Feasibility: 2/3

### Mimari dokümanın iddiası: $0/ay base, $10/ay sadece Colab/LLM aşımı için.

Bu **kısmen doğru, kısmen yanıltıcı**.

#### Geliştirme Maliyetleri

| Kalem | Aylık | Süre | Toplam (6 ay) | Not |
|---|---|---|---|---|
| Geliştirici (sen) | $0 (kişisel) | 6 ay | $0 | Zaman maliyeti dışlanmış — gerçek maliyet senin boş zamanın |
| **AI-assisted dev aracı** | **$10-20** | 6 ay | **$60-120** | ⚠️ BÜTÇEDE YOK. Cursor Pro $20, Copilot $10. "AI-assisted" deniyor ama bu maliyet sayılmamış. |
| Domain adı | ~$1/mo amorti | 12 ay | $12/yıl | Yok sayılmış |
| Toplam dev (6 ay) | — | — | **$72-132** | $10/ay bütçesinin **7-13 katı** |

**Kritik nokta**: "AI-assisted" aslında gizli bir $10-20/ay sabit maliyet. Eğer bunu zaten kullanıyorsan (başka proje için ödüyorsan) → bu projeye atanabilir $0. Ama yeni başlıyorsan, $10/ay LLM bütçesi **zaten Cursor'dan çıkıyor**.

#### Infra Maliyetleri (aylık, çalışan sistem)

| Servis | Sağlayıcı | Aylık | Scaling | Risk |
|---|---|---|---|---|
| Hosting + API | Vercel Hobby | $0 | 100GB bandwidth/ay → sonra $20/mo Pro | Düşük (kişisel kullanım) |
| DB + Auth | Supabase Free | $0 | 500MB DB, 5GB bandwidth, **1GB storage** | **ORTA — storage cliff** |
| Storage (PNG) | Supabase | $0 → **$25/mo Pro** | 1GB sonrası | **100 pnömoni PNG ≈ 1GB → zaten limite dayalı** |
| LLM (NLP fallback) | Gemini Flash free | $0 | 15 req/dk, 1500/gün → sonra ücretli | Orta (rate limit) |
| Cache (Upstash) | Free tier | $0 | 10k komut/gün | Düşük |
| Monitoring | Sentry Free | $0 | 5k hata/ay | Düşük |
| CI/CD | GitHub Actions | $0 | 2000 dk/ay private repo | Düşük |
| **Toplam (MVP, düşük trafik)** | — | **$0** | — | — |

#### Üçüncü Parti Maliyetleri

| Servis | Amaç | Aylık/Yıllık | Gerekli? |
|---|---|---|---|
| Colab Pro | BERT fine-tune (opsiyonel v2) | $10-20/mo | MVP'de HAYIR — ama NLP kalibrasyon yetersiz gelirse EVET |
| Gemini paid tier | Free aşılırsa | token bazlı | Sadece >50 aktif kullanıcıda |
| Supabase Pro | Storage 1GB aşılırsa | $25/mo | Pnömoni eklemede **muhtemel** |

#### 3-Yıllık TCO (Toplam Sahip Olma Maliyeti)

| Yıl | Geliştirme | Infra | Üçüncü Parti | Toplam |
|---|---|---|---|---|
| Yıl 1 (6 ay dev + 6 ay canlı) | $72-132 (AI araç) | $0-150 (Supabase Pro ihtimali) | $0-120 (Colab) | **$72-402** |
| Yıl 2 (sadece bakım) | $120 (AI araç sürdürme) | $0-300 | $0 | **$120-420** |
| Yıl 3 | $120 | $0-600 (büyüme) | $0 | **$120-720** |
| **3 yıl toplam** | — | — | — | **$312-1542** |

#### Bütçe vs Gerçek
- **İlan edilen bütçe**: $10/ay × 36 = **$360 / 3 yıl** (sadece LLM/Colab için)
- **Gerçek 3-yıl TCO**: $312-1542 (AI araç + infra dahil)
- **Aşım**: $0-1182

**Maliyet Assessment**: Infra $0/ay **kişisel kullanım için doğru**. AMA:
1. AI-assisted dev aracı maliyeti ($10-20/ay) bütçede yok — bu **en büyük gizli sabit maliyet**.
2. Supabase storage 1GB limiti, pnömoni PNG'leri ile zaten sınırda — Pro'ya geçiş $25/ay = bütçenin 2.5 katı.
3. $10/ay bütçe, sadece LLM API + Colab için geçerli. "AI-assisted" ile "AI API" farklı şeyler.

**Skor 2/3**: Infra doğru hesaplanmış, ama gizli sabit maliyetler (AI araç, domain, storage cliff) bütçeyi sessizce deler.

---

## 4. Operational Feasibility: 1/3

| Kriter | Skor | Not |
|---|---|---|
| **Bakım Yükü** | 1/3 | Klinik içerik çürür. Diyabet HbA1c hedefleri, troponin cutoff'ları, CKD KDIGO staging'i her 2-3 yılda güncellenir. Rubric + range tabloları yıllık review gerekir. Tek kişi bunu sürdüremez motivation ile. |
| **Monitoring Karmaşıklığı** | 2/3 | Sentry + Vercel Analytics yeterli. Düşük trafik. Ama "öğrenci yanlış puan aldı" tipi hataları tespit etmek için kullanıcı feedback döngüsü gerek — yok. |
| **Scaling Stratejisi** | 1/3 | 10 kullanıcı: OK. 100 kullanıcı: Supabase free tier'ı aşar ($25/mo), Gemini rate limit aşar (paid), Vercel Hobby 100GB'i aşabilir. 1000 kullanıcı: mimari değil, **içerik kalitesi** darboğaz — 5 hastalık yetmez. |
| **Bus Factor** | **0/3** | **1 kişi = bus factor 1.** Sen bırakırsan proje ölür. Dokümantasyon olsa bile, içerik (rubric, hasta yanıtları) senin zihninde. Bu, "kişisel proje" için kabul edilebilir AMA "sürdürülebilir" değil. |
| **Deployment Karmaşıklığı** | 3/3 | Vercel tek tık. Düşük. |
| **Dokümantasyon İhtiyacı** | 2/3 | Mimari dokümanı zaten iyi. Ama rubric'lerin niçin o aksiyonları beklediği (klinik gerekçe) dokümante edilmemiş. Olmazsa, 6 ay sonra "bu red flag neden -5?" sorusu cevapsız kalır. |

**Operasyonel Assessment**: **Sürdürülebilir değil**, tek kişilik kişisel proje olarak kabul edilebilir. İki büyük risk:

1. **Klinik doğrulama eksikliği**: Mimari dokümanı "uzman destekli gold-standard" diyor AMA **uzman kim, nasıl tazmin ediliyor** belirsiz. Eğer bir doktor arkadaşın yoksa, rubric'lerin doğru olduğu **kanıtsız**. Yanlış rubric = yanlış öğretim = etik sorumluluk. MVP raporunda bu konu geçiştirilmiş.

2. **İçerik çürümesi**: Tıp statik değil. 2026'da yazdığın diyabet rubric'i 2028'de eski olabilir. Güncelleme döngüsü yok. Tek kişi için yıllık rubric review = bir hafta iş, kim ödeyecek?

**Skor 1/3**: Kişisel "yapabilir miyim" projesi olarak yaşar. Ürün olarak sürdürülebilir değil. Bu farkı netleştir: "ben denemek için yapıyorum" vs "öğrenciler kullanacak ürün".

---

## 5. Overall Feasibility: 6/12 → CONDITIONALLY FEASIBLE

| Boyut | Skor | Ağırlık |
|---|---|---|
| Technical | 2/3 | Yapılabilir |
| Timeline | 1/3 | Tahminler 2× iyimser |
| Cost | 2/3 | Gizli sabit maliyetler |
| Operational | 1/3 | Bus factor=1, klinik doğrulama yok |
| **Toplam** | **6/12** | **%50** |

**Weighted Verdict**: **CONDITIONALLY FEASIBLE** — şu koşullarla:

1. ✅ Scope **Kalp hastalığı, 3 vaka** ile sınırlanır ("yapabilir miyim" testi).
2. ✅ En az 1 doktor, rubric'i 1 kez gözden geçirir (2 saat pro-bono yeter).
3. ✅ AI-assisted dev aracı maliyeti ($10-20/ay) bütçeye eklenir veya mevcut abonelik kullanılır.
4. ✅ Deterministik test generator **ilk prototip** olarak yapılır — çalışmazsa proje durur.
5. ✅ Pnömoni'nin storage cliff'i (Supabase 1GB) önceden hesaplanır.

Koşullar sağlanırsa → **GO (Kalp MVP için)**. Sağlanmazsa → **NO-GO**.

---

## 6. "Yapabilir miyim" — Net GO / NO-GO Thresholds

### GO Thresholds (hepsi sağlanmalı)

| # | Threshold | Ölçüm Yöntemi | Deadline |
|---|---|---|---|
| G1 | Kalp vakası end-to-end çalışıyor: soru → hasta yanıtı → test iste → sonuç → puan | Playwright smoke test geçer | F0+F1 sonunda (gerçekçi 6 hafta) |
| G2 | Türkçe NLP dictionary+fuzzy, LLM fallback olmadan **≥85%** synonym yakalıyor | 30 test cümlesiyle manuel ölç | F2 sonunda |
| G3 | En az 1 doktor, Kalp rubric'ini "klinik olarak doğru" onaylar | İmzalı/e-postalı onay | F1 sonunda |
| G4 | İlk 3 gerçek öğrenci testinde hasta yanıtları "anlaşılır ve gerçekçi" oyu ≥2/3 | Anket | F2 sonunda |
| G5 | Infra aylık maliyet **≤$5** (AI araç hariç) 50 test session'ında | Vercel/Supabase dashboard | F2 sonunda |
| G6 | Deterministik test generator, Kalp için 5 testte (EKG, troponin, CBC, kolesterol, BNP) **klinik olarak makul** değer üretiyor | Doktor spot check | F1 sonunda |

**Hepsi geçerse → Pnömoni'ye geç.** Yoksa → Kalp'i stabil yap, ilerleme.

### NO-GO Thresholds (herhangi biri → DUR)

| # | Trigger | Aksiyon |
|---|---|---|
| N1 | 8 hafta sonunda Kalp vakası end-to-end çalışmıyor | DUR — mimariyi yeniden değerlendir. Kod değil, içerik mi sorun? |
| N2 | Doktor onayı alınamıyor ve alınacak görünü de yok | DUR — yanlış tıp öğretmek etik değil. "Kişisel deneme" olarak bile olsa, öğrenci kullanırsa sorumluluk var. |
| N3 | AI-assisted dev aracı aylık **>$25** ve bütçe absorbe edemiyor | DUR — bütçe çatlamış. Alternatif: ücretsiz araç (Copilot free tier, Continue.dev). |
| N4 | İlk 3 öğrenci testinde "hasta yanıtları robotik/yanlış" geri bildirimi ≥2/3 | DUR — NLP katmanını yeniden yap. Hasta yanıtı ürünün çekirdeği. |
| N5 | Generator, bir MI vakasında troponin 0.01 üretiyor (klinik olarak imkansız) ve range tabloları düzeltilemiyor | DUR — Tier B generator'u bırak, sadece Tier A statik kullan. |
| N6 | Supabase storage 800MB'ı geçti ve pnömoni eklenmedi | DUR — storage stratejisini çöz (PNG'leri küçült, subset azalt, veya Pro'ya geç). |
| N7 | Motivasyon 4 hafta üst üste düşük, projeye dokunmuyorsun | DUR — bu sinyal. Zorla devam etme. |

---

## 7. Gizli Maliyetler (Overlooked Costs)

Mimari dokümanında **sayılmamış** maliyetler:

### 7.1 Veri Temizleme — ~1 gün/dataset
- UCI Heart Disease: 303 satır, 14 özellik. Eksik değerler (?), kategorik kodlama (1-4 chest pain type). Türkçe test_key'e mapping tablosu yazmak ~4 saat.
- UCI CKD: 24 özellik, çok eksik veri. Mapping ~6 saat.
- Kaggle Pneumonia: 5863 PNG, klasör yapısı normal/pneumonia. "Bu vaka pnömoni → bu PNG" eşleştirmesi + Türkçe radyoloji raporu yazmak: **50 görüntü × 10 dk = 8 saat**.
- Wisconsin Breast Cancer: 30 numeric özellik. "FNA sonucu" olarak klinik anlatıma çevirmek ~3 saat.
- **Toplam veri temizleme**: ~2-3 gün, mimari tahmininde yok.

### 7.2 Türkçe NLP Kalibrasyon — 2-4 hafta (F1-F2 içine yayılır)
- "200 alias × 5 hastalık = 1000 alias" yazmak AI ile 1 gün.
- AMA **kalibrasyon**: her alias'ın doğru aksiyona map'lendiğini doğrulamak. False positive (yanlış aksiyona map) = yanlış puan.
- Türkçe morfoloji: "Ağrıyor muydu?" (geçmiş zaman) vs "Ağrısı var mı?" (şimdiki) — aynı aksiyon ama farklı surfaz. Fuzzy bunları yakalayabilir ama threshold 0.85 **Türkçe için test edilmemiş**.
- **Test seti**: 30 Türkçe tıp öğrencisi tarzı cümle topla, hangi aksiyona düşeceğini manuel etiketle, dictionary+fuzzy accuracy ölç. Bu 2-4 gün iş.
- **Gizli maliyet**: eğer accuracy <85% ise, BERT fine-tune gerekir → Colab Pro $10-20/mo + 1-2 hafta eğitim işi. Bütçe daralır.

### 7.3 Rubric Üretimi — klinik saat başına ~1 rubric (doğrulamasız), 2-3 saat (doğrulamalı)
- AI "Kalp rubric yaz" → 30 dk draft.
- **AMA doğrulama**: her expected aksiyon için klinik kaynak (kılavuz, textbook) referansı. NICE/ESC/AHA kılavuzlarından alıntı. 10 expected aksiyon × 15 dk = 2.5 saat/vaka.
- 5 hastalık × 5 vaka = 25 vaka × 2.5 saat = **62 saat klinik doğrulama**. Bu "AI-assisted" ile hızlanmaz.
- **Etik maliyet**: doğrulamasız rubric = doğrulanmamış tıp öğretimi. Sayısal değil ama en ağır maliyet.

### 7.4 Validation — zemin doğruluk etiketi yok
- "Öğrenci 78 puan aldı — bu iyi mi kötü mü?" sorusunun cevabı için **uzman puanlaması** gold standard gerek.
- 10 vaka × 1 doktor × 15 dk = 2.5 saat doktor zamanı.
- Bu olmadan, senin rule-based puanlamanın doğru olduğu **kanıtsız**. Skor = keyfi.
- **Maliyet**: doktor zamanı (pro-bono zor) veya vaka başına $50-100 freelance tıp danışmanı = 25 vaka × $75 = **$1875**. Bütçenin 187 katı.

### 7.5 İçerik Çürümesi — yıllık ~1 hafta bakım
- Kardiyoloji: ESC guidelines 2-3 yılda bir major update.
- Diyabet: ADA Standards of Care **yıllık** update.
- Pnömoni: ATS/IDSA guidelines 3-5 yılda.
- Rubric + range tabloları bu güncellemeleri takip etmezse → **yanlış öğretim**.
- **Maliyet**: yılda 5-7 saat review + güncelleme. Tek kişi için motivasyon testi.

### 7.6 AI-Assisted Dev Aboneliği — $10-20/ay SABİT
- "AI-assisted" deniyor ama Cursor/Copilot maliyeti bütçede yok.
- Eğer zaten kullanıyorsan: $0 (sunk cost).
- Yeni başlıyorsan: **$120-240/yıl**, $10/ay LLM bütçesinin 12-24 katı.

### 7.7 Domain + SSL — $10-15/yıl
- Vercel subdomain ücretsiz (`tip-ai.vercel.app`). Profesyonel görünüm için custom domain.
- Yok sayılabilir ama üretimde istenir.

### 7.8 Supabase Storage Cliff — $25/ay tetikleyici
- 100 pnömoni PNG ≈ 1GB. Supabase free 1GB. **Zaten limite dayalı**.
- Çözümler: PNG'leri %50 küçült (quality), subset 50'ye indir, veya imgur/Cloudinary free tier (3GB) kullan.
- Aşımda: $25/ay Pro = bütçenin 2.5 katı.

### 7.9 Hasta Yanıtı İçeriği — 500+ yanıtlar
- 25 vaka × ~20 anamnez sorusu = **500 hasta yanıtı**.
- Her biri vakayla tıbben tutarlı. "Statik mapping" sanıldığı kadar kolay değil — bir MI vakasında "aile öyküsü" yanıtı farklı, unstable angina'da farklı.
- AI ile draftla, AMA birbirine tutarsız olmasın diye tek elden geçirme gerek. ~10 saat içerik işi.

### 7.10 Kenar Vakalar (Edge Cases) — tahmin edilemez
- Öğrenci "lösemiyi ekarte et" yazarsa? NLP bunu ne yapar?
- Öğrenci aynı testi 5 kez isterse? (mimari 20 limit koymuş, ama 5'inci kez aynı sonuç mu döner, "zaten istediniz" mü der?)
- Öğrenci "hastayı taburcu et" derse vaka ortasında?
- Bunlar **test edilmeden** bilinmez. Her biri bir bug + fix döngüsü.

**Toplam gizli maliyet (6 ay)**:
- Zaman: veri temizleme (3 gün) + NLP kalibrasyon (3 gün) + rubric doğrulama (62 saat ≈ 8 gün) + hasta yanıtları (10 saat ≈ 1.5 gün) + edge case fix (5 gün) = **~20 gün ek iş**, mimari tahmininde yok.
- Para: AI araç $60-120 + domain $6 + potansiyel Supabase Pro $150 = **$216-276/6 ay**, $60 bütçenin 3.5-4.6 katı.

---

## 8. Önerilen Scope Reduction — Minimum Uygulanabilir MVP

Mimari dokümanı "ilk hastalık Kalp" diyor — **doğru ama yeterince agresif değil**. Daha da küçült:

### Katman 0 — "Yapabilir miyim" Spike (2-3 hafta)
**Amaç**: Mimari ispat, içerik kalitesi değerlendirmesi.

| Parça | Dahil | Hariç |
|---|---|---|
| Hastalık | **SADECE Kalp** | Diğer 4 |
| Vaka sayısı | **1 vaka** (klasik göğüs ağrısı, 58 yaş erkek) | 3-5 vaka |
| Frontend | 3-panel iskelet, **masaüstü only** | Mobile optimization |
| NLP | Dictionary only (20 synonym, manuel), **fuzzy yok, LLM yok** | 3-katman |
| Test üretimi | **Tier A statik only** — EKG, troponin, CBC, kolesterol önceden yazılır | Tier B generator, Tier C dataset |
| Rubric | 1 vaka, 10 expected aksiyon, manuel | 5 vaka, scoring weights optimizasyon |
| Hasta yanıtları | 15 soru için statik yanıt | 20+ soru, LLM varyasyon |
| Scoring | Rule-based, 5 kural | Detaylı breakdown, feedback zenginleştirme |
| Auth | Anonim UUID | Supabase Auth |
| DB | SQLite local (Prisma) → sonra Supabase | Supabase ilk gün |
| Image | Yok (Kalp = EKG JSON) | PNG viewer |
| Test | 1 Playwright smoke + 5 Vitest unit | Coverage >80% |

**Bu spike'ın amacı**: 3 haftada "bu mimari çalışıyor mu, içerik yazar mıyım, kaliteli mi?" sorusunu yanıtlamak.

### Katman 1 — Eğer spike geçerse (3-5 hafta)
- Kalp: 3 vaka + fuzzy NLP + Tier B generator (sadece Kalp için 5 test) + scoring breakdown + feedback panel
- Doktor review (G3 threshold)
- Supabase'e taşı (SQLite → Postgres migration)

### Katman 2 — Pnömoni (eğer Katman 1 stable)
- İlk görüntü yolu: PNG viewer + Kaggle subset (30 görüntü, storage'da)
- Bu, image pipeline'ı test eder. **Burada storage cliff'i çöz**.

### Katman 3+ — Diğer hastalıklar
- Sıra: Diyabet (kolay, numeric) → CKD (orta, 24 özellik) → Meme Kanseri (zor, FNA numeric → klinik anlatım)
- Her biri 2-3 hafta

**Toplam gerçekçi timeline**:
- Spike: 3 hafta
- Katman 1 (Kalp tam): +4 hafta = 7 hafta
- Katman 2 (Pnömoni): +3 hafta = 10 hafta
- Katman 3-5: +9 hafta = **19 hafta** (5 hastalık)

Bu, iyimser 8 hafta tahmininin **2.4 katı**. Hofstadter'a uygun.

---

## 9. Kill Switch Criteria — Ne Zaman Durmalısın?

| # | Tetik | Aksiyon | Geri Dönüş Koşulu |
|---|---|---|---|
| K1 | Spike (3 hafta) sonunda 1 vaka end-to-end çalışmıyor | **DUR**. Mimariyi değil, **içerik yazarlığı yeteneğini** sorgula. | Sorun code ise → 1 hafta ek. İçerik ise → NO-GO. |
| K2 | Doktor onayı 4 haftada alınamadı | **DUR**. "Kişisel deneme" olarak devam et, ama **kimseye açma**. Yanlış tıp öğretmek etik sorumluluk. | 1 doktor bulunca → devam. |
| K3 | NLP dictionary+fuzzy accuracy <70% (G2 threshold'un altında) | **DUR**. Fuzzy yetersiz. 3 seçenek: (a) LLM her çağrıya taşı = maliyet patlar, (b) BERT fine-tune = Colab + 2 hafta, (c) chip-tabanlı UI (serbest metni kapat, sadece chip seç) = kolay ama UX düşer. | Karar verince devam. |
| K4 | Supabase storage 800MB, pnömoni eklenmeden | **DUR**. PNG'leri küçült (TinyPNG), subset 30'a indir, veya Cloudinary free (3GB) taşı. | Çözüm uygulanınca. |
| K5 | Aylık infra maliyet $15'ı geçti (AI araç hariç) | **DUR**. Bütçe çatlamış. Kullanıcı sayısını sınırla (private beta) veya upgrade'i ertele. | Trafik düşerse. |
| K6 | İlk 5 öğrenci testinde "hasta robotik/yanlış" ≥3/5 | **DUR**. Hasta yanıtı katmanını yeniden yap. Statik yanıtlara yatırım yap (LLM varyasyonu kapat). | 5/5 "anlaşılır" oyu. |
| K7 | Generator, klinisyene gösterildiğinde "bu sonuç imkansız" dediği ≥2 test | **DUR**. Tier B'yi kapat, sadece Tier A statik. Generator'u v2'ye ertele. | Range tabloları doktor onaylı. |
| K8 | 6 ay boyunca 10 aktif kullanıcıdan az | **DUR**. Ürün değil, kişisel deneme. Yeni özellik (hastalık) ekleme. Mevcudu stabil tut. | Trafik gelirse. |
| K9 | Motivasyon 6 hafta sıfır | **DUR**. Bu sinyal. Zorla sürdürme → kalite düşer, yanlış içerik riski artar. | İlgi geri dönene kadar bekle. |
| K10 | Rubric'lerde klinik hata tespit edildikten sonra 3. kez | **DUR**. Sistemik doğrulama eksikliği var. Tüm rubric'leri doktora yeniden göster. | Toplu review geçince. |

---

## 10. Tool & Technology Evaluation

| Araç | Amaç | Pros | Cons | Alternatif | Skor | Recommendation |
|---|---|---|---|---|---|---|
| **Next.js 14 App Router** | Frontend + API | AI tooling en iyi, Vercel tek tık, React ekosistemi | Biraz ağır, SvelteKit daha hafif | SvelteKit, Remix | 3/3 | **KABUL** — doğru seçim |
| **shadcn/ui + Tailwind** | UI komponent | Koda kopyala, vendor değil, AI bilir | Tutarlılık sana kalmış | MUI, AntD | 3/3 | **KABUL** |
| **Supabase (Postgres + Storage)** | DB + image storage | Free tier cömert, RLS, auth hazır | **1GB storage cliff = $25/mo** | Turso (SQLite, 9GB free), Neon | 2/3 | **KABUL ama storage'ı izle** — alternatif: Turso DB + Cloudinary image |
| **Vercel Hobby** | Hosting | $0, 100GB bw, otomatik deploy | 100GB aşımı = Pro $20/mo | Railway, Fly.io, Cloudflare Pages | 3/3 | **KABUL** |
| **Gemini Flash free** | NLP fallback | 1500 req/gün yeterli | Rate limit, Türkçe kalitesi test edilmemiş | GPT-4o-mini ($), Claude Haiku ($) | 2/3 | **KABUL ama ölç** — kaçak oran >10% ise paid gerekir |
| **rapidfuzz (WASM)** | Fuzzy matching | Hızlı, test edilmiş, npm | Türkçe için threshold kalibrasyon gerek | Fuse.js (daha yavaş) | 2/3 | **KABUL** — threshold 0.85 yerine 0.80 dene |
| **Vitest + Playwright** | Test | Hızlı, modern, Vite uyumlu | Playwright biraz ağır | Jest (eski), Cypress | 3/3 | **KABUL** |
| **Google Colab (free)** | Offline training | $0, GPU var (T4) | Session timeout, RAM limit | Kaggle Notebooks (30h/ha GPU) | 2/3 | **KABUL** — free yeterli, Pro $10 gerekirse |
| **SQLite (Prisma)** | Spike DB | $0, local, migration kolay | Çoklu kullanıcıda sınırlı | — | 3/3 | **SPIKE için KABUL**, sonra Supabase |
| **Cursor / Copilot** | AI-assisted dev | Kod hızlandırır | **$10-20/ay gizli maliyet** | Continue.dev (free, local model) | 2/3 | **KABUL** — ama bütçeye ekle |

**Teknoloji stack sağlam.** Tek endişe: Supabase storage cliff ve AI aracı maliyeti bütçede sayılmamış.

---

## 11. Kritik Varsayımlar

| # | Varsayım | Yanlışsa Risk |
|---|---|---|
| A1 | Doktor rubric review ücretsiz/pro-bono bulunabilir | **YÜKSEK** — bulunamazsa etik NO-GO |
| A2 | AI-assisted dev aracı zaten mevcut (sunk cost) | ORTA — yeni başlanıyorsa $120-240/yıl gizli |
| A3 | Türkçe NLP dictionary+fuzzy ≥85% yakalar | ORTA — düşerse BERT/Colab/$10-20/mo gerekir |
| A4 | Deterministik generator klinik olarak makul sonuç üretir | **YÜKSEK** — üretemezse test üretimi çöker, ürün değeri kaybolur |
| A5 | 5 hastalık için açık veri setleri yeterli | DÜŞÜK — setler var ama eğitim vakasına mapping iş |
| A6 | Tek kişi 20 hafta motivasyonu sürdürür | ORTA — kişisel proje, motivasyon riski gerçek |
| A7 | Supabase free tier yeterli (storage <1GB) | ORTA — pnömoni PNG'leri ile limite dayalı |
| A8 | Gemini free tier rate limit aşılmaz | DÜŞÜK — düşük trafikte sorun değil |
| A9 | Hasta yanıtları statik mapping ile yeterli gerçekçilikte | ORTA — düşerse LLM her çağrıya = maliyet |
| A10 | Sentetik vaka → KVKK dışı | DÜŞÜK — doğru, ama e-posta eklenirse değişir |

**En kritik 3**: A1 (doktor), A4 (generator), A2 (AI araç maliyeti). Bunlar yanlışsa proje durur.

---

## 12. Açık Sorular

1. **Doktor kim?** Rubric'i kim doğrulayacak? İsim, ilişki, zaman taahhüdü nedir? Bu olmadan GO verilmez.
2. **AI-assisted dev aracı mevcut mu?** Cursor/Copilot zaten ödeniyor mu, yoksa yeni mi başlanacak? Bütçeye giren çıkmıyor.
3. **Türkçe NLP doğruluğu ölçülecek mi?** 30 cümlelik test seti hazırlanmış mı? Hangi threshold "yeterli" sayılacak?
4. **Validation gold standard nasıl sağlanacak?** Doktor 10 vakayı puanlayacak mı? Yoksa skorlar keyfi mi kalacak?
5. **Pnömoni PNG'leri için storage stratejisi?** Supabase 1GB'i aşmadan 50-100 görüntü nasıl sığar? TinyPNG %50 küçültme yeterli mi?
6. **Hasta yanıtları statik mi LLM mi?** 500 yanıt statik yazılır mı, yoksa LLM her seferinde üretir mi (maliyet + deterministiklik riski)?
7. **İçerik güncelleme döngüsü?** Yıllık rubric review kim yapacak? Tek kişi 5 hastalığı takip edebilir mi?
8. **"Kişisel deneme" mi "ürün" mü?** Amaç sadece "yapabilir miyim" yanıtı mı, yoksa öğrenciler kullanacak mı? Bu, doğrulama seviyesini belirler.
9. **MVP sonrası plan?** 5 hastalık bitince ne olacak? Açık kaynak mı, hosting devam mı, kullanıcı topluluğu mu?

---

## 13. Recommendation (Brutal Özet)

**Bu proje YAPILABİLİR** — ama iki şeyi netleştirmeden başlama:

1. **Scope'u Kalp + 1 vaka'ya indir (3 haftalık spike).** Mimari dokümanı "ilk hastalık Kalp" diyor ama yeterince agresif değil. 1 vaka + statik test + dictionary-only NLP ile "yapabilir miyim" sorusunu yanıtlamak yeterli. Diğer 4 hastalık, spike başarılıysa **içerik problemi** olarak eklenir — mimari tekrar etmez.

2. **Doktor onayı olmadan başlama.** Bu etik bir gate, "nice to have" değil. Bir doktor arkadaşın yoksa, rubric'i kendin yazıp "kişisel deneme, kimse kullanmayacak" diye başla — ama ilk kullanıcıya açmadan önce doğrula. Yanlış tıp öğretmek, hiç öğretmemekten daha kötü.

**Gizli maliyet uyarısı**: $10/ay bütçe **sadece LLM API + Colab** için geçerli. AI-assisted dev aracı ($10-20/ay), domain ($10/yıl), Supabase storage aşımı ($25/ay) **bütçede yok**. Gerçek 6 aylık maliyet $200-400, bütçenin 3-6 katı. Bunu bilerek başla.

**Timeline uyarısı**: 6-8 hafta iyimser. Gerçekçi 8 hafta (sadece Kalp), 20 hafta (5 hastalık). Hofstadter's Law. Buna göre planla.

**Kill switch**: 3 hafta spike sonunda 1 vaka çalışmıyorsa veya doktor onayı alınamıyorsa → DUR. Zorla devam etme, kalite düşer, etik risk artar.

**Son söz**: Mimari dokümanı kaliteli, tuzakları doğru tespit etmiş. Tek eksik **içerik kalitesi ve klinik doğrulama** boyutunu ciddiye almamak. Kodu AI yazar, rubric'i AI yazamaz. Buradan başla: spike + doktor + NLP accuracy ölçümü. Üçü de geçerse → GO.

---

## Ek A — Hızlı Referans: GO/NO-GO Karar Ağacı

```
BAŞLA (Spike: Kalp + 1 vaka, 3 hafta)
   │
   ├─ 3 hafta sonunda vaka çalışıyor mu?
   │   ├─ HAYIR → [K1] DUR. İçerik mi kod mu? İçerik → NO-GO.
   │   └─ EVET ↓
   │
   ├─ Doktor rubric'i onayladı mı?
   │   ├─ HAYIR → [K2] DUR. Kişisel deneme olarak devam et, kimseye açma.
   │   └─ EVET ↓
   │
   ├─ NLP dictionary+fuzzy accuracy ≥85%?
   │   ├─ HAYIR → [K3] DUR. Chip UI'ya geç veya BERT/LLM投资.
   │   └─ EVET ↓
   │
   ├─ Generator klinik olarak makul sonuç üretiyor?
   │   ├─ HAYIR → [K7] DUR. Tier A statik'e geri dön.
   │   └─ EVET ↓
   │
   ├─ İlk 3 öğrenci testi "anlaşılır" dedi mi?
   │   ├─ HAYIR → [K6] DUR. Hasta yanıtlarını yeniden yap.
   │   └─ EVET ↓
   │
   ▼
   GO: Katman 1'e geç (Kalp tam: 3 vaka + fuzzy + generator + scoring)
      │
      ├─ 4 hafta sonunda stable mı?
      │   ├─ HAYIR → stabilize et, ilerleme.
      │   └─ EVET → Katman 2: Pnömoni (image yolu)
      │              │
      │              ├─ Storage cliff çözüldü mü? [K4]
      │              ├─ EVET → Katman 3: Diyabet → CKD → Meme K.
      │              └─ HAYIR → DUR, çöz.
      │
   [Her katmanda G1-G6 threshold'ları ölç, geçmeyene ilerleme]
```

---

## Ek B — Hesap Tablosu (Hızlı Maliyet Kontrolü)

| Kalem | Beklenen | Gerçekçi | Bütçe Aşımı? |
|---|---|---|---|
| LLM API (Gemini free) | $0 | $0-5 | Hayır |
| Colab | $0 | $0-20 | Sınırda |
| AI-assisted dev aracı | **$0 (sayılmamış)** | **$60-120/6 ay** | **EVET — gizli** |
| Domain | $0 | $6/6 ay | Küçük |
| Supabase Pro (ihtimal) | $0 | $0-150 | ORTA risk |
| **6 ay toplam** | **$0-60** | **$66-301** | **Evet** |

$10/ay × 6 = $60 bütçe. Gerçekçi $66-301. **Aşım: $6-241.**

---

*Rapor sonucu: CONDITIONALLY FEASIBLE (6/12). Koşullar: scope indir + doktor onayı + AI maliyeti bütçeye ekle + spike ile generator doğrula.*
