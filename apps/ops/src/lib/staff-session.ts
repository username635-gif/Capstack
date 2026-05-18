import { NextResponse } from 'next/server';
import { OPS_AUTH_COOKIE, OPS_SESSION_MAX_AGE_SECONDS, isAllowedOpsRole, serializeOpsAuthCookie } from '@/lib/auth-cookie';
import type { OpsSession } from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type StaffSessionResult =
  | { ok: true; session: OpsSession }
  | { ok: false; status: number; error: string };

export function sessionCookieOptions(maxAge = OPS_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export async function fetchStaffSessionByEmail(email: string): Promise<StaffSessionResult> {
  const authRes = await fetch(`${API}/api/v1/auth/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  }).catch(() => null);

  if (!authRes) {
    return { ok: false, status: 502, error: 'Could not reach the authentication service.' };
  }

  const authJson = await authRes.json().catch(() => null);
  if (!authRes.ok) {
    return {
      ok: false,
      status: authRes.status,
      error: authJson?.error ?? 'Sign-in failed.',
    };
  }

  if (!isOpsSession(authJson)) {
    return { ok: false, status: 502, error: 'Invalid staff session returned by auth service.' };
  }

  return { ok: true, session: authJson };
}

export async function attachStaffSessionCookie(response: NextResponse, session: OpsSession): Promise<NextResponse> {
  const signedCookie = await serializeOpsAuthCookie(session);
  response.cookies.set(OPS_AUTH_COOKIE, signedCookie, sessionCookieOptions());
  response.cookies.set('capstack_auth', '', sessionCookieOptions(0));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function isOpsSession(value: unknown): value is OpsSession {
  if (!value || typeof value !== 'object') return false;

  const maybe = value as Partial<OpsSession> & { lender?: { id?: string; name?: string } };
  return (
    typeof maybe.id === 'string' &&
    typeof maybe.email === 'string' && maybe.email.includes('@') &&
    typeof maybe.name === 'string' &&
    typeof maybe.role === 'string' && isAllowedOpsRole(maybe.role) &&
    maybe.type === 'staff' &&
    typeof maybe.lender?.id === 'string' &&
    typeof maybe.lender?.name === 'string'
  );
}