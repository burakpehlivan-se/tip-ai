# Teknik Mimari: Türkçe Klinik Karar Simülasyon Sistemi (tıp_ai)

> **Orthogonal constraint'ler**: Tek geliştirici (AI-assisted) · LLM bütçesi $10/ay · Colab model eğitimi için ek bütçe · "Yapabilir miyim" testi · Zaman sınırı yok ama hızlı iterasyon isteniyor.
> Mimari seçimlerde her karar bu 5 constraint'i test edilir. Eğer bir karar tek kişiyi boğarsa, reddedilir.

---

## 1. Mimari Karar (Pattern)

**Önerilen pattern: Modular Monolith (tek Next.js app)**

| Pattern | Bu proje için uygun mu? | Gerekçe |
|---|---|---|
| Modular Monolith | ✅ **SEÇİLDİ** | Tek geliştirici; deployment/operasyon yükü sıfır; modül sınırları kod içinde (case-engine, rubric-engine, nlp, scoring, test-gen) net tutulur. Mikroservis dağıtım kolaylığı getirmeyecek. |
| Mikroservis | ❌ | 5 servis = 5 deploy, 5 log, 5 monitoring. Tek kişi için operasyonel intihar. |
| Event-Driven | ❌ | Senkron interaktif bir öğrenme deneyimi — async gerek yok. |
| Serverless (Fn) | ⚠️ Kısmen | Next.js API route'ları zaten serverless ise. Tüm mimariyi buna dayamıyoruz. |

**Rationale (tek cümlede):** Öğrenci tek seferde tek vakayı tamamlar — bu bir request/response etkileşimidir; modüler monolit hem geliştirme hızını maksimize eder hem de ileride (eğer 100 öğrenciye ulaşırsa) modül sınırları zaten hazır olduğu için migration kolaydır.

---

## 2. Teknoloji Stack Önerisi

$10/ay budget, tek kişi, AI-assisted → **Vercel + Supabase + Gemini Flash (free tier)** kombinasyonu önerilir. Taban maliyet ≈ $0/ay, LLM sadece kaçış (fallback) için kullanılır.

