#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# TIP-AI yerel çalıştırma betiği — tüm gereksinimleri kendisi hazırlar.
#   - Port açıksa kapatır, yeniden başlatır.
#   - İzole yerel PostgreSQL'i başlatır (docker compose, port 5434).
#   - Gerekli tüm ortam değişkenlerine DEV varsayılanı atar.
#   - FHIR veri klasörü varsa onu kanonik kaynak kabul eder; eski CSV örneğinin
#     büyük FHIR deposunu silmesine izin vermez.
#   - Boş veritabanında FHIR içe aktarımı + tüm tanı kodlarını kapsayan vaka
#     kataloğu üretimi yapar.
#   - CASE_STORE=postgres ile başlatır.
#
# Öncelik: komut satırı ortamı > .env.local > DEV varsayılanları.
# Not: .env (prod) bilinçli olarak okunmaz; yerel çalıştırma prod DB'ye dokunmaz.
#
# Kullanım:
#   ./run.sh                          # PostgreSQL + FHIR veri deposu + vakalar
#   PORT=3001 ./run.sh                # farklı port
#   ADMIN_PASSWORD=gizli ./run.sh     # kendi admin şifren
#   SKIP_DB=1 ./run.sh                # DB adımlarını atla (yalnızca başlat)
#   RELOAD_FHIR=1 ./run.sh            # FHIR verisini baştan içe aktarır (uzun sürer)
#   CASE_LIMIT=1000 ./run.sh          # üretilecek vaka/tanı üst sınırı
#   ALL_DISEASES=0 ./run.sh           # eski hasta-bazlı sınırlı üretim davranışı
#   REBUILD=1 ./run.sh                # vaka kataloğunu sıfırdan üret (--wipe)
#   AI=1 ./run.sh                     # DeepSeek zenginleştirmesini aç (yavaş)
#   DB_BOOTSTRAP=1 ./run.sh           # yerel olmayan DB'de de bootstrap'ı zorla
# ─────────────────────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3000}"
PID_FILE="$PROJECT_DIR/.next.pid"
SKIP_DB="${SKIP_DB:-0}"
DB_BOOTSTRAP="${DB_BOOTSTRAP:-auto}"
REBUILD="${REBUILD:-0}"
AI="${AI:-0}"
FHIR_DIR="${FHIR_DIR:-reports/output_1/fhir}"
RELOAD_FHIR="${RELOAD_FHIR:-0}"
CASE_LIMIT="${CASE_LIMIT:-500}"
ALL_DISEASES="${ALL_DISEASES:-1}"

cd "$PROJECT_DIR"

# ── 1. Port ve önceki process'i kapat ──
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[run.sh] Önceki process kapatılıyor: PID=$OLD_PID"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$OLD_PID" 2>/dev/null; then
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

PORT_PIDS=""
if command -v lsof >/dev/null 2>&1; then
  PORT_PIDS="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
fi
if [ -n "$PORT_PIDS" ]; then
  echo "[run.sh] Port $PORT kullanılıyor (PID: $PORT_PIDS) — kapatılıyor."
  for p in $PORT_PIDS; do
    kill -9 "$p" 2>/dev/null || true
  done
  sleep 1
elif command -v fuser >/dev/null 2>&1; then
  fuser -k "$PORT/tcp" 2>/dev/null || true
  sleep 1
fi

# ── 2. Yerel PostgreSQL (docker) ──
ensure_local_db() {
  if [ "$SKIP_DB" = "1" ]; then
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "[run.sh] UYARI: docker bulunamadı; yerel DB başlatılmadı."
    return 0
  fi
  echo "[run.sh] Yerel PostgreSQL başlatılıyor (docker compose, port 5434)…"
  docker compose up -d db >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    if docker exec tip_ai_db pg_isready -U tip_ai -d tip_ai >/dev/null 2>&1; then
      echo "[run.sh] Yerel DB hazır."
      return 0
    fi
    sleep 1
  done
  echo "[run.sh] UYARI: Yerel DB 30 saniyede hazır olamadı."
}

