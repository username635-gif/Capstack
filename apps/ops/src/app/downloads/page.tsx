'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DocumentIcon } from '@/app/_components/LoanCalculator';
import { API_BASE_URL as API } from '@/lib/api-client';

function DownloadBtn({
  href,
  label,
  description,
  staffName = 'Ops User',
}: {
  href: string;
  label: string;
  description: string;
  staffName?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(href, {
        headers: {
          Authorization: 'Bearer demo',
          'x-staff-name': staffName,
        },
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = label.replace(/\s+/g, '-').toLowerCase() + '.pdf';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            12,
        padding:        '14px 18px',
        borderRadius:   10,
        border:         '1px solid var(--color-border)',
        background:     'var(--color-surface-2)',
        textDecoration: 'none',
        cursor:         status === 'loading' ? 'wait' : 'pointer',
        opacity:        status === 'loading' ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DocumentIcon size={16} color="var(--color-secondary)" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{description}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: status === 'error' ? '#DC2626' : 'var(--color-secondary)', whiteSpace: 'nowrap' }}>
        {status === 'loading' ? 'Generating…' : status === 'error' ? 'Failed — retry' : '↓ Download PDF'}
      </div>
    </a>
  );
}

type IdField = 'loanId' | 'borrowerId';

function IdLookupSection({
  title,
  description,
  field,
  placeholder,
  children,
}: {
  title: string;
  description: string;
  field: IdField;
  placeholder: string;
  children: (id: string) => React.ReactNode;
}) {
  const [id, setId]         = useState('');
  const [submitted, setSubmitted] = useState('');

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="mb-4">
        <div className="font-bold mb-1">{title}</div>
        <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{description}</div>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={id}
          onChange={e => { setId(e.target.value); setSubmitted(''); }}
          placeholder={placeholder}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)', color: 'var(--foreground)', outline: 'none',
          }}
        />
        <button
          onClick={() => id.trim() && setSubmitted(id.trim())}
          className="px-4 py-2 text-xs font-semibold rounded-lg"
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)', cursor: 'pointer' }}
        >
          Load
        </button>
      </div>
      {submitted && (
        <div className="flex flex-col gap-2">
          {children(submitted)}
        </div>
      )}
    </div>
  );
}

export default function OpsDownloadsPage() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* Sidebar stub */}
      <aside className="w-56 flex-shrink-0" style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
        <div className="h-16 flex items-center px-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="font-bold text-base tracking-tight">
            Capstack <span style={{ color: 'var(--color-secondary)' }}>Ops</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {[
            { label: 'Dashboard',    href: '/' },
            { label: 'Applications', href: '/applications' },
            { label: 'Loans',        href: '/loans' },
            { label: 'Collections',  href: '/collections' },
            { label: 'KYC / AML',   href: '/kyc' },
            { label: 'Reports',      href: '/reports' },
            { label: 'Settings',     href: '/settings' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: 'var(--color-muted)', textDecoration: 'none' }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-8" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm" style={{ color: 'var(--color-muted)' }}>← Dashboard</Link>
            <h1 className="text-lg font-bold">Download reports</h1>
          </div>
          <div
            className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
          >
            INTERNAL — Do not share with borrowers
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Enter a Loan ID or Borrower ID to generate and download the corresponding internal PDF report.
              All reports include risk scores, collections flags, and internal notes — they must never be shared with borrowers.
            </p>

            {/* Loan-level reports */}
            <IdLookupSection
              title="Loan reports"
              description="Full internal loan record including credit decision, KYC checks, AML alerts, and event log."
              field="loanId"
              placeholder="e.g. dl1 or loan UUID"
            >
              {(loanId) => (
                <>
                  <DownloadBtn
                    href={`${API}/api/v1/loans/${loanId}/ops-report`}
                    label="Full loan record"
                    description="Risk score, credit decision, KYC/AML checks, event log — INTERNAL"
                  />
                  <DownloadBtn
                    href={`${API}/api/v1/loans/${loanId}/statement`}
                    label="Loan statement (borrower version)"
                    description="Borrower-safe statement — no risk data · NCA s.108"
                  />
                  <DownloadBtn
                    href={`${API}/api/v1/loans/${loanId}/agreement`}
                    label="Loan agreement copy"
                    description="NCA s.93 credit agreement with terms and schedule"
                  />
                </>
              )}
            </IdLookupSection>

            {/* Borrower-level reports */}
            <IdLookupSection
              title="Borrower reports"
              description="Full credit history across all loans, portfolio summary, collections events, and compliance flags."
              field="borrowerId"
              placeholder="e.g. b1 or borrower UUID"
            >
              {(borrowerId) => (
                <>
                  <DownloadBtn
                    href={`${API}/api/v1/borrowers/${borrowerId}/ops-history`}
                    label="Borrower credit history"
                    description="All loans, DPD history, risk bands, collections events — INTERNAL"
                  />
                  <DownloadBtn
                    href={`${API}/api/v1/borrowers/${borrowerId}/transactions?format=pdf`}
                    label="Transaction history (borrower version)"
                    description="All transactions across loans — shareable with borrower"
                  />
                </>
              )}
            </IdLookupSection>

            {/* Legal note */}
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Internal reports are generated under NCR reporting requirements and are subject to POPIA.
              All downloads are logged with the generating staff member for audit purposes.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