| Katman | Seçenekler | Önerilen | Versiyon | Neden | Trade-off |
|---|---|---|---|---|---|
| **Frontend** | Next.js, SvelteKit, Remix | **Next.js 14 (App Router)** | 14.x | En geniş AI-assisted dev tooling'i (Cursor/Copilot en iyi Next.js'i bilir), Vercel'e tek tık deploy, React ekosistemi. | Daha ağır framework; SvelteKit daha hızlı embriyonik dev için ama AI tooling'i zayıf. |
| **UI Library** | shadcn/ui, MUI, AntD | **shadcn/ui + Tailwind** | latest | Komponentleri koda kopyalarsın (vendor değil), full kontrol, AI bilir. MVP'de ihtiyaç duyulan kart/badge/input/result-row'un hepsi hazır. | Dış vendor tema bağımlılığı yok ama kendi tutarlılığını korumak sana kalmış. |
| **Backend** | Next.js API routes, Express, FastAPI | **Next.js API Routes (Route Handlers)** | 14.x | Frontend ile aynı repo → tek deploy. Serverless function ücretsiz tier'da yeter. | Uzun süreli job (örn. model eğitimi) buradan çalışmaz; eğitim Colab'de, ayrı. |
| **DB** | Postgres (Supabase), SQLite (Turso) | **PostgreSQL via Supabase** | 15 | Ücretsiz tier 500MB + auth + storage (X-ray PNG'leri için) + row-level security. KVKK için RLS hazır. | Çok hafif ihtiyaç için overkill; ama storage dahil olması tek araç. |
| **Cache** | Redis, Upstash, LRU in-memory | **İhtiyaç yok MVP'de** | — | Single dev + düşük trafik; Next.js fetch cache yeter. | İleride synonym lookup cache istenirse Upstash free tier ($0). |
| **Queue** | BullMQ, SQS | **Yok** | — | Senkron interaktif sistem; vaka sonunda kişi puanlama bekler. | İleride "vaka üret" arka plan job'u istenirse Vercel Cron + DB status. |
| **LLM (normalize fallback)** | GPT-4o-mini, Gemini Flash, Claude Haiku | **Gemini 2.0 Flash (free tier)** | API | Ücretsiz tier ~15 req/dk, 1500/gün — synonym normalizasyon fallback'i için fazlasıyla yeter. Türkçe'yi yeterli normalize eder ($0 LLM cost). | Free tier rate limit'i var; bu yüzden **önce rule-based, LLM sadece kaçış**. |
| **LLM (puanlama)** | GPT-4, Claude Sonnet | **MVP'de yok** (rul tabanlı) | — | Deterministik + açıklanabilir + $0. Açıklanabilirlik eğitim aracı için LLM'den daha güvenilir. | Doğal dil esnek yorumlama eksik — v2'ye bırakılır. |
| **Image Viewer** | Cornerstone.js (DICOM), iv.js, plain `<img>` | **plain `<img>` + Tailwind zoom-on-click** | — | MVP'de DICOM yok, Kant dataset zaten PNG. Detaylı viewer learning eğrisi +32MB bundle = tek kişi için intihar. | DICOM gerçekçi radiology deneyimi istenirse iv.js (WebGL) ileride eklenir. |
| **Hosting** | Vercel, Railway, Fly.io | **Vercel** (frontend+API) + **Supabase** (DB+storage) | — | İkisi de free tier; tek deploy `vercel --prod`. | Vercel hobby tier 100GB bandwidth/ay — sadece lokal öğrenci testi için yeter. |
| **CI/CD** | GitHub Actions, Vercel_auto | **Vercel otomatik + GitHub Actions (lint/test)** | — | Push → Vercel preview, main → prod. GitHub Actions sadece `npm test`. | Sponsorlu runner yok ama ücretsiz 2000 dk/ay yeter. |
| **Test** | Vitest, Jest, Playwright | **Vitest (unit) + Playwright (E2E kritik akış)** | latest | Vitest Vite ile uyumlu, hızlı. Playwright: "vaka aç → soru sor → test iste → puanla" E2E. | Playwright biraz ağır; sadece tek "happy path" smoke test yeter. |
| **Türkçe NLP** | Türkçe BERT, spaCy-tr, simple dictionary+fuzzy | **Dictionary + Fuzzy + LLM fallback (3 katman)** | — | BERT fine-tuning Colab'de mümkün ama serving maliyet ve karmaşıklık tek kişiyi boğar. Fuzzy + LLM kaçış pratikte %95+ yakalar. | BERT seviyesinde synonym varyasyon yakalama biraz daha zayıf; kabul edilebilir. |

**Aylık maliyet tahmini:**
- Vercel Hobby: $0
- Supabase Free: $0
- Gemini Flash free tier: $0 (MVP trafik için)
- GitHub Actions: $0
- Toplam: **$0/ay base**. $10/ay bütçe sadece eğer Gemini limit aşımı olursa veya Colab Pro gerekirse kullanılır.

---

## 3. Sistem Mimarisi Diyagramı

### Level 1 — Context

```
 ┌──────────┐         ┌──────────────────────────┐         ┌──────────┐
 │ Tıp      │  HTTPS  │  tıp_ai (Vercel)          │  fetch   │ Supabase │
 │ Öğrencisi│────────▶│  Next.js App Router       │─────────▶│ Postgres │
 │ (Browser)│         │  (Frontend + API Routes)  │         │ + Storage│
 └──────────┘         └──────────────────────────┘         └──────────┘
                                  │                              ▲
                                  │ (fallback only)             │  (PNG X-ray)
                                  ▼                              │
                       ┌──────────────────────┐                 │
                       │ Gemini Flash API      │                 │
                       │ (free tier, LLM escape│                 │
                       │  for Türkçe normalize)│                 │
                       └──────────────────────┘                 │
                                  │                              │
                                  ▼                              │
                       ┌──────────────────────┐                 │
                       │ Google Colab (offline)│                 │
                       │  • synonym model fine │                 │
                       │  • BERT (opsiyonel)   │                 │
                       │  • sonuçları DB'ye push│                 │
                       └──────────────────────┘
```

### Level 2 — Container (tek app, içinde modüler kod)

```
NEXT.JS APP (modüler monolit)
├── app/                       ← sayfalar (route)
│   ├── /vakalar               ← vaka seçim listesi
│   ├── /vaka/[id]             ← vaka çalışma ekranı (3-panel)
│   └── /vaka/[id]/sonuc       ← değerlendirme ekranı
│
├── app/api/                  ← Route Handlers (backend)
│   ├── /api/cases/[id]       ← vaka getir
│   ├── /api/ask              ← soru sor → NLP normalize + hasta response
│   ├── /api/test/request     ← test iste → sonuç üret/dön
│   ├── /api/test/result/[id]← test sonucu getir
│   └── /api/evaluate         ← vaka sonu değerlendirme
│
├── lib/                      ← MODÜLLER (sınır burada)
│   ├── case-engine/          ← vaka state, scenario seeding
│   ├── rubric-engine/        ← beklenen aksiyonlar, kırmızı çizgiler
│   ├── nlp/                  ← Türkçe normalizasyon (3-katman)
│   │   ├── dictionary.ts
│   │   ├── fuzzy.ts
│   │   └── llm-fallback.ts
│   ├── test-generator/       ← "istenen test sonucu üret" motoru
│   │   ├── static.ts
│   │   ├── generator.ts
│   │   ├── dataset-extract.ts
│   │   └── image-lib.ts
│   ├── scoring/              ← kural tabanlı puanlama
│   ├── patient-response/     ← öğrenci sorusuna hasta yanıtı
│   └── data/                 ← vaka JSON'ları, rubric JSON'ları
│
└── components/               ← shadcn/ui tabanlı UI
    ├── PatientPanel.tsx
    ├── ChatPanel.tsx
    ├── TestPanel.tsx
    └── ResultViewer.tsx
```

### Level 3 — Runtime veri akışı (tek interaksiyon)

```
 browser (React) ──POST /api/ask {vakaid, soru:"kan şekeri kaç?"}
      │
      ▼
 Route Handler
      │
      ├─▶ nlp.normalize(soru)
      │      ├─ Layer 1: dictionary lookup  → hit? dön
      │      ├─ Layer 2: fuzzy (rapidfuzz) threshold 0.85 → hit? dön
      │      └─ Layer 3: Gemini Flash (cached 24h) → kaçak sinonim
      │                  ⇒ normalized aksiyon = "kan_sekeri_sor"
      │
      ├─▶ case-engine.getPatientResponse(case, normalizedAction)
      │      ⇒ hasta yanıtı: "birkaç yıldır yüksek, dün evde 220 ölçmüş"
      │
      ├─▶ rubric-engine.recordAction(case, normalizedAction, phase)
      │      ⇒ aksiyon rubric'e kaydedilir (puan vaka sonunda)
      │
      └─▶ yanıt döner → ChatPanel'e push
```

---

## 4. Component Breakdown

| Component | Sorumluluk | Teknoloji | Bağımlılıklar |
|---|---|---|---|
| **case-engine** | Vaka state'i tutar, scenario seed'ini verir, hangi fazda (anamnez/fizik/test/tanı) olduğunu izler, kullanıcı aksiyonlarını loglar. | TS class, in-memory + DB | DB (case_state tablosu) |
| **rubric-engine** | Her hastalık için JSON rubric'ten beklenen/istenmeyen aksiyonları yükler. Öğrenci aksiyonu geldiğinde "matched / missed-for-now / unrelated" olarak işaretler. | TS class + JSON data | — |
| **nlp** | Serbest Türkçe soruyu normalize aksiyona çevirir: dictionary → fuzzy → LLM fallback. 24h cache. | rapidfuzz (WASM) + Gemini Flash | Supabase (cache) |
| **test-generator** | "İstediği test sonucunu göster" gereksiniminin kalbi. Üç alt strateji (bkz. §8). | TS + seeding | rubric (gerçek tanı ile tutarlılık için) |
| **scoring** | Vaka sonunda rubric'e göre puan üretir. Deterministik kural tabanlı. | TS pure functions | rubric-engine |
| **patient-response** | Normalize aksiyona karşılık hasta yanıtı üretir. Statik mapping (önceden yazılmış hasta yanıtları) + LLM varyasyon (opsiyonel). | TS + opsiyonel LLM | case JSON |
| **ResultViewer** | Test/görüntüleme sonucu gösterimi. PNG/JSON/text. Basit zoom. | React + shadcn | — |
| **ChatPanel** | Sohbet akışı + serbest metin + chip önerileri. | React + zustand (local state) | — |
| **TestPanel** | Searchable dropdown ile test isteme. Kategoriler: lab / görüntüleme / diğer. | React + cmdk | — |
| **PatientPanel** | Hasta kartı — ad/yaş/cinsiyet, ana şikayet, mevcut bulgular. | React | — |

---

## 5. Data Flow — Tam Akış

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. VAKA SEÇİMİ                                                                │
│    Öğrenci Level/Konu gir → GET /api/cases?level=...&topic=...              │
│    case-engine: o filtre uygun 5 vakadan uygun olanı getir (Vaka JSON)       │
│    Vaka state DB'ye yaz (start timestamp)                              ───┐  │
└─────────────────────────────────────────────────────────────────────────────┘  │
                                                                                  │
┌─────────────────────────────────────────────────────────────────────────────┐  │
│ 2. SORU SORMA (tekrarlı)                                                     │ │
│    ┌─ Öğrenci: "Ağrı yayılıyor mu?" (serbest metin) ──────────┐              │ │
│    │  veya chip seç: [yer] [süre] [yayılım] [anterior] ...    │              │ │
│    └────────────────────┬─────────────────────────────────────┘              │ │
│                         ▼                                                    │ │
│   nlp.normalize("Ağrı yayılıyor mu?")                                         │ │
│       ├─ dictionary: "yayılım" → aksiyon: PAIN_RADIATION_ASK                 │ │
│       └─ (hit)                                                                │ │
│   patient-response(case, PAIN_RADIATION_ASK)                                 │ │
│       → "Evet, sol kola ve çeneye yayılıyor."                                │ │
│   rubric-engine.record(PAIN_RADIATION_ASK, phase=ANAMNEZ)                    │ │
│       → nil (puan vaka sonunda)                                               │ │
│   browser: chat'e push                                                        │ │
│   ⤴ tekrar                                                                    │ │
└─────────────────────────────────────────────────────────────────────────────┘ │
                                                                                  │
┌─────────────────────────────────────────────────────────────────────────────┐ │
│ 3. TEST İSTEME                                                                │ │
│    Öğrenci: dropdown'dan "EKG" seçer (veya "kalp grafisi" yazar)            │ │
│         ▼                                                                     │ │
│    nlp.normalize("EKG") → ECG_REQUESTED                                       │ │
│         ▼                                                                     │ │
│    rubric-engine.record(ECG_REQUESTED, phase=TEST)                            │ │
│         ▼                                                                     │ │
│    test-generator.get(case_id, ECG):                                          │ │
│       1. Static? — case JSON'da önceden var mı? EVET → döner.                │ │
│       2. Generator? — üretilmiş ve cache'lenmiş mi? → döner.                  │ │
│       3. Üret — dataset-extract(disease) veya generator → DB cache'le → döner│ │
│         ▼                                                                     │ │
│    browser: ResultPanel göster — EKG JSON veya çizgi grafiği                │ │
│    (röntgen/MR istendiyse PNG image-lib'den)                                 │ │
└─────────────────────────────────────────────────────────────────────────────┘ │
                                                                                  │
┌─────────────────────────────────────────────────────────────────────────────┐ │
│ 4. ÖN TANI GİRME                                                              │ │
│    Öğrenci: "Akut koroner sendrom" yazar → nlp → DX_HYPOTHESIS               │ │
│    rubric-engine.record(case, DX, final=true)                                │ │
└─────────────────────────────────────────────────────────────────────────────┘ │
                                                                                  │
┌─────────────────────────────────────────────────────────────────────────────┐ │
│ 5. DEĞERLENDİRME (vaka sonu)                                                  │ │
│    Öğrenci: "Vakayı tamamla" butonuna basar                                  │ │
│         ▼                                                                     │
│    POST /api/evaluate { case_id, session_id, final_dx }                       │ │
│         ▼                                                                     │ │
│    scoring.evaluate(case, record):                                            │ │
│       ├─ Beklenen sorular soruldu mu? (rubric expected)                      │ │
│       ├─ Red flag atlandı mı? (-3 / -5)                                       │ │
│       ├─ Gereksiz test istendi mi? (-1)                                      │ │
│       ├─ Doğru testler zamanında mı?                                          │ │
│       ├─ Tanı doğru mu?                                                      │ │
│       ⇒ toplam skor + rubric bazlı开放式 feedback                                │
│         ▼                                                                     │
│    browser: /sonuc ekranı — puan + kazanımlar + eksikler + eğitim notu        │ │
└─────────────────────────────────────────────────────────────────────────────┘ │
                                                                                  │
 (DB'ye student_progress kaydı yazılır) ◀──────────────────────────────────────┘
```

---

## 6. API Tasarımı

> Tüm API'ler Next.js Route Handler. Auth: opsiyonel eğitim modda yok; ileride Supabase Auth eklenir. Request/Response JSON. Hatalar tek biçimde: `{ "error": "msg", "code": "STR" }`.

### 6.1 Vaka listesi
```
GET /api/cases?level=beginner&topic=kardiyoloji
200: { cases: [{ id, title, presenting_complaint, difficulty }] }
400: { error: "invalid filter", code: "BAD_FILTER" }
```

### 6.2 Vaka detayı (çalışma ekranı)
```
GET /api/cases/:id
200: {
  case_id, presenting_complaint, patient: { age, sex, ... },
  scenario_seed, // deterministik veri üretimi için
  initial_findings: [...],
  suggested_question_chips: ["Yer","Süre","Yayılım",...], // opsiyonel ipucu
}
404: { error: "case not found", code: "NO_CASE" }
```

### 6.3 Soru sorma (anamnez / fizik muayene)
```
POST /api/ask
Body: { case_id, session_id, text: "Ağrı yayılıyor mu?" }
200: {
  patient_reply: "Evet, sol kola...",
  normalized_action: "PAIN_RADIATION_ASK",
  phase: "ANAMNEZ"
}
400: { error: "empty text", code: "EMPTY" }
422: { error: "tamamlanmış vaka", code: "CASE_DONE" }
Dependencies: nlp, patient-response, rubric-engine
```

### 6.4 Test isteme
```
POST /api/test/request
Body: { case_id, session_id, test_key: "ECG" | text: "kalp grafisi bak" }
200: {
  test_id, test_key, result_type: "json"|"image"|"text",
  result: { ... } | { image_url, caption },
  generated_by: "static"|"generator"|"dataset"|"image_lib",
  warning: "ilgili değil" | null   // rubric'e göre uyarı (negatif icin değil, sadece user feedback için)
}
400: { error: "unknown test", code: "NO_TEST" }
422: { error: "max test limiti doldu", code: "LIMIT" }   // maliyet koruması
```

### 6.5 Değerlendirme
```
POST /api/evaluate
Body: { case_id, session_id, final_dx: "Akut koroner sendrom" }
200: {
  score: { total: 78, max: 100, breakdown: {...} },
  feedback: {
    strengths: ["EKG'yi erken istedi"],
    weaknesses: ["Troponin istemedi"],
    red_flags_missed: ["aile öyküsünü sormadı"],
    expected_path: [...],
    note: "Kısa eğitim notu..."
  },
  dx_correct: true
}
422: { error: "vaka tamamlanmamış", code: "INCOMPLETE" }
```

### 6.6 Öğrenci ilerlemesi (opsiyonel v1.1)
```
GET /api/student/progress?session_id=...   // anonim (session id = UUID)
```

---

## 7. Veritabanı Şeması (PostgreSQL / Supabase)

> İlk sürümde **maksimum 10 tablo**. Tek geliştirici için migration sürdürme maliyeti yüksek → minimal şema.

```sql
-- 1) Hastalık kütüğü (statik veri)
diseases (
  id SERIAL PK,
  key TEXT UNIQUE,         -- 'kalp', 'diyabet', ...
  name_tr TEXT,           -- 'Kalp Hastalığı'
  icd10 TEXT,             -- referans için
  topic TEXT,             -- 'kardiyoloji'
  summary TEXT
);

-- 2) Vakalar (önceden yazılı JSON dosyalar → DB seed)
cases (
  id UUID PK,
  disease_id INT FK,
  title TEXT,             -- 'Göğüs Ağrısı ile Başvuran 58 Yaş Erkek'
  difficulty TEXT,       -- beginner/intermediate/advanced
  scenario_seed TEXT,     -- test-generator deterministik için (örn "case_001_kalp")
  presenting_complaint TEXT,
  patient_json JSONB,     -- { age, sex, history, vitals }
  initial_findings_json JSONB,
  expected_dx TEXT,
  rubric_id UUID FK,     -- beklenen akış + red flags
  is_active BOOLEAN
);

-- 3) Her vaka için önceden pişmiş statik test sonuçları (Tier A)
case_static_results (
  case_id UUID FK,
  test_key TEXT,         -- 'ECG', 'CBC', 'TROPONIN'
  result_json JSONB,     -- { "st_elevation": true, "leads": ["II","III","aVF"] }
  result_image_url TEXT, -- null for non-imaging
  PRIMARY KEY (case_id, test_key)
);

