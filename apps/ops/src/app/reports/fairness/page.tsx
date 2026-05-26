"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend,
} from "recharts";
import { getSession } from "@/lib/session";
import { API_BASE_URL, buildOpsApiHeaders } from "@/lib/api-client";
import type {
  FairnessReport,
  FairnessPeriod,
  FairnessAdviserRow,
} from "@capstack/types";

const ALLOWED_ROLES = ["ADMIN", "CREDIT_OFFICER", "COMPLIANCE"];
const PERIODS: Array<{ label: string; value: FairnessPeriod }> = [
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "12 months", value: "12m" },
  { label: "All time", value: "all" },
];

const COLOR_PRIMARY = "#3B6D11";
const COLOR_ALERT = "#A32D2D";
const DEVIATION_THRESHOLD = 0.15;

function pctFormatter(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "";
}

function ComplianceNotice() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6">
      <button
        type="button"
        className="text-xs text-[#3B6D11] underline mb-1"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide compliance notice" : "Show compliance notice"}
      </button>
      {open && (
        <div
          className="rounded p-3 text-xs text-[#3B6D11]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          This report is produced to support fair lending obligations under the National Credit Act and the Promotion of Equality and Prevention of Unfair Discrimination Act. Data should be reviewed quarterly.
        </div>
      )}
    </div>
  );
}

