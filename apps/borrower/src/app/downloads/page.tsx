'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { ThemeToggle } from '@/app/_components/ThemeProvider';
import { DocumentIcon } from '@/app/_components/LoanCalculator';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

// Demo loan for when the API isn't reachable
const DEMO_LOAN_ID = 'dl1';
const DEMO_BORROWER_ID = 'b1';

type Loan = { id: string; loanNumber: string; status: string; principal: number };

function DownloadBtn({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(href, { headers: { Authorization: 'Bearer demo' } });
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
        transition:     'opacity 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <DocumentIcon size={16} color="var(--color-secondary)" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{description}</div>
        </div>
      </div>
      <div
        style={{
          fontSize:     11,
          fontWeight:   600,
          color:        status === 'error' ? '#DC2626' : 'var(--color-secondary)',
          whiteSpace:   'nowrap',
        }}
      >
        {status === 'loading' ? 'Downloading…' : status === 'error' ? 'Failed — retry' : '↓ Download PDF'}
      </div>
    </a>
  );
}

export default function DownloadsPage() {
  const router  = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [loans, setLoans]     = useState<Loan[]>([]);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/sign-in'); return; }
    setSession(s);

    // Load borrower's loans
    fetch(`${API}/api/v1/loans?borrowerId=${s.id}`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(d => {
        if ((d.data ?? []).length > 0) setLoans(d.data);
        else setLoans([{ id: DEMO_LOAN_ID, loanNumber: 'LN-2026-00091', status: 'ACTIVE', principal: 2500000 }]);
      })
      .catch(() => {
        setLoans([{ id: DEMO_LOAN_ID, loanNumber: 'LN-2026-00091', status: 'ACTIVE', principal: 2500000 }]);
      });
  }, [router]);

  if (!session) return null;
  const borrowerId = session.id ?? DEMO_BORROWER_ID;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-base tracking-tight">Capstack</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard" className="text-sm" style={{ color: 'var(--color-muted)' }}>← My dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto w-full px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <DocumentIcon size={22} color="var(--color-secondary)" strokeWidth={1.5} />
            <h1 className="text-2xl font-black">Download documents</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Download your loan documents as PDF files. These are official records generated in accordance
            with NCA requirements. Documents are generated fresh each time you download.
          </p>
        </div>

        {/* Account-level documents */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)' }}>
            Account documents
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex flex-col gap-0 divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              <div className="p-4">
                <DownloadBtn
                  href={`${API}/api/v1/borrowers/${borrowerId}/transactions?format=pdf`}
                  label="Full transaction history"
                  description="All payments, disbursements and fees across every loan · NCA s.108"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Per-loan documents */}
        {loans.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)' }}>
              Loan documents
            </h2>
            <div className="flex flex-col gap-4">
              {loans.map(loan => (
                <div
                  key={loan.id}
                  className="rounded-xl p-5"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {/* Loan badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{loan.loanNumber}</div>
                      <div className="font-bold">R {(loan.principal / 100).toLocaleString()}</div>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
                      style={{
                        background: loan.status === 'ACTIVE' ? 'var(--badge-active-bg)' : 'var(--color-surface-2)',
                        color:      loan.status === 'ACTIVE' ? 'var(--badge-active-fg)' : 'var(--color-muted)',
                      }}
                    >
                      {loan.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <DownloadBtn
                      href={`${API}/api/v1/loans/${loan.id}/statement`}
                      label="Loan statement"
                      description="Outstanding balance, repayment history and amortization schedule · NCA s.108"
                    />
                    <DownloadBtn
                      href={`${API}/api/v1/loans/${loan.id}/agreement`}
                      label="Loan agreement"
                      description="Your credit agreement with all terms and consumer rights · NCA s.93"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legal note */}
        <p className="text-xs mt-10" style={{ color: 'var(--color-muted)' }}>
          All documents are generated in accordance with the National Credit Act 34 of 2005.
          If you believe any information is incorrect, please contact support at{' '}
          <a href="mailto:support@capstack.co.za" style={{ color: 'var(--color-secondary)' }}>
            support@capstack.co.za
          </a>.
        </p>

      </main>

      <footer style={{ borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>© 2026 Capstack Financial Services</span>
          <span>NCR Registered · FSP registration pending</span>
        </div>
      </footer>
    </div>
  );
}
