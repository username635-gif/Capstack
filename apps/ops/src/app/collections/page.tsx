'use client';

import { useState, useEffect } from 'react';
import OpsLayout               from '@/app/_components/OpsLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type CollectionLoan = {
  id: string; loanNumber: string; daysPastDue: number; outstandingPrincipal: number;
  borrower?: { firstName: string; lastName: string; email: string; phone?: string };
  latestCollectionEvent?: { type: string; notes?: string; createdAt: string } | null;
};

export default function CollectionsPage() {
  const [data,    setData]    = useState<CollectionLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [minDpd,  setMinDpd]  = useState('1');

  function load(dpd: string) {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/v1/collections?minDpd=${dpd}`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(minDpd); }, []); // eslint-disable-line

  function dpdBucket(dpd: number) {
    if (dpd >= 90) return { label: '90+ DPD', fg: '#dc2626', bg: '#fee2e2' };
    if (dpd >= 60) return { label: '60–89 DPD', fg: '#ea580c', bg: '#ffedd5' };
    if (dpd >= 30) return { label: '30–59 DPD', fg: '#d97706', bg: '#fef3c7' };
    return { label: '1–29 DPD', fg: '#0f766e', bg: '#ccfbf1' };
  }

  return (
    <OpsLayout title="Collections">
      {/* DPD filter */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-medium">Min DPD:</span>
        {['1','30','60','90'].map(d => (
          <button
            key={d}
            onClick={() => { setMinDpd(d); load(d); }}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: minDpd === d ? 'var(--color-primary)' : 'var(--color-surface-2)',
              color:      minDpd === d ? '#fff' : 'var(--color-muted)',
            }}
          >
            {d}+
          </button>
        ))}
        <span className="text-sm ml-auto" style={{ color: 'var(--color-muted)' }}>
          {data.length} borrower{data.length !== 1 ? 's' : ''} in arrears
        </span>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {!loading && !error && (
        data.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No loans in arrears for the selected filter. 🎉</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map(loan => {
              const bucket = dpdBucket(loan.daysPastDue);
              return (
                <div
                  key={loan.id}
                  className="rounded-xl p-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>{loan.loanNumber}</div>
                    <div className="font-bold">{loan.borrower?.firstName} {loan.borrower?.lastName}</div>
                    <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{loan.borrower?.email}</div>
                    {loan.borrower?.phone && (
                      <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{loan.borrower.phone}</div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-2">
                    <div className="text-sm font-semibold">R {(loan.outstandingPrincipal / 100).toLocaleString()} outstanding</div>
                    {loan.latestCollectionEvent && (
                      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        Last contact: {loan.latestCollectionEvent.type} · {new Date(loan.latestCollectionEvent.createdAt).toLocaleDateString('en-ZA')}
                        {loan.latestCollectionEvent.notes && ` — ${loan.latestCollectionEvent.notes}`}
                      </div>
                    )}
                    {!loan.latestCollectionEvent && (
                      <div className="text-xs font-medium" style={{ color: 'var(--badge-declined-fg)' }}>No contact logged yet</div>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <span
                      className="text-xs font-bold px-3 py-1.5 rounded-full"
                      style={{ background: bucket.bg, color: bucket.fg }}
                    >
                      {loan.daysPastDue}d · {bucket.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </OpsLayout>
  );
}
