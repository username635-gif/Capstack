'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OpsLayout from '@/app/_components/OpsLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

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

export default function ApplicationsPage() {
  const router  = useRouter();
  const [data,    setData]    = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState('ALL');

  useEffect(() => {
    const url = filter === 'ALL'
      ? `${API}/api/v1/applications`
      : `${API}/api/v1/applications?status=${filter}`;

    setLoading(true);
    fetch(url, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [filter]);

  return (
    <OpsLayout
      title="Applications"
      action={
        <a
          href="/applications/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          + New application
        </a>
      }
    >
      {/* Status filter tabs */}
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

      {loading  && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error    && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {!loading && !error && (
        data.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No applications found.</p>
          </div>
        ) : (
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
                {data.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{ borderBottom: i < data.length - 1 ? '1px solid var(--color-border)' : 'none' }}
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
        )
      )}
    </OpsLayout>
  );
}
