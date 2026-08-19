# Özellik Önerileri: Türkçe Klinik Karar Simülasyon Sistemi (tıp_ai)

> **Rol**: Feature Suggester · **Tarih**: 09 Temmuz 2026
> **Girdiler**: tech-architecture-tip-ai.md · product-strategy-tip-ai.md · feasibility-tip-ai.md · mcp-tools-tip-ai.md
> **Constraint'ler**: Tek fullstack dev (AI-assisted) · $10/ay LLM bütçesi (gizli AI araç maliyeti hariç) · "Yapabilir miyim" testi · Scope Kalp+1 vaka spike'ı ile başlar · Doktor onayı etik gate
> **Tutum**: Over-promise yok. Tek kişi fizibilitesine uymayan her özellik ⚠️ ile işaretlenir ve "eriş" koşulu yazılır.

---

## 0. Özet — Tavsiye Kararı

Bu rapor üç raporu sentezler. Tüm özellikler tek kişilik fizibilite ekseninde filtrelenmiştir. Tek ilke: **"Over-promise yok — hangi özellik bu hafta içinde demonstrable value üretir?"**

| Faz | Özellik sayısı | Toplam efor (tek dev hafta) | Tek hastalık (Kalp) | Görsel? |
|---|---|---|---|---|
| **MVP (Spike)** | 7 core | 2-3 hafta | Evet, 1 vaka | Yok (EKG JSON) |
| **V1** | 8 ek (4 should + 4 delight) | +3-5 hafta | 3 vaka + rubric zenginleştir | Röntgen opsiyonel |
| **V2** | 5 ek | +6-10 hafta (V1 stable ise) | Diğer hastalıklar | Evet (pnömoni PNG) |
| **Differentiators** | 3 must + 3 opsiyonel | Dağıtık (MVP/V1/V2 içinde) | — | — |

**Kritik tespit**: Reality-checker'ın "scope Kalp + 1 vaka'ya indir" önerisi doğrudur. Tüm feature kararları buna tabidir. Bir özellik spike'ı boğuyorsa → reddedilir.

---

## 1. MVP Features (Must Have) — İlk Spike (Kalp 1 Vaka) için Minimum

**Brutal cut testi**: "Bunu çıkarırsak hâlâ 'tıp_ai' mi?"

| # | Feature | Description | Success Metric | Effort | Cut Risk |
|---|---------|-------------|----------------|--------|----------|
| **M1** | **3-panel vaka çalışma ekranı** | Sol: hasta kartı + ana şikayet. Orta: sohbet (serbest metin + chip). Sağ: test isteme + sonuç görüntüleme. shadcn/ui + Tailwind. Masaüstü-only, mobil = scroll. | Öğrenci tek sayfada vaka akışını tamamlayabiliyor | Düşük (1 hafta) | Çıkarılırsa ürün yok |
| **M2** | **Serbest metin anamnez + dictionary-only Türkçe NLP** | Öğrenci serbest Türkçe yazar. Sistem ilk 30 synonym'i dictionary ile normalize eder (örn. "kan şekeri", "glycem", "glikoz" → GLUCOSE_ASK). Fuzzy/LLM yok. | 15 standart test cümlesinde ≥13'ü doğru action'a düşer (≥85%) | Düşük-Orta | Fuzzy eklemeden de demo çalışır; mükemmellik değil |
| **M3** | **Hasta yanıtı (statik mapping)** | Normalize action'a karşılık önceden yazılmış Türkçe hasta yanıtı. 1 vaka × ~15 anamnez sorusu = 15 yanıt. LLM varyasyonu yok. | İlk 3 test öğrencisinden 2/3 "anlaşılır" oyu | Düşük | LLM varyasyon = gizli maliyet, MVP'de yok |
| **M4** | **Test isteme (Tier A statik only)** | Dropdown'dan EKG / Troponin / CBC / Kolesterol / BNP seçer. Önceden elle yazılmış JSON sonuç döner. Generator yok, dataset yok. | 5 test × 1 vaka = 25 statik JSON. 0 ms yanıt. | Orta (içerik yazma) | Spiker requirement; Tier B generator V1'e ertelenir |
| **M5** | **Rule-based scoring + feedback ekranı** | Vaka sonu: "Beklenen sorular X Y, sen sordun Z. Red flag atladın: W. Puan 72/100." Deterministik kural tabanlı. 10 expected aksiyon, 3 red flag. | Skor verilen case'de deterministik → aynı input = aynı skor | Orta | LLM puanlama = maliyet + halüsinasyon riski; MVP'de yok |
| **M6** | **Anonim UUID session + "eğitim amaçlı" disclaimer** | URL açıldığında localStorage'a UUID atanır. Üst banner: "Eğitim amaçlıdır, klinik karar desteği değildir." Supabase Auth yok. | Tüm oturumlar UUID ile log'a yazılı; uyarı görünür | Düşük | KVKK için minimum gereklilik; kişi verisi işlenmiyor (sentez) |
| **M7** | **1 Kalp vaka + rubric (doktor onayı etik gate)** | 1 vaka JSON (58 yaş, göğüs ağrısı, MI vari). 10 expected aksiyon + 3 red flag + scoring ağırlıkları. **Doktor onayı olmadan kullanıcıya açma.** | 1 pratisyener/uzman hekim "klinik olarak doğru" der | İçerik ~1 gün, doktor beklemesi 2-4 hafta | **KRİTİK**: onaysız açma = etik NO-GO |

