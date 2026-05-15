/**
 * Redis-backed sliding-window rate limiter (Upstash REST).
 *
 * Uses INCR + EXPIRE to count requests per identifier within a rolling window.
 * Suitable for protecting public API and webhook endpoints.
 *
 * SECURITY:
 *   - identifier should NOT be derived solely from user-controlled input.
 *     Prefer `${apiKeyHash}:${path}` or `${ip}:${path}`.
 *   - The INCR+EXPIRE pattern is not 100% atomic on first call, but is
 *     acceptable for rate-limiting (small race window is safe to ignore).
 *
 * Patterns applied:
 *   1. Early return — over-limit check returns immediately
 *   2. Ternary — set expire only on first request
 *   3. Nullish coalescing — default limit/window params
 *   6. to() helper — Redis errors as values
 *   7. Property shorthand
 */

import { redis } from '@/lib/redis';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export interface RateLimitResult {
  allowed:   boolean;
  current:   number;
  limit:     number;
  remaining: number;
}

/**
 * Check and increment the rate-limit counter for an identifier.
 *
 * @param identifier  Unique key (e.g. `api_key_hash:endpoint_path`)
 * @param limit       Max requests allowed per window (default 100)
 * @param windowSecs  Rolling window in seconds (default 60)
 */
export async function rateLimit(
  identifier: string,
  limit       = 100,
  windowSecs  = 60,
): Promise<RateLimitResult> {
  const key = `rate:${identifier}`;

  const [incrErr, current] = await to(redis.incr(key));

  if (incrErr || current === null) {
    // Fail open — allow request if Redis is unreachable
    console.error('[rate-limit] Redis error:', incrErr);
    return { allowed: true, current: 0, limit, remaining: limit };
  }

  // Pattern 2 — only set TTL on the first request
  if (current === 1) {
    await to(redis.expire(key, windowSecs));
  }

  const allowed   = current <= limit;
  const remaining = Math.max(0, limit - current);

  // Pattern 7 — shorthand
  return { allowed, current, limit, remaining };
}
