/**
 * Ops app route protection.
 * Every route except /sign-in and auth session bootstrap routes requires a valid ops staff session cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { OPS_AUTH_COOKIE, parseOpsAuthCookie } from '@/lib/auth-cookie';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/api/session') ||
    pathname.startsWith('/api/auth/sso') ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  if (process.env.NEXT_PUBLIC_OPS_AUTH_MODE === 'demo') {
    return NextResponse.next();
  }

  const session = await parseOpsAuthCookie(req.cookies.get(OPS_AUTH_COOKIE)?.value);
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/sign-in';
  url.searchParams.set('reason', 'auth_required');

  const response = NextResponse.redirect(url);
  response.cookies.set(OPS_AUTH_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set('capstack_auth', '', { path: '/', maxAge: 0 });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};