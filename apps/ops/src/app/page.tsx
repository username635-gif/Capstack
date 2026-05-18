'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useState } from 'react';
import OpsLayout from './_components/OpsLayout';
import { API_BASE_URL, buildOpsApiHeaders } from '@/lib/api-client';

type DashboardPayload = {
  generatedAt: string;
  portfolio: {
    totalBookSizeCents: number;
    portfolioAtRiskPct: number | null;
    nplRatePct: number | null;
    activeLoanCount: number;
  };
  disbursementVelocity: Array<{
    week: string;
    approvedCount: number;
    disbursedCount: number;
    disbursedAmountCents: number;
  }>;
  aiPerformance: {
    approvalRatePct: number | null;
    avgPdPct: number | null;
    aiAlignedDefaultRatePct: number | null;
    overrideDefaultRatePct: number | null;
    overrideApprovalRatePct: number | null;
  };
  cohorts: Array<{
    label: string;
    loanCount: number;
    disbursedCount: number;
    totalPrincipalCents: number;
    par30Pct: number | null;
    nplPct: number | null;
  }>;
};

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return 'R 0';
  return `R ${(cents / 100).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

function statTone(value: number | null | undefined, lowerIsBetter = false) {
  if (value == null) return { bg: 'var(--color-surface-2)', fg: 'var(--color-muted)' };
  if (lowerIsBetter) {
    return value <= 5
      ? { bg: '#dcfce7', fg: '#166534' }
      : value <= 10
        ? { bg: '#fef3c7', fg: '#92400e' }
        : { bg: '#fee2e2', fg: '#991b1b' };
  }
  return value >= 70
    ? { bg: '#dcfce7', fg: '#166534' }
    : value >= 50
      ? { bg: '#fef3c7', fg: '#92400e' }
      : { bg: '#fee2e2', fg: '#991b1b' };
}

export default function OpsHome() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await buildOpsApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/dashboard`, {
        headers,
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as (DashboardPayload & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to load portfolio dashboard.');
      }

      setDashboard(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load portfolio dashboard.');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const latestWeek = dashboard?.disbursementVelocity[dashboard.disbursementVelocity.length - 1] ?? null;
  const maxWeeklyCount = Math.max(...(dashboard?.disbursementVelocity.map((bucket) => Math.max(bucket.approvedCount, bucket.disbursedCount)) ?? [1]));
  const maxCohortPrincipal = Math.max(...(dashboard?.cohorts.map((cohort) => cohort.totalPrincipalCents) ?? [1]));
  const parTone = statTone(dashboard?.portfolio.portfolioAtRiskPct, true);
  const nplTone = statTone(dashboard?.portfolio.nplRatePct, true);

  return (
    <OpsLayout
      title="Portfolio Command Center"
      action={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/applications"
            className="text-sm px-4 py-2 rounded-lg font-semibold"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            Review applications
          </Link>
          <Link
            href="/collections"
            className="text-sm px-4 py-2 rounded-lg font-semibold"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' }}
          >
            Open collections
          </Link>
        </div>
      }
    >
      <div
        className="rounded-2xl p-6 mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(14, 116, 144, 0.12))',
          border: '1px solid rgba(14, 116, 144, 0.18)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] mb-2" style={{ color: 'var(--color-secondary)' }}>
              Live portfolio telemetry
            </div>
            <h2 className="text-2xl font-black mb-2">Book quality, disbursement pace, and model drift in one operating view.</h2>
            <p className="text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
              The dashboard now reads from live loan performance, approval decisions, and disbursement activity so ops can track current book health, recent funding velocity, and AI-vs-human outcome quality without falling back to demo snapshots.
            </p>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {dashboard?.generatedAt ? `Updated ${new Date(dashboard.generatedAt).toLocaleString('en-ZA')}` : 'Waiting for live dashboard data'}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {loading && !dashboard ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl p-5 min-h-[132px] animate-pulse"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            />
          ))}
        </div>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total book size"
              value={formatCurrency(dashboard.portfolio.totalBookSizeCents)}
              detail={`${dashboard.portfolio.activeLoanCount} active loans in monitored portfolio`}
            />
            <MetricCard
              label="Portfolio at Risk"
              value={formatPercent(dashboard.portfolio.portfolioAtRiskPct)}
              detail="Exposure at 30+ DPD against total outstanding balance"
              tone={parTone}
            />
            <MetricCard
              label="NPL rate"
              value={formatPercent(dashboard.portfolio.nplRatePct)}
              detail="Loans at 90+ DPD or defaulted status"
              tone={nplTone}
            />
            <MetricCard
              label="Disbursement velocity"
              value={latestWeek ? `${latestWeek.disbursedCount} funded` : '—'}
              detail={latestWeek ? `${formatCurrency(latestWeek.disbursedAmountCents)} in the latest weekly bucket` : 'Awaiting weekly disbursement events'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr] mb-6">
            <section className="rounded-xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-5 gap-3">
                <div>
                  <h3 className="text-lg font-black">Disbursement Velocity</h3>
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                    Weekly approvals vs funded loans over the last six buckets.
                  </p>
                </div>
                <div className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
                  Live funding lane
                </div>
              </div>

              <div className="space-y-4">
                {dashboard.disbursementVelocity.map((bucket) => (
                  <div key={bucket.week} className="grid grid-cols-[72px_1fr_auto] gap-3 items-center">
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>{bucket.week}</div>
                    <div className="space-y-2">
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max((bucket.approvedCount / maxWeeklyCount) * 100, bucket.approvedCount > 0 ? 8 : 0)}%`, background: '#0f766e' }}
                        />
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max((bucket.disbursedCount / maxWeeklyCount) * 100, bucket.disbursedCount > 0 ? 8 : 0)}%`, background: '#10b981' }}
                        />
                      </div>
                    </div>
                    <div className="text-right text-xs min-w-[120px]" style={{ color: 'var(--color-muted)' }}>
                      <div>{bucket.approvedCount} approved</div>
                      <div>{bucket.disbursedCount} funded</div>
                      <div className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{formatCurrency(bucket.disbursedAmountCents)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="mb-5">
                <h3 className="text-lg font-black">AI Model Performance</h3>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Approval bias, override share, and downstream default performance from live production decisions.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PerfTile label="AI approval rate" value={formatPercent(dashboard.aiPerformance.approvalRatePct)} />
                <PerfTile label="Average PD" value={dashboard.aiPerformance.avgPdPct != null ? `${dashboard.aiPerformance.avgPdPct.toFixed(1)}%` : '—'} />
                <PerfTile label="Aligned default rate" value={formatPercent(dashboard.aiPerformance.aiAlignedDefaultRatePct)} tone={statTone(dashboard.aiPerformance.aiAlignedDefaultRatePct, true)} />
                <PerfTile label="Override default rate" value={formatPercent(dashboard.aiPerformance.overrideDefaultRatePct)} tone={statTone(dashboard.aiPerformance.overrideDefaultRatePct, true)} />
                <PerfTile label="Override share" value={formatPercent(dashboard.aiPerformance.overrideApprovalRatePct)} tone={statTone(100 - (dashboard.aiPerformance.overrideApprovalRatePct ?? 0))} />
              </div>

              <div className="mt-5 rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--color-muted)' }}>Interpretation</div>
                <p className="text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
                  A widening gap between aligned and overridden default rates is a direct signal that human overrides are either rescuing viable files or weakening model discipline. This panel is intended to make that drift visible before it leaks into arrears.
                </p>
              </div>
            </section>
          </div>

          <section className="rounded-xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex flex-col gap-2 mb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-black">Cohort Performance Over Time</h3>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Monthly disbursed cohorts with principal deployed, PAR30, and NPL performance.
                </p>
              </div>
              <Link href="/reports" className="text-sm font-semibold" style={{ color: 'var(--color-secondary)' }}>
                Open reporting suite
              </Link>
            </div>

            <div className="space-y-4">
              {dashboard.cohorts.map((cohort) => (
                <div key={cohort.label} className="grid grid-cols-1 gap-3 rounded-xl p-4 md:grid-cols-[140px_1fr_220px]" style={{ background: 'var(--color-surface-2)' }}>
                  <div>
                    <div className="font-semibold">{cohort.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{cohort.loanCount} loans</div>
                  </div>
                  <div>
                    <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(15, 118, 110, 0.12)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max((cohort.totalPrincipalCents / maxCohortPrincipal) * 100, cohort.totalPrincipalCents > 0 ? 8 : 0)}%`, background: '#0f766e' }}
                      />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {formatCurrency(cohort.totalPrincipalCents)} deployed across {cohort.disbursedCount} funded accounts
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--color-muted)' }}>PAR30</div>
                      <div className="font-semibold">{formatPercent(cohort.par30Pct)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--color-muted)' }}>NPL</div>
                      <div className="font-semibold">{formatPercent(cohort.nplPct)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </OpsLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: { bg: string; fg: string };
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="text-xs uppercase tracking-[0.16em] mb-3" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div className="text-3xl font-black mb-3">{value}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm leading-6" style={{ color: 'var(--color-muted)' }}>{detail}</div>
        {tone ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: tone.bg, color: tone.fg }}>Live</span> : null}
      </div>
    </div>
  );
}

function PerfTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: { bg: string; fg: string };
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: tone?.bg ?? 'var(--color-surface-2)', color: tone?.fg ?? 'var(--color-foreground)' }}>
      <div className="text-xs uppercase tracking-[0.16em] mb-2" style={{ color: tone?.fg ?? 'var(--color-muted)' }}>
        {label}
      </div>
      <div className="text-xl font-black">{value}</div>
    </div>
  );
}