export default function FairnessReportPage() {
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [period, setPeriod] = useState<FairnessPeriod>("90d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FairnessReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const DEMO_REPORT: FairnessReport = {
    approvalRateByProvince: [
      { province: "Gauteng", totalApplications: 450, approved: 310, approvalRate: 68.9, deviationFromMean: 2.1 },
      { province: "Western Cape", totalApplications: 280, approved: 201, approvalRate: 71.8, deviationFromMean: 5.0 },
      { province: "KwaZulu-Natal", totalApplications: 310, approved: 198, approvalRate: 63.9, deviationFromMean: -2.9 },
      { province: "Eastern Cape", totalApplications: 180, approved: 108, approvalRate: 60.0, deviationFromMean: -6.8 },
      { province: "Limpopo", totalApplications: 120, approved: 78, approvalRate: 65.0, deviationFromMean: -1.8 },
      { province: "Mpumalanga", totalApplications: 95, approved: 64, approvalRate: 67.4, deviationFromMean: 0.6 },
    ],
    approvalRateByIncomeBand: [
      { band: "under_5k", label: "Under R5K", totalApplications: 210, approved: 98, approvalRate: 46.7, defaultRate: 8.2 },
      { band: "5k_15k", label: "R5K–R15K", totalApplications: 480, approved: 312, approvalRate: 65.0, defaultRate: 4.1 },
      { band: "15k_30k", label: "R15K–R30K", totalApplications: 520, approved: 390, approvalRate: 75.0, defaultRate: 2.8 },
      { band: "over_30k", label: "Over R30K", totalApplications: 225, approved: 180, approvalRate: 80.0, defaultRate: 1.2 },
    ],
    scoreBandDistribution: [
      { band: "A", count: 180, approvalRate: 95.0, predictedDefaultRate: 1.2, actualDefaultRate: 1.0 },
      { band: "B", count: 320, approvalRate: 82.0, predictedDefaultRate: 3.5, actualDefaultRate: 3.8 },
      { band: "C", count: 410, approvalRate: 65.0, predictedDefaultRate: 6.8, actualDefaultRate: 7.1 },
      { band: "D", count: 280, approvalRate: 38.0, predictedDefaultRate: 12.0, actualDefaultRate: 11.4 },
      { band: "E", count: 145, approvalRate: 12.0, predictedDefaultRate: 22.0, actualDefaultRate: 24.1 },
    ],
    overrideAnalysisByAdviser: [
      { adviserId: "1", adviserName: "T. Mokoena", totalDecisions: 145, overrideCount: 18, overrideRate: 12.4, overrideApprovalRate: 72.0, overrideDefaultRate: 4.2, flagged: false },
      { adviserId: "2", adviserName: "S. Dlamini", totalDecisions: 98, overrideCount: 24, overrideRate: 24.5, overrideApprovalRate: 68.0, overrideDefaultRate: 6.8, flagged: true },
      { adviserId: "3", adviserName: "A. Pieterse", totalDecisions: 112, overrideCount: 14, overrideRate: 12.5, overrideApprovalRate: 78.0, overrideDefaultRate: 3.1, flagged: false },
    ],
    dateRange: { from: "2026-02-01", to: "2026-05-26" },
    generatedAt: new Date().toISOString(),
  };

  useEffect(() => {
    const session = getSession();
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      router.replace("/");
      return;
    }
    setRoleChecked(true);
  }, [router]);

  useEffect(() => {
    if (!roleChecked) return;

    if (process.env.NEXT_PUBLIC_OPS_AUTH_MODE === "demo") {
      setData(DEMO_REPORT);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const headers = await buildOpsApiHeaders();
        const res = await fetch(
          `${API_BASE_URL}/api/ops/reports/fairness?period=${period}`,
          { headers, signal: controller.signal, cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed to fetch report");
        const json = (await res.json()) as FairnessReport;
        setData(json);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to fetch report");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [period, roleChecked]);

  if (!roleChecked) return null;

  return (
    <div
      className="w-screen min-h-screen py-8 px-4"
      style={{ background: '#000', color: 'var(--foreground)', minHeight: '100vh', width: '100vw' }}
    >
      <ComplianceNotice />
      <h1 className="text-2xl font-bold mb-6">Fairness Report</h1>
      <div className="flex gap-2 mb-8">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className="px-4 py-2 rounded-full text-sm font-medium"
            style={{
              background: period === p.value ? "var(--color-primary)" : "var(--color-surface)",
              color: period === p.value ? "var(--color-primary-fg)" : "var(--foreground)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
            }}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {data && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Approval Rate by Province</h2>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={data.approvalRateByProvince}
              layout="vertical"
              margin={{ left: 60, right: 30, top: 10, bottom: 10 }}
            >
              <XAxis type="number" domain={[0, 1]} tickFormatter={pctFormatter} />
              <YAxis type="category" dataKey="province" width={120} />
              <Tooltip formatter={pctFormatter} />
              <Bar dataKey="approvalRate" isAnimationActive={false}>
                {data.approvalRateByProvince.map((entry) => (
                  <Cell
                    key={entry.province}
                    fill={
                      Math.abs(entry.deviationFromMean) > DEVIATION_THRESHOLD
                        ? COLOR_ALERT
                        : COLOR_PRIMARY
                    }
                  />
                ))}
                <LabelList
                  dataKey="approvalRate"
                  position="right"
                  formatter={pctFormatter}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#A32D2D]">
            Any province deviating more than {Math.round(DEVIATION_THRESHOLD * 100)}% from the mean approval rate may indicate a systemic bias. Review flagged segments.
          </div>
        </section>
      )}
      {data && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Approval and Default Rate by Income Band</h2>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={data.approvalRateByIncomeBand}
              margin={{ left: 30, right: 30, top: 10, bottom: 10 }}
            >
              <XAxis dataKey="label" />
              <YAxis domain={[0, 1]} tickFormatter={pctFormatter} />
              <Tooltip formatter={pctFormatter} />
              <Legend />
              <Bar dataKey="approvalRate" name="Approval Rate" fill={COLOR_PRIMARY}>
                <LabelList
                  dataKey="approvalRate"
                  position="top"
                  formatter={pctFormatter}
                />
              </Bar>
              <Bar dataKey="defaultRate" name="Default Rate" fill={COLOR_ALERT}>
                <LabelList
                  dataKey="defaultRate"
                  position="top"
                  formatter={pctFormatter}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
      {data && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">AI Score Band Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Band</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Applications</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Approval rate</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>AI predicted default</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Actual default</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {data.scoreBandDistribution.map((row) => {
                  const variance = row.actualDefaultRate - row.predictedDefaultRate;
                  let varianceColor = "";
                  if (variance > 0.02) varianceColor = "text-[#A32D2D] font-semibold";
                  else if (variance < 0) varianceColor = "text-[#3B6D11] font-semibold";
                  return (
                    <tr key={row.band}>
                      <td className="px-3 py-2 border text-center">{row.band}</td>
                      <td className="px-3 py-2 border text-center">{row.count}</td>
                      <td className="px-3 py-2 border text-center">{pctFormatter(row.approvalRate)}</td>
                      <td className="px-3 py-2 border text-center">{pctFormatter(row.predictedDefaultRate)}</td>
                      <td className="px-3 py-2 border text-center">{pctFormatter(row.actualDefaultRate)}</td>
                      <td className={`px-3 py-2 border text-center ${varianceColor}`}>
                        {variance > 0 ? "+" : ""}{(variance * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {data && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Override Analysis by Adviser</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Adviser</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Decisions</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Overrides</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Override rate</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Override approval rate</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Override default rate</th>
                  <th className="px-3 py-2" style={{ border: '1px solid var(--color-border)' }}>Flag</th>
                </tr>
              </thead>
              <tbody>
                {data.overrideAnalysisByAdviser
                  .slice()
                  .sort((a: FairnessAdviserRow, b: FairnessAdviserRow) => b.overrideRate - a.overrideRate)
                  .map((row) => (
                    <tr key={row.adviserId}>
                      <td className="px-3 py-2 border text-center">{row.adviserName}</td>
                      <td className="px-3 py-2 border text-center">{row.totalDecisions}</td>
                      <td className="px-3 py-2 border text-center">{row.overrideCount}</td>
                      <td className="px-3 py-2 border text-center">{pctFormatter(row.overrideRate)}</td>
                      <td className="px-3 py-2 border text-center">
                        {row.overrideCount > 0 ? pctFormatter(row.overrideApprovalRate) : "—"}
                      </td>
                      <td className="px-3 py-2 border text-center">
                        {row.overrideCount > 0 ? pctFormatter(row.overrideDefaultRate) : "—"}
                      </td>
                      <td className="px-3 py-2 border text-center">
                        {row.flagged ? (
                          <span className="inline-block px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                            Monitor
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
