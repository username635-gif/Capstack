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
        <div className="bg-[#F1EFE8] border border-[#3B6D11] rounded p-3 text-xs text-[#3B6D11]">
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
    <div className="max-w-3xl mx-auto py-8 px-4">
      <ComplianceNotice />
      <h1 className="text-2xl font-bold mb-6">Fairness Report</h1>
      <div className="flex gap-2 mb-8">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`px-4 py-2 rounded-full border text-sm font-medium ${
              period === p.value
                ? "bg-[#3B6D11] text-white"
                : "bg-white text-[#3B6D11] border-[#3B6D11]"
            }`}
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
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 border">Band</th>
                  <th className="px-3 py-2 border">Applications</th>
                  <th className="px-3 py-2 border">Approval rate</th>
                  <th className="px-3 py-2 border">AI predicted default</th>
                  <th className="px-3 py-2 border">Actual default</th>
                  <th className="px-3 py-2 border">Variance</th>
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
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 border">Adviser</th>
                  <th className="px-3 py-2 border">Decisions</th>
                  <th className="px-3 py-2 border">Overrides</th>
                  <th className="px-3 py-2 border">Override rate</th>
                  <th className="px-3 py-2 border">Override approval rate</th>
                  <th className="px-3 py-2 border">Override default rate</th>
                  <th className="px-3 py-2 border">Flag</th>
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
