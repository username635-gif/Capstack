'use client';

import { useState, useEffect }    from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, clearSession } from '@/lib/session';
import { Suspense } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type Loan = {
  id: string; loanNumber: string; status: string;
  principal: number; outstandingPrincipal: number;
  aprBps: number; startDate: string; maturityDate: string;
  daysPastDue: number; product?: { name: string };
};

type Application = {
  id: string; status: string; amountRequested: number;
  submittedAt: string; product?: { name: string };
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ACTIVE:               { bg: 'var(--badge-active-bg)',   fg: 'var(--badge-active-fg)'   },
  PAID_IN_FULL:         { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  DEFAULTED:            { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
  SUBMITTED:            { bg: 'var(--badge-pending-bg)',  fg: 'var(--badge-pending-fg)'  },
  APPROVED:             { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  REJECTED:             { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
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
  const router       = useRouter();
  const searchParams = useSearchParams();
  const justApplied  = searchParams.get('applied') === '1';

  const [loans, setLoans]         = useState<Loan[]>([]);
  const [apps, setApps]           = useState<Application[]>([]);
  const [loading, setLoading]     = useState(true);
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/sign-in'); return; }
    setSessionState(s);

    Promise.all([
      fetch(`${API}/api/v1/loans?borrowerId=${s.id}`, { headers: { Authorization: 'Bearer demo' } }).then(r => r.json()),
      fetch(`${API}/api/v1/applications?borrowerId=${s.id}`, { headers: { Authorization: 'Bearer demo' } }).then(r => r.json()),
    ]).then(([loansData, appsData]) => {
      setLoans(loansData.data ?? []);
      setApps(appsData.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="font-bold text-base tracking-tight">Capstack</a>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Hi, {session.name.split(' ')[0]}
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

      <div className="max-w-5xl mx-auto w-full px-6 py-10">
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
            <a
              href="/apply"
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              + Apply for a loan
            </a>
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
          ) : loans.length === 0 ? (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                You don&apos;t have any active loans yet.
              </p>
              <a
                href="/apply"
                className="text-sm font-semibold px-5 py-2.5 rounded-lg"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                Apply now
              </a>
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
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
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
                        <div className="font-semibold">{new Date(loan.startDate).toLocaleDateString('en-ZA')}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-muted)' }}>Maturity</div>
                        <div className="font-semibold">{new Date(loan.maturityDate).toLocaleDateString('en-ZA')}</div>
                      </div>
                    </div>
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
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Product', 'Amount', 'Submitted', 'Status'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: i < apps.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td className="px-5 py-3 font-medium">{a.product?.name ?? '—'}</td>
                      <td className="px-5 py-3 font-semibold">R {(a.amountRequested / 100).toLocaleString()}</td>
                      <td className="px-5 py-3" style={{ color: 'var(--color-muted)' }}>
                        {new Date(a.submittedAt).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="px-5 py-3">{badge(a.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <footer style={{ borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>© 2026 Capstack Financial Services</span>
          <span>NCR Registered · FSP 12345</span>
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
