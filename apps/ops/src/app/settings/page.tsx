'use client';

import OpsLayout from '@/app/_components/OpsLayout';
import { getSession } from '@/lib/session';
import { useEffect, useState } from 'react';

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
        <div
          className="rounded-xl px-5 py-4 text-xs"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          <strong>Authentication:</strong> Currently running in demo mode (no password required).<br />
          To enable production auth, integrate Clerk in <code>apps/ops/src/app/sign-in/page.tsx</code> and replace the <code>/api/v1/auth/staff</code> call with <code>useSignIn()</code> from <code>@clerk/nextjs</code>.
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