-- 4) Rubric — beklenen aksiyonlar (JSON tek satır, kolay edit)
rubrics (
  id UUID PK,
  disease_id INT FK,
  expected_questions JSONB,   -- ["PAIN_RADIATION_ASK", "ASSOCIATED_SYMPTOMS_ASK"]
  expected_tests JSONB,       -- ["ECG_REQUESTED", "TROPONIN_REQUESTED"]
  discouraged_tests JSONB,   -- ["CT_HEAD_REQUESTED"] (erken aşamada)
  red_flags JSONB,           -- ["SUDDEN_TEARS_ASK", "SYNCOPE_ASK"]
  expected_dx JSONB,         -- ["AKS","unstable_angina"]
  scoring_weights JSONB,    -- {PAIN_RADIATION: 2, ECG: 3, RED_FLAG_MISS: -5,...}
  version INT
);

-- 5) Türkçe synonym dictionary (TEXT formatında)
test_aliases (           -- "EKG çek","kalp grafisi","elektrokardiyografi"
  test_key TEXT,
  alias_tr TEXT,
  PRIMARY KEY (test_key, alias_tr)
);
question_aliases (       -- "ağrı yeri","ağrı nerede" → PAIN_LOCATION_ASK
  action_key TEXT,
  alias_tr TEXT,
  PRIMARY KEY (action_key, alias_tr)
);

