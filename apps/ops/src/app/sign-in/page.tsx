'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOpsAuthModeLabel, getPublicOpsAuthConfig, OPS_SSO_PROVIDER_LABELS, type OpsSsoProvider } from '@/lib/auth-config';
import { setSession } from '@/lib/session';


const AUTH_CONFIG = getPublicOpsAuthConfig();
const AUTH_MODE_LABEL = getOpsAuthModeLabel(AUTH_CONFIG.mode);
const SSO_PROVIDER_ORDER: OpsSsoProvider[] = ['google', 'microsoft'];


export default function StaffSignIn() {
  const router   = useRouter();
  const [email,  setEmail]   = useState('');
  const [error,  setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Ensure dark theme on initial sign-in page render (ThemeProvider applies via useEffect).
    document.documentElement.setAttribute('data-theme', 'dark');

    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const provider = params.get('provider');
    if (!reason) {
      return;
    }

    setError(getReasonMessage(reason, provider));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    // DEMO MODE: Instant sign-in, no artificial delay
    if (AUTH_CONFIG.mode === 'demo') {
      setSession({
        id: 'demo-staff-001',
        email: email.trim().toLowerCase(),
        name: 'Demo Advisor',
        role: 'ADMIN',
        lender: { id: 'demo-lender-001', name: 'Capstack Demo' },
        type: 'staff',
      });

      router.replace('/applications');
      return;
    }

    try {
      const res  = await fetch('/api/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Sign-in failed.');
        setLoading(false);
        return;
      }

      setSession(json);
      router.replace('/applications');
    } catch {
      setError('Could not reach the server. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'rgb(0, 0, 0)', colorScheme: 'dark' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-9 relative z-10"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.24em] px-3 py-1 rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-secondary)', border: '1px solid var(--color-border)' }}
            >
              Internal Workspace
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.18em] px-3 py-1 rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
            >
              {AUTH_MODE_LABEL}
            </span>
          </div>

          <div className="font-extrabold text-[1.85rem] tracking-tight mb-2">Capstack Ops Console</div>
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Internal underwriting, servicing, collections, and portfolio operations.
          </div>
        </div>

        <div
          className="rounded-xl px-4 py-4 mb-5"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-primary)' }}>
            Authentication
          </div>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            {AUTH_CONFIG.mode === 'demo'
              ? 'This preview uses passwordless work-email sign-in for provisioned internal users.'
              : AUTH_CONFIG.mode === 'passwordless'
                ? 'This environment uses passwordless work-email sign-in for provisioned internal users.'
                : AUTH_CONFIG.mode === 'hybrid'
                  ? 'This environment supports both work-email sign-in and enterprise SSO for provisioned internal users.'
                  : 'This environment requires enterprise SSO for internal users.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {SSO_PROVIDER_ORDER.map((provider) => {
            const enabled = AUTH_CONFIG.ssoEnabled && AUTH_CONFIG.enabledProviders.includes(provider);

            return enabled ? (
              <a
                key={provider}
                href={`/api/auth/sso/${provider}`}
                className="px-4 py-3 rounded-lg text-sm font-semibold text-center"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
              >
                {OPS_SSO_PROVIDER_LABELS[provider]}
              </a>
            ) : (
              <button
                key={provider}
                type="button"
                disabled
                className="px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-100"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
              >
                {OPS_SSO_PROVIDER_LABELS[provider]}
              </button>
            );
          })}
        </div>

        <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
          {AUTH_CONFIG.ssoEnabled
            ? AUTH_CONFIG.enabledProviders.length > 0
              ? `Configured SSO providers: ${AUTH_CONFIG.enabledProviders.map((provider) => OPS_SSO_PROVIDER_LABELS[provider]).join(', ')}.`
              : 'SSO mode is available, but no provider has been enabled in this environment yet.'
            : 'Enterprise SSO can be turned on later by enabling ops auth mode and provider routes in environment configuration.'}
        </p>

        {error && (
          <div
            className="text-sm px-4 py-3 rounded-lg mb-5"
            style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
          >
            {error}
          </div>
        )}

        {AUTH_CONFIG.emailSignInEnabled ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                Work email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@lender.co.za"
                className="px-4 py-3 rounded-lg text-sm"
                style={{
                  background:  'var(--color-surface-2)',
                  border:      '1px solid var(--color-border)',
                  color:       'var(--foreground)',
                  outline:     'none',
                }}
              />
            </div>

            {loading && (
              <div
                className="text-xs px-4 py-3 rounded-lg"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
              >
                Verifying workspace access and opening the internal console…
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div
            className="rounded-lg px-4 py-4 text-sm"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
          >
            Work-email sign-in is disabled in this environment. Use one of the enabled SSO providers above.
          </div>
        )}

        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
            Forgot your access or need to be added to the workspace?
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <a href="mailto:support@capstack.co.za?subject=Ops%20workspace%20access" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
              Contact workspace admin
            </a>
            <Link href="/" style={{ color: 'var(--color-muted)' }}>
              Back to platform
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getReasonMessage(reason: string, provider: string | null): string {
  const providerLabel = provider && (provider === 'google' || provider === 'microsoft')
    ? OPS_SSO_PROVIDER_LABELS[provider]
    : 'Enterprise SSO';

  switch (reason) {
    case 'session_expired':
      return 'Your ops session expired. Sign in again to continue.';
    case 'auth_required':
      return 'Sign in to access the ops workspace.';
    case 'sso_provider_denied':
      return `${providerLabel} sign-in was cancelled or denied.`;
    case 'sso_state_invalid':
      return 'The SSO sign-in attempt expired or could not be verified. Please try again.';
    case 'sso_exchange_failed':
      return `${providerLabel} completed, but the authorization code exchange failed.`;
    case 'sso_profile_failed':
      return `${providerLabel} completed, but your verified work profile could not be retrieved.`;
    case 'sso_access_denied':
      return 'Your identity provider authenticated you, but no provisioned Capstack staff account was found for that email.';
    case 'sso_provider_not_configured':
      return `${providerLabel} is enabled in the UI but not fully configured on the server.`;
    default:
      return 'Sign-in failed. Please try again.';
  }
}
