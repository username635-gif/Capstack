'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getSession } from '@/lib/session';
import { API_BASE_URL, buildOpsApiHeaders } from '@/lib/api-client';
import { runStressTest } from '@/utils/stressTest';
import type { LoanItem } from '@/hooks/useLoans';
import type { StressTestSummary } from '@/utils/stressTest';

const ALLOWED_ROLES = ['ADMIN', 'CREDIT_OFFICER', 'COMPLIANCE'];

function formatMoney(cents: number): string {
  if (cents == null) return 'R0';
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div
      className="rounded-lg p-4 flex-1"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>
        {label}
      </p>
      <p className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function StressTestPage() {
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [result, setResult] = useState<StressTestSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input controls
  const [rateBpsDelta, setRateBpsDelta] = useState<number>(200); // bp
  const [unemploymentIncrease, setUnemploymentIncrease] = useState<number>(0.05); // pct
  const [horizonMonths, setHorizonMonths] = useState<number>(12); // months

  useEffect(() => {
    const session = getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      router.replace('/');
      return;
    }
    setRoleChecked(true);
  }, [router]);

  useEffect(() => {
    if (!roleChecked) return;

    if (process.env.NEXT_PUBLIC_OPS_AUTH_MODE === 'demo') {
      setLoans([
        { id: '1', loanNumber: 'LN-001', principal: 4500000, outstandingBalance: 3800000, apr: 0.18, termMonths: 24, remainingMonths: 18, dpd: 0, productType: 'personal', status: 'active', borrower: { monthlyIncome: 15000, monthlyExpenses: 8000 } },
        { id: '2', loanNumber: 'LN-002', principal: 12000000, outstandingBalance: 11400000, apr: 0.12, termMonths: 60, remainingMonths: 58, dpd: 0, productType: 'business', status: 'active', borrower: { monthlyIncome: 45000, monthlyExpenses: 22000 } },
        { id: '3', loanNumber: 'LN-003', principal: 2500000, outstandingBalance: 2200000, apr: 0.18, termMonths: 24, remainingMonths: 20, dpd: 0, productType: 'personal', status: 'active', borrower: { monthlyIncome: 12000, monthlyExpenses: 7000 } },
        { id: '4', loanNumber: 'LN-004', principal: 800000, outstandingBalance: 650000, apr: 0.36, termMonths: 12, remainingMonths: 8, dpd: 14, productType: 'short_term', status: 'active', borrower: { monthlyIncome: 8000, monthlyExpenses: 5000 } },
        { id: '5', loanNumber: 'LN-005', principal: 5000000, outstandingBalance: 4800000, apr: 0.24, termMonths: 36, remainingMonths: 35, dpd: 91, productType: 'personal', status: 'defaulted', borrower: { monthlyIncome: 18000, monthlyExpenses: 12000 } },
        { id: '6', loanNumber: 'LN-006', principal: 7500000, outstandingBalance: 5200000, apr: 0.18, termMonths: 48, remainingMonths: 32, dpd: 32, productType: 'business', status: 'active', borrower: { monthlyIncome: 32000, monthlyExpenses: 18000 } },
      ] as unknown as LoanItem[]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const headers = await buildOpsApiHeaders();
        const res = await fetch(`${API_BASE_URL}/api/v1/loans`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!res.ok) throw new Error('Failed to load loans');

        const data = (await res.json()) as { loans: LoanItem[] };
        setLoans(data.loans || []);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [roleChecked]);

  const handleRunStressTest = () => {
    if (loans.length === 0) {
      setError('No loans available for stress test');
      return;
    }

    try {
      const testResult = runStressTest({
        loans,
        rateBpsDelta,
        unemploymentIncrease,
        horizonMonths,
      });
      setResult(testResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stress test failed');
      setResult(null);
    }
  };

  if (!roleChecked) return null;

  return (
    <div
      className="w-screen min-h-screen py-8 px-4"
      style={{ background: '#000', color: 'var(--foreground)', minHeight: '100vh', width: '100vw' }}
    >
      {/* Disclaimer */}
      <div
        className="mb-6 p-4 rounded-lg"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          <strong style={{ color: 'var(--foreground)' }}>Disclaimer:</strong> This stress test is a simulation tool intended to estimate portfolio behavior under adverse scenarios. Results are probabilistic estimates based on historical patterns and loan characteristics. These projections should not be relied upon as actual forecasts. Use for scenario planning and risk management purposes only.
        </p>
      </div>

      <h1 className="text-2xl font-bold mb-8">Portfolio Stress Test</h1>

      {/* Left Panel: Input Controls */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[35%] flex flex-col gap-4">
          <div
            className="rounded-lg p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-lg font-semibold mb-4">Scenario Parameters</h2>

            {/* Interest Rate Delta */}
            <div className="mb-4">
              <label className="text-xs font-medium uppercase tracking-[0.18em] block mb-2" style={{ color: 'var(--color-muted)' }}>
                Interest Rate Change (bps)
              </label>
              <input
                type="number"
                value={rateBpsDelta}
                onChange={(e) => setRateBpsDelta(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                Change from current rates ({rateBpsDelta > 0 ? '+' : ''}{rateBpsDelta} bps)
              </p>
            </div>

            {/* Unemployment Increase */}
            <div className="mb-4">
              <label className="text-xs font-medium uppercase tracking-[0.18em] block mb-2" style={{ color: 'var(--color-muted)' }}>
                Unemployment Increase
              </label>
              <input
                type="number"
                value={unemploymentIncrease}
                onChange={(e) => setUnemploymentIncrease(Number(e.target.value))}
                step="0.01"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                Percentage point increase ({formatPct(unemploymentIncrease)})
              </p>
            </div>

            {/* Time Horizon */}
            <div className="mb-6">
              <label className="text-xs font-medium uppercase tracking-[0.18em] block mb-2" style={{ color: 'var(--color-muted)' }}>
                Time Horizon (months)
              </label>
              <input
                type="number"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(Number(e.target.value))}
                min="1"
                max="60"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                Projection period ({horizonMonths} months)
              </p>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunStressTest}
              disabled={loading || loans.length === 0}
              className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--color-secondary)',
                color: 'var(--color-secondary-fg)',
                cursor: loading || loans.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Loading loans...' : 'Run Stress Test'}
            </button>

            {error && (
              <div
                className="mt-4 p-3 rounded-lg text-sm"
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {error}
              </div>
            )}

            {loans.length > 0 && (
              <p className="text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
                {loans.length} loans loaded
              </p>
            )}
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="lg:w-[65%] flex flex-col gap-4">
          {result ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard
                  label="Active Loans"
                  value={result.activeLoanCount.toString()}
                />
                <SummaryCard
                  label="Total Outstanding"
                  value={formatMoney(result.totalOutstandingCents)}
                />
                <SummaryCard
                  label="Affordability Breaches"
                  value={result.affordabilityBreachCount.toString()}
                  subtext={formatPct(result.affordabilityBreachCount / result.activeLoanCount)}
                />
                <SummaryCard
                  label="Breach Exposure"
                  value={formatMoney(result.affordabilityBreachExposureCents)}
                />
                <SummaryCard
                  label="Est. Additional Defaults"
                  value={result.estimatedAdditionalDefaults.toString()}
                  subtext={formatPct(result.estimatedAdditionalDefaultPct)}
                />
                <SummaryCard
                  label="Provision Increase"
                  value={formatMoney(result.provisionIncreaseCents)}
                />
              </div>

              {/* DPD Distribution Chart */}
              <div
                className="rounded-lg p-6"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <h3 className="text-lg font-semibold mb-4">DPD Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={result.dpdDistribution}
                    margin={{ left: 30, right: 30, top: 10, bottom: 10 }}
                  >
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="current" name="Current" fill="#3B6D11" />
                    <Bar dataKey="projected" name="Projected" fill="#A32D2D" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div
              className="rounded-lg p-12 text-center flex-1 flex items-center justify-center"
              style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
            >
              <div>
                <p style={{ color: 'var(--color-muted)' }}>
                  Run stress test to view results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
