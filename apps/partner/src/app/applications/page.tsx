'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PartnerLayout from '@/app/_components/PartnerLayout';

type Application = {
  id: string; status: string; amountRequested: number; termMonths: number; submittedAt: string;
  borrower?: { firstName: string; lastName: string };
  product?:  { name: string };
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:            'var(--badge-pending-fg)',
  APPROVED:             'var(--badge-approved-fg)',
  REJECTED:             'var(--badge-declined-fg)',
  PENDING_DISBURSEMENT: 'var(--badge-awaiting-fg)',
};

const DEMO: Application[] = [
  { id: 'pa1', status: 'APPROVED',             amountRequested: 1500000,  termMonths: 12, submittedAt: '2026-05-14T08:00:00Z', borrower: { firstName: 'Mpho',    lastName: 'Khumalo'   }, product: { name: 'Personal Loan'   } },
  { id: 'pa2', status: 'SUBMITTED',            amountRequested: 3000000,  termMonths: 24, submittedAt: '2026-05-13T10:00:00Z', borrower: { firstName: 'Rudi',    lastName: 'van Wyk'   }, product: { name: 'Personal Loan'   } },
  { id: 'pa3', status: 'PENDING_DISBURSEMENT', amountRequested: 8000000,  termMonths: 36, submittedAt: '2026-05-12T09:00:00Z', borrower: { firstName: 'Zanele',  lastName: 'Dube'      }, product: { name: 'Business Loan'   } },
  { id: 'pa4', status: 'APPROVED',             amountRequested: 500000,   termMonths: 6,  submittedAt: '2026-05-11T14:00:00Z', borrower: { firstName: 'Kabelo',  lastName: 'Moagi'     }, product: { name: 'Short-Term Loan' } },
  { id: 'pa5', status: 'REJECTED',             amountRequested: 4000000,  termMonths: 18, submittedAt: '2026-05-10T11:00:00Z', borrower: { firstName: 'Tariro',  lastName: 'Musikavanhu' }, product: { name: 'Personal Loan' } },
  { id: 'pa6', status: 'SUBMITTED',            amountRequested: 2000000,  termMonths: 12, submittedAt: '2026-05-09T09:00:00Z', borrower: { firstName: 'Ayanda',  lastName: 'Ntuli'     }, product: { name: 'Personal Loan'   } },
];

export default function PartnerApplications() {
  const router  = useRouter();
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? DEMO : DEMO.filter(a => a.status === filter);

  return (
    <PartnerLayout title="Applications" action={
      <Link href="/applications/new" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
        + New application
      </Link>
    }>
      <div className="flex gap-2 flex-wrap mb-6">
        {['ALL','SUBMITTED','APPROVED','REJECTED','PENDING_DISBURSEMENT'].map(s => (
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
                {['Borrower','Product','Amount','Term','Status','Submitted'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                  className="hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                  onClick={() => router.push(`/applications/${a.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{a.borrower?.firstName} {a.borrower?.lastName}</td>
                  <td className="px-4 py-3">{a.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">R {(a.amountRequested / 100).toLocaleString()}</td>
                  <td className="px-4 py-3">{a.termMonths}m</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[a.status] ?? 'var(--color-muted)' }}>
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {new Date(a.submittedAt).toLocaleDateString('en-ZA')}
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
