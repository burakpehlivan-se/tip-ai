# MCP Tool Analysis: tıp_ai — Türkçe Klinik Karar Simülasyon Sistemi

## Proje Sınıflandırması
- **Tip**: Web Application + Data/Analytics + AI/ML (hibrit)
- **Confidence**: Yüksek
- **Sinyaller**: Next.js, Supabase, Gemini Flash, Kaggle datasets, Türkçe NLP, röntgen/MR görüntü, Colab eğitimi, Pino logging, tek fullstack dev
- **Stack** (tech-architecture raporundan): Next.js 14 + Supabase Postgres/Storage + Vercel + rapidfuzz + Gemini Flash + Kaggle PNG subset

## mcpservers.org Arama Sonuçları
**Aranan kategoriler**: `/category/development`, `/category/database`, `/category/file-system`, `/category/cloud-service`
**Toplam taranan**: ~4.700 sunucu
**Keşfedilen ilgili sunucular**:
| Sunucu | Kategori | Resmi? | Neden İlgili |
|--------|----------|--------|--------------|
| `fsext-mcp-server-python` | File System | ❌ | Dosya ops **+ görsel işleme + OCR** yerleşik — Kaggle PNG'leri tip/boyut normalize etmek için birebir |
| `oxidize-pdf` | File System | ❌ | PDF→Markdown, metin çıkarımı — klinik rehber PDF'leri için |
| `e2b-dev/mcp-server` | Cloud Service | ✅ | Güvenli kod sandbox — **Colab yerine/yanı** model eğitimi prototipi |
| `cure-cancer-with-ai` (ccwai-api) | Cloud Service | ❌ | Ücretsiz onkoloji verisi + biomedical predictions — ileride hastalık kapsam genişletmesi için |
| `pdbeurope/pdbe-mcp-servers` | Database | ✅ | Protein Data Bank Europe — biyomedikal veri (MVP dışı, araştırma) |

---

## Aktif MCP Sunucuları

### Tier 1 — Core (Her Zaman Aktif)
| Sunucu | Araçlar | Amaç |
|--------|---------|------|
| **Filesystem** | read/write/list/search/delete | Proje dosyaları, dataset dosyalarını organize etme |
| **Git** (uvx) | status/log/diff/branch/commit | Versiyon kontrol |
| **GitHub** | search_repos, get_file_contents, list_commits | Kaggle benzeri açık repo'ları araştırma, community病例 |
| **Fetch** | fetch, fetch_html, fetch_txt | Kaggle dataset açıklama sayfaları, tıp guideline scraped görüntüleme |
| **Memory** | save/search/delete/get_memory | Hastalık→dataset→görüntü eşlemesi gibi kalıcı analiz notları |
| **Sequential Thinking** | sequentialthinking | NLP synonym katmanı tasarımı + senaryo üretme akışı |
| **Google MCP** | search_documents | Android/Web/Cloud/Firebase dokümantasyonu |
| **Google Search** | google_search | Pazar/competitor tıbbi eğitim araç araştırması |

### Tier 2 — Free (Proje-Spesifik)
| Sunucu | Araçlar | Neden Aktif |
|--------|---------|-------------|
| **Supabase** (`@supabase-community/supabase-mcp`) ✅official | query_database, create_table, get_users, call_edge_function | Postgres + storage + RLS — projenin kalbindeki servis |
| **Context 7** (`@upstash/context7-mcp`) ✅official | search_docs, get_code_examples, get_api_reference | Next.js 14, Supabase JS, Vercel'de güncel API referansı |
| **PostgreSQL** (gerek yok) | — | Supabase MCP aynı işi görür, skip |
| **Playwright** (`@microsoft/playwright-mcp`) ✅official | browser_navigate, browser_snapshot, browser_click | Simülasyon senaryosunun UI walkthrough testi (öğrenci akışı) |
| **Tailwind CSS** | generate_classes, get_utility | Röntgen overlay, squeeze/zoom component'leri |
| **Vercel** (`@vercel/mcp`) | list_projects, get_deployment, get_logs | Vercel deployment + log izleme |
| **Time** | get_current_time, convert_time | Senaryo zaman damgaları, signed URL süre kontrolü |
| **Puppeteer** | navigate, screenshot, evaluate | (opsiyonel, Playwright zaten yeter) — skip edilebilir |
| **E2B Sandbox** (`@e2b-dev/mcp-server`) | run_code, create_sandbox, execute_command | **Colab prototipi için** — Gemini Flash ile sonuç-validation, model pip install + küçük numpy deneme |
| **DuckDB (Data)** | csv_import, sql_query, semantic_search | Kaggle CSV'leri lokal SQL ile keşfetme (pnömoni meta CSV) |
| **SQLite** | query, schema, create_table | Landing/demo modda lokal paket — `npx tıp_ai` offline build |
| **Brave Search** | brave_web_search | Türkçe tıp terim sinonim kümesi için web tarama (free tier) |
| **fsext-mcp-server-python** (mcpservers.org keşfi) | image_process, ocr, file_search | Kaggle PNG'leri normalize/resize/OCR — Tier 2 alternatif, yerleşik görüntü işlemesi |

