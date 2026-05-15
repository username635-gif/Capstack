/**
 * Borrower app route protection middleware.
 *
 * Checks for the `capstack_auth` cookie (set by setSession() on sign-in).
 * Redirects unauthenticated requests to /sign-in.
 *
 * Public paths — accessible without a session:
 *   /sign-in, /sign-up, and the root marketing page /
 */

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals
  if (PUBLIC_PATHS.some(p => pathname === p) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  if (req.cookies.has('capstack_auth')) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/sign-in';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
