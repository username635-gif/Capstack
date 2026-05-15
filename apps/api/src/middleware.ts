import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js middleware — applied to all /api/v1/* routes.
 *
 * Enforces:
 *   1. Rate limiting via Redis sliding window (when UPSTASH_REDIS_REST_URL is set)
 *   2. API key auth on partner-facing routes (when x-api-key header is present)
 *
 * DEMO MODE: When env vars are missing the checks pass through so the demo
 * works without real credentials.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard v1 API routes
  if (!pathname.startsWith('/api/v1')) return NextResponse.next();

  // ── Rate limiting (skip gracefully if Redis env not configured) ──────────
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  if (redisUrl) {
    try {
      const { rateLimit } = await import('@/middleware/rate-limit');
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const result = await rateLimit(ip);
      if (!result.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', remaining: result.remaining },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit':     String(result.limit),
              'X-RateLimit-Remaining': String(result.remaining),
            },
          },
        );
      }
    } catch {
      // Fail open — rate limiter outage should not block traffic
    }
  }

  // ── API key auth (only when x-api-key header is present) ─────────────────
  const rawKey = req.headers.get('x-api-key');
  if (rawKey) {
    try {
      const { verifyApiKey } = await import('@/lib/auth/api-key');
      const valid = await verifyApiKey(rawKey);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
      }
    } catch {
      // Fail open during demo — DB might not be migrated yet
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
