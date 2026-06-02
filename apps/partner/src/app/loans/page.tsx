'use client';

import { useState } from 'react';
import PartnerLayout from '@/app/_components/PartnerLayout';

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
};

const DEMO: Loan[] = [
  { id: 'pl1', loanNumber: 'LN-2026-00091', status: 'ACTIVE',       principal: 1500000,  outstandingPrincipal: 1380000,  aprBps: 1800, startDate: '2026-02-01', maturityDate: '2027-02-01', daysPastDue: 0, borrower: { firstName: 'Mpho',   lastName: 'Khumalo' }, product: { name: 'Personal Loan'   } },
  { id: 'pl2', loanNumber: 'LN-2026-00087', status: 'ACTIVE',       principal: 8000000,  outstandingPrincipal: 7600000,  aprBps: 1200, startDate: '2026-03-01', maturityDate: '2029-03-01', daysPastDue: 0, borrower: { firstName: 'Zanele',  lastName: 'Dube'    }, product: { name: 'Business Loan'   } },
  { id: 'pl3', loanNumber: 'LN-2026-00083', status: 'ACTIVE',       principal: 500000,   outstandingPrincipal: 380000,   aprBps: 3600, startDate: '2026-03-15', maturityDate: '2026-09-15', daysPastDue: 7, borrower: { firstName: 'Kabelo',  lastName: 'Moagi'   }, product: { name: 'Short-Term Loan' } },
  { id: 'pl4', loanNumber: 'LN-2025-00071', status: 'PAID_IN_FULL', principal: 2500000,  outstandingPrincipal: 0,         aprBps: 1800, startDate: '2025-05-01', maturityDate: '2026-05-01', daysPastDue: 0, borrower: { firstName: 'Rudi',    lastName: 'van Wyk' }, product: { name: 'Personal Loan'   } },
  { id: 'pl5', loanNumber: 'LN-2026-00078', status: 'ACTIVE',       principal: 2000000,  outstandingPrincipal: 1920000,  aprBps: 1800, startDate: '2026-04-01', maturityDate: '2027-04-01', daysPastDue: 0, borrower: { firstName: 'Ayanda',  lastName: 'Ntuli'   }, product: { name: 'Personal Loan'   } },
];

export default function PartnerLoans() {
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? DEMO : DEMO.filter(l => l.status === filter);

  return (
    <PartnerLayout title="Loans">
      <div className="flex gap-2 flex-wrap mb-6">
        {['ALL','ACTIVE','PAID_IN_FULL','DEFAULTED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: filter === s ? 'var(--color-primary)' : 'var(--color-surface-2)', color: filter === s ? '#fff' : 'var(--color-muted)' }}
          >
            {s.replace(/_/g,' ')}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                {['Loan #','Borrower','Product','Principal','Outstanding','APR','DPD','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-4 py-3 font-mono text-xs">{l.loanNumber}</td>
                  <td className="px-4 py-3 font-medium">{l.borrower?.firstName} {l.borrower?.lastName}</td>
                  <td className="px-4 py-3">{l.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">R {(l.principal / 100).toLocaleString()}</td>
                  <td className="px-4 py-3">R {(l.outstandingPrincipal / 100).toLocaleString()}</td>
                  <td className="px-4 py-3">{(l.aprBps / 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span style={{ color: l.daysPastDue > 0 ? 'var(--badge-declined-fg)' : 'inherit' }}>{l.daysPastDue}d</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[l.status] ?? 'var(--color-muted)' }}>
                      {l.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PartnerLayout>
  );
}
