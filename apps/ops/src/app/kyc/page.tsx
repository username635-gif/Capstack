'use client';

import { useState, useEffect } from 'react';
import OpsLayout               from '@/app/_components/OpsLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type KycCheck = {
  id: string; status: string; outcome?: string | null;
  submittedAt: string; completedAt?: string | null;
  borrower?: { firstName: string; lastName: string; email: string; idNumber?: string };
  checkType?: string;
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING:     { bg: 'var(--badge-pending-bg)',   fg: 'var(--badge-pending-fg)'   },
  IN_PROGRESS: { bg: 'var(--badge-awaiting-bg)',  fg: 'var(--badge-awaiting-fg)'  },
  COMPLETE:    { bg: 'var(--badge-approved-bg)',  fg: 'var(--badge-approved-fg)'  },
  FAILED:      { bg: 'var(--badge-declined-bg)',  fg: 'var(--badge-declined-fg)'  },
};

export default function KycPage() {
  const [data,    setData]    = useState<KycCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState('PENDING');
  const [acting,  setActing]  = useState<string | null>(null); // id of check being updated

  function load(status: string) {
    setLoading(true);
    setError(null);
    const url = status === 'ALL'
      ? `${API}/api/v1/kyc-checks`
      : `${API}/api/v1/kyc-checks?status=${status}`;
    fetch(url, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(filter); }, []); // eslint-disable-line

  async function updateCheck(id: string, status: string, outcome: string) {
    setActing(id);
    const res = await fetch(`${API}/api/v1/kyc-checks`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo' },
      body:    JSON.stringify({ id, status, outcome, completedAt: new Date().toISOString() }),
    });
    setActing(null);
    if (res.ok) {
      setData(prev => prev.map(c => c.id === id ? { ...c, status, outcome } : c));
    }
  }

  return (
    <OpsLayout title="KYC / AML Queue">
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED'].map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); load(s); }}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: filter === s ? 'var(--color-primary)' : 'var(--color-surface-2)',
              color:      filter === s ? '#fff' : 'var(--color-muted)',
            }}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {!loading && !error && (
        data.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No checks in this queue.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map(check => {
              const c = STATUS_COLORS[check.status] ?? STATUS_COLORS['PENDING'];
              const isBusy = acting === check.id;
              return (
                <div
                  key={check.id}
                  className="rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {/* Borrower info */}
                  <div className="flex-1">
                    <div className="font-bold">{check.borrower?.firstName} {check.borrower?.lastName}</div>
                    <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{check.borrower?.email}</div>
                    {check.borrower?.idNumber && (
                      <div className="text-xs mt-1 font-mono" style={{ color: 'var(--color-muted)' }}>ID: {check.borrower.idNumber}</div>
                    )}
                    <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      {check.checkType ?? 'KYC'} · Submitted {new Date(check.submittedAt).toLocaleDateString('en-ZA')}
                    </div>
                  </div>

                  {/* Status + outcome */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
                      {check.status.replace(/_/g, ' ')}
                      {check.outcome && ` · ${check.outcome}`}
                    </span>
                  </div>

                  {/* Action buttons — only for PENDING / IN_PROGRESS */}
                  {(check.status === 'PENDING' || check.status === 'IN_PROGRESS') && (
                    <div className="flex gap-2">
                      <button
                        disabled={isBusy}
                        onClick={() => updateCheck(check.id, 'COMPLETE', 'CLEAR')}
                        className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                        style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)' }}
                      >
                        {isBusy ? '…' : 'Pass'}
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => updateCheck(check.id, 'COMPLETE', 'REFER')}
                        className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                        style={{ background: 'var(--badge-awaiting-bg)', color: 'var(--badge-awaiting-fg)' }}
                      >
                        {isBusy ? '…' : 'Refer'}
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => updateCheck(check.id, 'FAILED', 'FAIL')}
                        className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                        style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
                      >
                        {isBusy ? '…' : 'Fail'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </OpsLayout>
  );
}
