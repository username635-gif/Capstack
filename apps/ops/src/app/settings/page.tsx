'use client';

import OpsLayout from '@/app/_components/OpsLayout';
import { getOpsAuthModeLabel, getPublicOpsAuthConfig, OPS_SSO_PROVIDER_LABELS } from '@/lib/auth-config';
import { getSession } from '@/lib/session';
import { useEffect, useState } from 'react';

const AUTH_CONFIG = getPublicOpsAuthConfig();

export default function SettingsPage() {
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  return (
    <OpsLayout title="Settings">
      <div className="max-w-xl flex flex-col gap-6">

        {/* Staff profile */}
        <Section title="Your profile">
          <Row label="Name"  value={session?.name  ?? '—'} />
          <Row label="Email" value={session?.email ?? '—'} />
          <Row label="Role"  value={session?.role  ?? '—'} />
        </Section>

        {/* Lender info */}
        {session?.lender && (
          <Section title="Lender">
            <Row label="Name" value={session.lender.name ?? '—'} />
            <Row label="ID"   value={session.lender.id   ?? '—'} />
          </Section>
        )}

        {/* Auth note */}
        <Section title="Authentication mode">
          <Row label="Mode" value={getOpsAuthModeLabel(AUTH_CONFIG.mode)} />
          <Row label="Work email sign-in" value={AUTH_CONFIG.emailSignInEnabled ? 'Enabled' : 'Disabled'} />
          <Row
            label="SSO providers"
            value={AUTH_CONFIG.enabledProviders.length > 0
              ? AUTH_CONFIG.enabledProviders.map((provider) => OPS_SSO_PROVIDER_LABELS[provider]).join(', ')
              : 'Not configured'}
          />
        </Section>

        <div
          className="rounded-xl px-5 py-4 text-xs"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          <strong>Authentication:</strong> This preview uses provisioned passwordless demo access for internal staff only.<br />
          Production auth can now be staged by setting <code>NEXT_PUBLIC_OPS_AUTH_MODE</code>, enabling <code>NEXT_PUBLIC_OPS_SSO_PROVIDERS</code>, and wiring provider start URLs before replacing demo auth entirely.
        </div>
      </div>
    </OpsLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