ensure_local_db

# ── 3. Ortam değişkenleri (DEV varsayılanları) ──
# Komut satırı değerlerini koruyarak .env.local yükle (varsa).
_SAVED_DATABASE_URL="${DATABASE_URL:-}"
_SAVED_ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
_SAVED_CASE_STORE="${CASE_STORE:-}"

set -a
if [ -f ".env.local" ]; then
  . ./.env.local
fi
set +a

# Komut satırı öncelikli; sonra .env.local; sonra DEV varsayılanı.
export DATABASE_URL="${_SAVED_DATABASE_URL:-${DATABASE_URL:-postgresql://tip_ai:tip_ai@localhost:5434/tip_ai}}"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${_SAVED_ADMIN_PASSWORD:-${ADMIN_PASSWORD:-admin123}}"
export ADMIN_SESSION_SECRET="${ADMIN_SESSION_SECRET:-tip-ai-dev-admin-session-secret-0000000000}"
export STUDENT_SESSION_SECRET="${STUDENT_SESSION_SECRET:-tip-ai-dev-student-session-secret-00000000}"
export CASE_STORE="${_SAVED_CASE_STORE:-${CASE_STORE:-postgres}}"
export TIP_AI_REPLICA_COUNT="${TIP_AI_REPLICA_COUNT:-1}"
export RATE_LIMIT_STORE="${RATE_LIMIT_STORE:-memory}"

# ── 4. DB bootstrap kararı ──
is_local_db() {
  case "${1:-}" in
    *localhost* | *127.0.0.1* | *::1* | *@postgres* | *@db* | *@database* | *@tip_ai_db* | *@tip-ai-db*)
      return 0
      ;;
    *) return 1 ;;
  esac
}

should_bootstrap() {
  if [ "$SKIP_DB" = "1" ]; then return 1; fi
  if [ "$DB_BOOTSTRAP" = "0" ]; then return 1; fi
  if [ "$DB_BOOTSTRAP" = "1" ]; then return 0; fi
  is_local_db "$DATABASE_URL"
}

db_scalar() {
  local query="$1"
  if command -v docker >/dev/null 2>&1 && docker inspect tip_ai_db >/dev/null 2>&1; then
    docker exec tip_ai_db sh -lc "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"$query\"" 2>/dev/null || true
  fi
}

existing_patient_count() {
  local count
  count="$(db_scalar 'select count(*) from synthea_patients;' | tr -d '[:space:]')"
  [[ "$count" =~ ^[0-9]+$ ]] && printf '%s\n' "$count" || printf '0\n'
}

existing_case_source_count() {
  local count
  count="$(db_scalar 'select count(*) from synthea_case_sources;' | tr -d '[:space:]')"
  [[ "$count" =~ ^[0-9]+$ ]] && printf '%s\n' "$count" || printf '0\n'
}

existing_condition_code_count() {
  local count
  count="$(db_scalar 'select count(distinct code) from synthea_conditions;' | tr -d '[:space:]')"
  [[ "$count" =~ ^[0-9]+$ ]] && printf '%s\n' "$count" || printf '0\n'
}

existing_code_case_count() {
  local count
  count="$(db_scalar "select count(distinct content->>'hastalikKey') from clinical_cases where status = 'aktif' and content->>'hastalikKey' like 'synthea-tani-%';" | tr -d '[:space:]')"
  [[ "$count" =~ ^[0-9]+$ ]] && printf '%s\n' "$count" || printf '0\n'
}

# ── 5. Veritabanı bootstrap ──
if ! should_bootstrap; then
  if [ "$SKIP_DB" = "1" ]; then
    echo "[run.sh] DB adımları atlandı (SKIP_DB=1)."
  elif [ -z "${DATABASE_URL:-}" ]; then
    echo "[run.sh] UYARI: DATABASE_URL tanımlı değil; DB adımları atlandı."
  else
    echo "[run.sh] UYARI: DATABASE_URL yerel değil; yıkıcı Synthea adımları atlandı."
    echo "[run.sh]   Zorlamak için: DB_BOOTSTRAP=1"
  fi
