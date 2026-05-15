/**
 * Ops app route protection.
 * Every route except /sign-in requires the capstack_auth cookie.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/sign-in') || pathname.startsWith('/_next')) {
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
