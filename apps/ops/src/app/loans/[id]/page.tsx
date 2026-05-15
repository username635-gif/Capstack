'use client';

import { useState, use } from 'react';
import { useRouter }     from 'next/navigation';
import OpsLayout         from '@/app/_components/OpsLayout';

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

// Helper: generate a fixed-payment amortisation schedule
function makeSchedule(id: string, principal: number, aprBps: number, months: number, start: string): ScheduleEntry[] {
  const r   = aprBps / 10000 / 12;
  const pmt = r > 0 ? Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)) : Math.round(principal / months);
  const entries: ScheduleEntry[] = [];
  let bal = principal;
  const d = new Date(start);
  for (let i = 1; i <= months && bal > 0; i++) {
    const interest  = Math.round(bal * r);
    const princ     = Math.min(bal, pmt - interest);
    const closing   = bal - princ;
    d.setMonth(d.getMonth() + 1);
    entries.push({ id: `${id}-s${i}`, period: i, paymentDate: d.toISOString().slice(0, 10), openingBalance: bal, scheduledPayment: pmt, principal: princ, interest, closingBalance: closing });
    bal = closing;
  }
  return entries;
}

const DEMO: Record<string, LoanDetail> = {
  l1: {
    id: 'l1', loanNumber: 'LN-2026-00091', status: 'ACTIVE', principal: 2500000, outstandingPrincipal: 2200000, aprBps: 1800, startDate: '2026-02-01', maturityDate: '2028-02-01', daysPastDue: 0,
    borrower: { firstName: 'Sipho',  lastName: 'Dlamini',      email: 'sipho@example.co.za'   }, product: { name: 'Personal Loan'   },
    schedule:   makeSchedule('l1', 2500000, 1800, 24, '2026-02-01'),
    repayments: [
      { id: 'r1a', receivedAt: '2026-03-01T08:00:00Z', amount: 124850, method: 'Debit order' },
      { id: 'r1b', receivedAt: '2026-04-01T08:00:00Z', amount: 124850, method: 'Debit order' },
      { id: 'r1c', receivedAt: '2026-05-01T08:00:00Z', amount: 124850, method: 'Debit order' },
    ],
  },
  l2: {
    id: 'l2', loanNumber: 'LN-2026-00088', status: 'ACTIVE', principal: 12000000, outstandingPrincipal: 11400000, aprBps: 1200, startDate: '2026-01-15', maturityDate: '2029-01-15', daysPastDue: 0,
    borrower: { firstName: 'Naledi', lastName: 'Mokoena',      email: 'naledi@example.co.za'  }, product: { name: 'Business Loan'   },
    schedule:   makeSchedule('l2', 12000000, 1200, 36, '2026-01-15'),
    repayments: [
      { id: 'r2a', receivedAt: '2026-02-15T08:00:00Z', amount: 398667, method: 'EFT' },
      { id: 'r2b', receivedAt: '2026-03-15T08:00:00Z', amount: 398667, method: 'EFT' },
      { id: 'r2c', receivedAt: '2026-04-15T08:00:00Z', amount: 398667, method: 'EFT' },
    ],
  },
  l3: {
    id: 'l3', loanNumber: 'LN-2026-00085', status: 'ACTIVE', principal: 800000, outstandingPrincipal: 650000, aprBps: 3600, startDate: '2026-03-01', maturityDate: '2026-09-01', daysPastDue: 14,
    borrower: { firstName: 'James',  lastName: 'van der Merwe', email: 'james@example.co.za'   }, product: { name: 'Short-Term Loan' },
    schedule:   makeSchedule('l3', 800000, 3600, 6, '2026-03-01'),
    repayments: [
      { id: 'r3a', receivedAt: '2026-04-01T08:00:00Z', amount: 145333, method: 'EFT' },
    ],
  },
  l4: {
    id: 'l4', loanNumber: 'LN-2025-00072', status: 'ACTIVE', principal: 7500000, outstandingPrincipal: 5200000, aprBps: 1800, startDate: '2025-09-01', maturityDate: '2027-09-01', daysPastDue: 32,
    borrower: { firstName: 'Lerato', lastName: 'Sithole',      email: 'lerato@example.co.za'  }, product: { name: 'Business Loan'   },
    schedule:   makeSchedule('l4', 7500000, 1800, 24, '2025-09-01'),
    repayments: [
      { id: 'r4a', receivedAt: '2025-10-01T08:00:00Z', amount: 374167, method: 'Debit order' },
      { id: 'r4b', receivedAt: '2025-11-01T08:00:00Z', amount: 374167, method: 'Debit order' },
      { id: 'r4c', receivedAt: '2025-12-01T08:00:00Z', amount: 374167, method: 'Debit order' },
      { id: 'r4d', receivedAt: '2026-01-01T08:00:00Z', amount: 374167, method: 'Debit order' },
      { id: 'r4e', receivedAt: '2026-02-01T08:00:00Z', amount: 374167, method: 'Debit order' },
      { id: 'r4f', receivedAt: '2026-03-01T08:00:00Z', amount: 374167, method: 'Debit order' },
    ],
  },
  l5: {
    id: 'l5', loanNumber: 'LN-2025-00061', status: 'PAID_IN_FULL', principal: 1500000, outstandingPrincipal: 0, aprBps: 2400, startDate: '2025-06-01', maturityDate: '2026-06-01', daysPastDue: 0,
    borrower: { firstName: 'Andile', lastName: 'Zulu',          email: 'andile@example.co.za'  }, product: { name: 'Personal Loan'   },
    schedule:   makeSchedule('l5', 1500000, 2400, 12, '2025-06-01'),
    repayments: Array.from({ length: 12 }, (_, i) => ({ id: `r5-${i}`, receivedAt: new Date(2025, 6 + i, 1).toISOString(), amount: 141250, method: 'Debit order' })),
  },
  l6: {
    id: 'l6', loanNumber: 'LN-2025-00058', status: 'ACTIVE', principal: 3500000, outstandingPrincipal: 3100000, aprBps: 1800, startDate: '2025-12-01', maturityDate: '2027-06-01', daysPastDue: 0,
    borrower: { firstName: 'Thabo',  lastName: 'Nkosi',         email: 'thabo@example.co.za'   }, product: { name: 'Personal Loan'   },
    schedule:   makeSchedule('l6', 3500000, 1800, 18, '2025-12-01'),
    repayments: [
      { id: 'r6a', receivedAt: '2026-01-01T08:00:00Z', amount: 218056, method: 'Debit order' },
      { id: 'r6b', receivedAt: '2026-02-01T08:00:00Z', amount: 218056, method: 'Debit order' },
      { id: 'r6c', receivedAt: '2026-03-01T08:00:00Z', amount: 218056, method: 'Debit order' },
      { id: 'r6d', receivedAt: '2026-04-01T08:00:00Z', amount: 218056, method: 'Debit order' },
      { id: 'r6e', receivedAt: '2026-05-01T08:00:00Z', amount: 218056, method: 'Debit order' },
    ],
  },
  l7: {
    id: 'l7', loanNumber: 'LN-2025-00044', status: 'DEFAULTED', principal: 5000000, outstandingPrincipal: 4800000, aprBps: 2400, startDate: '2025-05-01', maturityDate: '2026-05-01', daysPastDue: 91,
    borrower: { firstName: 'Fatima', lastName: 'Cassim',        email: 'fatima@example.co.za'  }, product: { name: 'Personal Loan'   },
    schedule:   makeSchedule('l7', 5000000, 2400, 12, '2025-05-01'),
    repayments: [
      { id: 'r7a', receivedAt: '2025-06-01T08:00:00Z', amount: 472500, method: 'EFT' },
    ],
  },
  l8: {
    id: 'l8', loanNumber: 'LN-2026-00079', status: 'ACTIVE', principal: 4000000, outstandingPrincipal: 3850000, aprBps: 1200, startDate: '2026-04-01', maturityDate: '2028-04-01', daysPastDue: 0,
    borrower: { firstName: 'Priya',  lastName: 'Naidoo',        email: 'priya@example.co.za'   }, product: { name: 'Business Loan'   },
    schedule:   makeSchedule('l8', 4000000, 1200, 24, '2026-04-01'),
    repayments: [
      { id: 'r8a', receivedAt: '2026-05-01T08:00:00Z', amount: 188000, method: 'EFT' },
    ],
  },
};

export default function LoanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const [data]    = useState<LoanDetail | null>(DEMO[id] ?? null);
  const [loading] = useState(false);
  const [error]   = useState<string | null>(DEMO[id] ? null : 'Loan not found.');
  const [tab,     setTab]     = useState<'schedule' | 'repayments'>('schedule');

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
