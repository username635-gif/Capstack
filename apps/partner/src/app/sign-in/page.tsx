"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setSession } from '@/lib/session';
import { getSession } from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

export default function PartnerSignIn() {
  const router = useRouter();
  const [apiKey,   setApiKey]  = useState('');
  const [error,    setError]   = useState<string | null>(null);
  const [loading,  setLoading] = useState(false);
  const [savedSession, setSavedSession] = useState<ReturnType<typeof getSession>>(null);
  const SAVED_API_KEY = 'capstack_partner_saved_api';

  useEffect(() => { 
    setSavedSession(getSession());
    const stored = typeof window !== 'undefined' ? localStorage.getItem(SAVED_API_KEY) : null;
    if (stored) setApiKey(stored);
  }, []);
  useEffect(() => { setSavedSession(getSession()); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);
    // DEMO MODE — bypass real API
    if (apiKey.trim() === 'demo') {
      setSession({
        id: 'partner-demo',
        name: 'Demo Partner',
        slug: 'demo-partner',
        lenderId: 'lender-001',
        type: 'partner',
      });
      router.replace('/loans');
      return;
    }
    try {
      const res  = await fetch(`${API}/api/v1/auth/partner`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Invalid API key.');
        setLoading(false);
        return;
      }
      setSession(json);
      router.replace('/loans');
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
          <div className="font-extrabold text-2xl tracking-tight mb-1">Capstack Partner</div>
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Enter your API key to access the partner portal</div>
        </div>

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
              API key
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk_live_…"
              className="px-4 py-3 rounded-lg text-sm font-mono"
              style={{
                background: 'var(--color-surface-2)',
                border:     '1px solid var(--color-border)',
                color:      'var(--foreground)',
                outline:    'none',
              }}
            />
            {savedSession && (
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Signed in as <span className="font-mono text-xs">{savedSession.name}</span> (saved)
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      // For demo session, autofill the demo key. Otherwise continue into the app.
                          if (savedSession.id === 'partner-demo') {
                            setApiKey('demo');
                            try { localStorage.setItem(SAVED_API_KEY, 'demo'); } catch {}
                          } else {
                            router.replace('/loans');
                          }
                    }}
                    className="text-xs font-semibold px-3 py-1 rounded"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                  >
                    Use saved
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
          >
            {loading ? 'Authenticating…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs mt-6 text-center" style={{ color: 'var(--color-muted)' }}>
          Don&apos;t have an API key? Contact your Capstack account manager.
        </p>
      </div>
    </div>
  );
}
