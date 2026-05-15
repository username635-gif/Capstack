import { NextRequest, NextResponse } from 'next/server';

// ── CORS helpers ─────────────────────────────────────────────────────────────
const STATIC_ORIGINS = [
  'https://borrower-lac.vercel.app',
  'https://capstack-ops.vercel.app',
  'https://capstack-partner.vercel.app',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  const extra = (process.env.CORS_EXTRA_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-api-key, x-capstack-sandbox, idempotency-key',
  'Access-Control-Max-Age': '86400',
};

/**
 * Next.js 16 proxy — applied to all /api/* routes.
 *
 * Handles CORS preflight and headers for all routes.
 * Enforces rate limiting and API key auth when environment variables are set.
 * DEMO MODE: When env vars are missing all checks pass through.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin') ?? '';
  const allowed = isAllowedOrigin(origin);

  // Handle CORS preflight for all API routes
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowed ? origin : '',
        ...CORS_HEADERS,
      },
    });
  }

  // Only apply rate limiting / API key checks to v1 routes
  if (!pathname.startsWith('/api/v1')) {
    const res = NextResponse.next();
    if (allowed) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
      res.headers.set('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
    }
    return res;
  }

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

  const res = NextResponse.next();
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
    res.headers.set('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
  }
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
