import { NextRequest, NextResponse } from 'next/server';
import { OPS_AUTH_COOKIE, parseOpsAuthCookie } from '@/lib/auth-cookie';
import { attachStaffSessionCookie, fetchStaffSessionByEmail, sessionCookieOptions } from '@/lib/staff-session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const staffSession = await fetchStaffSessionByEmail(email);
  if (!staffSession.ok) {
    return NextResponse.json({ error: staffSession.error }, { status: staffSession.status });
  }

  try {
    return await attachStaffSessionCookie(NextResponse.json(staffSession.session), staffSession.session);
  } catch {
    return NextResponse.json({ error: 'Ops session signing is not configured.' }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const session = await parseOpsAuthCookie(req.cookies.get(OPS_AUTH_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json(session);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(OPS_AUTH_COOKIE, '', sessionCookieOptions(0));
  response.cookies.set('capstack_auth', '', sessionCookieOptions(0));
  return response;
}