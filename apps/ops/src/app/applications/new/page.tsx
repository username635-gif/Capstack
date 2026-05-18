'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import OpsLayout               from '@/app/_components/OpsLayout';
import { API_BASE_URL as API } from '@/lib/api-client';

type Product = { id: string; name: string; minAmount: number; maxAmount: number; minTermMonths: number; maxTermMonths: number };

export default function NewApplication() {
  const router = useRouter();

  const [products,  setProducts]  = useState<Product[]>([]);
  const [step,      setStep]      = useState(1); // 1 = borrower, 2 = loan details, 3 = confirm

  // Step 1: Borrower lookup
  const [email,     setEmail]      = useState('');
  const [borrower,  setBorrower]   = useState<{ id: string; firstName: string; lastName: string; email: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking,   setLooking]    = useState(false);

  // Step 2: Loan details
  const [productId, setProductId] = useState('');
  const [amount,    setAmount]    = useState('');
  const [term,      setTerm]      = useState('');
  const [purpose,   setPurpose]   = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/products`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => setProducts(j.data ?? []));
  }, []);

  async function lookupBorrower() {
    if (!email.trim()) return;
    setLooking(true);
    setLookupError(null);
    setBorrower(null);

    // Search for borrower by email via auth route (read-only lookup)
    const res  = await fetch(`${API}/api/v1/auth/borrower`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const json = await res.json();
    setLooking(false);

    if (!res.ok) { setLookupError('Borrower not found. Ask them to sign up first.'); return; }
    setBorrower(json);
    setStep(2);
  }

  async function handleSubmit() {
    if (!borrower || !productId || !amount || !term) return;
    setSubmitting(true);
    setSubmitError(null);

    const res  = await fetch(`${API}/api/v1/applications`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo' },
      body: JSON.stringify({
        borrowerId:      borrower.id,
        productId,
        amountRequested: Math.round(parseFloat(amount) * 100),
        termMonths:      parseInt(term),
        purpose,
      }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) { setSubmitError(json.error ?? 'Submission failed.'); return; }
    router.push(`/applications/${json.id}`);
  }

  const selectedProduct = products.find(p => p.id === productId);

  return (
    <OpsLayout title="New Application">
      <div className="max-w-xl">
        {/* Progress steps */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step >= s ? 'var(--color-primary)' : 'var(--color-surface-2)',
                  color:      step >= s ? '#fff' : 'var(--color-muted)',
                }}
              >
                {s}
              </div>
              {s < 3 && <div className="w-12 h-px" style={{ background: 'var(--color-border)' }} />}
            </div>
          ))}
          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {step === 1 ? 'Find borrower' : step === 2 ? 'Loan details' : 'Review'}
          </span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {/* STEP 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold mb-1">Find borrower</h2>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Enter the borrower&apos;s email to pull up their profile.</p>

              {lookupError && (
                <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>
                  {lookupError}
                </div>
              )}

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="borrower@example.com"
                className="px-4 py-3 rounded-lg text-sm"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && lookupBorrower()}
              />
              <button
                onClick={lookupBorrower}
                disabled={looking}
                className="py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                {looking ? 'Looking up…' : 'Find borrower →'}
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && borrower && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Loan details</h2>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Borrower: <strong>{borrower.firstName} {borrower.lastName}</strong> ({borrower.email})
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Product</label>
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  className="px-4 py-3 rounded-lg text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                >
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {selectedProduct && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                      Amount (R) — {(selectedProduct.minAmount/100).toLocaleString()}–{(selectedProduct.maxAmount/100).toLocaleString()}
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min={selectedProduct.minAmount / 100}
                      max={selectedProduct.maxAmount / 100}
                      placeholder="Enter amount"
                      className="px-4 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                      Term (months) — {selectedProduct.minTermMonths}–{selectedProduct.maxTermMonths}
                    </label>
                    <input
                      type="number"
                      value={term}
                      onChange={e => setTerm(e.target.value)}
                      min={selectedProduct.minTermMonths}
                      max={selectedProduct.maxTermMonths}
                      placeholder="Months"
                      className="px-4 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Purpose (optional)</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Business working capital"
                  className="px-4 py-3 rounded-lg text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)' }}>← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!productId || !amount || !term}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                  Review →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && borrower && selectedProduct && (
            <div className="flex flex-col gap-5">
              <h2 className="text-lg font-bold">Review application</h2>

              {submitError && (
                <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>
                  {submitError}
                </div>
              )}

              <div className="rounded-xl p-5 grid grid-cols-2 gap-4 text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                {[
                  ['Borrower',   `${borrower.firstName} ${borrower.lastName}`],
                  ['Email',      borrower.email],
                  ['Product',    selectedProduct.name],
                  ['Amount',     `R ${parseFloat(amount).toLocaleString()}`],
                  ['Term',       `${term} months`],
                  ['Purpose',    purpose || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>{label}</div>
                    <div className="font-semibold">{value}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)' }}>← Back</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--color-secondary)', color: '#fff' }}
                >
                  {submitting ? 'Submitting…' : 'Submit application'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </OpsLayout>
  );
}
