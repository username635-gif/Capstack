'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import OpsLayout from '@/app/_components/OpsLayout';
import { API_BASE_URL, buildOpsApiHeaders } from '@/lib/api-client';

type ReportType = 'ncr_monthly' | 'fica_ctr' | 'fica_sar' | 'nca_affordability' | 'ifrs9_ecl';

type PortfolioSummary = {
  reportType: string;
  generatedAt: string;
  kpis: {
    activeLoans: number;
    loansInArrears: number;
    totalOutstandingCents: number;
    arrearsOutstandingCents: number;
    par30Pct: number | null;
    par90Pct: number | null;
    nplCount: number;
    highRiskAmlAlerts: number;
    openAmlAlerts: number;
    approvalRatePct: number | null;
    avgPdPct: number | null;
    totalEclCents: number;
  };
  collections: {
    totalLoans: number;
    totalOutstandingCents: number;
    immediateActionCount: number;
    promiseToPayOpenCount: number;
    brokenPromiseCount: number;
    legalQueueCount: number;
    restructureQueueCount: number;
    avgDaysSinceLastContact: number | null;
  };
  productExposure: Array<{ product: string; count: number; outstandingCents: number }>;
  portfolioMix: Array<{ bucket: string; count: number; outstandingCents: number }>;
  filings: Array<{ report: string; dueDate: string; status: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' }>;
};

type NcrReport = {
  reportType: string;
  generatedAt: string;
  totalOriginated: number;
  totalCancelled: number;
  accountsInArrears: number;
  byProduct: Array<{ product: string; count: number; totalValueRand: number; avgAprPct: number }>;
  filingDeadline: string;
  filingStatus: string;
};

type FicaCtrReport = {
  reportType: string;
  generatedAt: string;
  thresholdRand: number;
  totalEntries: number;
  totalValueRand: number;
  filingDeadline: string;
  filingStatus: string;
  entries: Array<{ transactionId: string; date: string; amountRand: number; rail: string; borrowerId: string; filedWithFic: boolean }>;
};

type FicaSarReport = {
  reportType: string;
  generatedAt: string;
  totalAlerts: number;
  highRiskAlerts: number;
  openAlerts: number;
  filingDeadline: string;
  filingStatus: string;
  alerts: Array<{ alertId: string; borrowerId: string; alertType: string; riskLevel: string; status: string; createdAt: string; filed: boolean }>;
};

type NcaReport = {
  reportType: string;
  generatedAt: string;
  totalDecisions: number;
  approved: number;
  declined: number;
  approvalRatePct: number | null;
  avgPdPct: number | null;
  avgDeclaredIncomeRand: number | null;
  declineReasons: Array<{ reason: string; count: number }>;
  byProduct: Array<{ product: string; count: number; approvalRatePct: number | null; avgPdPct: number | null }>;
  note: string;
};

type Ifrs9Report = {
  reportType: string;
  generatedAt: string;
  ecl: {
    totalEcl: number;
    loanCount: number;
    stage1Ecl: number;
    stage2Ecl: number;
    stage3Ecl: number;
  };
  stageCounts: {
    stage1: number;
    stage2: number;
    stage3: number;
  };
  note: string;
};

type ReportPayload = NcrReport | FicaCtrReport | FicaSarReport | NcaReport | Ifrs9Report;

const REPORT_OPTIONS: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'ncr_monthly', label: 'NCR Monthly', description: 'Originations, arrears, and rate disclosure summary' },
  { value: 'fica_ctr', label: 'FICA CTR', description: 'Cash-threshold transactions and filing deadline' },
  { value: 'fica_sar', label: 'FICA SAR', description: 'Suspicious activity and AML filing queue' },
  { value: 'nca_affordability', label: 'NCA Affordability', description: 'Underwriting quality, approval rate, and decline reasons' },
  { value: 'ifrs9_ecl', label: 'IFRS 9 ECL', description: 'Provisioning and stage migration snapshot' },
];

