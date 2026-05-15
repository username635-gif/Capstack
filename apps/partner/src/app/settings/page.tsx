'use client';

import { useState, useEffect } from 'react';
import PartnerLayout from '@/app/_components/PartnerLayout';
import { getSession } from '@/lib/session';

export default function PartnerSettings() {
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [webhook, setWebhook] = useState('');
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    setSession(getSession());
  }, []);

  return (
    <PartnerLayout title="Settings">
      <div className="max-w-xl flex flex-col gap-6">

        {/* Partner profile */}
        <Section title="Partner profile">
          <Row label="Name"       value={session?.name  ?? '—'} />
          <Row label="Slug"       value={session?.slug  ?? '—'} />
          <Row label="Partner ID" value={session?.id    ?? '—'} />
        </Section>

        {/* Webhook */}
        <Section title="Webhook URL">
          <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
            Capstack will POST loan events (disbursed, repaid, defaulted) to this URL.
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              value={webhook}
              onChange={e => { setWebhook(e.target.value); setSaved(false); }}
              placeholder="https://your-server.com/webhooks/capstack"
              className="flex-1 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
            <button
              onClick={() => setSaved(true)}
              className="px-5 py-3 rounded-lg text-sm font-semibold"
              style={{ background: saved ? 'var(--badge-approved-bg)' : 'var(--color-primary)', color: saved ? 'var(--badge-approved-fg)' : '#fff' }}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
            Note: persistent webhook registration requires connecting to the live API.
          </p>
        </Section>

        {/* Auth note */}
        <div
          className="rounded-xl px-5 py-4 text-xs"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          <strong>Authentication:</strong> Currently running in demo mode (API key check only).<br />
          To add MFA or SSO, integrate Clerk in <code>apps/partner/src/app/sign-in/page.tsx</code>.
        </div>
      </div>
    </PartnerLayout>
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
      <span className="font-semibold font-mono text-xs">{value}</span>
    </div>
  );
}