**MVP brute-force durumu**: Bu 7 özellik olmadan tıp_ai dijital bir vaka kitabından farkı yok. Çıkarılanlar (generator, fuzzy, LLM, görüntü, mobil) → hepsi V1/V2'ye taşınır. Spike_BEGIN.

**MVP başarı metriği (sırada değil, sertifikasyon)**: 3 haftada 1 Playwright smoke test PASS (vaka aç → 3 soru → 2 test → tanı → puan ≥60) + 1 doktor e-postalı onay.

### MVP'de Açıkça OLmayan (Kasıtlı çıkarma)

| Çıkarılan | Neden | Ne zaman |
|---|---|---|
| Fuzzy NLP | Dictionary +30 synonym spike için yeter | NLP accuracy <85% ise V1 |
| LLM (Gemini) çağrısı | $0 base cost; spike'da kaçak %0 | V1 kaçı-day |
| Deterministik test generator | 100 klinik referans tablosu gerek — spike'i boğar | V1 (Tier B) |
| Kaggle dataset / röntgen PNG | Kalp = EKG JSON, görüntü yok | V2 (Pnömoni) |
| Supabase (production) | Spike SQLite (Prisma) local | V1 migration |
| Multi-user auth | Anonim UUID yeter | V1.1 (eğer öğrenci destinasyonu ileri ister) |
| Mobile responsive | Masaüstü 3-panel yeter; mobil "scroll" tolere | V1 |
| Birden fazla vaka | Spike'ta sadece 1; "yapabilir miyim" yanıtı 1 vaka ile netleşir | V1 (3 vaka) |

---

## 2. V1 Features (Should Have) — İlk Kullanıcı Geri Dönütü Sonrası

**Geçiş koşulu**: Spike PASS + 3 öğrenci "OK continue" feedback + 1 doktor onayı (product-strategy K + feasibility G3).

| # | Feature | Description | Trigger | Effort | Risk |
|---|---------|-------------|---------|--------|------|
| **V1-1** | **Fuzzy NLP (rapidfuzz) + Gemini LLM kaçak** | 30 synonym → 200 alias. Layer 2 fuzzy (threshold 0.80, Türkçe için ↓0.85). Layer 3 Gemini Flash cache 24h. | NLP accuracy <95% veya "Glikoz ne?" gibi varyasyonlar kaçıyorsa | Orta-Yüksek | Türkçe threshold kalibrasyon gerek (2-4 gün) |
| **V1-2** | **Tier B deterministik test generator** | `seed=hash(case_id+test_key)` ile PRNG. 5 Kalp testi için normal + abnormal aralık tablosu (EKG, troponin, CBC, kolesterol, BNP). Doktor spot-check. | 1 vaka statik test'lerle sınıra dayanır; "farklı vaka" duyar | Yüksek (içerik) | [K7 kill switch]: 2+ imkansız değer → Tier A'ya dön |
| **V1-3** | **3 vaka + 3 farklı"klinik senaryo"** | Tipik MI + unstabil angina + atipik prezentasyon (gastrit gibi gelen). Aynı mimari; içerik ×3. | Spike sonrası "1 vaka yeter mi?" feedback | Orta (içerik ~6 saat) | Bus factor riski: sen yazıyorsun |
| **V1-4** | **SQLite → Supabase migration + RLS** | Prisma migration. Anonim session'lar RLS. Storage signed URL. | Spike başarılı; "diğer cihazda da çalışsın" talebi | Orta | 1 gün migration + test |
| **V1-5** | **Scoring breakdown + "ideal yol" karşılaştırma** | Feedback ekranı: "Senin yolu", "İdeal yol" yan yana. Hangi red flag kaçırıldı, hangi test geç istendi. | Daha net eğitim geri bildirimi | Düşük-Orta | Bir parça frontend iş |
| **V1-6** | **İnteraktif onboarding (3 adım)** | İlk kullanıcıya: (1) "Bir vaka seç", (2) "Sohbete yaz veya chip seç", (3) "Test iste". Progress bar. Kayıttan sonrası gösterme. | "Nereden başlayacağımı bilemedim" feedback | Düşük (delight) | 2-3 saat iş |
| **V1-7** | **Soru chip'leri (önerilen soru butonları)** | ChatPanel altında: "Yer", "Süre", "Yayılım", "Aile öyküsü" gibi tıklanabilir chip. Serbest metin alternatifi. NLP coverage düşük baseline olarak + UX pedagojik yardım. | NLP accuracy = düşük fallback veya yeni kullanıcı guide | Düşük (delight) | Pedagojik "ipucu" unreduced |
| **V1-8** | **"Vaka geçmişini replay" (audit log)** | session_actions tablosu zaten yazılıyor. Vaka sonu: "Senin adımların" history. Paylaşılabilir link (anonim). | Öğretmen/eğitmen kullanımı; kullanıcı kendi yolunu gözden geçirir | Düşük-Orta | Düşük efor, yüksek pedagojik değer |