-- 6) NLP LLM sonuç cache (24h) — Gemini çağrı maliyetini düşür
nlp_cache (
  raw_text TEXT,
  normalized_action TEXT,
  source TEXT,           -- 'dict'|'fuzzy'|'llm'
  confidence REAL,
  cached_at TIMESTAMPTZ,
  PRIMARY KEY (raw_text)
);

-- 7) Üretilmiş test sonuçları (Tier B/C cache) — aynı vakada tekrar üretmemek için
generated_test_results (
  case_id UUID,
  test_key TEXT,
  generated_by TEXT,    -- 'generator'|'dataset'|'image_lib'
  result_json JSONB,
  result_image_url TEXT,
  generated_at TIMESTAMPTZ,
  PRIMARY KEY (case_id, test_key)
);

-- 8) Öğrenci oturumları (anonim)
sessions (
  id UUID PK,
  case_id UUID FK,
  student_label TEXT,    -- opsiyonel "okul + seviye"
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 9) Aksiyon log (öğrencinin her adımı)
session_actions (
  id BIGSERIAL PK,
  session_id UUID FK,
  step_no INT,
  raw_text TEXT,
  normalized_action TEXT,
  nlp_source TEXT,
  phase TEXT,            -- anamnez/fizik/test/dx
  recorded_at TIMESTAMPTZ
);

-- 10) Vaka sonu değerlendirme
session_evaluations (
  session_id UUID PK,
  total_score INT,
  max_score INT,
  breakdown_json JSONB,
  feedback_json JSONB,
  dx_correct BOOLEAN,
  created_at TIMESTAMPTZ
);
```

**Indexes (kritik olanlar):**
- `cases(disease_id, difficulty)` — filtreleme için
- `nlp_cache(raw_text)` PK (zaten)
- `session_actions(session_id, step_no)` — replay için
- `test_aliases(alias_tr)` — synonym lookup O(1)

**Veri saklama:** Eğitim amaclı → 2 yıl sonra anonim aggregate'e düşür. `session_actions` ve `session_evaluations` 24 ay saklanır, sonra yıllık aggregate tabloya yazılır (`yearly_stats`), detay silinir. KVKK için "eğitim amaçlı anonim oturum" → kişisel veri sayılmaz (isim yok).

---

## 8. "İstediği Test Sonucunu Göster" Mekaniği (KRIPTİK GEREKSİNİM)

Bu, MVP'nin en yüksek riskli gereksinimidir. Öğrenci rastgele test isteyebilir; sistemın ya doğru yanıt vermesi ya da uygun şekilde "bu istek mantıklı değil ama işte sonuç" demesi gerekir.

### 8.1 Strateji: Tiered Test Result Supply

Her test için öncelik sırası denenir, ilk hit döner:

```
┌──────────────────────────────────────────────────────────────────┐
│ Tier A — STATİK (önceden pişirilmiş)                            │
│ Vaka JSON yazılırken, her vaka için beklenen ve kritik testlerin │
│ sonuçları elle yazılır. Öğrenci ECG istediğinde 0 ms döner.      │
│ ÖRNEK:                                                          │
│ { test_key:"ECG", result_json: { heart_rate:..., st:, ... } }   │
│ Maliyet: ilk 5 vaka için elle 30 dk × 5 = 2.5 saatlık iş.       │
└──────────────────────────────────────────────────────────────────┘
                                ▼ (hit yoksa)
