import { NextRequest, NextResponse } from 'next/server';
import { OPS_SSO_PROVIDER_LABELS, type OpsSsoProvider } from '@/lib/auth-config';
import { getLegacyOpsSsoStartUrl, getOpsSsoProviderConfig } from '@/lib/auth-config.server';
import { attachStaffSessionCookie, fetchStaffSessionByEmail } from '@/lib/staff-session';

type SsoProfile = {
  email: string;
  name: string;
};

const SSO_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export async function startOpsSso(req: NextRequest, provider: OpsSsoProvider): Promise<NextResponse> {
  const config = getOpsSsoProviderConfig(provider);
  if (!config) {
    const legacyStartUrl = getLegacyOpsSsoStartUrl(provider);
    if (legacyStartUrl) {
      return NextResponse.redirect(new URL(legacyStartUrl, req.nextUrl.origin));
    }

    return NextResponse.json(
      { error: `${OPS_SSO_PROVIDER_LABELS[provider]} is not fully configured.` },
      { status: 503 },
    );
  }

  const state = createRandomValue(24);
  const verifier = createRandomValue(64);
  const challenge = await createCodeChallenge(verifier);
  const redirectUri = buildRedirectUri(req, provider);
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'));

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  for (const [key, value] of Object.entries(config.extraAuthorizeParams ?? {})) {
    authorizeUrl.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(authorizeUrl);
  const cookies = getCookieNames(provider);
  response.cookies.set(cookies.state, state, buildSsoCookieOptions());
  response.cookies.set(cookies.verifier, verifier, buildSsoCookieOptions());
  response.cookies.set(cookies.returnTo, returnTo, buildSsoCookieOptions());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function finishOpsSso(req: NextRequest, provider: OpsSsoProvider): Promise<NextResponse> {
  const config = getOpsSsoProviderConfig(provider);
  if (!config) {
    return redirectToSignIn(req, 'sso_provider_not_configured', provider);
  }

  const errorCode = req.nextUrl.searchParams.get('error');
  if (errorCode) {
    return redirectToSignIn(req, 'sso_provider_denied', provider);
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookies = getCookieNames(provider);
  const expectedState = req.cookies.get(cookies.state)?.value ?? null;
  const verifier = req.cookies.get(cookies.verifier)?.value ?? null;
  const returnTo = sanitizeReturnTo(req.cookies.get(cookies.returnTo)?.value ?? null);

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return clearSsoCookies(req, provider, redirectToSignIn(req, 'sso_state_invalid', provider));
  }

  const tokenResponse = await exchangeAuthorizationCode(code, verifier, buildRedirectUri(req, provider), config);
  if (!tokenResponse.ok) {
    return clearSsoCookies(req, provider, redirectToSignIn(req, tokenResponse.reason, provider));
  }

  const profile = await fetchProviderProfile(config.provider, tokenResponse.accessToken);
  if (!profile) {
    return clearSsoCookies(req, provider, redirectToSignIn(req, 'sso_profile_failed', provider));
  }

  const staffSession = await fetchStaffSessionByEmail(profile.email.toLowerCase());
  if (!staffSession.ok) {
    return clearSsoCookies(req, provider, redirectToSignIn(req, 'sso_access_denied', provider));
  }

  const response = NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
  await attachStaffSessionCookie(response, staffSession.session);
  return clearSsoCookies(req, provider, response);
}

function buildRedirectUri(req: NextRequest, provider: OpsSsoProvider): string {
  return new URL(`/api/auth/sso/${provider}/callback`, req.nextUrl.origin).toString();
}

function getCookieNames(provider: OpsSsoProvider) {
  const prefix = `capstack_ops_sso_${provider}`;
  return {
    state: `${prefix}_state`,
    verifier: `${prefix}_verifier`,
    returnTo: `${prefix}_return_to`,
  };
}

function buildSsoCookieOptions(maxAge = SSO_COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

function clearSsoCookies(req: NextRequest, provider: OpsSsoProvider, response: NextResponse) {
  const cookies = getCookieNames(provider);
  response.cookies.set(cookies.state, '', buildSsoCookieOptions(0));
  response.cookies.set(cookies.verifier, '', buildSsoCookieOptions(0));
  response.cookies.set(cookies.returnTo, '', buildSsoCookieOptions(0));
  if (!response.headers.get('Cache-Control')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

function redirectToSignIn(req: NextRequest, reason: string, provider: OpsSsoProvider) {
  const url = new URL('/sign-in', req.nextUrl.origin);
  url.searchParams.set('reason', reason);
  url.searchParams.set('provider', provider);
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) {
    return '/applications';
  }

  return value;
}

async function exchangeAuthorizationCode(
  code: string,
  verifier: string,
  redirectUri: string,
  config: NonNullable<ReturnType<typeof getOpsSsoProviderConfig>>,
): Promise<{ ok: true; accessToken: string } | { ok: false; reason: string }> {
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
    }).toString(),
    cache: 'no-store',
  }).catch(() => null);

  if (!tokenResponse || !tokenResponse.ok) {
    return { ok: false, reason: 'sso_exchange_failed' };
  }

  const tokenJson = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenJson?.access_token) {
    return { ok: false, reason: 'sso_exchange_failed' };
  }

  return { ok: true, accessToken: tokenJson.access_token };
}

async function fetchProviderProfile(provider: OpsSsoProvider, accessToken: string): Promise<SsoProfile | null> {
  if (provider === 'google') {
    return fetchGoogleProfile(accessToken);
  }

  return fetchMicrosoftProfile(accessToken);
}

async function fetchGoogleProfile(accessToken: string): Promise<SsoProfile | null> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const profile = await response.json().catch(() => null) as {
    email?: string;
    name?: string;
    email_verified?: boolean;
  } | null;

  if (!profile?.email || profile.email_verified === false) {
    return null;
  }

  return {
    email: profile.email,
    name: profile.name?.trim() || profile.email,
  };
}

async function fetchMicrosoftProfile(accessToken: string): Promise<SsoProfile | null> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const profile = await response.json().catch(() => null) as {
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  } | null;

  const email = profile?.mail?.trim() || profile?.userPrincipalName?.trim();
  if (!email) {
    return null;
  }

  return {
    email,
    name: profile?.displayName?.trim() || email,
  };
}

function createRandomValue(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Buffer.from(hash).toString('base64url');
}