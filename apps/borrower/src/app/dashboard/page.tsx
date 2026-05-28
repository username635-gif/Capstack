'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSession, clearSession } from '@/lib/session';
import { ThemeToggle } from '@/app/_components/ThemeProvider';
import { LoanCalculator, CalculatorIcon, DocumentIcon } from '@/app/_components/LoanCalculator';
import { Suspense } from 'react';

type Loan = {
  id: string; loanNumber: string; status: string;
  principal: number; outstandingPrincipal: number;
  aprBps: number; startDate: string; maturityDate: string;
  daysPastDue: number; product?: { name: string };
};

type Application = {
  id: string; status: string; amountRequested: number;
  submittedAt: string; product?: { name: string };
  approvedAmount?: number; approvedAprBps?: number; approvedTermDays?: number;
};

// Expanded demo data for dashboard
const DEMO_LOANS: Loan[] = [
  {
    id: 'dl1', loanNumber: 'LN-2026-00091', status: 'ACTIVE',
    principal: 2500000, outstandingPrincipal: 1500000,
    aprBps: 1800, startDate: '2026-01-15', maturityDate: '2027-01-15',
    daysPastDue: 0, product: { name: 'Personal Loan' },
  },
  {
    id: 'dl2', loanNumber: 'LN-2026-00092', status: 'ACTIVE',
    principal: 1200000, outstandingPrincipal: 1200000,
    aprBps: 1650, startDate: '2026-03-01', maturityDate: '2027-03-01',
    daysPastDue: 14, product: { name: 'Business Loan' },
  },
  {
    id: 'dl3', loanNumber: 'LN-2026-00093', status: 'DEFAULTED',
    principal: 800000, outstandingPrincipal: 800000,
    aprBps: 2200, startDate: '2025-10-10', maturityDate: '2026-10-10',
    daysPastDue: 91, product: { name: 'Vehicle Finance' },
  },
  {
    id: 'dl4', loanNumber: 'LN-2026-00094', status: 'PAID_IN_FULL',
    principal: 500000, outstandingPrincipal: 0,
    aprBps: 1500, startDate: '2025-01-01', maturityDate: '2026-01-01',
    daysPastDue: 0, product: { name: 'Education Loan' },
  },
  {
    id: 'dl5', loanNumber: 'LN-2026-00095', status: 'ACTIVE',
    principal: 2000000, outstandingPrincipal: 500000,
    aprBps: 1750, startDate: '2026-04-15', maturityDate: '2027-04-15',
    daysPastDue: 32, product: { name: 'Home Loan' },
  },
  {
    id: 'dl6', loanNumber: 'LN-2026-00096', status: 'ACTIVE',
    principal: 1000000, outstandingPrincipal: 1000000,
    aprBps: 1600, startDate: '2026-05-01', maturityDate: '2027-05-01',
    daysPastDue: 0, product: { name: 'Personal Loan' },
  },
];

const DEMO_APPS: Application[] = [
  {
    id: 'da1', status: 'AI_APPROVED', amountRequested: 2500000,
    submittedAt: '2026-01-12', product: { name: 'Personal Loan' },
    approvedAmount: 2500000, approvedAprBps: 1800, approvedTermDays: 365,
  },
  {
    id: 'da2', status: 'AI_DECLINED', amountRequested: 1200000,
    submittedAt: '2026-02-10', product: { name: 'Business Loan' },
  },
  {
    id: 'da3', status: 'AI_ESCALATED', amountRequested: 800000,
    submittedAt: '2026-03-05', product: { name: 'Vehicle Finance' },
  },
  {
    id: 'da4', status: 'SUBMITTED', amountRequested: 500000,
    submittedAt: '2026-04-01', product: { name: 'Education Loan' },
  },
  {
    id: 'da5', status: 'PENDING_DISBURSEMENT', amountRequested: 2000000,
    submittedAt: '2026-04-20', product: { name: 'Home Loan' },
    approvedAmount: 2000000, approvedAprBps: 1750, approvedTermDays: 365,
  },
  {
    id: 'da6', status: 'APPROVED', amountRequested: 1000000,
    submittedAt: '2026-05-01', product: { name: 'Personal Loan' },
    approvedAmount: 1000000, approvedAprBps: 1600, approvedTermDays: 365,
  },
  {
    id: 'da7', status: 'SUBMITTED', amountRequested: 750000,
    submittedAt: '2026-05-10', product: { name: 'Business Loan' },
  },
  {
    id: 'da8', status: 'AI_APPROVED', amountRequested: 600000,
    submittedAt: '2026-05-15', product: { name: 'Personal Loan' },
    approvedAmount: 600000, approvedAprBps: 1700, approvedTermDays: 180,
  },
];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: 'var(--badge-active-bg)', fg: 'var(--badge-active-fg)' },
  PAID_IN_FULL: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  DEFAULTED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
  SUBMITTED: { bg: 'var(--badge-pending-bg)', fg: 'var(--badge-pending-fg)' },
  APPROVED: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  REJECTED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
  PENDING_DISBURSEMENT: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
};