┌──────────────────────────────────────────────────────────────────┐
│ Tier B — GENERATOR (deterministik, seeded)                       │
│ test_generator.generate(case_seed, test_key) → sonuç             │
│ Mantık:                                                         │
│   • Hastalık ground truth = expected_dx                           │
│   • Test'in klinik aralığı: normal [-] hastalık [+/-...]         │
│   • Seed ile PRNG → tutarlı numerik                             │
│ ÖRNEK: Troponin istendi AMA statik sonuç yazmadın:               │
│   seed=hash(case_seed+"TROPONIN") → sonuç 0.8 ng/mL (high)       │
│ Hastalık tipine göre normal/abnormal val. üretir.                │
│ Aynı vakada tekrar istense → aynı sonuç (cache + generated_test) │
└──────────────────────────────────────────────────────────────────┘
                                ▼ (hit yoksa)
┌──────────────────────────────────────────────────────────────────┐
│ Tier C — DATASET extraction                                      │
│ Hastalık için dataset var ise:                                   │
│   • UCI Heart Disease satırı → laboratuvar panel üret             │
│   • UCI CKD → renal panel                                         │
│   • Kaggle Pneumonia PNGs → röntgen görüntüsü                       │
│   • Wisconsin FNA → numeric biyopsi sonucu                        │
│ Mapping: dataset feature → test_key (statik dosyalama, Colab'de) │
│ Bu tier'dan sonra cache.                                          │
└──────────────────────────────────────────────────────────────────┘
                                ▼ (klinik olarak uygunsuz ise)
┌──────────────────────────────────────────────────────────────────┐
│ Tier D — "UYARI + YİNE DE VER"                                    │
│ Öğrenci obez hastaya "kanama zamanı" istedi (anlamsız):           │
│   • Sistem uyarı döner: "Bu test bu vaka için standart değil"    │
│   • Ama yine de normal referans aralığında sonuç döner             │
│   • rubric bunu negatif(-1) işaretler                             │
└──────────────────────────────────────────────────────────────────┘
                                ▼ (asla üretemeyecekse)
┌──────────────────────────────────────────────────────────────────┐
│ Tier E — REJECT (minimal)                                         │
│ "Sisteme kayıtlı olmayan test": { error: "uygun değil" }          │
│ Yalnız <5 durum. Çoğu zustand kapsanır.                          │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Test tiplerine göre veri üretme stratejisi

| Test tipi | Strateji | Örnek |
|---|---|---|
| **Numerik lab** (CBC, troponin, kreatinin, HbA1c, ürik asit) | **Tier B — generator**. Cinsiyet+yaş+seed ile normal aralıkta veya disease-aware abnormal. PRNG seed = `hash(case_seed+test_key)`. | `{ hemoglobin: 11.2, wbc: 7.4, platelet: 245 }` |
| **Panel** (renal panel, karaciğer panel) | **Tier B**, alt testlerin hepsi aynı seed ile üretilir. | `{ urea: 78, creatinine: 2.3, na: 142, k: 5.1 }` |
| **EKG** (12 derivasyon) | **Tier A static** (5 vaka elle EC yazılır). Sonra Tier B'de sade JSON. | `{ rhythm: "sinüs", hr: 92, st_elevation: "II,III,aVF" }` |
| **Röntgen (PA akciğer)** | **Tier C — Kaggle Pneumonia dataset**. Case ile eşleştir: bu vakanın tanısı pnömoni → gerçek pnömoni PNG'si göster. Normal vaka → normal PNG. | `<img src="supabase storage URL">` + rapor metni |
| **MR / BT / Tomografi** | **Tier B (text rapor)** + **yoksa Tier C placeholder**. Gerçek DICOM/MR clienti için ileride. MVP'de: radyoloji raporu (Türkçe metin) + opsiyonel охра placeholder PNG. | `{ findings: "Apikal segmentte... ", impression: "Şüpheli lezyon" }` |
| **Hikaye/Anamnez sorusu** | **patient-response** modülü. Statik cevap → Tier A. Olmayınca LLM (Gemini Flash, case seed) ile ~. | "Evet, baba kalp krizi geçirdi." |
| **Gaita/İdrar** | Tier B | `{ color: "koyu", ph: 5.2, nitrite: pozitif }` |

### 8.3 Önemli: Deterministiklik garantisi
- `seed = hash(case_id + test_key)`
- Aynı vaka + aynı test → her zaman **aynı** sonuç
- Üretildikten sonra `generated_test_results` tablosuna yazılır → hiçbir zaman tekrar üretilmez
- LLM çağrıları (Tier-+) **asla fedakarlık etmez**: sadece kullanılmaz, kullanılmaz, kullanılmaz. **LLM yalnızca NLP kaçak synonym için kullanılır, test üretiminde değil** (maliyet + deterministiklik).

---

## 9. Röntgen / MR Görüntüleme Tekniği

### 9.1 MVP Kararı: **PNG + basit `<img>` + zoom-on-click**. DICOM'a **gerek yok**.

| Seçenek | Öneri | Gerekçe |
|---|---|---|
| DICOM + Cornerstone.js | ❌ REDDEDİLDİ (MVP) | Bundle +32MB, öğrenme eğrisi haftalar, gerçek DICOM datası yok elimizde. Eğitim değerine katkısı marginal. |
| PNG + sade `<img>` | ✅ **SEÇİLDİ** | Kaggle Chest X-Ray zaten PNG. Supabase storage → CDN URL. React `<img>` → Tailwind `object-contain`. Çok basit modal zoom yeter. |
| WebGL viewer (iv.js) | ⚠️ v2 | Gerçek radiology UX gerekirse. Şimdi değil. |

### 9.2 MVP viewer davranışı
```tsx
// <ResultImage result={...} />
<div>
  <img src={result.image_url}
       alt={result.caption}
       className="object-contain max-h-[60vh] rounded border cursor-zoom-in"
       onClick={() => setZoom(true)} />
  <p className="text-xs text-gray-600">{result.caption}</p>
  {zoom && <Modal> <img src={...} className="max-w-full" /> </Modal>}
</div>
```

### 9.3 Röntgen/MR görüntü kütüphanesi
- **Pnömoni (Kaggle Chest X-Ray)**: ~5800 PNG → selective subset (50-100 vaka), Supabase storage'a yüklenir, database'de `image_library` meta tablosu (opsiyonel). Caption → TürkçeRAPORMENTARazı.
- **Kalp (EKG)**: EKG'ye PNG değil, **metin/JSON** (yukarıda). EKG çizimi isterse SVG'den basit polyline (ileri v).
- **MR/BT/Meme USG**: MVP'de **radyoloji raporu metni** + opsiyonel genericjemline placeholder PNG (CC-licensed). Gerçek görüntü: dataset olmayanlar için **yorum + tipik özet** yeter.

**Sonuç:** MVP'de tek "gerçek görüntü tipi" = akciğer röntgeni. Diğerleri için **yazılı rapor** yeterli. Bu tek kişi için uygundur.

---

## 10. "İlk Akyıllı 5 Hastalık" Stratejisi

### Kritik karar: **5 hastalığı BİRDEN ÖNCE, YALNIZCA BİRİ (Kalp Hastalığı) ile end-to-end prototype çıkarılır.**

**Neden?**
- 5 hastalığın hepsini aynı anda yapmak → her katmanda 5'er kez spec/data/rubric yazma. Tek kişi => sürünür, motivasyon kırılır.
- 5 hastalık **içerik** problemidir, mimari problemi **değildir**. Mimari ilk hastalıkta doğrulanmalı, sonra içerik tekrarlanır.
- "Yapabilir miyim" testi → ilk hasta end-to-end çalışırsa diğer 4 = içerik üretmek için linear effort.

### Tek hastalığı şeç: **Kalp Hastalığı**

| Kriter | Kalp | Diyabet | CKD | Pnömoni | Meme K. |
|---|---|---|---|---|---|
| Enrich numeric dataset | ✅ UCI Heart | ✅ | ✅ | partial | ✅ |
| Görüntüleme var | ❌ (basitlik) | ❌ | ❌ | ✅ (X-ray) | ✅ |
| Klasik OSCE vaka | ✅ | ✅ | partial | ✅ | ✅ |
| En az komponent bağımlılığı | **✅ minimal** | partial | partial | needs viewer | needs viewer |
| Rubric en net | ✅ | ✅ | partial | ✅ | ✅ |
| Hızlı end-to-end | **✅** | ✅ | partial | partial | partial |

Kalp seçildi çünkü: görüntü viewer'ı gerekmez (MVP'de), EKG/kan sonuçları numerik (kişiye en yakın dataset), kalp semptomları en bilindik → rubric'i yazmak en kolay, "student feedback" almak en hızlı.

