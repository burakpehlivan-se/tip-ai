import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/auth/db";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}

const BUCKETS = new Map<string, Bucket>();
let lastPostgresCleanupAt = 0;

export type RateLimitStoreMode = "memory" | "postgres";

/**
 * Varsayılan bellek deposu geriye uyumludur. Çoklu replica veya production
 * auth cutover'ında `RATE_LIMIT_STORE=postgres` zorunlu ortak kotayı açar.
 */
export function rateLimitStoreMode(value = process.env.RATE_LIMIT_STORE): RateLimitStoreMode {
  if (value === undefined || value === "" || value === "memory") return "memory";
  if (value === "postgres") return "postgres";
  throw new Error("RATE_LIMIT_STORE yalnızca memory veya postgres olabilir.");
}

function bucketKey(namespace: string, key: string): string {
  // Ham IP/kullanıcı adını global bellek anahtarında dahi gereksiz yere tutma.
  return `${namespace}:${createHash("sha256").update(key).digest("base64url")}`;
}

/** Proxy'nin ilettiği istemci IP'si; erişilemezse sabit, güvenli bir paylaşılmış anahtar. */
export function clientRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown-client";
}

/** Uzun/garip kullanıcı girişleri bellek büyütemez; sadece oran anahtarı için özetlenir. */
export function usernameRateLimitKey(username: string): string {
  return username.trim().toLocaleLowerCase("tr-TR").slice(0, 128) || "empty-username";
}

/** Bir istek için kota ayırır. Başarılı login'de `refundRateLimit` çağrılabilir. */
function takeMemoryRateLimit(options: RateLimitOptions): RateLimitDecision {
  const now = options.now ?? Date.now();
  const key = bucketKey(options.namespace, options.key);
  const previous = BUCKETS.get(key);
  const bucket = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : previous;
  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  BUCKETS.set(key, bucket);
  return {
    allowed: true,
    limit: options.limit,
    remaining: options.limit - bucket.count,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Başarılı kimlik doğrulama için önceden ayrılmış tek kota hakkını serbest bırakır. */
function refundMemoryRateLimit(options: Pick<RateLimitOptions, "namespace" | "key">, now = Date.now()): void {
  const key = bucketKey(options.namespace, options.key);
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    BUCKETS.delete(key);
    return;
  }
  bucket.count -= 1;
  if (bucket.count <= 0) BUCKETS.delete(key);
}

async function cleanupExpiredPostgresBuckets(now: Date): Promise<void> {
  // Her istekte temizlik sorgusu çalıştırmayız. Aynı processin beş dakikalık
  // tek denemesi yeterlidir; hata kota kararını maskelemez.
  if (now.getTime() - lastPostgresCleanupAt < 5 * 60 * 1000) return;
  lastPostgresCleanupAt = now.getTime();
  try {
    await getDb().execute(sql`DELETE FROM rate_limit_buckets WHERE reset_at <= ${now}`);
  } catch {
    // Asıl quota upsert'i aşağıda fail-closed davranır; best-effort temizlik
    // başarısızlığı yeni giriş kararını değiştirmez.
  }
}

async function takePostgresRateLimit(options: RateLimitOptions): Promise<RateLimitDecision> {
  const now = new Date(options.now ?? Date.now());
  const resetAt = new Date(now.getTime() + options.windowMs);
  const key = bucketKey(options.namespace, options.key);
  await cleanupExpiredPostgresBuckets(now);

  // Tek UPSERT, replica'lar arası yarışta kotayı atomik olarak ayırır. Limit
  // aşılmış isteklerde sayaç artmaya devam eder; böylece eşiğe ulaşan geçerli
  // son istek ile sonraki reddedilen istek birbirinden ayırt edilebilir.
  const result = await getDb().execute(sql`
    INSERT INTO rate_limit_buckets (bucket_key, count, reset_at, updated_at)
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT (bucket_key) DO UPDATE
    SET
      count = CASE
        WHEN rate_limit_buckets.reset_at <= ${now} THEN 1
        ELSE rate_limit_buckets.count + 1
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= ${now} THEN ${resetAt}
        ELSE rate_limit_buckets.reset_at
      END,
      updated_at = ${now}
    RETURNING count, reset_at
  `);
  const row = result.rows[0] as { count?: number; reset_at?: Date | string } | undefined;
  const count = Number(row?.count);
  const returnedResetAt = row?.reset_at instanceof Date ? row.reset_at : new Date(String(row?.reset_at));
  if (!Number.isFinite(count) || Number.isNaN(returnedResetAt.getTime())) {
    throw new Error("Ortak rate limit kotası doğrulanamadı.");
  }
  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((returnedResetAt.getTime() - now.getTime()) / 1000)),
  };
}

async function refundPostgresRateLimit(
  options: Pick<RateLimitOptions, "namespace" | "key">,
  now: Date
): Promise<void> {
  const key = bucketKey(options.namespace, options.key);
  // Tek başarı için ayrılan hakkı serbest bırakır; eşzamanlı başka denemelerin
  // sayacı sıfırın altına düşmez. Süresi geçen kayıtlar zaten etkilenmez.
  await getDb().execute(sql`
    UPDATE rate_limit_buckets
    SET count = GREATEST(count - 1, 0), updated_at = ${now}
    WHERE bucket_key = ${key} AND reset_at > ${now}
  `);
}

/** Ortak rate-limit mağazası seçildiğinde asenkron PostgreSQL yolu kullanılır. */
export async function takeRateLimit(options: RateLimitOptions): Promise<RateLimitDecision> {
  return rateLimitStoreMode() === "postgres" ? takePostgresRateLimit(options) : takeMemoryRateLimit(options);
}

/** Başarılı login'de ayrılmış tek kota hakkını seçili depoda iade eder. */
export async function refundRateLimit(
  options: Pick<RateLimitOptions, "namespace" | "key">,
  now = Date.now()
): Promise<void> {
  if (rateLimitStoreMode() === "postgres") {
    await refundPostgresRateLimit(options, new Date(now));
    return;
  }
  refundMemoryRateLimit(options, now);
}

export function rateLimitHeaders(decision: RateLimitDecision): HeadersInit {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(Math.max(0, decision.remaining)),
    "Retry-After": String(decision.retryAfterSeconds),
  };
}

/** Test izolasyonu için; production kodu çağırmaz. */
export function resetRateLimitsForTests(): void {
  BUCKETS.clear();
  lastPostgresCleanupAt = 0;
}