function badge(status: string) {
  const c = STATUS_COLORS[status] ?? { bg: 'var(--color-surface-2)', fg: 'var(--color-muted)' };
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.fg }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justApplied = searchParams.get('applied') === '1';

  const [loans, setLoans] = useState<Loan[]>(DEMO_LOANS);
  const [apps, setApps] = useState<Application[]>(DEMO_APPS);
  const [loading] = useState(false);
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [calcOpen, setCalcOpen] = useState(false);

  // Payment panel state
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payStep, setPayStep] = useState<1 | 2>(1); // 1=amount  2=card
  const [payAmount, setPayAmount] = useState('');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [payStatus, setPayStatus] = useState<'idle' | 'processing' | 'done'>('idle');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Removed constellation/canvas background effect.
  // NOTE: This section previously contained a partially-edited animation loop which broke Turbopack parsing.
  // The dashboard UI does not require the canvas animation; demo content remains fully functional.

  function openPay(loanId: string, monthlyEstimate: number) {
    setPayingId(loanId);
    setPayAmount((monthlyEstimate / 100).toFixed(2));
    setCard({ number: '', expiry: '', cvv: '', name: '' });
    setPayStep(1);
    setPayStatus('idle');
  }

  function closePay() {
    setPayingId(null);
    setPayAmount('');
    setCard({ number: '', expiry: '', cvv: '', name: '' });
    setPayStep(1);
    setPayStatus('idle');
  }

  function submitPayment(loan: Loan) {
    const cents = Math.round(parseFloat(payAmount) * 100);
    if (!cents || cents <= 0) return;
    setPayStatus('processing');
    setTimeout(() => {
      setLoans(prev => prev.map(l =>
        l.id === loan.id
          ? {
            ...l,
            outstandingPrincipal: Math.max(0, l.outstandingPrincipal - cents),
            daysPastDue: 0,
            status: l.outstandingPrincipal - cents <= 0 ? 'PAID_IN_FULL' : l.status,
          }
          : l
      ));
      setPayStatus('done');
      setTimeout(() => closePay(), 2000);
    }, 900);
  }

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/sign-in'); return; }
    setSessionState(s);
    // Real fetch (runs in background; demo data already shown above)
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app'}/api/v1/loans?borrowerId=${s.id}`, { headers: { Authorization: 'Bearer demo' } }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app'}/api/v1/applications?borrowerId=${s.id}`, { headers: { Authorization: 'Bearer demo' } }).then(r => r.json()),
    ]).then(([loansData, appsData]) => {
      setLoans((loansData.data && loansData.data.length > 0) ? loansData.data : DEMO_LOANS);
      setApps((appsData.data && appsData.data.length > 0) ? appsData.data : DEMO_APPS);
    }).catch(() => {
      setLoans(DEMO_LOANS);
      setApps(DEMO_APPS);
    });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)', position: 'relative' }}>
      <LoanCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', position: 'relative', zIndex: 1 }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-base tracking-tight">Capstack</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Calculator icon */}
            <button
              onClick={() => setCalcOpen(true)}
              aria-label="Open loan calculator"
              title="Loan Calculator"
              style={{
                background: 'transparent', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '5px 7px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', lineHeight: 1,
              }}
            >
              <CalculatorIcon size={18} color="var(--foreground)" strokeWidth={1.4} />
            </button>
            {/* PDF downloads */}
            <Link
              href="/downloads"
              aria-label="Download documents"
              title="Download PDFs"
              style={{
                background: 'transparent', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '5px 7px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', lineHeight: 1,
                textDecoration: 'none',
              }}
            >
              <DocumentIcon size={18} color="var(--foreground)" strokeWidth={1.4} />
            </Link>
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Hi, {session?.name?.split(' ')[0] ?? ''}
            </span>
            <button
              onClick={() => { clearSession(); router.push('/sign-in'); }}
              className="text-xs font-medium"
              style={{ color: 'var(--color-danger)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto w-full px-6 py-10" style={{ position: 'relative', zIndex: 1 }}>
        {justApplied && (
          <div
            className="rounded-xl px-5 py-4 mb-8 text-sm font-medium"
            style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)', border: '1px solid #a7f3d0' }}
          >
            ✓ Application submitted! We&apos;ll review it and update you within 4 hours.
          </div>
        )}

        {/* Active loans */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">My loans</h2>
            <Link
              href="/apply"
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            >
              + Apply for a loan
            </Link>
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
          ) : loans.length === 0 ? (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}
            >
              <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                You don&apos;t have any active loans yet.
              </p>
              <Link
                href="/apply"
                className="text-sm font-semibold px-5 py-2.5 rounded-lg"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
              >
                Apply now
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {loans.map(loan => {
                const repaid = loan.principal > 0
                  ? Math.round(((loan.principal - loan.outstandingPrincipal) / loan.principal) * 100)
                  : 0;
                return (
                  <div
                    key={loan.id}
                    className="rounded-xl p-6"
                    style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                          {loan.product?.name ?? 'Loan'} · {loan.loanNumber}
                        </div>
                        <div className="text-2xl font-black">R {(loan.principal / 100).toLocaleString()}</div>
                      </div>
                      {badge(loan.status)}
                    </div>

                    <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
                      <span>Repaid {repaid}%</span>
                      <span>R {(loan.outstandingPrincipal / 100).toLocaleString()} remaining</span>
                    </div>
                    <progress value={repaid} max={100} className="w-full" />

                    {loan.daysPastDue > 0 && (
                      <div
                        className="mt-3 text-xs px-3 py-2 rounded-lg font-medium"
                        style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
                      >
                        {loan.daysPastDue} days past due — please make a payment to avoid penalties.
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div style={{ color: 'var(--color-muted)' }}>APR</div>
                        <div className="font-semibold">{(loan.aprBps / 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-muted)' }}>Start date</div>
                        <div className="font-semibold">{fmt(loan.startDate)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-muted)' }}>Maturity</div>
                        <div className="font-semibold">{fmt(loan.maturityDate)}</div>
                      </div>
                    </div>

                    {/* Make a payment */}
                    {loan.status === 'ACTIVE' && payingId !== loan.id && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => openPay(loan.id, Math.round(loan.outstandingPrincipal / 12))}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md"
                          style={{ background: 'var(--color-secondary)', color: 'var(--color-secondary-fg)' }}
                        >
                          Make a payment
                        </button>
                      </div>
                    )}

                    {/* Payment panel */}
                    {payingId === loan.id && (
                      <div className="mt-4 rounded-md p-4" style={{ background: 'var(--color-surface-2)', border: '0.5px solid var(--color-border)' }}>
                        {/* ── Success ── */}
                        {payStatus === 'done' && (
                          <p className="text-sm font-semibold text-center py-2" style={{ color: 'var(--badge-approved-fg)' }}>
                            ✓ Payment of R {parseFloat(payAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} received
                          </p>
                        )}

                        {/* ── Step 1: amount ── */}
                        {payStatus !== 'done' && payStep === 1 && (
                          <>
                            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Amount to pay (R)</p>
                            <div className="flex gap-2">
                              <input
                                type="number" min="1"
                                value={payAmount}
                                onChange={e => setPayAmount(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm rounded-md"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                              />
                              <button
                                onClick={() => { if (parseFloat(payAmount) > 0) setPayStep(2); }}
                                className="px-4 py-2 text-xs font-semibold rounded-md"
                                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
                              >
                                Next
                              </button>
                              <button
                                onClick={closePay}
                                className="px-3 py-2 text-xs rounded-md"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}

                        {/* ── Step 2: card details ── */}
                        {payStatus !== 'done' && payStep === 2 && (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Card details — R {parseFloat(payAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                              <button onClick={() => setPayStep(1)} className="text-xs" style={{ color: 'var(--color-muted)' }}>← Back</button>
                            </div>
                            <div className="grid gap-2">
                              <input
                                type="text" placeholder="Name on card"
                                value={card.name}
                                onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                                className="w-full px-3 py-2 text-sm rounded-md"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                              />
                              <input
                                type="text" placeholder="Card number (16 digits)" maxLength={19}
                                value={card.number}
                                onChange={e => setCard(c => ({ ...c, number: e.target.value.replace(/[^\d]/g,'').replace(/(\d{4})/g,'$1 ').trim() }))}
                                className="w-full px-3 py-2 text-sm rounded-md font-mono tracking-wider"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text" placeholder="MM / YY" maxLength={5}
                                  value={card.expiry}
                                  onChange={e => {
                                    let v = e.target.value.replace(/[^\d]/g,'');
                                    if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2,4);
                                    setCard(c => ({ ...c, expiry: v }));
                                  }}
                                  className="px-3 py-2 text-sm rounded-md"
                                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                                />
                                <input
                                  type="password" placeholder="CVV" maxLength={4}
                                  value={card.cvv}
                                  onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g,'') }))}
                                  className="px-3 py-2 text-sm rounded-md"
                                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => submitPayment(loan)}
                                disabled={payStatus === 'processing' || !card.name || card.number.replace(/\s/g,'').length < 16 || card.expiry.length < 5 || card.cvv.length < 3}
                                className="flex-1 py-2 text-xs font-semibold rounded-md disabled:opacity-40"
                                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
                              >
                                {payStatus === 'processing' ? 'Processing…' : 'Pay now'}
                              </button>
                              <button
                                onClick={closePay}
                                className="px-4 py-2 text-xs rounded-md"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-muted)' }}>Secured by PayFast · Your card details are encrypted</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Applications */}
        {apps.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-5">My applications</h2>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Product', 'Amount', 'Submitted', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a, i) => (
                    <React.Fragment key={a.id}>
                      <tr style={{ borderBottom: expandedApp === a.id ? 'none' : i < apps.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <td className="px-5 py-3 font-medium">{a.product?.name ?? '—'}</td>
                        <td className="px-5 py-3 font-semibold">R {(a.amountRequested / 100).toLocaleString()}</td>
                        <td className="px-5 py-3" style={{ color: 'var(--color-muted)' }}>{fmt(a.submittedAt)}</td>
                        <td className="px-5 py-3">{badge(a.status)}</td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setExpandedApp(expandedApp === a.id ? null : a.id)}
                            className="text-xs font-semibold px-3 py-1 rounded-md"
                            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', cursor: 'pointer' }}
                          >
                            {expandedApp === a.id ? 'Close' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expandedApp === a.id && (
                        <tr style={{ borderBottom: i < apps.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <td colSpan={5} className="px-5 py-4" style={{ background: 'var(--color-surface-2)' }}>
                            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                              <div>
                                <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>Requested</div>
                                <div className="font-semibold">R {(a.amountRequested / 100).toLocaleString()}</div>
                              </div>
                              {a.approvedAmount != null && (
                                <div>
                                  <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>Approved amount</div>
                                  <div className="font-semibold">R {(a.approvedAmount / 100).toLocaleString()}</div>
                                </div>
                              )}
                              {a.approvedAprBps != null && (
                                <div>
                                  <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>Interest rate</div>
                                  <div className="font-semibold">{(a.approvedAprBps / 100).toFixed(1)}% APR</div>
                                </div>
                              )}
                              {a.approvedTermDays != null && (
                                <div>
                                  <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>Term</div>
                                  <div className="font-semibold">{Math.round(a.approvedTermDays / 30)} months</div>
                                </div>
                              )}
                            </div>
                            <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)' }}>
                              {a.status === 'APPROVED'
                                ? '✓ Your application has been approved. Funds will be disbursed to your account within 24 hours.'
                                : a.status === 'PENDING_DISBURSEMENT'
                                ? 'Approved — funds are being transferred to your account now.'
                                : a.status === 'SUBMITTED'
                                ? "Your application is under review. We'll update you within 4 hours."
                                : a.status === 'REJECTED'
                                ? 'This application was not approved. Contact support for more information.'
                                : `Status: ${a.status.replace(/_/g, ' ')}`}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <footer style={{ borderTop: '1px solid var(--color-border)', marginTop: 'auto', position: 'relative', zIndex: 1 }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>© 2026 Capstack Financial Services</span>
          <span>NCR Registered · FSP registration pending</span>
        </div>
      </footer>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