### Önerilen sıra:
```
M0 (1-2 hafta): Mimari spike — sadece /vaka/anmecineccc; tek vaka pipeline.
   ├─ Frontend: 3 panel boş iskelet + Chat + Test dropdown
   ├─ nlp: sadece kalp için 20 synonym (manual)
   ├─ test-gen: sadece ECG + Troponin + CBC
   ├─ rubric: sadece kalp için tek vaka, 10 expected aksiyon
   └─ Depoy: SQLite-pratik → sonra Supabase.
M1 (1 hafta): Kalp vakasının tüm pipeline'ı — 3 vaka seed. Feedback topla.
M2 (1 hafta): Pnömoni ekle (X-ray viewer gerçek görüntü testi).
M3 (1 hafta): Diyabet ekle.
M4-M5: CKD + Meme Kanseri.
```

### İçerik-üretim maliyeti (kalp baz alınca):
- 5 vaka seed × ~2 saat =
- Hastalık başına 5 vaka × ~3 saat =
- Total içeriği ve data seed 5×5=25 vaka ≈ 3-5 saat.
- Bu _sürükle-bırak_. AI-asistan bunu hızlandırır.

---

## 11. Sicherheitsmodell (KVKK / Tıbbi Veri)

| Konu | Yaklaşım | Detay |
|---|---|---|
| **Authentication** | Anonim session UUID (v1) → Supabase Auth e-posta (v1.1) | MVP'de e-postasız. Her öğrenci bir UUID. Veriler onuolojiyle bağlanır. |
| **Authorization** | RLS (Row Level Security) Supabase | Sessions/patients yalnız sahibine görünür (`auth.uid() = owner_uuid`) — ama anonim session modunda RLS devre kalkar (kendi session id token). |
| **Veri şifreleme** | TLS (Vercel/Supabase zorunlu) + storage şifreleme | Supabase storage (X-ray PNGs) yol token URL ile (24h signed). |
| **PHI / Tıbbi veri** | **YOK** (sentezlenmiş vakalar) | Hastalar sentetik. Gerçek hasta verisi yok → KVKK "özel nitelikli kişisel veri" kapsamında değil. Bu büyük vicudanlık avantaj. Bunları README'de not et. |
| **Öğrenci verisi** | E-posta (v1.1) → KVKK "kişisel veri" | E-posta tek kişisel veri. Sadece anonim toplama (yaş/seviye) → etik sıkıntı yok. |
| **Girdi validasyonu** | Zod (Next.js ile beyi) | API girişleri her yerde schema validation. |
| **Hız sınırı** | Upstash Ratelimit (free tier) | `3 req/5sn/IP` veya `100/vaka`. Gemini'i korumak için. |
| **Secret yönetimi** | Vercel env vars + Supabase Vault | `.env.local` dev, Vercel prod env vars. `.env` git'e değil. |
| **CORS / CSP** | Next.js `next.config.js` headers dizisi | strict CSP, önlem. |
| **Audit log** | `session_actions` tablosu | Tüm öğrenci aksiyonları replay için saklı (24 ay). |

---

## 12. İş Akış Spesifikasyonları

### Workflow 1: Soru Sorma — Mutlu Yol
**Trigger**: Öğrenci ChatPanel'e metin yazar + Enter.
1. `post /api/ask` → nlp.normalize
2. Layer 1 dictionary hit → action
3. patient-response → Türkçe yanıt (statik veya varyasyon)
4. rubric-record → phase=ANAMNEZ
5. browser chat push

**Failure modes:**
- **400 boş metin**: frontend'de disable, hiç API'ye gitmez.
- **NLP — üç katman da hit etmez**: choose default action = `UNKNOWN_QUESTION` → hasta: "Bunu tam anlamadım, daha açıklayabilir misiniz?" → öğrenciye re-affordance. Puan +0. Maliyet yok.
- **Gemini rate-limit (Tier-3 fail)**: cache'ten closest fuzzy'ye dön veya `UNKNOWN` fallback. Logla. **Kritik değil** (LLM sadece hit yoksa).
- **DB bağlantısı koparsa**: 503 + retry. Chat kaybolsa da, session_actions CDC olmamış — ileride replay tekrardan hiç önemli değil, kullanıcı yeniden sorar.

### Workflow 2: Test İsteme — Mutlu Yol
**Trigger**: TestPanel dropdown → seç → "İste"
1. nlp.normalize (terminology)
2. rubric-record → phase=TEST
3. test-generator.run(case, test_key):
   - a) CACHE: generated_test_results hit → dön
   - b) STATIK: case_static_results hit → DB'ye cache → dön
   - c) GENERATOR/dataset → üret → cache → dön
   - d) Uygun değil → uyarı + Tier D
