import { NextRequest, NextResponse } from 'next/server';
import { getPublicOpsAuthConfig, getOpsAuthModeLabel, isOpsSsoProvider, OPS_SSO_PROVIDER_LABELS } from '@/lib/auth-config';
import { startOpsSso } from '@/lib/ops-sso';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isOpsSsoProvider(provider)) {
    return NextResponse.json({ error: 'Unsupported SSO provider.' }, { status: 404 });
  }

  const authConfig = getPublicOpsAuthConfig();
  if (!authConfig.ssoEnabled || !authConfig.enabledProviders.includes(provider)) {
    return NextResponse.json(
      {
        error: `${OPS_SSO_PROVIDER_LABELS[provider]} is not enabled for the current ops auth mode (${getOpsAuthModeLabel(authConfig.mode)}).`,
      },
      { status: 503 },
    );
  }

  return startOpsSso(req, provider);
}