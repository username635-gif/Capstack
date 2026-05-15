'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setSession } from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';
const DEMO_EMAIL = 'ops@capstack.demo';

export default function StaffSignIn() {
  const router   = useRouter();
  const [email,  setEmail]   = useState('');
  const [error,  setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API}/api/v1/auth/staff`, {
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
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-9"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="mb-8 text-center">
          <div className="font-extrabold text-2xl tracking-tight mb-1">Capstack Ops</div>
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Sign in to the operations portal</div>
        </div>

        {/* Demo credentials banner */}
        <button
          type="button"
          onClick={() => setEmail(DEMO_EMAIL)}
          className="w-full text-left px-4 py-3 rounded-lg mb-5 text-sm"
          style={{ background: 'rgba(0,180,120,0.08)', border: '1px dashed var(--color-secondary)', color: 'var(--color-secondary)' }}
        >
          <span className="font-semibold">⚡ Demo mode</span> — click to fill demo credentials<br />
          <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }}>{DEMO_EMAIL}</span>
        </button>

        {error && (
          <div
            className="text-sm px-4 py-3 rounded-lg mb-5"
            style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
          >
            {error}
          </div>
        )}

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

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