**V1'in toplam efor tahmini**: 3-5 hafta (gerçekçi). Spike sonrası +5 hafta = toplam 8 hafta (reality-checker ile uyumlu).

---

## 3. V2 Features (Nice to Have) — Ölçek Büyürse

**Geçiş koşulu**: V1 stable + 50 aktif kullanıcı + 5+ öğrenci 2. kez giriş yaptı (product-strategy U2).

> ⚠️ **Önemli**: V2 özellikleri TEK KİŞİ İÇİN SÜRDÜRÜLEBİLİR DEĞİL olabilir. Her birinin "eriş koşulu" yazılmıştır. Reality-checker Bus Factor=0 uyarısı dikkate alınmalı.

| # | Feature | Description | Eriş Koşulu | Effort | ⚠️ Tek-develi Fizibilite |
|---|---------|-------------|-------------|--------|---------------------------|
| **V2-1** | **Pnömoni (ikinci hastalık + röntgen PNG yolu)** | Kaggle Chest X-Ray subset (50 görüntü). Supabase Storage ya da Cloudinary free (3GB). Plain `<img>` + Tailwind zoom modal. Türkçe radyoloji raporu metni. | V1 stable + storage cliff çözüldü (TinyPNG → ~500MB) + doktor röntgen onayı | Yüksek (~3 hafta) | ⚠️ TIFF/DICOM'a geçme; ≤50 PNG; imzalı URL cache'le |
| **V2-2** | **Diyabet (3. hastalık)** | Tiroid/HbA1c numerik. Generator Tier B genişlet. | V2-1 stable | Orta (~2 hafta) | ⚠️ Rubric güncelleme ADA yıllık guideline takip içinContentsYearly review gerek |
| **V2-3** | **Spaced repetition — "Vaka tekrar"** | Öğrencinin "kaçırdığı red flag" bazlı 7 gün sonra benzer vaka öneri. Klasik Anki karşı-savunması. | 50 aktif kullanıcı, 2. kez session log mevcut | Orta | ⚠️ Tıbbi öğretim rencontru; uzman hekim görüşü alınmalı |
| **V2-4** | **Eğitmen/öğretmen dashboard'ı (opsiyonel)** | Each session ID paylaş → öğretmen "ideal yol" görsün, öğrenci yolnu kıyasla. Etik给宝宝 için ideal. | Üniversite tıp kulübü gerçekten talep ederse; yoksa skip | Yüksek | ⚠️ Auth gerektirir (Supabase Auth + RLS). Bu scope creep riski taşıyor; gerçek talep yoksa yapma |
| **V2-5** | **Vaka şablonu + topluluk katkısı (GitHub PR)** | Açık source. CONTRIBUTING.md + vaka JSON şablonu. Uzman hekim kendi vaka yazıp push'lar. Bus factor kırma denemesi. | V1-V2 stable; README + demo video kamuya açık | Yüksek (modération) | ⚠️ Moderasyon yükü: her PR'yi doktor review etmeli; aksi halde yanlış içerik riski. Tek kişi için operational yüz yük |

**V2 toplam gerçekçi timeline (V1 stable sonra)**: +6-10 hafta. Bu, reality-checker'ın 5 hastalık = 20 hafta tahmini ile uyumlu.

### Diğer Hastalıklar (V2 sıra)

V2-1 (Pnömoni) → V2-2 (Diyabet) → V3: CKD → Meme Kanseri. Tech-architect'ın sıralaması: görüntü gereksineni önce (Pnömoni) test image pipeline; numerikxef sonra (Diyabet), sonra 24 özellik (CKD), en zor FNA numeric → klinik anlatım (Meme K.).

---

## 4. Differentiator Features (Unique Value) — ChatGPT/Anki/OSCE sim'lerden farkı

> Product-strategist'ın tespiti: ChatGPT bu projenin değer önermesinin ~%40'ını karşılıyor. Differentiator'lar kalan %60'ın savunması.

### Must-Have Differentiator'lar (MVP'de)

| # | Feature | Competitor Gap | User Impact | Implementation | Strategic Value |
|---|---------|---------------|-------------|----------------|-----------------|
| **D1** | **Rubric-tabanlı, kırmızı çizgi cezalı puanlama** | ChatGPT: yok. Anki: yok. OSCE sim'ler: var ama puanlama instructor'a. AMBOSS: var ama QBank. | Öğrenci "hangi hataları yaptığını öğrenir". Anki "yanlış kart tekrar"ın klinik muadili. | Düşük (rule-based scoring pure functions) | **Yüksek** — ChatGPT'nin yapamadığı; proje kalbinin %40'ı |
| **D2** | **"Red flag" atlama negatif ceza mekanizması** | ChatGPT sana "red flag atlattın" demiyor. Anki ezber altyapısıyla "neyi kaçırdın" net değil. | Öğrencinin "kritik hasta 近 miss"leri görmesi — gerçek hasta güvenliği refleksi kazanır | Düşük (rubric JSON + negatif ağırlık) | **Yüksek** — pedagojik en güçlü farklı |
| **D3** | **Türkçe serbest metin (chip değil) anamnez** | AMBOSS İngilizce. Türkçe QBank TUS sim değil. | Anatomi diliyle soru sorma rahatlığı — pattern 不是 ext patterning | Orta (NLP katmanı) | **Yüksek** — Türkçe pazarda yapılandırıcı fark |

