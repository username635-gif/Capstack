'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OpsLayout from '@/app/_components/OpsLayout';

type Loan = {
  id: string; loanNumber: string; status: string;
  principal: number; outstandingPrincipal: number;
  aprBps: number; startDate: string; maturityDate: string; daysPastDue: number;
  borrower?: { firstName: string; lastName: string };
  product?:  { name: string };
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:       'var(--badge-active-fg)',
  PAID_IN_FULL: 'var(--badge-approved-fg)',
  DEFAULTED:    'var(--badge-declined-fg)',
  WRITTEN_OFF:  'var(--color-muted)',
};

const ALL_STATUSES = ['ALL', 'ACTIVE', 'PAID_IN_FULL', 'DEFAULTED'];

const DEMO: Loan[] = [
  { id: 'l1', loanNumber: 'LN-2026-00091', status: 'ACTIVE',       principal: 2500000,  outstandingPrincipal: 2200000,  aprBps: 1800, startDate: '2026-02-01', maturityDate: '2028-02-01', daysPastDue: 0,  borrower: { firstName: 'Sipho',   lastName: 'Dlamini'       }, product: { name: 'Personal Loan'   } },
  { id: 'l2', loanNumber: 'LN-2026-00088', status: 'ACTIVE',       principal: 12000000, outstandingPrincipal: 11400000, aprBps: 1200, startDate: '2026-01-15', maturityDate: '2029-01-15', daysPastDue: 0,  borrower: { firstName: 'Naledi',  lastName: 'Mokoena'       }, product: { name: 'Business Loan'   } },
  { id: 'l3', loanNumber: 'LN-2026-00085', status: 'ACTIVE',       principal: 800000,   outstandingPrincipal: 650000,   aprBps: 3600, startDate: '2026-03-01', maturityDate: '2026-09-01', daysPastDue: 14, borrower: { firstName: 'James',   lastName: 'van der Merwe' }, product: { name: 'Short-Term Loan' } },
  { id: 'l4', loanNumber: 'LN-2025-00072', status: 'ACTIVE',       principal: 7500000,  outstandingPrincipal: 5200000,  aprBps: 1800, startDate: '2025-09-01', maturityDate: '2027-09-01', daysPastDue: 32, borrower: { firstName: 'Lerato',  lastName: 'Sithole'       }, product: { name: 'Business Loan'   } },
  { id: 'l5', loanNumber: 'LN-2025-00061', status: 'PAID_IN_FULL', principal: 1500000,  outstandingPrincipal: 0,         aprBps: 2400, startDate: '2025-06-01', maturityDate: '2026-06-01', daysPastDue: 0,  borrower: { firstName: 'Andile',  lastName: 'Zulu'          }, product: { name: 'Personal Loan'   } },
  { id: 'l6', loanNumber: 'LN-2025-00058', status: 'ACTIVE',       principal: 3500000,  outstandingPrincipal: 3100000,  aprBps: 1800, startDate: '2025-12-01', maturityDate: '2027-06-01', daysPastDue: 0,  borrower: { firstName: 'Thabo',   lastName: 'Nkosi'         }, product: { name: 'Personal Loan'   } },
  { id: 'l7', loanNumber: 'LN-2025-00044', status: 'DEFAULTED',    principal: 5000000,  outstandingPrincipal: 4800000,  aprBps: 2400, startDate: '2025-05-01', maturityDate: '2026-05-01', daysPastDue: 91, borrower: { firstName: 'Fatima',  lastName: 'Cassim'        }, product: { name: 'Personal Loan'   } },
  { id: 'l8', loanNumber: 'LN-2026-00079', status: 'ACTIVE',       principal: 4000000,  outstandingPrincipal: 3850000,  aprBps: 1200, startDate: '2026-04-01', maturityDate: '2028-04-01', daysPastDue: 0,  borrower: { firstName: 'Priya',   lastName: 'Naidoo'        }, product: { name: 'Business Loan'   } },
];

export default function LoansPage() {
  const router   = useRouter();
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? DEMO : DEMO.filter(l => l.status === filter);

  return (
    <OpsLayout title="Loans">
      <div className="flex gap-2 flex-wrap mb-6">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: filter === s ? 'var(--color-primary)' : 'var(--color-surface-2)',
              color:      filter === s ? '#fff' : 'var(--color-muted)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              {['Loan #','Borrower','Product','Principal','Outstanding','APR','DPD','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr
                key={l.id}
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                className="hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">{l.loanNumber}</td>
                <td className="px-4 py-3 font-medium">{l.borrower?.firstName} {l.borrower?.lastName}</td>
                <td className="px-4 py-3">{l.product?.name ?? '—'}</td>
                <td className="px-4 py-3 font-semibold">R {(l.principal / 100).toLocaleString()}</td>
                <td className="px-4 py-3">R {(l.outstandingPrincipal / 100).toLocaleString()}</td>
                <td className="px-4 py-3">{(l.aprBps / 100).toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <span style={{ color: l.daysPastDue > 0 ? 'var(--badge-declined-fg)' : 'inherit' }}>
                    {l.daysPastDue}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[l.status] ?? 'var(--color-muted)' }}>
                    {l.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => router.push(`/loans/${l.id}`)} className="text-xs font-semibold" style={{ color: 'var(--color-secondary)' }}>
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OpsLayout>
  );
}
