'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OpsLayout from '@/app/_components/OpsLayout';

type Application = {
  id: string; status: string; amountRequested: number;
  termMonths: number; submittedAt: string;
  borrower?: { firstName: string; lastName: string; email: string };
  product?:  { name: string };
};

const ALL_STATUSES = ['ALL','SUBMITTED','APPROVED','REJECTED','PENDING_DISBURSEMENT'];

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:            'var(--badge-pending-fg)',
  APPROVED:             'var(--badge-approved-fg)',
  REJECTED:             'var(--badge-declined-fg)',
  PENDING_DISBURSEMENT: 'var(--badge-awaiting-fg)',
};

const DEMO: Application[] = [
  { id: 'a1', status: 'SUBMITTED',            amountRequested: 2500000,  termMonths: 24, submittedAt: '2026-05-14T08:23:00Z', borrower: { firstName: 'Sipho',   lastName: 'Dlamini',       email: 'sipho@example.co.za'   }, product: { name: 'Personal Loan'   } },
  { id: 'a2', status: 'APPROVED',             amountRequested: 12000000, termMonths: 36, submittedAt: '2026-05-13T14:05:00Z', borrower: { firstName: 'Naledi',  lastName: 'Mokoena',       email: 'naledi@example.co.za'  }, product: { name: 'Business Loan'   } },
  { id: 'a3', status: 'PENDING_DISBURSEMENT', amountRequested: 800000,   termMonths: 6,  submittedAt: '2026-05-13T09:40:00Z', borrower: { firstName: 'James',   lastName: 'van der Merwe', email: 'james@example.co.za'   }, product: { name: 'Short-Term Loan' } },
  { id: 'a4', status: 'REJECTED',             amountRequested: 5000000,  termMonths: 12, submittedAt: '2026-05-12T16:20:00Z', borrower: { firstName: 'Fatima',  lastName: 'Cassim',        email: 'fatima@example.co.za'  }, product: { name: 'Personal Loan'   } },
  { id: 'a5', status: 'SUBMITTED',            amountRequested: 3500000,  termMonths: 18, submittedAt: '2026-05-12T11:15:00Z', borrower: { firstName: 'Thabo',   lastName: 'Nkosi',         email: 'thabo@example.co.za'   }, product: { name: 'Personal Loan'   } },
  { id: 'a6', status: 'APPROVED',             amountRequested: 7500000,  termMonths: 24, submittedAt: '2026-05-11T10:00:00Z', borrower: { firstName: 'Lerato',  lastName: 'Sithole',       email: 'lerato@example.co.za'  }, product: { name: 'Business Loan'   } },
  { id: 'a7', status: 'SUBMITTED',            amountRequested: 1500000,  termMonths: 12, submittedAt: '2026-05-11T08:30:00Z', borrower: { firstName: 'Andile',  lastName: 'Zulu',          email: 'andile@example.co.za'  }, product: { name: 'Short-Term Loan' } },
  { id: 'a8', status: 'REJECTED',             amountRequested: 2000000,  termMonths: 6,  submittedAt: '2026-05-10T14:45:00Z', borrower: { firstName: 'Priya',   lastName: 'Naidoo',        email: 'priya@example.co.za'   }, product: { name: 'Personal Loan'   } },
];

export default function ApplicationsPage() {
  const router  = useRouter();
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? DEMO : DEMO.filter(a => a.status === filter);

  return (
    <OpsLayout
      title="Applications"
      action={
        <Link
          href="/applications/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          + New application
        </Link>
      }
    >
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
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              {['Borrower','Product','Amount','Term','Status','Submitted',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr
                key={a.id}
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                className="hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{a.borrower?.firstName} {a.borrower?.lastName}</div>
                  <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{a.borrower?.email}</div>
                </td>
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
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/applications/${a.id}`)}
                    className="text-xs font-semibold"
                    style={{ color: 'var(--color-secondary)' }}
                  >
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