### Should-Have Differentiator'lar (V1/V2'de)

| # | Feature | Competitor Gap | User Impact | Implementation | Strategic Value |
|---|---------|---------------|-------------|----------------|-----------------|
| **D4** | **"İdeal yol vs. senin yol" yan yana karşılaştırma** | ChatGPT sohbet bitince kapar. Vaka kitabı sadece ideal yol verir, seninkini vermez. | Öğrenci hata farkındalığını somut görür — meta-bilişsel öğrenme | Düşük (V1-5 feature) | **Yüksek** — düşünme yapan ürün |
| **D5** | **Deterministik + açıklanabilir skorlama** | ChatGPT = halüsinasyonlu. AMBOSS = soru doğru/yanlış. | "Niye -3?" → "Troponin erken istemedin 5 dk içinde". Açıklanabilir = güven. | Düşük (rule-based) | **Orta-Yüksek** — güven = retention |
| **D6** | **Anonim + tek tık başlangıç (kayıt yok)** | AMBOSS/Osmosis ödeme + hesap. ChatGPT hesap gerekli. | "Dene" frictionsız — öğrenci korkmadan açar | Düşük (UUID local) | Orta — GTM için kritik |

### Nice-to-Have Differentiator'lar (V2+, ⚠️ fizibilite düşük)

| # | Feature | Competitor Gap | User Impact | Implementation | ⚠️ Risk |
|---|---------|---------------|-------------|----------------|---------|
| **D7** | **Spaced repetition vaka tekrarı** | Anki'nın temel özelliğini vaka-bazlı yapar — Anki'nin tahtına çıkar, ama kline. | Uzun-dönem muhafaza | Orta (V2-3) | ⚠️ Doğru tıbbi puanlama gerek, yoksa yanlış vaka tekrar |
| **D8** | **Eğitmen dashboard'ı** | Üniversite CSSC'lere online katkı sağlar. | Öğretmen → sınıfa vaka ödevi | Yüksek (V2-4) | ⚠️ Scope creep riski; talep yoksa yapma |
| **D9** | **Türkçe medikal sinonim learning API (public)** | "tıp_ai-synonyms" — diğer Türkçe tıp ürünleri satın alır | Topluluk katkısı, marka | Yüksek (V2+) | ⚠️ Bakım yükü; ileriki faz |

### Açıkça REDDEDİLEN Differentiator'lar (Telepythia)

