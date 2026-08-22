# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Migration runner ve auth, standalone trace'e girmeyen paketlere ihtiyaç duyar
# (pg, drizzle-orm, @node-rs/argon2). Bu yüzden üretim bağımlılıkları runner'a
# ayrıca kopyalanır.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Webpack cache'i BuildKit cache volume'ünde tutulur; runner'a kopyalanmaz,
# sadece derleme hızını artırır (ilk build sonrası etkili).
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TIP_AI_REPLICA_COUNT=1

# Coolify healthcheck needs curl inside the container
RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
# Migration SQL + meta journal; standalone-migrate.mjs bunları bekler
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# On-demand ETL/admin script'leri src'nin tamamını import eder (cdm, data, ai,
# admin, clinical-history…). Yalnızca etl+auth kopyalamak container içi
# script koşularını (db:generate-synthea-cases vb.) kırıyordu.
COPY --from=builder /app/src ./src
# tsx is devDependency but needed for on-demand ETL in prod; copy it.
# deps aşamasındaki .bin/tsx symlink'i kopyada bozuluyor — gerçek cli'ya
# işaret eden düz bir shim yazılır.
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx
RUN printf '#!/bin/sh\nexec node /app/node_modules/tsx/dist/cli.mjs "$@"\n' > /app/node_modules/.bin/tsx \
 && chmod +x /app/node_modules/.bin/tsx

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000

VOLUME ["/app/data"]

# Migration'ları başlatmadan önce PostgreSQL'e uygula (advisory lock ile);
# sonra Next.js standalone server.
CMD ["sh", "-c", "node ./scripts/standalone-migrate.mjs && node server.js"]