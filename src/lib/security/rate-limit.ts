import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

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
export function takeRateLimit(options: RateLimitOptions): RateLimitDecision {
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
export function refundRateLimit(options: Pick<RateLimitOptions, "namespace" | "key">, now = Date.now()): void {
  const key = bucketKey(options.namespace, options.key);
  const bucket = BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    BUCKETS.delete(key);
    return;
  }
  bucket.count -= 1;
  if (bucket.count <= 0) BUCKETS.delete(key);
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
}
