'use client';

import { useState, use } from 'react';
import { useRouter }     from 'next/navigation';
import OpsLayout         from '@/app/_components/OpsLayout';

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

const DEMO: Record<string, ApplicationDetail> = {
  a1: {
    id: 'a1', status: 'SUBMITTED', amountRequested: 2500000, termMonths: 24, submittedAt: '2026-05-14T08:23:00Z',
    borrower: { id: 'b1', firstName: 'Sipho', lastName: 'Dlamini', email: 'sipho@example.co.za', phone: '+27 82 555 1001', idNumber: '9001015009087', employmentStatus: 'EMPLOYED', monthlyIncome: 3500000, creditScore: 672 },
    product:  { name: 'Personal Loan', minAmount: 500000, maxAmount: 5000000, aprBps: 1800 },
  },
  a2: {
    id: 'a2', status: 'APPROVED', amountRequested: 12000000, termMonths: 36, submittedAt: '2026-05-13T14:05:00Z',
    borrower: { id: 'b2', firstName: 'Naledi', lastName: 'Mokoena', email: 'naledi@example.co.za', phone: '+27 71 555 2002', idNumber: '8805105009081', employmentStatus: 'SELF_EMPLOYED', monthlyIncome: 12000000, creditScore: 741 },
    product:  { name: 'Business Loan', minAmount: 5000000, maxAmount: 50000000, aprBps: 1200 },
    decision: { id: 'd2', decision: 'APPROVE', pdScore: 0.021, affordabilityRatio: 0.33, decidedAt: '2026-05-13T15:00:00Z' },
  },
  a3: {
    id: 'a3', status: 'PENDING_DISBURSEMENT', amountRequested: 800000, termMonths: 6, submittedAt: '2026-05-13T09:40:00Z',
    borrower: { id: 'b3', firstName: 'James', lastName: 'van der Merwe', email: 'james@example.co.za', phone: '+27 83 555 3003', idNumber: '9503015009083', employmentStatus: 'EMPLOYED', monthlyIncome: 2500000, creditScore: 598 },
    product:  { name: 'Short-Term Loan', minAmount: 100000, maxAmount: 2000000, aprBps: 3600 },
    decision: { id: 'd3', decision: 'APPROVE', pdScore: 0.058, affordabilityRatio: 0.32, decidedAt: '2026-05-13T12:00:00Z' },
  },
  a4: {
    id: 'a4', status: 'REJECTED', amountRequested: 5000000, termMonths: 12, submittedAt: '2026-05-12T16:20:00Z',
    borrower: { id: 'b4', firstName: 'Fatima', lastName: 'Cassim', email: 'fatima@example.co.za', phone: '+27 79 555 4004', idNumber: '9207205009084', employmentStatus: 'EMPLOYED', monthlyIncome: 1800000, creditScore: 521 },
    product:  { name: 'Personal Loan', minAmount: 500000, maxAmount: 5000000, aprBps: 2400 },
    decision: { id: 'd4', decision: 'REJECT', pdScore: 0.142, affordabilityRatio: 0.52, decidedAt: '2026-05-12T17:00:00Z', rejectionReasons: ['Debt-to-income ratio exceeds 40%', 'Affordability check failed'] },
  },
  a5: {
    id: 'a5', status: 'SUBMITTED', amountRequested: 3500000, termMonths: 18, submittedAt: '2026-05-12T11:15:00Z',
    borrower: { id: 'b5', firstName: 'Thabo', lastName: 'Nkosi', email: 'thabo@example.co.za', phone: '+27 82 555 5005', idNumber: '8812105009085', employmentStatus: 'EMPLOYED', monthlyIncome: 4500000, creditScore: 648 },
    product:  { name: 'Personal Loan', minAmount: 500000, maxAmount: 5000000, aprBps: 1800 },
  },
  a6: {
    id: 'a6', status: 'APPROVED', amountRequested: 7500000, termMonths: 24, submittedAt: '2026-05-11T10:00:00Z',
    borrower: { id: 'b6', firstName: 'Lerato', lastName: 'Sithole', email: 'lerato@example.co.za', phone: '+27 71 555 6006', idNumber: '9104105009086', employmentStatus: 'SELF_EMPLOYED', monthlyIncome: 9000000, creditScore: 712 },
    product:  { name: 'Business Loan', minAmount: 5000000, maxAmount: 50000000, aprBps: 1200 },
    decision: { id: 'd6', decision: 'APPROVE', pdScore: 0.031, affordabilityRatio: 0.28, decidedAt: '2026-05-11T12:00:00Z' },
  },
  a7: {
    id: 'a7', status: 'SUBMITTED', amountRequested: 1500000, termMonths: 12, submittedAt: '2026-05-11T08:30:00Z',
    borrower: { id: 'b7', firstName: 'Andile', lastName: 'Zulu', email: 'andile@example.co.za', phone: '+27 83 555 7007', idNumber: '9205055009082', employmentStatus: 'EMPLOYED', monthlyIncome: 2800000, creditScore: 611 },
    product:  { name: 'Short-Term Loan', minAmount: 100000, maxAmount: 2000000, aprBps: 3600 },
  },
  a8: {
    id: 'a8', status: 'REJECTED', amountRequested: 2000000, termMonths: 6, submittedAt: '2026-05-10T14:45:00Z',
    borrower: { id: 'b8', firstName: 'Priya', lastName: 'Naidoo', email: 'priya@example.co.za', phone: '+27 79 555 8008', idNumber: '9308205009089', employmentStatus: 'EMPLOYED', monthlyIncome: 2200000, creditScore: 489 },
    product:  { name: 'Personal Loan', minAmount: 500000, maxAmount: 5000000, aprBps: 2400 },
    decision: { id: 'd8', decision: 'REJECT', pdScore: 0.198, affordabilityRatio: 0.61, decidedAt: '2026-05-10T16:00:00Z', rejectionReasons: ['Existing default on credit bureau', 'Credit score below minimum threshold'] },
  },
};

export default function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const initial  = DEMO[id] ?? null;
  const [data,    setData]    = useState<ApplicationDetail | null>(initial);
  const [loading]             = useState(false);
  const [error]               = useState<string | null>(initial ? null : 'Application not found.');
  const [acting,  setActing]  = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function act(action: 'approve' | 'reject') {
    if (!data) return;
    setActing(action);
    setActionError(null);
    setTimeout(() => {
      setData(prev => prev ? { ...prev, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : prev);
      setActing(null);
    }, 600);
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
