'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import PartnerLayout           from '@/app/_components/PartnerLayout';
import { getSession }          from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type Product = { id: string; name: string; minAmount: number; maxAmount: number; minTermMonths: number; maxTermMonths: number };

export default function NewPartnerApplication() {
  const router  = useRouter();
  const session = typeof window !== 'undefined' ? getSession() : null;

  const [products,  setProducts]  = useState<Product[]>([]);
  const [step,      setStep]      = useState(1);

  // Step 1: Borrower details
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [idNumber,  setIdNumber]  = useState('');
  const [empStatus, setEmpStatus] = useState('EMPLOYED');
  const [income,    setIncome]    = useState('');

  // Step 2: Loan details
  const [productId, setProductId] = useState('');
  const [amount,    setAmount]    = useState('');
  const [term,      setTerm]      = useState('');
  const [purpose,   setPurpose]   = useState('');

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/products`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => setProducts(j.data ?? []));
  }, []);

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);

    // 1. Create or look up borrower
    const borrowerRes  = await fetch(`${API}/api/v1/borrowers`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo' },
      body: JSON.stringify({
        firstName, lastName, email, phone,
        idNumber,  employmentStatus: empStatus,
        monthlyIncome: Math.round(parseFloat(income) * 100),
        lenderId: session.lenderId,
      }),
    });
    const borrowerJson = await borrowerRes.json();
    if (!borrowerRes.ok && borrowerRes.status !== 409) {
      setSubmitError(borrowerJson.error ?? 'Failed to create borrower.');
      setSubmitting(false);
      return;
    }

    const borrowerId = borrowerJson.id ?? borrowerJson.existingId;

    // 2. Submit application
    const appRes  = await fetch(`${API}/api/v1/applications`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo' },
      body: JSON.stringify({
        borrowerId, productId,
        amountRequested: Math.round(parseFloat(amount) * 100),
        termMonths:      parseInt(term),
        purpose,
        partnerId: session.id,
      }),
    });
    const appJson = await appRes.json();
    setSubmitting(false);

    if (!appRes.ok) { setSubmitError(appJson.error ?? 'Submission failed.'); return; }
    router.push('/applications');
  }

  const selectedProduct = products.find(p => p.id === productId);

  return (
    <PartnerLayout title="New Application">
      <div className="max-w-xl">
        {/* Progress */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: step >= s ? 'var(--color-primary)' : 'var(--color-surface-2)', color: step >= s ? '#fff' : 'var(--color-muted)' }}
              >
                {s}
              </div>
              {s < 3 && <div className="w-12 h-px" style={{ background: 'var(--color-border)' }} />}
            </div>
          ))}
          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {step === 1 ? 'Borrower details' : step === 2 ? 'Loan details' : 'Review & submit'}
          </span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {/* STEP 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">Borrower details</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['First name', firstName, setFirstName, 'text', 'Jane'],
                  ['Last name',  lastName,  setLastName,  'text', 'Smith'],
                  ['Email',      email,     setEmail,     'email', 'jane@example.com'],
                  ['Phone',      phone,     setPhone,     'tel',  '+27 82 000 0000'],
                  ['ID number',  idNumber,  setIdNumber,  'text', '9001010000000'],
                  ['Monthly income (R)', income, setIncome, 'number', '15000'],
                ].map(([label, val, setter, type, placeholder]) => (
                  <div key={label as string} className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{label as string}</label>
                    <input
                      type={type as string}
                      value={val as string}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                      placeholder={placeholder as string}
                      className="px-4 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Employment status</label>
                  <select
                    value={empStatus}
                    onChange={e => setEmpStatus(e.target.value)}
                    className="px-4 py-3 rounded-lg text-sm"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none', colorScheme: 'inherit' }}
                  >
                    {['EMPLOYED','SELF_EMPLOYED','UNEMPLOYED','PENSIONER'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!firstName || !lastName || !email || !income}
                className="mt-2 py-3 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
              >
                Next: Loan details →
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-lg font-bold">Loan details</h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Product</label>
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  className="px-4 py-3 rounded-lg text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none', colorScheme: 'inherit' }}
                >
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedProduct && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                      Amount (R) · {(selectedProduct.minAmount/100).toLocaleString()}–{(selectedProduct.maxAmount/100).toLocaleString()}
                    </label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      min={selectedProduct.minAmount/100} max={selectedProduct.maxAmount/100}
                      className="px-4 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                      Term (months) · {selectedProduct.minTermMonths}–{selectedProduct.maxTermMonths}
                    </label>
                    <input type="number" value={term} onChange={e => setTerm(e.target.value)}
                      min={selectedProduct.minTermMonths} max={selectedProduct.maxTermMonths}
                      className="px-4 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Purpose (optional)</label>
                <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)}
                  className="px-4 py-3 rounded-lg text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)' }}>← Back</button>
                <button onClick={() => setStep(3)} disabled={!productId || !amount || !term} className="flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>Review →</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && selectedProduct && (
            <div className="flex flex-col gap-5">
              <h2 className="text-lg font-bold">Review &amp; submit</h2>
              {submitError && (
                <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>{submitError}</div>
              )}
              <div className="rounded-xl p-5 grid grid-cols-2 gap-4 text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                {[
                  ['Name',     `${firstName} ${lastName}`],
                  ['Email',    email],
                  ['Product',  selectedProduct.name],
                  ['Amount',   `R ${parseFloat(amount).toLocaleString()}`],
                  ['Term',     `${term} months`],
                  ['Purpose',  purpose || '—'],
                ].map(([l, v]) => (
                  <div key={l}><div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>{l}</div><div className="font-semibold">{v}</div></div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)' }}>← Back</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--color-secondary)', color: 'var(--color-secondary-fg)' }}>
                  {submitting ? 'Submitting…' : 'Submit application'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PartnerLayout>
  );
}
