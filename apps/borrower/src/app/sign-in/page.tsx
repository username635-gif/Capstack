'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setSession } from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [returnPath, setReturnPath] = useState('/dashboard');

  useEffect(() => {
    const nextPath = new URLSearchParams(window.location.search).get('next');
    setReturnPath(nextPath?.startsWith('/') ? nextPath : '/dashboard');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch(`${API}/api/v1/auth/borrower`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Sign-in failed');
        return;
      }

      setSession(data);
      router.push(returnPath);
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="mb-8">
          <div className="font-bold text-xl tracking-tight mb-1">
            Capstack <span style={{ color: 'var(--color-secondary)' }}>Borrower</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Sign in to view your loans and applications.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
            Use the email linked to your account. For this demo, sign-in is email-only; live launch will use a secure link or OTP.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border:     '1px solid var(--color-border)',
                color:      'var(--foreground)',
              }}
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
            >
              {error}
            </div>
          )}

          {loading && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
            >
              Checking your account and opening your secure borrower workspace…
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm font-semibold py-2.5 rounded-lg"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs mt-6 text-center" style={{ color: 'var(--color-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href={returnPath === '/dashboard' ? '/sign-up' : `/sign-up?next=${encodeURIComponent(returnPath)}`} style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