4. ResultView render

**Failure modes:**
- **Bilinmeyen test_key**: 400 → frontend'de dropdown'a yine de ekleme seçeneği serbest metin.
- **Generator seed çakışması**: deterministic → asla olamaz.
- **Image storage URL imzası expired (24h)**: API route on-demand yeni imza → response'ta daima fresh URL. (Client cache etmez.)
- **Çok fazla test istendi (maliyet)**: 422 LIMIT. Maksimum 20 test/oturum. UI'da "kalan: X" sayaç.

### Workflow 3: Vaka Sonu Değerlendirme
**Trigger**: "Vakayı Tamamla" — ön tanı textbox zorunlu
1. Frontend: final_dx zorunlu, default boş geçilemez
2. POST /api/evaluate
3. scoring.evaluate(case, all_actions):
   - expected_questions kaçılandı mı?
   - expected_tests istendi mi?
   - discouraged_tests erken istendi mi (negatif)?
   - red_flags sorulmadı mı (-3 / -5)?
   - final_dx doğru mu?
4. feedback JSON üret
5. session_evaluations tablosuna yaz

**Failure modes:**
- **Anamnez adımı hiç yoktan test istendi**: rubric bunu zaten cezalandırır; "öğrenci hemen tanı atladı" feedback. Puan düşer ama çalışır.
- **DX girilmedi**: 422 INCOMPLETE, frontend zaten zorlar.

### Workflow 4: Hasta Yanıtı Mutasyon (ileride)
LLM (Gemini Flash) tek biristi için **deterministik temperature=0 + case_seed** ile çağrılır, cache'lenir. Bir hasta yanıtı varyasyonu = 1 LLM call ÷ 0 (ücretsiz) × cache ömür 30gün. Pessimistik senaryo: 100 öğrenci × 20 vaka × 30 Anamnez sorusu = 60k LLM call/ay. Free tier 1500/gün ≈ 45k/ay → limit yakın. **Çözüm**: Vaka sonrası cache 7gune çıkarılır; aynı soru-soru pair tüm öğrencilere aynı yanıt. Üretim kadarda "vaka seed" ile train.

---

## 13. Kalite Nitelikleri

| Özellik | Strateji | Detay |
|---|---|---|
| **Scalability** | Stateful dışında stateless API | API route'lar stateful değil; session DB. Supabase'de 500MB free → ~10k vaka + 100k session_actions yeter. Hız ölçek = Supabase tier upgrade. |
| **Performance** | Cache agresif | nlp_cache (24h), generated_test_results (kalıcı), Next.js fetch cache, tài thuộc PNG CDN. EKG/cbc üretilme süresi: <10 ms cache'te, <200 ms fresh. |
| **Reliability** | Deterministik | LLM yok puanlamada, generator deterministik. Sistem her zaman aynı giriş = aynı çıkış → test edilebilir, "bug" yerine "yanlış content". |
| **Maintainability** | Sınırlı modüller | 7 lib modülleri, 10 DB tablolu. Modüller birbirini sadece bien-defined functionla çağırır. AI kayısı (Cursor & Copilot) → Next.js öğrenmesi kolay. |
| **Observability** | Structured logs + Sentry free | Konsol.log → Pino ile. Sentry free tier hata yakala. Slow API: Vercel analytics. |
| **Test edilebilirlik** | Vitest unit modüler + Playwright smoke | 7-modüler her biri pure function olabildiği kadar. E2E: "vaka aç → 3 soru sor → 2 test iste → değerlendir → ≥60 puan" gibi happy path akışı. ADOPT:>2.5 is exit criteria. |

---

## 14. ADR'ler (Architecture Decision Records)

