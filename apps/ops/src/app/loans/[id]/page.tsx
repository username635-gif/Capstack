'use client';

import { useState, useEffect, use } from 'react';
import { useRouter }                 from 'next/navigation';
import OpsLayout                     from '@/app/_components/OpsLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type ScheduleEntry = { id: string; period: number; paymentDate: string; openingBalance: number; scheduledPayment: number; principal: number; interest: number; closingBalance: number };
type Repayment     = { id: string; receivedAt: string; amount: number; method?: string };
type LoanDetail    = {
  id: string; loanNumber: string; status: string;
  principal: number; outstandingPrincipal: number; aprBps: number;
  startDate: string; maturityDate: string; daysPastDue: number;
  borrower?: { firstName: string; lastName: string; email: string };
  product?:  { name: string };
  schedule?:   ScheduleEntry[];
  repayments?: Repayment[];
};

export default function LoanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const [data,    setData]    = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<'schedule' | 'repayments'>('schedule');

  useEffect(() => {
    fetch(`${API}/api/v1/loans/${id}`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setData(j); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  return (
    <OpsLayout title="Loan Detail">
      {loading && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {data && (
        <div className="max-w-4xl flex flex-col gap-6">
          {/* Summary card */}
          <div className="rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Loan number</div>
              <div className="font-bold font-mono text-sm">{data.loanNumber}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Principal</div>
              <div className="font-extrabold text-lg">R {(data.principal / 100).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Outstanding</div>
              <div className="font-extrabold text-lg">R {(data.outstandingPrincipal / 100).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Status</div>
              <div className="font-bold text-sm">{data.status.replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Borrower</div>
              <div className="font-semibold text-sm">{data.borrower?.firstName} {data.borrower?.lastName}</div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{data.borrower?.email}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Product</div>
              <div className="font-semibold text-sm">{data.product?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>APR</div>
              <div className="font-semibold text-sm">{(data.aprBps / 100).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Days past due</div>
              <div className="font-semibold text-sm" style={{ color: data.daysPastDue > 0 ? 'var(--badge-declined-fg)' : 'inherit' }}>
                {data.daysPastDue}d
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
            {(['schedule', 'repayments'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-5 py-2.5 text-sm font-medium capitalize"
                style={{
                  borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: tab === t ? 'var(--color-primary)' : 'var(--color-muted)',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Schedule table */}
          {tab === 'schedule' && (
            <div className="rounded-xl overflow-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    {['#','Date','Opening bal.','Payment','Principal','Interest','Closing bal.'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.schedule ?? []).map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < (data.schedule?.length ?? 0) - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td className="px-4 py-2.5 font-mono">{s.period}</td>
                      <td className="px-4 py-2.5">{new Date(s.paymentDate).toLocaleDateString('en-ZA')}</td>
                      <td className="px-4 py-2.5">R {(s.openingBalance / 100).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-semibold">R {(s.scheduledPayment / 100).toLocaleString()}</td>
                      <td className="px-4 py-2.5">R {(s.principal / 100).toLocaleString()}</td>
                      <td className="px-4 py-2.5">R {(s.interest / 100).toLocaleString()}</td>
                      <td className="px-4 py-2.5">R {(s.closingBalance / 100).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(data.schedule ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--color-muted)' }}>No schedule available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Repayments table */}
          {tab === 'repayments' && (
            <div className="rounded-xl overflow-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    {['Date','Amount','Method'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.repayments ?? []).map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < (data.repayments?.length ?? 0) - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td className="px-4 py-3">{new Date(r.receivedAt).toLocaleString('en-ZA')}</td>
                      <td className="px-4 py-3 font-semibold">R {(r.amount / 100).toLocaleString()}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{r.method ?? 'EFT'}</td>
                    </tr>
                  ))}
                  {(data.repayments ?? []).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center" style={{ color: 'var(--color-muted)' }}>No repayments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={() => router.back()} className="self-start text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
            ← Back to loans
          </button>
        </div>
      )}
    </OpsLayout>
  );
}
