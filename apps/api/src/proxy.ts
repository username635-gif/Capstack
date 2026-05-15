import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16 proxy — applied to all /api/v1/* routes.
 *
 * Enforces rate limiting and API key auth when environment variables are set.
 * DEMO MODE: When env vars are missing all checks pass through.
 *
 * Note: Edge Runtime only supports Web APIs. Heavy checks (Prisma, crypto)
 * are handled inside individual route handlers instead.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard v1 API routes
  if (!pathname.startsWith('/api/v1')) return NextResponse.next();

  // ── Rate limiting (skip gracefully if Redis env not configured) ──────────
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rateLimitWindow = process.env.RATE_LIMIT_WINDOW_MS;
  if (redisUrl && rateLimitWindow) {
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const key = `rl:${ip}`;
      const now = Date.now();
      const window = parseInt(rateLimitWindow, 10) || 60_000;
      const limit = 100;

      // Lightweight sliding-window counter using Upstash REST API (fetch = Edge-safe)
      const res = await fetch(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZREMRANGEBYSCORE', key, '-inf', now - window],
          ['ZADD', key, now, `${now}`],
          ['ZCARD', key],
          ['PEXPIRE', key, window],
        ]),
      });
      if (res.ok) {
        const data = await res.json() as Array<{ result: number }>;
        const count = data[2]?.result ?? 0;
        if (count > limit) {
          return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429, headers: { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': '0' } },
          );
        }
      }
    } catch {
      // Fail open — rate limiter outage should not block traffic
    }
  }

  // ── API key auth (only when x-api-key header present) ────────────────────
  // Full verification (Prisma + crypto) is deferred to route handlers.
  // Here we only check the key is present and well-formed (prefix check).
  const rawKey = req.headers.get('x-api-key');
  if (rawKey && !rawKey.startsWith('pk_') && !rawKey.startsWith('sk_')) {
    return NextResponse.json({ error: 'Malformed API key' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