---

## MCP Configuration Önerisi

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/burak/code/tıp_ai"]
    },
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git", "--repository", "/home/burak/code/tıp_ai"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "google": {
      "command": "npx",
      "args": ["-y", "@google-cloud/mcp-server"]
    },
    "google-search": {
      "command": "npx",
      "args": ["-y", "@mcp-server/google-search-mcp"],
      "env": { "GOOGLE_API_KEY": "${GOOGLE_API_KEY}", "GOOGLE_CSE_ID": "${GOOGLE_CSE_ID}" }
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase-community/supabase-mcp"],
      "env": { "SUPABASE_URL": "${SUPABASE_URL}", "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}" }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@microsoft/playwright-mcp"]
    },
    "tailwindcss": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-tailwind"]
    },
    "vercel": {
      "command": "npx",
      "args": ["-y", "@vercel/mcp"],
      "env": { "VERCEL_TOKEN": "${VERCEL_TOKEN}" }
    },
    "time": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-time"]
    },
    "e2b": {
      "command": "npx",
      "args": ["-y", "@e2b-dev/mcp-server"],
      "env": { "E2B_API_KEY": "${E2B_API_KEY}" }
    },
    "duckdb": {
      "command": "npx",
      "args": ["-y", "@gentic/mcp-data"]
    },
    "sqlite": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "./data/local-demo.db"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" }
    },
    "fsext": {
      "command": "uvx",
      "args": ["fsext-mcp-server-python"]
    }
  }
}
```

Not: Pino logging için ayrı MCP gerekmez — zaten `pino` npm paketi doğrudan kod içinde kullanılır, MCP katmanı gereksiz.

---

## Tool → Analiz Görevi Eşleştirmesi

| MCP Server | Tool | Geliştirme Görevi |
|------------|------|-------------------|
| Filesystem | `write_file` | Next.js app dizin yapısını oluşturma, dataset metadata JSON üretme |
| Filesystem | `search_files` | Kaggle PNG'lerini organize etme, `.env.local` doğrulama |
| fsext | `image_process` | Kaggle röntgen PNG'lerini 512x512 normalize, metadata strip |
| fsext | `ocr` | Tıbbi rehber PDF'lerinden Türkçe açıklama çıkarımı |
| Supabase | `create_table` | `cases`, `sessions`, `session_actions`, `image_library` şema kurulumu |
| Supabase | `query_database` | RLS politikalarını test etme, gerçek vaka sayısı kontrol |
| Supabase | storage upload | 50 röntgen PNG'sini signed URL ile storage'a yükleme |
| Context7 | `get_api_reference` | Next.js 14 App Router Route Handler güncel imzası |
| Context7 | `search_docs` | Supabase JS v2 storage API eşleşmesi |
| E2B | `run_code` | Colab notebook mantığının lokal prototipi — `rapidfuzz` vs `fuzzywuzzy` bench |
| E2B | `execute_command` | `pip install` + küçük model inference denemesi |
| DuckDB | `csv_import` | Kaggle pnömoni meta CSV'ini SQL ile analiz (case count, label dağılım) |
| DuckDB | `sql_query` | Hastalık→dataset→görüntü mapping tablosu istatistikleri |
| Sequential Thinking | `sequentialthinking` | NLP 3 katmanlı (dict → fuzzy → LLM fallback) akış tasarımı |
| Fetch | `fetch` | Kaggle dataset sayfası, UpToDate/Lecture Notes scraped önizleme |
| GitHub | `search_repositories` | Açık tıbbi eğitim simülasyonu repo'ları (örn. case-based learning) |
| Google Search | `google_search` | Türkçe tıp terim sinonim listesi (semptom, hastalık, lab) oluştur |
| Brave Search | `brave_web_search` | Türkçe emocu: "karın ağrısı" → "abdominal pain" gibi varyasyon araştırma |
| Playwright | `browser_navigate` + `browser_snapshot` | Öğrenci senaryosu E2E testi: soru → görüntü → cevap → skor |
| Playwright | `browser_click` | Lightbox zoom/modal interaction doğrulama |
| Tailwind | `generate_classes` | `<img>` + `object-contain` overlay ile zoon-on-click viewer |
| Vercel | `get_deployment` | `tıp_ai` preview URL kontrol |
| Vercel | `get_logs` | Serverless function hatalarını Pino üzerinden inceleme |
| Time | `convert_time` | Supabase storage signed URL 24h süre kontrolü |
| Memory | `save_memory` | "Hastalık → Tier (A/B/C/D) → dataset kaynak" haritası kalıcı not |
| Memory | `search_memory` | Sonraki session'da hangi hastalığın dataset gerektirdiği sorgusu |
| Git | `git_log` / `git_diff` | Hangi hastalık eklendikten sonra ne değişti — commit bağlamı |
| Sequential Thinking | `sequentialthinking` | Colab eğitim pipeline sırası: data hazırlık → model → export → serving protokol |

---

## MCP Önerileri — Tier 3 (Freemium/Paid)

### Gentic MCP Sunucuları
| MCP Server | Araç | Maliyet | Bu Projede Neden? |
|------------|------|---------|-------------------|
| **Gentic Knowledge** | ingest_url, ingest_document, semantic_search | Free–5¢/use | Türkçe tıp dokümanlarını (rehber PDF, guideline) vector DB'ye yükleyip **CDSS** açıklamaları için semantic search — Gemini context azaltır |

### Colab / GPU / Image Annotation Açısından
| Öneri | Tip | Maliyet | Neden Öneriliyor |
|--------|-----|---------|-------------------|
| **E2B Sandbox (Tier 2'de aktif)** | Kod sandbox | Free tier + $0.25/saat | Colab'e gitmeden GPU olmasa da model pip + inference deneyi; batch dataset mapping prototipi |
| **Browserbase** (`@browserbase/mcp-server-browserbase`) | Cloud browser | Pay-per-use | Playwright zaten yeter; sadece yoğun scrape gerekirse (KG guideline toplama) — **MVP için skip** |
| **GPU / Colab alternatifi**: RunPod, Modal Labs | Cloud GPU | ~$0.3–$0.6/saat (T4) | Colab free yettiği sürece gerekmez; Colab Pro $10/ay — mevcut bütçeyle dönüşük |
| **Roboflow Universe MCP** (yok ama Roboflow API) | Image annotation | Free–paid | Kaggle PNG'lerini **manuel etiket yeniden标注** gerekmez (zaten etiketli), skip |
| **CVAT / Label Studio + E2B** | Annotation | Açık kaynak (free) | Yeni annotation şart değil — Kaggle label yeter; ileride kendi dataset toplanırsa yükleyebilir |

**Netice**: Tier 3 olarak yalnızca **Gentic Knowledge** opsiyonel mantıklı (Türkçe tıp döküman indexing). Diğerlerinin hiçbirine MVP'de ihtiyaç yok — Colab free + mevcut Kaggle etiketli veri masrafsız işi görüyor.

### mcpservers.org'dan Ek Öneriler
| Sunucu | Resmi? | Maliyet | Neden Öneriliyor |
|--------|--------|---------|------------------|
| **cure-cancer-with-ai** (ccwai-api) | ❌ | Free | Ücretsiz onkoloji verisi + IBM MAMMAL — kalp dışına genişleme fazında ücretsiz kaynak |
| **PDBe MCP** | ✅ | Free | Biyomedikal yapısal veri — araştırma/ileri prototip, MVP dışı |
| **fsext-mcp-server-python** | ❌ | Free | **Tier 2'ye eklendi** — PNG resize/OCR için pratik |

---

## Context Budget Tahmini
- **Toplam yüklü araç**: ~17 sunucu, ~110 araç
- **Tahmini context kullanımı**: Orta (çoğu araç az kullanılır)
- **Öneri**:
  - **Skip**: Puppeteer (Playwright yeter), Google MCP (eğer Vercel/Next dışında Google servisi yoksa), SQLite (Supabase yeter)
  - **Hibrit mod**: geliştirme sürecinde tümü aktif; production runtime'da yalnız Supabase + Fetch + E2B kullanılır
  - Favori trendi: **Context7 > Büyük Model Eğitimi** için; bunu kullan boz Broadcast özelliğiyle training-set invalidation kontrol

## Güvenlik Notları
- **Supabase MCP**: `service_role` key kullanılırsa RLS bypass eder — **production'da service role yerine anon key + kullanıcı JWT** tercih et. Şemalar okuma/query yazma kapasitesi var; yalnız yazar arasında görünmesi gerekirse read-only ddl moduna al.
- **GitHub MCP**: `public_repo` scope yeter; `repo` (private yazma) verme tek kişide.
- **E2B Sandbox**: Kod çalıştırma yetkisi tanıdığından `pip install` whitelist öner; tedarik zinciri paket riski.
- **Fetch / Brave / Google Search**: Röntgen görüntülerinin URL'sini atsan indekslenir; **PHI içermemeli** (KVKK) — sadece Kaggle açık veri, sentetik DTO/UUID kullan.
- **Filesystem MCP**: `/home/burak/code/tıp_ai` dışına yazma dışı scope; `/data`, `/tmp` read-only.
- **`fsext` OCR** sonucundaki metinde Türkçe karakter优胜 (â, î, ı) encoding kontrol et.
- **`.env`, `*.pem`, `*.key`** asla okuma (AGENTS.md kuralı). Supabase service role key `.env.local`'da, Vercel env'inde.