function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return 'R0';
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatRand(amount: number | null | undefined): string {
  if (amount == null) return 'R0';
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return 'n/a';
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function filingStyles(status: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE') {
  if (status === 'OVERDUE') return { fg: '#991b1b', bg: '#fee2e2' };
  if (status === 'DUE_SOON') return { fg: '#9a3412', bg: '#ffedd5' };
  return { fg: '#166534', bg: '#dcfce7' };
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('ncr_monthly');
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [detail, setDetail] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await buildOpsApiHeaders();
      const [summaryResponse, detailResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/reports?type=portfolio_summary&from=${from}&to=${to}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${API_BASE_URL}/api/v1/reports?type=${reportType}&from=${from}&to=${to}`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      if (!summaryResponse.ok || !detailResponse.ok) {
        throw new Error('Failed to load reporting data');
      }

      setSummary(await summaryResponse.json() as PortfolioSummary);
      setDetail(await detailResponse.json() as ReportPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reporting data');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <OpsLayout title="Regulatory Reports">
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl p-6 flex flex-col gap-5 xl:flex-row xl:items-end" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--color-muted)' }}>Report type</label>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              {REPORT_OPTIONS.find((option) => option.value === reportType)?.description}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--color-muted)' }}>From</label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--color-muted)' }}>To</label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>

          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="px-6 py-3 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
          >
            {loading ? 'Refreshing…' : 'Generate report'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
            {error}
          </div>
        )}

        {summary && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {[
                { label: 'Portfolio', value: formatMoney(summary.kpis.totalOutstandingCents) },
                { label: 'Arrears', value: formatMoney(summary.kpis.arrearsOutstandingCents) },
                { label: 'PAR30', value: formatPct(summary.kpis.par30Pct) },
                { label: 'Approval Rate', value: formatPct(summary.kpis.approvalRatePct) },
                { label: 'High AML', value: String(summary.kpis.highRiskAmlAlerts) },
                { label: 'ECL', value: formatMoney(summary.kpis.totalEclCents) },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl p-4"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                  <div className="text-xl font-bold">{card.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
              <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold">Portfolio Mix</h3>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Delinquency distribution and collections pressure.</p>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-muted)' }}>Generated {new Date(summary.generatedAt).toLocaleString('en-ZA')}</div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {summary.portfolioMix.map((bucket) => (
                    <div key={bucket.bucket} className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                      <div className="font-semibold">{bucket.bucket}</div>
                      <div className="text-sm mt-1">{bucket.count} loans</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{formatMoney(bucket.outstandingCents)} exposure</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Collections Queue</div>
                    <div className="font-semibold">{summary.collections.totalLoans} loans</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{summary.collections.immediateActionCount} need action now</div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Promises to Pay</div>
                    <div className="font-semibold">{summary.collections.promiseToPayOpenCount} open</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{summary.collections.brokenPromiseCount} broken</div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Legal / Restructure</div>
                    <div className="font-semibold">{summary.collections.legalQueueCount} legal</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{summary.collections.restructureQueueCount} restructure</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div>
                  <h3 className="font-bold">Filing Calendar</h3>
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Near-term regulatory deadlines based on the selected reporting window.</p>
                </div>
                {summary.filings.map((filing) => {
                  const badge = filingStyles(filing.status);
                  return (
                    <div key={filing.report} className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: 'var(--color-surface-2)' }}>
                      <div>
                        <div className="font-semibold">{filing.report}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>Due {formatDate(filing.dueDate)}</div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: badge.bg, color: badge.fg }}>
                        {filing.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {detail && (
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold">{detail.reportType}</h3>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Selected period: {from} to {to}</p>
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>Generated {new Date(detail.generatedAt).toLocaleString('en-ZA')}</div>
            </div>

            {reportType === 'ncr_monthly' && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  {(() => {
                    const report = detail as NcrReport;
                    return [
                      { label: 'Originated', value: String(report.totalOriginated) },
                      { label: 'Cancelled', value: String(report.totalCancelled) },
                      { label: 'In Arrears', value: String(report.accountsInArrears) },
                      { label: 'Deadline', value: report.filingDeadline },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                        <div className="font-semibold">{card.value}</div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="grid gap-3">
                  {(detail as NcrReport).byProduct.map((row) => (
                    <div key={row.product} className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: 'var(--color-surface-2)' }}>
                      <div>
                        <div className="font-semibold">{row.product}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{row.count} agreements</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatRand(row.totalValueRand)}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>Avg APR {row.avgAprPct.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === 'fica_ctr' && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  {(() => {
                    const report = detail as FicaCtrReport;
                    return [
                      { label: 'Threshold', value: formatRand(report.thresholdRand) },
                      { label: 'Entries', value: String(report.totalEntries) },
                      { label: 'Value', value: formatRand(report.totalValueRand) },
                      { label: 'Deadline', value: report.filingDeadline },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                        <div className="font-semibold">{card.value}</div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="grid gap-3">
                  {(detail as FicaCtrReport).entries.slice(0, 10).map((entry) => (
                    <div key={entry.transactionId} className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: 'var(--color-surface-2)' }}>
                      <div>
                        <div className="font-semibold">{entry.rail}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{entry.transactionId} · {entry.borrowerId}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatRand(entry.amountRand)}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{formatDate(entry.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === 'fica_sar' && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  {(() => {
                    const report = detail as FicaSarReport;
                    return [
                      { label: 'Alerts', value: String(report.totalAlerts) },
                      { label: 'High Risk', value: String(report.highRiskAlerts) },
                      { label: 'Open', value: String(report.openAlerts) },
                      { label: 'Deadline', value: report.filingDeadline },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                        <div className="font-semibold">{card.value}</div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="grid gap-3">
                  {(detail as FicaSarReport).alerts.slice(0, 10).map((alert) => (
                    <div key={alert.alertId} className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: 'var(--color-surface-2)' }}>
                      <div>
                        <div className="font-semibold">{alert.alertType}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{alert.borrowerId} · {alert.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{alert.riskLevel}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{formatDate(alert.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reportType === 'nca_affordability' && (
              <>
                <div className="grid gap-4 md:grid-cols-5">
                  {(() => {
                    const report = detail as NcaReport;
                    return [
                      { label: 'Decisions', value: String(report.totalDecisions) },
                      { label: 'Approved', value: String(report.approved) },
                      { label: 'Declined', value: String(report.declined) },
                      { label: 'Approval Rate', value: formatPct(report.approvalRatePct) },
                      { label: 'Avg Income', value: formatRand(report.avgDeclaredIncomeRand) },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                        <div className="font-semibold">{card.value}</div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="font-semibold">Decline Reasons</div>
                    {(detail as NcaReport).declineReasons.slice(0, 8).map((reason) => (
                      <div key={reason.reason} className="flex items-center justify-between gap-3 text-sm">
                        <span>{reason.reason}</span>
                        <span style={{ color: 'var(--color-muted)' }}>{reason.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="font-semibold">By Product</div>
                    {(detail as NcaReport).byProduct.map((product) => (
                      <div key={product.product} className="flex items-center justify-between gap-3 text-sm">
                        <span>{product.product}</span>
                        <span style={{ color: 'var(--color-muted)' }}>{formatPct(product.approvalRatePct)} · Avg PD {formatPct(product.avgPdPct)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{(detail as NcaReport).note}</p>
              </>
            )}

            {reportType === 'ifrs9_ecl' && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  {(() => {
                    const report = detail as Ifrs9Report;
                    return [
                      { label: 'Total ECL', value: formatMoney(report.ecl.totalEcl) },
                      { label: 'Loans', value: String(report.ecl.loanCount) },
                      { label: 'Stage 2', value: formatMoney(report.ecl.stage2Ecl) },
                      { label: 'Stage 3', value: formatMoney(report.ecl.stage3Ecl) },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                        <div className="font-semibold">{card.value}</div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {(() => {
                    const report = detail as Ifrs9Report;
                    return [
                      { label: 'Stage 1', count: report.stageCounts.stage1, value: formatMoney(report.ecl.stage1Ecl) },
                      { label: 'Stage 2', count: report.stageCounts.stage2, value: formatMoney(report.ecl.stage2Ecl) },
                      { label: 'Stage 3', count: report.stageCounts.stage3, value: formatMoney(report.ecl.stage3Ecl) },
                    ].map((stage) => (
                      <div key={stage.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="font-semibold">{stage.label}</div>
                        <div className="text-sm mt-1">{stage.count} loans</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{stage.value} provision</div>
                      </div>
                    ));
                  })()}
                </div>

                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{(detail as Ifrs9Report).note}</p>
              </>
            )}
          </div>
        )}
      </div>
    </OpsLayout>
  );
}