import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_API_ORIGIN = 'https://capstack-api.vercel.app';
const LOCAL_API_PORT_BY_OPS_PORT = new Map([
  ['3002', '3000'],
  ['3302', '3300'],
]);
const REQUEST_HEADER_ALLOWLIST = [
  'accept',
  'authorization',
  'content-type',
  'idempotency-key',
  'x-api-key',
  'x-capstack-sandbox',
];
const RESPONSE_HEADER_ALLOWLIST = [
  'cache-control',
  'content-disposition',
  'content-type',
  'etag',
  'last-modified',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
];

export const dynamic = 'force-dynamic';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiOrigin(req: NextRequest): string {
  const configuredOrigin = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (configuredOrigin) {
    return trimTrailingSlashes(configuredOrigin);
  }

  const hostname = req.nextUrl.hostname;
  const mappedPort = LOCAL_API_PORT_BY_OPS_PORT.get(req.nextUrl.port);

  if (mappedPort && (hostname === '127.0.0.1' || hostname === 'localhost')) {
    return `${req.nextUrl.protocol}//${hostname}:${mappedPort}`;
  }

  return FALLBACK_API_ORIGIN;
}

function buildForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();

  for (const headerName of REQUEST_HEADER_ALLOWLIST) {
    const headerValue = req.headers.get(headerName);
    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  return headers;
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();

  for (const headerName of RESPONSE_HEADER_ALLOWLIST) {
    const headerValue = upstream.headers.get(headerName);
    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  return headers;
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const upstreamUrl = `${resolveApiOrigin(req)}/${path.join('/')}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: buildForwardHeaders(req),
    cache: 'no-store',
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: buildResponseHeaders(upstream),
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to reach the Capstack API.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;