### ADR-001: Modular Monolith (Next.js) — Mikroservis değil
**Status**: Accepted
**Context**: Tek geliştirici, "yapabilir miyim" testi, hızlı iterasyon.
**Decision**: Next.js App Router + modüler `lib/` Klasörü. Her modül kendi sorumluluk alanında (case-engine, rubric, nlp, test-gen, scoring, patient-response, image-via-lib).
**Consequences**:
- (+) Tek deploy, tek repo, tek log source, AI-assisted dev için mükemmel.
- (+) Modül sınırları kod içinde net → ileride migration (örn. test-generator'ı ayrı servise) sadece interface aynı kalarak yapılabilir.
- (−) Bir modül bellek sızdırırsa tüm app etkilenir. MVP'de trafik düşük => kabul edilebilir.

### ADR-002: Türkçe NLP için 3 katmanlı (dictionary → fuzzy → LLM fallback)
**Status**: Accepted
**Context**: Türkçe medikal sinonim çok; BERT kullanmak tek kişiye kaybetmek istemediğimiz masa. Gemini free tier var.
**Decision**: Layer 1 dictionary (her test/soru için toplam ~200 alias), Layer 2 rapidfuzz (threshold 0.85), Layer 3 Gemini Flash free tier (cache 24h).
**Consequences**:
- (+) Sıfır LLM maliyeti ortalama (cache + dict/fuzzy yüzdesi >95%).
- (+) LLM kaçak: %5 erişilebilir, ama sadece hit yoksa.
- (−) BERT seviyesinde varyasyon yakalama zayıf (örn. "abartılı৩য়ে কানন শutar কল্যাণı": ameliyata gerek olup olmadığını merak istiyorum" gibi dolaylı ifadeler). İleride Colab'de BERT fine-tune opsiyonel.
- (−) LLM rate-limit aşımı → tüm liability synthetik. Risk düşük ama Log'a yazılmalı.

### ADR-003: Test üretimi DETERMİNİSTİK, LLM değil (generçar jeneratör!)
**Status**: Accepted (KRİTİK)
**Context**: "İstediği test sonucunu ver" ile LLM cost-out explode eder. Ayrıca LLM'un tıbbi sonuç üretmesi riskli (halüsinasyon → öğrenci yanlış öğrenir).
**Decision**: Test üretimi **asla** LLM ile olmaz. Sadece (a) statik vaka JSON, (b) generatör hash seed ile, (c) dataset extraction.
**Consequences**:
- (+) Maliyet = 0. Aynı vaka = aynı sonuç = deterministik.
- (+) Eğitim açısından semantik yapı retroactively açıklanabilir (rubric ile tutarlı).
- (−) Generatörü yazmak için her hastalık için "abnormal range" tablosu gerekiyor (~20 test × 5 hastalık × normal+abnormal).
- (−) Üretilmiş sonuçlar "çok şablon" hissi verebilir — ama MVP için tolere.

### ADR-004: Röntgen = PNG, DICOM değil
**Status**: Accepted
**Context**: Tüm DICOM/Cornerstone mantığı tek kişi/tek proje için aşırı yük. Kaggle dataset zaten PNG.
**Decision**: Sade PNG + sade zoom-on-click modal. WebGL/DICOM v2 v.
**Consequences**:
- (+) 1 saatte viewer devai. Storage CDN tarafından servis edilir.
- (−) Gerçek DICOM WINDOW/LEVEL tooling yok — ama öğrenciler için eğitim değeri büyük değil.
- (−) Diğer imgeler (MR/BT/Meme USG) için gerçek görüntü yok → yer tutucu+rapor metni. Bu 5-dalı MVP için OK.

### ADR-005: İlk hastalık = Kalp Hastalığı (özgün)
**Status**: Accepted
**Context**: 5 hastalık içinden end-to-end prototype için en hızlı yol.
**Decision**: Kalp ile end-to-end pipeline tamamlandıktan sonra diğer 4 hasta eklenir (sıra: Pnömoni → Diyabet → CKD → Meme K.).
**Consequences**:
- (+) "Yapabilir miyim" yanıtı 4. haftada kesinleşir.
- (-) Pnömoni eklemeden "gerçek görüntü" thread'i kalp'da tam test edilmez → bunu M1 sonunda sinemada erken getire -> "öngörü: test image gen'i tek hastalikla da cheap bir smoke test et".
- (−) 4 hastalık → sonradan içerik yükleme işi _linear effort_ — ama üretimde AI-asistan çok yardım.

### ADR-006: Anonim otorite UUID, no-login ilk sürüm
**Status**: Accepted
**Context**: KVKK e-posta + auth.huggingface bariyeri erken frekans düşürür. Eğitim değerine katkısı marjinal MVP'de.
**Decision**: İlk URL açıldığında UUID oturum otomatik atanır → localStorage; tüm skorlar UUID'ye. v1.1'de Supabase Auth optional.
**Consequences**:
- (+) Engagement frictionsız. Feedback toplama: "Congratulations, bu UUID kısaltırken [ok/not-ok] yaz".
- (−) Öğrenci cihaz değiştirirse ilerleme kaybedilir. Çözüm: "email linkle kaydet" akışı ileride.
- (−) KVKK: anonim oturum kişisel veri sayılmaz → bilgilendirme metnine gerek Korek.

---

## 15. Riskler & Açık Teknik Sorular

### Yüksek risk
- **R1**: Test-generator normal/abnormal aralıkları üretmek için her test için medikal bilgi gerekiyor. Bu knowledge base'i kurmak 1 hastalık için ~1 gün. → **Mitigation**: Açık referans aralıkları (orn LabCorp/WHO) tek tabloda topla (`test_normal_ranges.json`).
- **R2**: Türkçe synonym dictionary editor. Elle yazmak sıkıcı. → **Mitigation**: İlk 5 vaka için minimum 20 alias/test elle. AI assistant'a "bu EKG için Türkçe 30 varyasyon yaz" promptu → hızla genişler.
- **R3**: "İstediği test sonucu ver" gereksinimini TA'dan değil öğreneni ölçmek istiyoruz: öğrenci gerçekten OK hasta icin için УЗИ kalbin istiyor olabilir — "_"gereksiz test_-1" mantğı ğrubricsine takılır. → ans: ver + uyar + puanla. → Durum: Tier D.

### Ort açıklık
- **Q1**: Frontend Türkçe'yi sadece UI dilinde değil de öğrenci giriş metninde spell-check ister mi? Caprice — ihtiyaç söylenmedi. Netlik yok. → **Önerilen**: hayır (MVP).
- **Q2**: Öğrenci "ayrıcı tanı" modalında listesini reorder edebiliyor mudur? MVP Router basöldü — opsiyonel. → Final DX sadece serbest metin. Skor = correct/incorrect dirrel.
- **Q3**: Birden çok öğrenci aynı anda kullanırsa collçakışmayın? Session ID déhook → evet, ayrı session = ayrı session_actions. Sıfır fraughtness.
- **Q4**: Colab'de "sinonim modeli eğitimi" projesini ne zaman başlatmalı? → MVP den sonr. 5 hastalık çalışır, data topladıktan sonra (kullanıcı farklı soru sorma paternleri) → fine-tune.
- **Q5**: Image gallery ve storage ölçek? Kaggle'dan 100 PNG = ~1GB. Supabase free 1GB storage. → Subseti 50 görsel yeter vaka renk.leri için. Extra ısrar yok.

### Makul aslında

- **Q6**: `nlp_cache`'te rate_LIMIT geldiğinde LLM'ye gitmesin diye bir retry-policy? → Evet: Retrqueue değil, doğrudan "eski coğu yakın fuzzy kullan" Hint.
- **Q7**: Öğrenciye "rubric" göstermek doğrudan ürünü hurt ediyor mu? → Hayır: skor sonunda gösterilir. Ürün too muchSpoil değil, öküzeye değer (öğrenme). Rubric'i sonu ki göstоса конкретно öğrenciye değil, kullanıcı öğretmene ICler.

---

## Ek — Mimari Karar Özeti Tablosu

| # | Karar | Seçim | $/ay (MVP) | Risk |
|---|---|---|---|---|
| Frontend | Next.js 14 + shadcn/ui | 0 | Düsük |
| Backend | Next.js API Routes | 0 | Düşük |
| DB | Supabase Postgres | 0 | Düşük |
| Storage | Supabase Storage | 0 (1GB) | Orta (limit dolarsa $25/100GB) |
| LLM | Gemini Flash free | 0 | Orta (rate limit) |
| NLP | Dict + Fuzzy + LLM kaçak | 0 | Düşük |
| Test üretim | Deterministik generator | 0 | Düşük |
| Image viewer | plain PNG <img> + modal | 0 | Düşük |
| CI/CD | Vercel auto + Actions | 0 | Düşük |
| Monitoring | Sentry + Vercel Analytics | 0 | Düşük |

**Toplam base cost: $0/ay.** $10/ay budget → sadece Colab Pro / artısı LLM aşımı durumunda kullanılmıyor. Deneme kapsamında (%95 olasılıkla ihtiyaç olmaz.

---

## Sonuç

Bu mimari **tek geliştirici + $10/ay** constraint'lerini outcome-oriented olarak karşılar. Riskli rotalar (DICOM, microservices, LLM-in-loop puanlama) baştan reddedilmiştir. İlk 4 haftalık hedef, **Kalp Hastalığı** mistik end-to-end prototype çıkarıp "yapabilir miyim" sorusunu yanıtlamak. Diğer 4 hastalık content addition problemidir.