'use client';

import { useState } from 'react';
import PartnerLayout from '@/app/_components/PartnerLayout';

type ReportType = 'NCR' | 'FICA' | 'NCA' | 'IFRS9';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = Record<string, any>;

const DEMO_REPORTS: Record<ReportType, ReportData> = {
  NCR: {
    period: { from: '2026-04-01', to: '2026-05-14' },
    partnerSummary: { totalLoansIssued: 24, totalDisbursed: 48200000, activeLoans: 18, nplRate: 0.042 },
    ncrComplaints: { total: 0, resolved: 0, pending: 0 },
    reportGeneratedAt: new Date().toISOString(),
  },
  FICA: {
    period: { from: '2026-04-01', to: '2026-05-14' },
    kycSummary: { total: 24, clear: 21, refer: 2, failed: 1, completionRate: 0.875 },
    sanctionsChecks: { checked: 24, flagged: 0 },
    reportGeneratedAt: new Date().toISOString(),
  },
  NCA: {
    period: { from: '2026-04-01', to: '2026-05-14' },
    affordabilityChecks: { completed: 24, passed: 21, failed: 3 },
    recklessLendingFlags: 0,
    creditAgreements: { total: 24, withCoolingOff: 24, cancelledInCoolingOff: 0 },
    reportGeneratedAt: new Date().toISOString(),
  },
  IFRS9: {
    period: { from: '2026-04-01', to: '2026-05-14' },
    stages: {
      stage1: { loans: 18, outstandingPrincipal: 3240000, ecl: 47000,   pct: 0.015 },
      stage2: { loans:  4, outstandingPrincipal:  720000, ecl: 312000,  pct: 0.433 },
      stage3: { loans:  2, outstandingPrincipal:  240000, ecl: 1840000, pct: 0.767 },
    },
    totalEcl: 2199000,
    reportGeneratedAt: new Date().toISOString(),
  },
};

export default function PartnerReports() {
  const [reportType, setReportType] = useState<ReportType>('IFRS9');
  const [from,  setFrom]  = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); });
  const [to,    setTo]    = useState(() => new Date().toISOString().slice(0, 10));
  const [data,  setData]  = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function fetchReport() {
    setLoading(true);
    setError(null);
    setData(null);
    setTimeout(() => {
      setData(DEMO_REPORTS[reportType]);
      setLoading(false);
    }, 300);
  }

  return (
    <PartnerLayout title="Reports">
      <div className="max-w-3xl flex flex-col gap-6">
        <div className="rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-end"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Report type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)}
              className="px-4 py-3 rounded-lg text-sm"
             style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none', colorScheme: 'inherit' }}
            >
              {(['NCR','FICA','NCA','IFRS9'] as ReportType[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
          <button onClick={fetchReport} disabled={loading}
            className="px-7 py-3 rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {error && (
          <div className="text-sm px-5 py-4 rounded-xl" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>{error}</div>
        )}

        {data && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <h3 className="font-bold">{reportType} Report</h3>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{from} to {to}</span>
            </div>
            <pre className="p-6 text-xs overflow-auto" style={{ color: 'var(--foreground)', maxHeight: '60vh', fontFamily: 'monospace' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Select report type and date range, then click Generate.</p>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}
