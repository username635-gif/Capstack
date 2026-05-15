'use client';

import { useState, useEffect } from 'react';
import PartnerLayout           from '@/app/_components/PartnerLayout';
import { getSession }          from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

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

export default function PartnerLoans() {
  const [data,    setData]    = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return;
    // Use sandbox API key for partner loan access
    fetch(`${API}/api/public/v1/loans`, {
      headers: { 'x-api-key': `pk_live_${s.id}`, Authorization: 'Bearer demo' },
    })
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <PartnerLayout title="Loans">
      {loading && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {!loading && !error && (
        data.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No loans in your portfolio yet.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                  {['Loan #','Borrower','Product','Principal','Outstanding','APR','DPD','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: i < data.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
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
        )
      )}
    </PartnerLayout>
  );
}
