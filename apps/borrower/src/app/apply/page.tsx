'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import Link from 'next/link';
import { getSession }          from '@/lib/session';
import { ThemeToggle }         from '@/app/_components/ThemeProvider';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type Product = {
  id: string; name: string; type: string;
  minAmount: number; maxAmount: number;
  minTermDays: number; maxTermDays: number;
  defaultAprBps: number;
};

const PURPOSES = ['Personal expenses', 'Home improvement', 'Medical', 'Education', 'Business', 'Debt consolidation', 'Other'];

export default function Apply() {
  const router = useRouter();
  const [step, setStep]         = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [amount, setAmount]     = useState('');
  const [termDays, setTermDays] = useState('');
  const [purpose, setPurpose]   = useState(PURPOSES[0]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [prodLoading, setProdLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/products`)
      .then(r => r.json())
      .then(j => { setProducts(j.data ?? []); setProdLoading(false); })
      .catch(() => setProdLoading(false));
  }, []);

  async function handleSubmit() {
    const session = getSession();
    if (!session) { router.replace('/sign-in'); return; }
    if (!selected) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/v1/applications`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo' },
        body: JSON.stringify({
          borrowerId:        session.id,
          productId:         selected.id,
          amountRequested:   Math.round(Number(amount) * 100),
          termDaysRequested: Number(termDays),
          purpose,
          channel:           'web',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Submission failed'); setLoading(false); return; }
      router.push('/dashboard?applied=1');
    } catch {
      setError('Unable to reach the server.');
      setLoading(false);
    }
  }

  const fmtApr = (bps: number) => `${(bps / 100).toFixed(1)}%`;
  const fmtR   = (cents: number) => `R ${(cents / 100).toLocaleString()}`;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-base tracking-tight">Capstack</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard" className="text-sm" style={{ color: 'var(--color-muted)' }}>My dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto w-full px-6 py-12">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-10">
          {['Select product', 'Loan details', 'Review'].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step > i + 1 ? 'var(--color-secondary)' : step === i + 1 ? 'var(--color-primary)' : 'var(--color-border)',
                    color:      step >= i + 1 ? '#fff' : 'var(--color-muted)',
                  }}
                >
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className="text-sm font-medium" style={{ color: step === i + 1 ? 'var(--foreground)' : 'var(--color-muted)' }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div className="w-8 h-px" style={{ background: 'var(--color-border)' }} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Select product */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Choose a loan product</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
              Select the product that best fits your needs.
            </p>

            {prodLoading ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading products…</p>
            ) : products.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  No products available right now. Please check back later.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelected(p); setAmount(String(p.minAmount / 100)); setTermDays(String(p.minTermDays)); }}
                    className="text-left rounded-xl p-5 transition-all"
                    style={{
                      background: selected?.id === p.id ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      border: selected?.id === p.id
                        ? `2px solid var(--color-secondary)`
                        : '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold">{p.name}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          {p.type.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{fmtApr(p.defaultAprBps)} APR</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          {fmtR(p.minAmount)} – {fmtR(p.maxAmount)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!selected}
              className="mt-8 px-6 py-3 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--color-primary)', color: '#fff', opacity: selected ? 1 : 0.4 }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Loan details */}
        {step === 2 && selected && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Loan details</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
              How much do you need, and for how long?
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
                  Loan amount (R) — min {fmtR(selected.minAmount)} / max {fmtR(selected.maxAmount)}
                </label>
                <input
                  type="number"
                  value={amount}
                  min={selected.minAmount / 100}
                  max={selected.maxAmount / 100}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
                  Term (days) — min {selected.minTermDays} / max {selected.maxTermDays}
                </label>
                <input
                  type="number"
                  value={termDays}
                  min={selected.minTermDays}
                  max={selected.maxTermDays}
                  onChange={e => setTermDays(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>
                  Purpose
                </label>
                <select
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                >
                  {PURPOSES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!amount || !termDays}
                className="px-6 py-3 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-primary)', color: '#fff', opacity: amount && termDays ? 1 : 0.4 }}
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && selected && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Review your application</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
              Please confirm the details below before submitting.
            </p>

            <div
              className="rounded-xl p-6 flex flex-col gap-4 mb-6"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {[
                ['Product',    selected.name],
                ['Amount',     `R ${Number(amount).toLocaleString()}`],
                ['Term',       `${termDays} days`],
                ['Purpose',    purpose],
                ['APR',        fmtApr(selected.defaultAprBps)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-muted)' }}>{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>

            <p className="text-xs mb-6" style={{ color: 'var(--color-muted)' }}>
              By submitting you confirm you have read and agree to Capstack&apos;s credit agreement terms.
              This is a binding application under the National Credit Act.
            </p>

            {error && (
              <div
                className="text-xs px-3 py-2 rounded-lg mb-4"
                style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-3 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-secondary)', color: '#fff', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
