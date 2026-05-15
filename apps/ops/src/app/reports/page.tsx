'use client';

import { useState } from 'react';
import OpsLayout    from '@/app/_components/OpsLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type ReportType = 'NCR' | 'FICA' | 'NCA' | 'IFRS9';

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  NCR:   'National Credit Regulator — monthly statutory submission',
  FICA:  'Financial Intelligence Centre Act — AML/KYC compliance report',
  NCA:   'National Credit Act — affordability and cost of credit report',
  IFRS9: 'IFRS 9 — expected credit loss and provision analysis',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = Record<string, any>;

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('NCR');
  const [from,       setFrom]       = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to,         setTo]         = useState(() => new Date().toISOString().slice(0, 10));
  const [data,       setData]       = useState<ReportData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    setData(null);
    const url = `${API}/api/v1/reports?type=${reportType}&from=${from}&to=${to}`;
    try {
      const res  = await fetch(url, { headers: { Authorization: 'Bearer demo' } });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to generate report.'); setLoading(false); return; }
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  return (
    <OpsLayout title="Regulatory Reports">
      <div className="max-w-3xl flex flex-col gap-6">
        {/* Controls */}
        <div
          className="rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-end"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {/* Report type */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Report type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            >
              {(Object.keys(REPORT_DESCRIPTIONS) as ReportType[]).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{REPORT_DESCRIPTIONS[reportType]}</p>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>

          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-7 py-3 rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            {loading ? 'Generating…' : 'Generate report'}
          </button>
        </div>

        {error && (
          <div className="text-sm px-5 py-4 rounded-xl" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>
            {error}
          </div>
        )}

        {data && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
            >
              <h3 className="font-bold">{reportType} Report</h3>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{from} to {to}</span>
            </div>
            <pre
              className="p-6 text-xs overflow-auto"
              style={{ color: 'var(--foreground)', maxHeight: '60vh', fontFamily: 'monospace' }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Select a report type and date range, then click Generate.
            </p>
          </div>
        )}
      </div>
    </OpsLayout>
  );
}