| # | Feature | Neden Reddedildi |
|---|---------|-------------------|
| ✗ | Gerçek DICOM viewer (Cornerstone.js) | Tek kişiye +32MB bundle + haftalar eğitim eğrisi (tech-architect ADR-004) |
| ✗ | LLM ile hasta yanıtı üretimi (her çağrı) | $cost patlar + halüsinasyon riski (tech-architect ADR-003) |
| ✗ | Mikroservis mimari | 5 service × 5 deploy = operasyonel intihar (tech-architect) |
| ✗ | Anki deck export | MVP dışı; "ilk Anki-savunması" → alıcı-satıcı değil; bu ezber-hizalanması — ürün akıl yürütme-eksenli |
| ✗ | Tedavi doz hesaplama / ilaç interaksiyon | Doğrulama yükü yüksek; KVKK / tıbbi sorumluluk riski |
| ✗ | Mobil native app | Web responsive yeterli (V1); iOS/Android ek yük tek kişi için ölümcül |
| ✗ | Vaka veya hastalık AI üretimi | Halüsinasyon riski → yanlış tıp eğitimi etik risk (product-strategist'in K1Risk) |
| ✗ | Online çoklu oyunculu / pair simulation | Operasyonel karmaşıklık + tek dev + küçük kullanıcı tabanı → RED |
| ✗ | Voice recognition ("hastaya sesli soru") | STT ekleme + Türkçe STT kalitesi + backend complexity. V3 opsiyonel ama V2'de değil |
| ✗ | Real-time multi-modal görsel anlatım | Tek kişi; backend pipeline; V2-scope dışı |

---

## 5. Feature Priority Matrix (Effort × Impact)

```
                High User Value
                     │
    Quick Wins       │       Major Projects
    (do first)       │       (plan carefully)
 ────────────────────┼────────────────────────
 D1 Skor+red flag    │ M1 3-panel UI
 V1-6 Onboarding     │ M5 Scoring
 V1-7 Soru chip'leri  │ V1-2 Tier B generator
 V1-8 Replay history │ V1-3 3 vaka
 D6 UUID + auth yok   │ V1-1 Fuzzy+LLM NLP
 D3 Türkçe serbest   │ V2-1 Pnömoni (X-ray)
    D2 Red flag puan │ V2-2 Diyabet
    D4 İdeal yol     │ V2-5 Topluluk vaka
                     │ D8 Eğitmen dashboard
                     │
    Fill-Ins         │       Thankless Tasks
    (do if time)     │       (avoid or defer)
 ────────────────────┼────────────────────────
 V1-5 Breakdown UI   │  Voice recognition ✗
 V1-4 SQLite→Supabase│  DICOM viewer ✗
 V2-3 Spaced rep.    │  Native mobile ✗
 M6 Anonim UUID      │  LLM real-time hasta ✗
 M7 Doktor onayı     │  Mikroservis ✗
                     │  Tedavi/doz özelliği ✗
                     │
        Low Effort ──────────────── High Effort
```

### Quick Wins (do first — yüksek değer, düşük efor)

1. **D1+D2 — Rubric skorlama + red flag negatif ceza** (MVP, ~2 gün iş, ChatGPT'den ayrım)
2. **D6 — Anonim UUID + 0 registration** (MVP, ~yarım gün, AMBOSS/Osmosis'ten ayrım)
3. **V1-6 — 3 adım onboarding** (V1, ~2 saat, "deneme frictionsız")
4. **V1-7 — Soru chip'leri** (V1, ~3 saat, NLP coverage baseline + UX pedagojik güç)
5. **V1-8 — Replay/audit history** (V1, ~1 gün, paylaşılabilir = GTMFi)

### Major Projects (plan carefully — yüksek değer, yüksek efor)

1. **M1 — 3-panel UI** (MVP spike) — ürünün kalbi, ama masaüstü-only başla
2. **V1-2 — Tier B deterministik generator** — spike geçince V1'in riskli yeni byzas; ilk prototiple önden doğrula
3. **V2-1 — Pnömoni + X-ray PNG** — image yolu; storage cliff'i çözmeden başlama
4. **V2-5 — Topluluk vaka + açık kaynak** — Bus factor'i kırma denemesi; ama moderasyon yükü

### Fill-Ins (düşük değer veya düşük efor — zaman varsa)

- V1-5 — Skor breakdown UI zenginleştir (eğitmen opland)
- M6 — KVKK disclaimer + anonim UUID (zorunlu, düşük efor)
- D5 — Açıklanabilir skorlama (state't eklemek; D1'in stateless extension'ı)

### Thankless Tasks (KAÇIN — düşük değer, yüksek efor)

- Voice recognition (STT eklentisi) → tek kişiye 3-4 hafta
- DICOM viewer (Cornerstone.js) → learning curve haftalar
- Native mobile app (iOS/Android) → ikinci app bakımı
- Real-time LLM hasta yanıtı → cost + halüsinasyon etik risk
- Mikroservis refactor → şimdi gerek yok
- Tedavi doz hesaplama / ilaç etkileşim → tıbbi sorumluluk katlanır

---

## 6. Feature Phasing Roadmap

| Phase | Features | Timeline (gerçekçi) | Goal | Success Metric |
|-------|----------|----------------------|------|----------------|
| **Spike (F0)** | M1, M2, M3, M4, M5, M6, M7 | 2-3 hafta | "Yapabilir miyim" yanıtı + mimari ispat + doktor onayı gate | 1 Playwright smoke + 1 doktor onayı |
| **V1** | V1-1, V1-2, V1-3, V1-4, V1-5, V1-6, V1-7, V1-8 + D4, D5 | +3-5 hafta (toplam 5-8 hafta) | İlk kullanıcı geri dönüt + NLP fuzzy + generator | 3 öğrenci "OK continue"; NLP ≥85%; 50 kullanıcı |
| **V2** | V2-1, V2-2, V2-3 opsiyonel + D7 spaced | +6-10 hafta (toplam ~5 ay) | Pnömoni image yolu + 2. hastalık + storage çözümü | 20-50 kullanıcı; ≥5 kullanıcı 2. kez; supabase $25 threshold aşılmadı |
| **V3** | V2-4 eğitim dashboard (opsiyonel), V2-5 topluluk (opsiyonel), D8 eğitmen | Months 5+ | Ölçek + sürdürülebilirlik | Talep yoksa dur; talep varsa Yüksek Bus Factor ölçeği |

**Reality-checker ile uyum notu**: Bu timeline reality-checker "8 hafta (sadece Kalp), 20 hafta (5 hastalık)" tahmini ile uyumlu. Spike 3 hafta + V1 5 hafta = Kalp tamam 8 hafta. V2 10 hafta = toplam 18 hafta (Pnömoni + Diyabet). CKD + Meme Kanseri V3'e düşer.

---

## 7. Feature Dependency Map

```
Spike (Kalp + 1 vaka):
M6 Anonim UUID ─┬── M1 3-panel UI
                │   ├── M2 Dictionary NLP ── M3 Statik hasta yanıtı
                │   └── M4 Statik test sonuç ── M5 Rule-score
                │                              │
                └── M7 Doktor onayı (gate) ─────┘
                                                ▼
                                       [SPIKE PASS gate]
                                                │
V1:                                              │
V1-1 Fuzzy+LLM NLP ←── M2 dictionary (genişlet)  │
V1-2 Generator ←── M4 statik range tabloları     │
V1-3 3 vaka ←── M3 + M4 (3× içerik)              │
V1-4 Supabase migration ←── SQLite spike          │
V1-8 Replay ←── M4 scoring + audit log           │
                                                │
                                                ▼
                                       [V1 PASS gate]
                                                │
V2:                                              │
V2-1 Pnömoni + X-ray ──► Storage cliff çözümü (TinyPNG/Cloudinary)
        │       │
        │       └── V2-2 Diyabet (generator genişlet ve yeni rubric)
        │                         │
        │                         └── V2-3 Spaced repetition (audit log'a dayalı)
        │
        └── D7 Repeated vaka ←── V2-3

Differentiator'lar (transversal):
D1+D2 Skorlama ←── M5 (MVP'de başlar)
D3 Türkçe NLP ←── M2 + V1-1 (genişler)
D4 İdeal yol ←── V1-5 breakdown
D5 Açıklanabilirlik ←── D1 + feedback panel
D6 Zero-auth ←── M6 (MVP)
D8 Eğitmen dashboard (V2+, talebe bağlı)
```

**Kritik bağımlılık**: `M7 doktor onayı` her geçişin gate'i. Reddedilirse → "kişisel deneme" kalır; öğrencilere açılmaz (product-strategist K1, feasibility K2 kill switch).

---

## 8. Competitive Feature Gap (vs ChatGPT / Anki / AMBOSS / OSCE)

| Feature | tıp_ai (us) | ChatGPT | Anki | AMBOSS/Osmosis | OSCE/SimMan | Gap Status |
|---------|--------|---------|------|----------------|-------------|------------|
| Türkçe dil | ✅ | ✅ | 🔄 (deck var ama zayıf) | ❌ | ✅ (üniv.) | Parity (ChatGPT ile) |
| Serbest metin anamnez | ✅ | ✅ | ❌ | 🔄 (sohbet var) | ✅ (standart hasta) | Parity |
| Test isteme pratiği | ✅ | 🔄 (sorular) | ❌ | 🔄 (soru-bazlı) | ✅ | **Differentiator** |
| Rubric + puanlama | ✅ | ❌ | 🔄 (yanlış kart) | ✅ (soru puanı) | ✅ (instructor) | **Differentiator** |
| Red flag negatif ceza | ✅ | ❌ | ❌ | ❌ | 🔄 | **Differentiator** |
| İdeal yol karşılaştırma | ✅ (V1) | ❌ | ❌ | 🔄 (cevap anahtarı) | ❌ | **Differentiator** |
| Açıklanabilir skorlama | ✅ | ❌ (halüsinasyon) | 🔄 | ✅ (soru bazlı) | 🔄 | **Differentiator** |
| 0 registration | ✅ | ❌ | 🔄 (hesap) | ❌ | ❌ (üniversite) | **Differentiator** |
| Ücretsiz erişim | ✅ | 🔄 (free tier) | ✅ | ❌ (ödeme) | ❌ (üniv.) | **Differentiator** |
| Evden erişim | ✅ | ✅ | ✅ | ✅ | ❌ | **Differentiator** (OSCE'ye karşı) |
| Görüntü (X-ray) | 🔄 (V2) | 🔄 | ❌ | ❌ | ✅ (manken) | Gap — V2 doldurur |
| Spaced repetition | 🔄 (V2) | ❌ | ✅ | ❌ | ❌ | Gap — D7 V2'de |
| Vaka sayısı | 1 (MVP), 3 (V1) | ∞ (kullanıcı prompt) | 300k deck kart | binlerce | 20-30 | **Gap (kasıtlı)** — 5 vaka hard limit |
| Gerçek hasta videosu | ❌ | ❌ | ❌ | ❌ (AMBOSS) | ✅ (standart hasta) | Gap, değil hedef |
| Eğitmen dashboard | 🔄 (V2-4) | ❌ | ❌ | ✅ (üniversite) | ✅ | Gap — talep yoksa yapma |
| TUS soru bankası entegrasyonu | ❌ | ❌ | ❌ | ✅ (TUS-DEX benzeri) | ❌ | Gap, ama hedef değil (klinik sim farklı kategori) |

**Net sonus**: tıp_ai'nin farklılaşması 5 eksende:
1. **Red flag negatif ceza + açıklanabilir puanlama** — ChatGPT'de yok
2. **Türkçe serbest metin + 0 registration** — AMBOSS/Osmosis'te yok
3. **Test isteme pratiği end-to-end** — Anki'de yok
4. **Evden + ücretsiz** — OSCE/SimMan'a karşı
5. **İdeal yol yan yana** — vaka kitaplarına karşı

**Tehdit**: Vaka sayısı (1-3) ChatGPT (~sınırsız) ile kıyaslanamaz fark. Mitigasyon: "5 vaka hard limit" — ama her vaka **uzun** vaka sim, "ChatGPT ile 5 dk" değil; farklı değer önermesi.

---

## 9. "What If" Senaryoları

| Scenario | Impact | Feasibility (tek dev) | Recommendation |
|----------|--------|----------------------|----------------|
| **Öğrenci her test sonucuna "kaynak" isterse?** | Yüksek güven, tıbbi referans | Düşük (Link column tabloya ekle) | **YAP** — feedback ekranına "Bu sonuç UCI Heart Disease satır 42 referansından" yazısı ekle; trust + pedagoji |
| **Öğrenci "ayrıcı tanı" modalı isterse?** | Düşük (V1-3 final_dx textbox yeter) | Düşük | **ERİŞ** — V2+: ayırıcı tanı reorder UI; MVP'de "serbest metin tanı yaz" yeter |
| **Uzman hekim rubric'i ücretsiz review etiquetmezse?** | Proje ölür (etik gate) | — | **Plan B**: vaka kitaplarından (Harrison vb.) "ideal yol" kaynak linki ile rubric doğrula; "kaynak referansı" kullanarak uzman orijinalitesini taklit et; ama 1 doktor en az 1 vakayı onaylamalı |
| **ChatGPT'ye "tıp_ai gibi hasta simulasyonu yap ama Türkçe + rubric puanlama" promptu çalışırsa?** | Project-strategist tehdit, değer %40 daralma | — | **Miti farklı啦啦**: "tıp_ai'de rubric insan-doktor-onaylı, scoring deterministik + açıklanabilir; ChatGPT halüsinasyon-riskli rubric." Bu yaşacak. README + ilk ekranda vurgula |
| **50 öğrenci aynı anda 5 vaka deneyse?** | Supabase free tier'ı aşma riski (storage cliff + bandwidth) | Orta | **Önceden hesapla**: 50 × 1 vaka × 2 test PNG = 100 görüntü × ~150KB = 15GB bandwidth/ay eğer resetlenir. Vercel Hobby 100GB yeter. Storage 50 PNG ≈ 500MB < 1GB. **OK V1 için**; 100 öğrenci → Pro threshold |
| **Bir öğrenci "lösemi ekle" isterse?** | Scope creep riski | — | **Reddet ama not tut**: 5 vaka hard limit; yeni hastalık yalnızca V2'de ve +doktor onayı + +klinik içeriği varsa |
| **NLP accuracy <85% olursa?** | K3 kill switch | — | **3 seçenek**: (a) chip-only UI'ya geç (UX düşer, ama doğru), (b) LLM her çağrıya taşı (maliyet $5-10/ay), (c) BERT Colab fine-tune (+2 hafta). Sırayla dene: önce chip, sonra hairy 之后 BERT |
| **Öğrenci haftalık vaka tekrarı isterse (Anki mimarisi)?** | Yüksek değer (retention) | V2 alanı | **D7 V2'ye bırak**: spaced repetition için "hatalı red flag" bazlı öneri; her öğrenciye kişisel bir Anki deck yerine tıp_ai bellek-açıdan deneyim |
| **Mobilde gerçekten kullanılırsa?** | Mobile responsive V1 zorunlu | Orta | **V1'de minimal mobile**: 3 panel → tabbed UI. Tam native app değil. PWA meta ekle |
| **Öğretmen bir sınıfa atama olarak kullanmak isterse?** | Yüksek değer ama scope | Yüksek | **V2-4 ancak talep olursa**: üniversite tıp kulübünden gerçek talep; yoksa skip. Tek kişi auth + dashboard yönetemez, değilse scope creep |
| **Topluluğu PR ile vaka göndersin?** | Bus factor kırıcı | Yüksek ama moderasyon bugünkü | **V2-5**: açık source + CONTRIBUTING + doktor review şart. Tek kişi yapmadan PR'leri gate'le. Eğer moderation strain olursa → Eğitmen dashboard öncelik |
| **Türkçe tıp araştırması için public synonym API?** | Marka + topluluk | Yüksek | **V3 opsiyonel**; önce kendi ürününü stabilize et. Outbound değil, önce inbound |

---

## 10. Top 5 Recommendations (Bu Hafta Başlanacak)

1. **D1+D2 — Rubric skorlama + red flag negatif ceza** (MVP, ~2 gün): ChatGPT/Anki'de yok, proje değerinin %40'ı. Deterministik + açıklanabilir olduğundan düşük efor + yüksek etki. Rule-based pure functions.

2. **M7 — Doktor onayı etik gate'i bugünden başlat** (içerik ~1 gün, doktor bekleme 2-4 hafta paralel): İçerik yazarken doktor beyaz-mantık tespit et. Onayı beklerken spike kodu geliştir. Bu, product-strategist K1 ve feasibility K2 kill-switch'i; atlatılmaz.

3. **M5 — Rule-based scoring + feedback ekranı** (MVP, ~2-3 gün): "Açıklanabilirlik" en güçlü trusted-differentiator. ChatGPT'nin halüsinasyon riskine karşı deterministik olma öne çıkar. JSON rubric + pure functions → LLM maliyeti yok.

4. **V1-7 — Soru chip'leri (önerilen soru butonları)** (V1, ~3 saat): NLP accuracy düşük kayıpочке; kalıcı savunma kalkanı + pedagojik "ipucu"; anında hata düşürme düşürme düşürme.

5. **V1-8 — Audit/replay (session_actions görselleştirme)** (V1, ~1 gün): session_actions tablosu spike'da yazılabiliyordu; frontend'i sadece 1 gün. Öğretmen/universite GTM için en ucuz özellik. Paylaşılabilir link (anonim) → GTM virality katkısı.

---

## 11. Features to Explicitly Avoid (Kill Your Darlings)

| Feature | Why Avoid | Revisit Condition |
|---------|-----------|-------------------|
| **Gerçek DICOM viewer (Cornerstone.js, iv.js)** | +32MB bundle, haftalar öğrenme eğrisi, tek kişiye ölümcül | Sadece V3+ — ve gerçek radyoloji eğitimine ihtiyaç olması; ilk önce png + zoom yolu (V2-1) başarıyla çalışsın |
| **LLM ile hasta yanıtı her çağrıda üretimi** | Cost patlar + deterministiklik kaybı + halüsinasyon riski + KVKK açıklanabilirlik kaybı | Asla — statik mapping + LLM varyasyon sadece cache + Tier A hit dışında, vaka seed ile |
| **Mikroservis refactor** | Operasyonel yük tek kişi için ölümcül; deployment / monitoring / log 5× | Asla (modüler monolit scope yeter) —除非 trafik 1000+ aktif / gün olursa |
| **Native mobile app (iOS/Android)** | İkinci app bakımı + App Store süreçleri + tıbbi içerik review'ü 2× | Asla V2-V3. PWA yeter. Unless V3'te massiv traction (5000+ aktif kullanıcı) + yatırım |
| **Voice recognition ("sesli anamnez")** | Türkçe STT kalitesi orta + backend complexity + iş + içerik match | V3 opsiyonel; ama önce web text'i → 2-3 ay stabil |
| **Tedavi doz hesaplama / ilaç interaksiyon kontrolü** | Tıbbi sorumluluk katlanır; KVKK "özel nitelikli kişisel veri"; drug database entegrasyon licensed product | Asla — kullanım şartları "eğitim amaçlı, klinik karar desteği değil" disclaimer ile örtüştürür |
| **AI-generated vaka (LLM vakayı uçtan uca üretir)** | Halüsinasyon → yanlış tıp eğitimi → etik responsibility (product-strategy K1) | Asla — vakalar elle yazılır, doktor onayı zorunlu. Vaka şablonu (V2-5) sadece moderasyonlu açık source |
| **Anki deck export** | Ürün kategorisi farklı (akıl yürütme vs ezber) | Asla — farklı positioning; Anki'nin tahtına çıkma | 
| **Ödeme entegrasyonu (Stripe/Iyzico)** | Tek kişi operasyonel yük + KVKK + ödeme verisi güvenlik | Asla bu proje scope'unda. "Buy me a coffee"/jar V2+ max |
| **Sosyal özellik (yorum/like/leaderboard)** | Tıp eğitiminde rekabetçi yanlış teşvik + moderasyon yükü | Asla — pedagojik açıdan (PEARLS framework "debrief" önerir, değil rekabet) |
| **Çoklu oyunculu pair simulation** | Real-time socket + matching + state sync. Tek kişiye ölümcül | Asla. Asenkron (V2-4 eğitim dashboard) sıra dışı |
| **TUS / Kurul sınavı src soru bankası** | Ticары tıp DTNE yakın licensing / içerik hakları + scope creep | Asla —分泌物 bu proje klinik sim değil sınav hazırlık |
| **Gerçek hasta verisi entegrasyonu (PHI)** | KVKK "özel nitelikli kişisel veri" + etik onay + veri temizleme yükü | Asla — sentetik vaka ürünün en büyük avantajı; bunu koru |
| **Otomatik guideline update crawler** | Web scraper bakımı + tıbbi doğrulama yine gerek | V3 opsiyonel; önce yıllık manuel review |

---

## 12. Özet — Özellik Disiplini İlkesi

Bu raporun tek geliştirici fizibilitesine uymayan **tek özellik** yoktur. İlke basit:

1. **MVP'de en az üten özellikle en yüksek değer (?**: rubric skorlama + red flag + Türkçe serbest metin. Bu değer önermesinin omurgası.
2. **Over-promise etme**: NIL "AI vakaları otomatik üretir", "sesli anamnez", "her hastalık", "ücretsiz ömürboyu". Bunlar eklemedi.
3. **Doktor onayı = özellik değil, gate**: M7 her fazın geçişinde onay şartı olarak işletilir.
4. **Tier B generator V1'e bırakılır**: spike statik enough. Tech-architect'ın kestiği gibi; reality-checker'ın "ilk prototip" önerisi V1'e taşınır, V1 V1……
5. **Differentiator'lar (D1, D2, D3, D6) MVP'de hazır**: ChatGPT'yi "sahiplen" → ChatGPT'nin yapamadığı dezavantajı öne çıkar.
6. **V2'den itibaren BUS FACTOR riski özellikleri ⚠️ işaretledim**: gerçek fizibilite talep bazlıdır; "ilk öğretmen/üniversite talep etmeden eğitim dashboard yapma" gibi disclaimer.
7. **NO-GO feature'leri yok olsun**: DICOM/LLM-real-time/mikroservis/native mobile tek developer için kapandı. V3+ traction bile olsa önce PWA + Cloudinary gibi alt-segment geçer.

**En kritik iki özellik**:
- **D1+D2 (rubric + red flag skorlama)** — ChatGPT'den farklılaşmanın minimum viableri
- **M7 (doktor onayı gate)** — etik sorumluluk + uzun-dönem güven

Bunlar olmazsa tıp_ai "ChatGPT'nin Türkçe hasta simulasyonu"ndan farkı olmayan bir cila oluyor. Bunlar varsa, 1 vaka + 1 hastalık bile "OK continue" feedback'i alır.

---

*Rapor sonucu: Spike (3 hafta, 7 core feature) → V1 (+5 hafta, 4 NLP/generator/vaka + 4 delight) → V2 (+10 hafta, 5 hastalık-eye correct scope). Scope Kalp'te sabit; expansion yalnızca hard gate'lerle.*