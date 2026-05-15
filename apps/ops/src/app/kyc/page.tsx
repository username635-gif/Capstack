'use client';

import { useState } from 'react';
import OpsLayout from '@/app/_components/OpsLayout';

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

const DEMO: KycCheck[] = [
  { id: 'k1', status: 'PENDING',     checkType: 'DOCUMENT_VERIFICATION', submittedAt: '2026-05-14T09:00:00Z', borrower: { firstName: 'Thabo',   lastName: 'Nkosi',    email: 'thabo@example.co.za',   idNumber: '9001015009087' } },
  { id: 'k2', status: 'PENDING',     checkType: 'LIVENESS_CHECK',        submittedAt: '2026-05-14T08:30:00Z', borrower: { firstName: 'Andile',  lastName: 'Zulu',     email: 'andile@example.co.za',  idNumber: '9205055009082' } },
  { id: 'k3', status: 'IN_PROGRESS', checkType: 'DOCUMENT_VERIFICATION', submittedAt: '2026-05-13T14:00:00Z', borrower: { firstName: 'Sipho',   lastName: 'Dlamini',  email: 'sipho@example.co.za',   idNumber: '8812105009081' } },
  { id: 'k4', status: 'COMPLETE',    checkType: 'DOCUMENT_VERIFICATION', submittedAt: '2026-05-12T10:00:00Z', completedAt: '2026-05-12T10:45:00Z', outcome: 'CLEAR',  borrower: { firstName: 'Naledi',  lastName: 'Mokoena',  email: 'naledi@example.co.za',  idNumber: '9103085009083' } },
  { id: 'k5', status: 'COMPLETE',    checkType: 'LIVENESS_CHECK',        submittedAt: '2026-05-11T09:00:00Z', completedAt: '2026-05-11T09:20:00Z', outcome: 'CLEAR',  borrower: { firstName: 'Priya',   lastName: 'Naidoo',   email: 'priya@example.co.za',   idNumber: '9407125009085' } },
  { id: 'k6', status: 'FAILED',      checkType: 'DOCUMENT_VERIFICATION', submittedAt: '2026-05-10T15:00:00Z', completedAt: '2026-05-10T15:30:00Z', outcome: 'REFER', borrower: { firstName: 'Fatima',  lastName: 'Cassim',   email: 'fatima@example.co.za',  idNumber: '8606205009084' } },
];

export default function KycPage() {
  const [filter, setFilter] = useState('PENDING');
  const [checks, setChecks] = useState<KycCheck[]>(DEMO);

  const filtered = filter === 'ALL' ? checks : checks.filter(c => c.status === filter);

  function updateCheck(id: string, status: string, outcome: string) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status, outcome } : c));
  }

  return (
    <OpsLayout title="KYC / AML Queue">
      <div className="flex gap-2 mb-6">
        {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
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

      <div className="flex flex-col gap-3">
        {filtered.map(check => {
          const c = STATUS_COLORS[check.status] ?? STATUS_COLORS['PENDING'];
          return (
            <div
              key={check.id}
              className="rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex-1">
                <div className="font-bold">{check.borrower?.firstName} {check.borrower?.lastName}</div>
                <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{check.borrower?.email}</div>
                {check.borrower?.idNumber && (
                  <div className="text-xs mt-1 font-mono" style={{ color: 'var(--color-muted)' }}>ID: {check.borrower.idNumber}</div>
                )}
                <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  {check.checkType?.replace(/_/g,' ') ?? 'KYC'} · Submitted {new Date(check.submittedAt).toLocaleDateString('en-ZA')}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
                  {check.status.replace(/_/g, ' ')}
                  {check.outcome && ` · ${check.outcome}`}
                </span>
              </div>

              {(check.status === 'PENDING' || check.status === 'IN_PROGRESS') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateCheck(check.id, 'COMPLETE', 'CLEAR')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateCheck(check.id, 'FAILED', 'REFER')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
                  >
                    Refer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </OpsLayout>
  );
}
