/**
 * Borrower app route protection middleware.
 *
 * Checks for the `capstack_auth` cookie (set by setSession() on sign-in).
 * Redirects unauthenticated requests to /sign-in.
 *
 * SESSION TIMEOUT:
 *   The cookie value is a ms-epoch timestamp set at login time.
 *   If the session is older than SESSION_TIMEOUT_MS, the user is redirected
 *   to /sign-in?reason=session_expired so the UI can display an appropriate
 *   message. This check happens server-side on every protected request.
 *
 *   Legacy cookies with value "1" are accepted as valid (backward-compat).
 *
 * Public paths — accessible without a session:
 *   /sign-in, /sign-up, and the root marketing page /
 */

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

// 8 hours — change via SESSION_TIMEOUT_HOURS env variable if needed
const SESSION_TIMEOUT_MS =
  Number(process.env.SESSION_TIMEOUT_HOURS ?? 8) * 60 * 60 * 1000;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pattern 1 — early return: allow public paths and Next.js internals first
  if (PUBLIC_PATHS.some(p => pathname === p) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get('capstack_auth')?.value;

  // Pattern 1 — early return: no cookie → redirect to sign-in
  if (!authCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  // Pattern 3 — optional chaining / nullish coalescing on parsed timestamp
  // Legacy value "1" has no timestamp — treat as valid (issuedAt = 0 means infinite age).
  const issuedAt   = authCookie === '1' ? 0 : Number(authCookie);
  const sessionAge = issuedAt > 0 ? Date.now() - issuedAt : 0;

  // Pattern 2 — ternary: timed-out → redirect; still valid → continue
  if (sessionAge > SESSION_TIMEOUT_MS) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('reason', 'session_expired');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
