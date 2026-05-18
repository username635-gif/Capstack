/**
 * Borrower app route protection proxy.
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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get('capstack_auth')?.value;

  if (!authCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  const issuedAt = authCookie === '1' ? 0 : Number(authCookie);
  const sessionAge = issuedAt > 0 ? Date.now() - issuedAt : 0;

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