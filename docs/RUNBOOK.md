# TIP-AI Runbook — Deploy, Health, Rollback, Backup

**Scope:** Tek replica JSON file-store (`TIP_AI_REPLICA_COUNT=1`, `/app/data` volume) + PostgreSQL opsiyonel. Hedef: `P95 <350ms`, `LCP <2.5s`, `error <1%`.

## 1. Sağlık Uçları (NFR: availability, observability)

- `GET /api/health/live` → `200 {status:"ok"}` — liveness, DB’ye dokunmaz, K8s/Coolify restart kararı.
- `GET /api/health/ready` ve `GET /api/health` → `200` hazır, `503` not_ready — **tek readiness kaynağı** (`src/lib/health/readiness.ts:52`).
  - `json` modda: `adminDataDir()` RW + `cases.json` R kontrolü (`checkJsonStoreReadiness:10`). Başarısız → `503`.
  - `postgres` modda: `checkAuthMigrationReadiness` + `checkCaseStoreMigrationReadiness` tamamlanmadan `503` (trafik almaz).
  - Payload: `{auth, attempts, rateLimit, cases, status}` — log’a yazılmaz, sadece probe.

**Probe:** Coolify healthcheck → `GET /api/health/ready` (interval 10s, timeout 3s, retries 3). `live` ayrı tutulmaz.

## 2. Deploy (NFR: zero 500 on cache clear)

**Ön koşul:** `/app/data` volume kalıcı, `TIP_AI_REPLICA_COUNT=1`, `ADMIN_SESSION_SECRET` + `STUDENT_SESSION_SECRET` (ayrı, ≥32 byte) set.

**Adımlar:**
1. `npm ci && npm test && npx tsc --noEmit && npm run build` — CI `quality` job’u zaten koşar.
2. `docker build -t tip-ai:$GIT_SHA .` — `Dockerfile:47` `standalone-migrate.mjs` + `server.js` sırayla çalışır (advisory lock ile 2 replica yarışsa 2. bekler).
3. Coolify pre-deploy: `npm run db:migrate` **değil** — Dockerfile CMD migration’ı koşar; Coolify’da `CMD` override ediliyorsa pre-deploy’a `node scripts/standalone-migrate.mjs` ekle.
4. Deploy tek replica başlat, `GET /api/health/ready` 200 olana kadar trafik kapalı tut.
5. Log: JSON (`logger.ts:53` `ts, level, msg, requestId, error`) — `journalctl -u tip-ai -f | jq`.

**Cache:** `next dev`’de `eval` için `script-src 'unsafe-eval'` sadece dev’de (`next.config.mjs:9`), prod’da yok.

## 3. Rollback

- **Kod rollback:** Önceki image’a `docker rollback` / Coolify “Redeploy previous”. `STORE_MODE` değişmediyse `/app/data` aynen kalır, yeni kod eski JSON’u okur.
- **STORE_MODE rollback (json ↔ postgres):** Tek bayrak, çift yazma yok. `STORE_MODE=postgres`’ten `json`’a dönersen, postgres’e yazılan yeni kullanıcı/denemeler JSON’a kopyalanmaz — **kayıp**. Rollback öncesi `pg_dump` al veya `import-users.ts` yedeğini sakla. `DATABASE_URL`’yi eski haline getir ve restart et.

## 4. Yedek / Geri Yükleme (NFR: durability)

- **Yedek al:** Admin panel → Yedekler → `createBackup` (`src/lib/admin/store.ts:360` `writeJsonAtomic` + `fsync`). Dosya `/app/data/admin/backups/bak_*.json`, index `index.json`. Saklama 100.
- **Geri yükle:** `POST /api/admin/backups/:id/restore` → `restoreBackup:410` önce `pre-restore` yedeği alır, sonra `cases.json` + `hasta-tipleri.json`’u atomic replace eder.
- **Bozuk JSON:** `quarantineCorruptJson` → `cases.json.corrupt-*` karantina, `loadCasesStore` seed’e döner, `503` değil.
- **Tatbikat:** Her deploy öncesi `GET /api/health/ready` 200 + `ls -lh /app/data/admin/backups` + bir yedeği `restore` ile test (staging).

## 5. Metrik & Alarm (NFR: latency, error budget)

- **Log tabanlı:** Her `logger.exception` `error` + `requestId` + `route` ile JSON. `error` rate’i `journalctl | jq 'select(.level=="error")' | wc -l` / toplam request.
- **Latency:** `proxy.ts` `x-request-id` ekler, `NextResponse.next` ile taşınır. İleride `src/lib/metrics.ts` eklenirse `performance.now()` ile P95 hesaplanır — şu an `pipeline:scan` ve `validate:vakalar` ile doluluk ölçülüyor.
- **Alarm:** `ready:503` 1dk → Pager, `error` rate >1% 5dk → Pager.

## 6. Hızlı Kontroller

```bash
# sağlık
curl -i http://localhost:3000/api/health/ready | jq
# yedekler
ls -lh /app/data/admin/backups
# log
journalctl -u tip-ai --since "5 min ago" | jq 'select(.level=="error")'
# P95 (kaba)
curl -w "@curl-format.txt" http://localhost:3000/api/student/attempts?poliklinikKey=kardiyoloji -H "Cookie: tip_ai_student_session=..."
```

**Env (üretim):** `ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, STUDENT_SESSION_SECRET, DATABASE_URL, APP_URL, TIP_AI_REPLICA_COUNT=1, RATE_LIMIT_STORE=memory|postgres`
