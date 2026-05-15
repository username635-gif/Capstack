'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setSession } from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

// Demo / test data — no real personal information
const TEST_DATA = {
  fullName:        'Demo User',
  email:           `demo.${Date.now()}@capstack-test.com`,
  phone:           '+27 82 000 0000',
  idNumber:        '8001015009087',
  dateOfBirth:     '1980-01-01',
  monthlyIncome:   '15000',
  employmentStatus: 'EMPLOYED',
};

export default function SignUp() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', phone: '', fullName: '', idNumber: '',
    dateOfBirth: '', monthlyIncome: '', employmentStatus: 'EMPLOYED',
  });

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function fillTestData() {
    setForm({ ...TEST_DATA, email: `demo.${Date.now()}@capstack-test.com` });
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate date format before sending
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
        setError('Date of birth must be in YYYY-MM-DD format (e.g. 1990-05-15)');
        setLoading(false);
        return;
      }

      // Step 1: Create borrower
      const createRes = await fetch(`${API}/api/v1/borrowers`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:  'INDIVIDUAL',
          email: form.email,
          phone: form.phone,
          individual: {
            fullName:        form.fullName,
            idNumber:        form.idNumber,
            dateOfBirth:     form.dateOfBirth,
            monthlyIncome:   form.monthlyIncome ? Math.round(Number(form.monthlyIncome) * 100) : undefined,
            employmentStatus: form.employmentStatus,
          },
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) { setError(createData.error ?? 'Account creation failed'); return; }

      // Step 2: Sign in
      const authRes  = await fetch(`${API}/api/v1/auth/borrower`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: form.email }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) { setError(authData.error ?? 'Sign-in failed after registration'); return; }

      setSession(authData);
      router.push('/dashboard');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Network errors often say "Failed to fetch" — give a clearer message
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('CORS')) {
        setError('Network error — the API may still be deploying. Wait 30 seconds and try again.');
      } else {
        setError(`Error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        required
        className="w-full text-sm px-3 py-2 rounded-lg outline-none"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="mb-4">
          <div className="font-bold text-xl tracking-tight mb-1">
            Capstack <span style={{ color: 'var(--color-secondary)' }}>Borrower</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Create your account to apply for a loan.
          </p>
        </div>

        {/* Test data banner */}
        <button
          type="button"
          onClick={fillTestData}
          className="w-full text-xs font-semibold px-3 py-2 rounded-lg mb-4 text-left"
          style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-secondary)', color: 'var(--color-secondary)' }}
        >
          ⚡ Fill with demo data (no real info needed)
        </button>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2].map(s => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full"
              style={{ background: step >= s ? 'var(--color-secondary)' : 'var(--color-border)' }}
            />
          ))}
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleSubmit}
          className="flex flex-col gap-4"
        >
          {step === 1 && (
            <>
              {field('Full name', 'fullName', 'text', 'As on your ID')}
              {field('Email address', 'email', 'email', 'you@example.com')}
              {field('Mobile number', 'phone', 'tel', '+27 82 000 0000')}
              <button
                type="submit"
                className="w-full text-sm font-semibold py-2.5 rounded-lg mt-2"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {field('South African ID number', 'idNumber', 'text', '8001015009087')}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
                  Date of birth
                </label>
                <input
                  type="text"
                  value={form.dateOfBirth}
                  onChange={e => set('dateOfBirth', e.target.value)}
                  required
                  placeholder="YYYY-MM-DD (e.g. 1990-05-15)"
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Format: YYYY-MM-DD</span>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
                  Employment status
                </label>
                <select
                  value={form.employmentStatus}
                  onChange={e => set('employmentStatus', e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                >
                  {['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED'].map(v => (
                    <option key={v} value={v}>{v.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              {field('Monthly gross income (R)', 'monthlyIncome', 'number', '15000')}

              {error && (
                <div
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
                >
                  {error}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-lg"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-lg"
                  style={{ background: 'var(--color-primary)', color: '#fff', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-xs mt-6 text-center" style={{ color: 'var(--color-muted)' }}>
          Already have an account?{' '}
          <Link href="/sign-in" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
