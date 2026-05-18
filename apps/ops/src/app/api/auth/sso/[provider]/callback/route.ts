import { NextRequest } from 'next/server';
import { isOpsSsoProvider } from '@/lib/auth-config';
import { finishOpsSso } from '@/lib/ops-sso';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isOpsSsoProvider(provider)) {
    return Response.json({ error: 'Unsupported SSO provider.' }, { status: 404 });
  }

  return finishOpsSso(req, provider);
}