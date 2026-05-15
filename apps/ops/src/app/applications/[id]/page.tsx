'use client';

import { useState, useEffect, use } from 'react';
import { useRouter }                 from 'next/navigation';
import OpsLayout                     from '@/app/_components/OpsLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type ApplicationDetail = {
  id: string; status: string; amountRequested: number; termMonths: number;
  submittedAt: string; purpose?: string;
  borrower?: { id: string; firstName: string; lastName: string; email: string; phone?: string; idNumber?: string; employmentStatus?: string; monthlyIncome?: number; creditScore?: number };
  product?:  { name: string; minAmount: number; maxAmount: number; aprBps: number };
  decision?: { id: string; decision: string; pdScore: number; affordabilityRatio: number; decidedAt: string; rejectionReasons?: string[] };
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  SUBMITTED:            { bg: 'var(--badge-pending-bg)',   fg: 'var(--badge-pending-fg)'   },
  APPROVED:             { bg: 'var(--badge-approved-bg)',  fg: 'var(--badge-approved-fg)'  },
  REJECTED:             { bg: 'var(--badge-declined-bg)',  fg: 'var(--badge-declined-fg)'  },
  PENDING_DISBURSEMENT: { bg: 'var(--badge-awaiting-bg)',  fg: 'var(--badge-awaiting-fg)'  },
};

export default function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const [data,    setData]    = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [acting,  setActing]  = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/applications/${id}`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setData(j); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  async function act(action: 'approve' | 'reject') {
    if (!data) return;
    setActing(action);
    setActionError(null);
    const res = await fetch(`${API}/api/v1/applications/${id}/${action}`, {
      method:  'POST',
      headers: { Authorization: 'Bearer demo' },
    });
    const json = await res.json();
    setActing(null);
    if (!res.ok) { setActionError(json.error ?? 'Action failed.'); return; }
    setData(prev => prev ? { ...prev, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : prev);
  }

  return (
    <OpsLayout title="Application Detail">
      {loading && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {data && (
        <div className="max-w-3xl flex flex-col gap-6">
          {/* Header */}
          <div
            className="rounded-2xl p-6 flex items-center justify-between"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>Application · {data.id.slice(0, 8)}</div>
              <div className="text-3xl font-black">R {(data.amountRequested / 100).toLocaleString()}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                {data.product?.name ?? '—'} · {data.termMonths} months
                {data.purpose && ` · ${data.purpose}`}
              </div>
            </div>
            <div>
              {(() => {
                const c = STATUS_COLORS[data.status] ?? { bg: 'var(--color-surface-2)', fg: 'var(--color-muted)' };
                return (
                  <span
                    className="px-4 py-2 rounded-full text-sm font-semibold"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    {data.status.replace(/_/g, ' ')}
                  </span>
                );
              })()}
            </div>
          </div>

          {actionError && (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>
              {actionError}
            </div>
          )}

          {/* Action buttons — only for SUBMITTED */}
          {data.status === 'SUBMITTED' && (
            <div className="flex gap-3">
              <button
                onClick={() => act('approve')}
                disabled={acting !== null}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)', border: '1px solid #a7f3d0' }}
              >
                {acting === 'approve' ? 'Approving…' : '✓ Approve'}
              </button>
              <button
                onClick={() => act('reject')}
                disabled={acting !== null}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)', border: '1px solid #fca5a5' }}
              >
                {acting === 'reject' ? 'Declining…' : '✕ Decline'}
              </button>
            </div>
          )}

          {/* Borrower info */}
          {data.borrower && (
            <Card title="Borrower information">
              <Grid items={[
                ['Name',       `${data.borrower.firstName} ${data.borrower.lastName}`],
                ['Email',      data.borrower.email],
                ['Phone',      data.borrower.phone ?? '—'],
                ['ID number',  data.borrower.idNumber ?? '—'],
                ['Employment', data.borrower.employmentStatus ?? '—'],
                ['Income',     data.borrower.monthlyIncome != null ? `R ${(data.borrower.monthlyIncome / 100).toLocaleString()}/mo` : '—'],
                ['Credit score', data.borrower.creditScore?.toString() ?? '—'],
              ]} />
            </Card>
          )}

          {/* Decision info */}
          {data.decision && (
            <Card title="Credit decision">
              <Grid items={[
                ['Decision',          data.decision.decision],
                ['PD score',          `${(data.decision.pdScore * 100).toFixed(1)}%`],
                ['Affordability ratio', `${(data.decision.affordabilityRatio * 100).toFixed(1)}%`],
                ['Decided at',        new Date(data.decision.decidedAt).toLocaleString('en-ZA')],
              ]} />
              {data.decision.rejectionReasons && data.decision.rejectionReasons.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>Rejection reasons</div>
                  <ul className="list-disc list-inside flex flex-col gap-1">
                    {data.decision.rejectionReasons.map(r => (
                      <li key={r} className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <button
            onClick={() => router.back()}
            className="self-start text-sm font-medium"
            style={{ color: 'var(--color-muted)' }}
          >
            ← Back to applications
          </button>
        </div>
      )}
    </OpsLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Grid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      {items.map(([label, value]) => (
        <div key={label}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>{label}</div>
          <div className="font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}
