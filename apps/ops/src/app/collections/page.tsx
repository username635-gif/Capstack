'use client';

import { useState } from 'react';
import OpsLayout from '@/app/_components/OpsLayout';

type CollectionLoan = {
  id: string; loanNumber: string; daysPastDue: number; outstandingPrincipal: number;
  borrower?: { firstName: string; lastName: string; email: string; phone?: string };
  latestCollectionEvent?: { type: string; notes?: string; createdAt: string } | null;
};

const DEMO: CollectionLoan[] = [
  { id: 'l7', loanNumber: 'LN-2025-00044', daysPastDue: 91, outstandingPrincipal: 4800000, borrower: { firstName: 'Fatima',  lastName: 'Cassim',    email: 'fatima@example.co.za',  phone: '+27 82 555 1234' }, latestCollectionEvent: { type: 'LEGAL',            notes: 'Section 129 notice sent', createdAt: '2026-05-10T09:00:00Z' } },
  { id: 'l4', loanNumber: 'LN-2025-00072', daysPastDue: 32, outstandingPrincipal: 5200000, borrower: { firstName: 'Lerato',  lastName: 'Sithole',   email: 'lerato@example.co.za',  phone: '+27 71 555 9876' }, latestCollectionEvent: { type: 'CALL',             notes: 'No answer, left voicemail', createdAt: '2026-05-12T14:00:00Z' } },
  { id: 'l3', loanNumber: 'LN-2026-00085', daysPastDue: 14, outstandingPrincipal: 650000,   borrower: { firstName: 'James',   lastName: 'van der Merwe', email: 'james@example.co.za', phone: '+27 83 555 4321' }, latestCollectionEvent: { type: 'EMAIL_REMINDER',  notes: 'Second reminder sent',     createdAt: '2026-05-13T10:00:00Z' } },
  { id: 'l9', loanNumber: 'LN-2026-00082', daysPastDue: 7,  outstandingPrincipal: 1200000, borrower: { firstName: 'Bongani', lastName: 'Khumalo',   email: 'bongani@example.co.za', phone: '+27 76 555 6543' }, latestCollectionEvent: null },
  { id: 'la', loanNumber: 'LN-2026-00090', daysPastDue: 3,  outstandingPrincipal: 800000,  borrower: { firstName: 'Zanele',  lastName: 'Dube',      email: 'zanele@example.co.za',  phone: '+27 79 555 7890' }, latestCollectionEvent: { type: 'SMS_REMINDER',    notes: 'Auto-SMS sent',            createdAt: '2026-05-14T08:00:00Z' } },
];

export default function CollectionsPage() {
  const [minDpd, setMinDpd] = useState('1');
  const filtered = DEMO.filter(l => l.daysPastDue >= Number(minDpd));

  function dpdBucket(dpd: number) {
    if (dpd >= 90) return { label: '90+ DPD', fg: '#dc2626', bg: '#fee2e2' };
    if (dpd >= 60) return { label: '60–89 DPD', fg: '#ea580c', bg: '#ffedd5' };
    if (dpd >= 30) return { label: '30–59 DPD', fg: '#d97706', bg: '#fef3c7' };
    return { label: '1–29 DPD', fg: '#0f766e', bg: '#ccfbf1' };
  }

  return (
    <OpsLayout title="Collections">
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-medium">Min DPD:</span>
        {['1','30','60','90'].map(d => (
          <button
            key={d}
            onClick={() => setMinDpd(d)}
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
          {filtered.length} borrower{filtered.length !== 1 ? 's' : ''} in arrears
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No loans in arrears for the selected filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(loan => {
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
                      Last contact: {loan.latestCollectionEvent.type.replace(/_/g,' ')} · {new Date(loan.latestCollectionEvent.createdAt).toLocaleDateString('en-ZA')}
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
      )}
    </OpsLayout>
  );
}