else
  echo "[run.sh] Migration uygulanıyor…"
  npm run db:migrate

  if [ -d "$FHIR_DIR" ]; then
    PATIENT_COUNT="$(existing_patient_count)"
    CASE_SOURCE_COUNT="$(existing_case_source_count)"
    CONDITION_CODE_COUNT="$(existing_condition_code_count)"
    CODE_CASE_COUNT="$(existing_code_case_count)"
    # 1.000 altı, küçük CSV örneği / eksik bootstrap olarak kabul edilir.
    if [ "$RELOAD_FHIR" = "1" ] || [ "$PATIENT_COUNT" -lt 1000 ]; then
      echo "[run.sh] FHIR veri deposu içe aktarılıyor (mevcut hasta: $PATIENT_COUNT)…"
      npm run db:load-synthea-fhir -- --dir "$FHIR_DIR" --replace
      echo "[run.sh] FHIR klinik geçmiş kaynakları içe aktarılıyor…"
      npm run db:load-synthea-fhir:history -- --dir "$FHIR_DIR"
      CASE_SOURCE_COUNT=0
      CONDITION_CODE_COUNT="$(existing_condition_code_count)"
      CODE_CASE_COUNT=0
    else
      echo "[run.sh] FHIR veri deposu hazır ($PATIENT_COUNT hasta); tekrar yükleme atlandı."
    fi

    if [ "$REBUILD" = "1" ] || [ "$CASE_SOURCE_COUNT" -eq 0 ] || \
      { [ "$ALL_DISEASES" = "1" ] && [ "$CODE_CASE_COUNT" -lt "$CONDITION_CODE_COUNT" ]; }; then
      GEN_ARGS="--publish --limit $CASE_LIMIT"
      if [ "$ALL_DISEASES" = "1" ]; then
        GEN_ARGS="$GEN_ARGS --all-diseases"
      fi
      if [ "$AI" != "1" ]; then
        GEN_ARGS="$GEN_ARGS --no-ai"
      fi
      if [ "$REBUILD" = "1" ]; then
        GEN_ARGS="$GEN_ARGS --wipe"
      fi
      echo "[run.sh] FHIR vakaları üretiliyor (generate $GEN_ARGS)…"
      # shellcheck disable=SC2086
      npm run db:generate-synthea-cases -- $GEN_ARGS
      npm run db:backfill-synthea-case-sources
    else
      echo "[run.sh] FHIR vaka kataloğu hazır ($CODE_CASE_COUNT/$CONDITION_CODE_COUNT tanı kodu); tekrar üretim atlandı."
    fi
  else
    echo "[run.sh] FHIR klasörü bulunamadı; CSV kaynağı yükleniyor."
    npm run db:load-synthea
    GEN_ARGS="--publish --limit $CASE_LIMIT"
    if [ "$ALL_DISEASES" = "1" ]; then
      GEN_ARGS="$GEN_ARGS --all-diseases"
    fi
    if [ "$AI" != "1" ]; then
      GEN_ARGS="$GEN_ARGS --no-ai"
    fi
    if [ "$REBUILD" = "1" ]; then
      GEN_ARGS="$GEN_ARGS --wipe"
    fi
    # shellcheck disable=SC2086
    npm run db:generate-synthea-cases -- $GEN_ARGS
  fi
fi

# ── 6. Başlat ──
echo "[run.sh] Başlatılıyor: port=$PORT · CASE_STORE=$CASE_STORE · DB yerel"
echo "[run.sh] Yönetici hesabı ortam değişkenlerinden yüklendi."
npx next dev --webpack -p "$PORT" &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
echo "[run.sh] Çalışıyor: PID=$NEW_PID → http://localhost:$PORT"

wait "$NEW_PID" 2>/dev/null || true
rm -f "$PID_FILE"
