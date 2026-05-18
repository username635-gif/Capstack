import { NextRequest, NextResponse } from 'next/server';
import { OPS_AUTH_COOKIE } from '@/lib/auth-cookie';
import { createOpsAccessToken, parseSignedSession } from '@/lib/ops-auth-crypto';

export async function POST(req: NextRequest) {
  const identity = await parseSignedSession(req.cookies.get(OPS_AUTH_COOKIE)?.value);

  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await createOpsAccessToken(identity);
    const response = NextResponse.json({ accessToken: token.token, expiresAt: token.expiresAt });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Ops API token signing is not configured.' }, { status: 503 });
  }
}