import { type OpsSsoProvider } from './auth-config';

type OpsSsoProviderConfig = {
  provider: OpsSsoProvider;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthorizeParams?: Record<string, string>;
};

const LEGACY_SSO_START_URLS: Record<OpsSsoProvider, string | undefined> = {
  google: process.env.OPS_SSO_GOOGLE_START_URL?.trim() || undefined,
  microsoft: process.env.OPS_SSO_MICROSOFT_START_URL?.trim() || undefined,
};

export function getLegacyOpsSsoStartUrl(provider: OpsSsoProvider): string | undefined {
  return LEGACY_SSO_START_URLS[provider];
}

export function getOpsSsoProviderConfig(provider: OpsSsoProvider): OpsSsoProviderConfig | null {
  if (provider === 'google') {
    const clientId = process.env.OPS_SSO_GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.OPS_SSO_GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }

    const hostedDomain = process.env.OPS_SSO_GOOGLE_HOSTED_DOMAIN?.trim();
    return {
      provider,
      clientId,
      clientSecret,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['openid', 'email', 'profile'],
      extraAuthorizeParams: {
        prompt: 'select_account',
        ...(hostedDomain ? { hd: hostedDomain } : {}),
      },
    };
  }

  const clientId = process.env.OPS_SSO_MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.OPS_SSO_MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  const tenantId = process.env.OPS_SSO_MICROSOFT_TENANT_ID?.trim() || 'organizations';
  const baseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
  return {
    provider,
    clientId,
    clientSecret,
    authorizeUrl: `${baseUrl}/authorize`,
    tokenUrl: `${baseUrl}/token`,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    extraAuthorizeParams: {
      prompt: 'select_account',
    },
  };
}