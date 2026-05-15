/**
 * API CORS middleware.
 *
 * Allows cross-origin requests from the three Capstack frontend apps.
 * Handles OPTIONS preflight and appends CORS headers to every /api/* response.
 *
 * ALLOWED_ORIGINS is seeded with production Vercel URLs + localhost ports for
 * each app. Add custom domains via CORS_EXTRA_ORIGINS env var (comma-separated).
 */

import { NextRequest, NextResponse } from 'next/server';

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
  // Allow all Vercel preview deployments (*.vercel.app) so branch previews work
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

export function middleware(req: NextRequest) {
  const origin  = req.headers.get('origin') ?? '';
  const allowed = isAllowedOrigin(origin);
  const corsOrigin = allowed ? origin : '';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        ...CORS_HEADERS,
      },
    });
  }

  const res = NextResponse.next();
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', corsOrigin);
    res.headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
    res.headers.set('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
  }
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
