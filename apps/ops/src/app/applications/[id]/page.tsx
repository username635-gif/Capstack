"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

// Design tokens (Tailwind classes follow the spec colours)
type AIDecision = "approved" | "declined" | "escalated" | "manual_review";

type AIOutput = {
  decision: AIDecision;
  confidence: number;
  scoreband: "A" | "B" | "C" | "D" | "E";
  reasoning: string[];
  modelVersion: string;
  processedAt: string;
  overridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
};

type ModelHealth = {
  overrideRate: number;
  overrideRateThreshold: number;
  approvalRate: number;
  defaultRate: number;
  aiVsHumanAccuracy?: number;
  drift: "stable" | "watch" | "alert";
  lastCalibrated: string;
};

type ApplicationRes = {
  id: string;
  borrower: { id: string; fullName?: string; email?: string; idNumber?: string } | null;
  product?: { name?: string } | null;
  amountRequested: number;
  termDaysRequested?: number;
  submittedAt: string;
  status: string;
  aiOutput?: AIOutput | null;
  audit?: { actor: string; action: string; when: string; payload?: unknown }[];
};

const SkeletonTable = ({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) => (
  <div className="animate-pulse p-6 space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-4 bg-[#F1EFE8] rounded flex-1" />
        ))}
      </div>
    ))}
  </div>
);

const ErrorState = ({ message, onRetry, lastSuccessful }: { message: string; onRetry: () => void; lastSuccessful?: string | null }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <AlertCircle className="text-[#A32D2D]" size={22} />
    <p className="text-[13px] text-[#5F5E5A]">{message}</p>
    {lastSuccessful && (
      <p className="text-[11px] text-[#888780]">Last successful load: {lastSuccessful}</p>
    )}
    <button onClick={onRetry} className="px-4 py-1.5 text-[13px] border border-[rgba(0,0,0,0.10)] rounded-lg hover:bg-[#F8F8F7] text-[#1A1A18]">
      Retry
    </button>
  </div>
);

function Pill({ variant = "gray", children }: { variant?: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    green: "bg-[#EAF3DE] text-[#3B6D11] border-[#639922]",
    amber: "bg-[#FAEEDA] text-[#854F0B] border-[#EF9F27]",
    red: "bg-[#FCEBEB] text-[#A32D2D] border-[#E24B4A]",
    blue: "bg-[#E6F1FB] text-[#185FA5] border-[#378ADD]",
    purple: "bg-[#F0EAFB] text-[#5B2D8E] border-[#9B6DD1]",
    gray: "bg-[#F1EFE8] text-[#5F5E5A] border-[rgba(0,0,0,0.10)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}

export default function ApplicationDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [data, setData] = useState<ApplicationRes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setIsError(false);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/applications/${id}`);
      if (!res.ok) throw new Error('fetch failed');
      const payload = await res.json();
      // normalize minimal shape
      const app = payload?.data ? payload.data : payload;
      setData(app as ApplicationRes);
      setLastSuccess(new Date().toLocaleString());
    } catch (err) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  if (isLoading) return <SkeletonTable rows={6} cols={4} />;
  if (isError) return <ErrorState message="Unable to load data." onRetry={fetchData} lastSuccessful={lastSuccess} />;
  if (!data) return <div className="p-6">No records match the current filter.</div>;

  const ai = data.aiOutput;

  const confidenceColor = (n: number) => (n >= 80 ? 'green' : n >= 60 ? 'amber' : 'red');

  return (
    <div className="min-h-screen flex bg-[#F1EFE8] text-[#1A1A18]">
      <aside className="w-52 p-4 border-r border-[rgba(0,0,0,0.10)]">
        <div className="font-medium text-[15px]">Capstack Ops</div>
        <div className="text-[13px] text-[#888780] mt-1">Internal ops console</div>
        <nav className="mt-6 space-y-2 text-[13px]">
          <div className="text-[#185FA5]">Applications</div>
          <div className="text-[#5F5E5A]">Loans</div>
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[15px] font-medium">Application {data.id}</h1>
            <div className="text-[12px] text-[#888780]">Submitted {new Date(data.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Live</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="px-3 py-1.5 bg-white border border-[rgba(0,0,0,0.10)] rounded-lg">Back</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <section className="col-span-2 bg-white rounded-lg p-4 border border-[rgba(0,0,0,0.10)]">
            <h2 className="text-[13px] font-medium mb-3">Borrower profile</h2>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[11px] text-[#888780]">Name</div>
                <div className="font-medium">{data.borrower?.fullName ?? 'Borrower record'}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#888780]">ID / Passport</div>
                <div className="font-medium">{data.borrower?.idNumber ?? '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#888780]">Contact</div>
                <div className="font-medium">{data.borrower?.email ?? '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#888780]">Requested</div>
                <div className="font-medium">R {(data.amountRequested / 100).toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-[13px] font-medium mb-2">Document checklist</h3>
              <ul className="text-[13px] space-y-1">
                <li>ID ✓</li>
                <li>Payslip ✓</li>
                <li>Bank statement ✓</li>
                <li>Proof of address ✗</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-[13px] font-medium mb-2">Bureau / credit</h3>
              <div className="text-[13px]">Score: <span className="font-medium">712</span></div>
              <div className="text-[13px]">Adverse: None</div>
              <div className="text-[13px]">DTI: <span className="font-medium">38%</span></div>
            </div>
          </section>

          <aside className="col-span-1 bg-white rounded-lg p-4 border border-[rgba(0,0,0,0.10)]">
            <h3 className="text-[13px] font-medium mb-3">AI Decision</h3>
            {ai ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Pill variant="purple">{ai.decision === 'approved' ? 'AI approved' : ai.decision === 'declined' ? 'AI declined' : 'AI escalated'}</Pill>
                  <div className="text-[11px] text-[#888780]">Model: {ai.modelVersion}</div>
                </div>

                <div>
                  <div className="text-[11px] text-[#888780]">Confidence</div>
                  <div className="w-full h-3 bg-[#F8F8F7] rounded mt-1">
                    <div style={{ width: `${ai.confidence}%` }} className={`h-3 rounded ${confidenceColor(ai.confidence) === 'green' ? 'bg-[#3B6D11]' : confidenceColor(ai.confidence) === 'amber' ? 'bg-[#854F0B]' : 'bg-[#A32D2D]'}`} />
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-[#888780]">Score band</div>
                  <Pill variant="purple">{ai.scoreband}</Pill>
                </div>

                <div>
                  <div className="text-[11px] text-[#888780]">Reasoning</div>
                  <ol className="list-decimal list-inside text-[13px] ml-2">
                    {ai.reasoning.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                  </ol>
                </div>

                <div className="pt-2 border-t border-[rgba(0,0,0,0.05)]"> 
                  <div className="text-[11px] text-[#888780]">Offer terms</div>
                  <div className="mt-2 text-[13px]">
                    <div>Amount: R {(data.amountRequested / 100).toLocaleString()}</div>
                    <div>Term: {data.termDaysRequested ? Math.round(data.termDaysRequested / 30) : '—'} months</div>
                    <div>Rate: {(ai.decision === 'approved' ? 18 : 0)}% APR</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 bg-[#EAF3DE] text-[#3B6D11] rounded-lg">Approve & disburse</button>
                  <button className="px-3 py-1.5 bg-[#F1EFE8] text-[#5F5E5A] rounded-lg">Override decision</button>
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-[#888780]">No AI output available.</div>
            )}
          </aside>
        </div>

        <div className="mt-6 bg-white rounded-lg p-4 border border-[rgba(0,0,0,0.10)]">
          <h3 className="text-[13px] font-medium mb-3">Audit trail</h3>
          {data.audit && data.audit.length ? (
            <ul className="space-y-2 text-[13px]">
              {data.audit.map((e, i) => (
                <li key={i} className="text-[13px]">{new Date(e.when).toLocaleString()} — {e.actor} — {e.action}</li>
              ))}
            </ul>
          ) : (
            <div className="text-[13px] text-[#888780]">No audit events yet.</div>
          )}
        </div>
      </main>
    </div>
  );
}
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OpsLayout from '@/app/_components/OpsLayout';
import { API_BASE_URL as API, buildOpsApiHeaders } from '@/lib/api-client';

type WorkflowStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PENDING_DISBURSEMENT';
type SlaStatus = 'WITHIN_SLA' | 'BREACH_SOON' | 'BREACHED';

type ApplicationDetail = {
  id: string;
  referenceNumber: string;
  status: string;
  workflowStatus: WorkflowStatus;
  amountRequested: number;
  termDaysRequested: number;
  submittedAt: string;
  decidedAt?: string | null;
  purpose?: string | null;
  channel: string;
  canApprove: boolean;
  canReject: boolean;
  borrower: {
    id: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
    displayName: string;
    email: string;
    phone: string;
    riskRating?: string | null;
    blacklistFlag: boolean;
    individual?: {
      fullName: string;
      idNumber: string;
      dateOfBirth: string;
      monthlyIncome?: number | null;
      employmentStatus?: string | null;
      employer?: string | null;
      occupation?: string | null;
      nationality?: string | null;
    } | null;
    business?: {
      legalName: string;
      tradingName?: string | null;
      registrationNumber: string;
      industry?: string | null;
      founded?: string | null;
      monthlyTurnover?: number | null;
      numberOfEmployees?: number | null;
    } | null;
  };
  product: {
    id: string;
    name: string;
    minAmount: number;
    maxAmount: number;
    minTermDays: number;
    maxTermDays: number;
    defaultAprBps?: number | null;
    amortizationMethod?: string | null;
  };
  loan?: {
    id: string;
    status: string;
    loanNumber: string;
    principal: number;
    aprBps: number;
    termDays: number;
    startDate: string;
    maturityDate: string;
    disbursedAt?: string | null;
    outstandingPrincipal: number;
    outstandingInterest: number;
    outstandingFees: number;
  } | null;
  latestDecision?: {
    id: string;
    modelVersion?: string | null;
    pdScore: number;
    lgdScore: number;
    expectedLoss: number;
    riskBand: string;
    recommendation: string;
    approvedAmount?: number | null;
    approvedTermDays?: number | null;
    approvedAprBps?: number | null;
    reasonCodes: string[];
    policyExceptions: string[];
    createdAt: string;
    decisionMaker?: { fullName: string; role: string } | null;
  } | null;
  underwriting: {
    recommendation?: string | null;
    modelVersion?: string | null;
    riskBand?: string | null;
    riskScore?: number | null;
    confidencePct?: number | null;
    pdScore?: number | null;
    lgdScore?: number | null;
    expectedLoss?: number | null;
    reasonCodes: string[];
    topFactors: string[];
    policyExceptions: string[];
    recommendedOffer: {
      amountCents: number;
      termDays: number;
      aprBps: number;
      estimatedInstallmentCents: number;
    };
  };
  affordability: {
    source: 'BANK_TRANSACTIONS' | 'DECLARED_INCOME' | 'TURNOVER_FALLBACK' | 'UNAVAILABLE';
    monthlyIncomeCents?: number | null;
    monthlyExpensesCents?: number | null;
    monthlyObligationsCents?: number | null;
    requestedInstallmentCents?: number | null;
    disposableIncomeCents?: number | null;
    headroomCents?: number | null;
    dtiPct?: number | null;
    canAfford: boolean | null;
    ncaStatus: 'PASS' | 'FAIL' | 'REVIEW';
    avgMonthlyCreditsCents?: number | null;
    avgMonthlyDebitsCents?: number | null;
    bankStatementsTotal: number;
    bankStatementsVerified: number;
    parsedDocumentCount: number;
    lastStatementAt?: string | null;
  };
  compliance: {
    kycStatus: string;
    kycChecks: Array<{
      id: string;
      type: string;
      provider: string;
      status: string;
      outcome?: string | null;
      failureReason?: string | null;
      createdAt: string;
      completedAt?: string | null;
    }>;
    amlRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    amlAlerts: Array<{
      id: string;
      type: string;
      severity: string;
      status: string;
      details: unknown;
      filedSar: boolean;
      createdAt: string;
    }>;
    bureau: {
      status: 'PULLED' | 'FAILED' | 'PENDING' | 'CONSENT_REQUIRED' | 'UNAVAILABLE';
      lastPulledAt?: string | null;
      provider?: string | null;
      bureauScore?: number | null;
      defaultCount?: number | null;
      judgementCount?: number | null;
      enquiryCount?: number | null;
      totalExposure?: number | null;
      monthlyObligations?: number | null;
      currentAccounts: Array<Record<string, unknown>>;
      failureReason?: string | null;
    };
  };
  workflow: {
    assignee?: string | null;
    assignedAt?: string | null;
    ageHours: number;
    slaStatus: SlaStatus;
    approvalTier: 'AI_AUTO_ELIGIBLE' | 'ADVISOR_REVIEW' | 'MANAGER_SIGN_OFF';
    noteCount: number;
    latestNote?: string | null;
  };
  notes: Array<{
    id: string;
    actor: string;
    createdAt: string;
    note: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    actor: string;
    payload: unknown;
    createdAt: string;
  }>;
  auditTrail: Array<{
    id: string;
    actor: string;
    actorType: string;
    action: string;
    before: unknown;
    after: unknown;
    createdAt: string;
  }>;
  communications: Array<{
    id: string;
    type: string;
    channel: string;
    subject?: string | null;
    body: string;
    status: string;
    externalRef?: string | null;
    createdAt: string;
    sentAt?: string | null;
  }>;
  bankAnalysis: {
    linkedAccountCount: number;
    verifiedAccountCount: number;
    statementCount: number;
    verifiedStatementCount: number;
    avgMonthlyCreditsCents?: number | null;
    avgMonthlyDebitsCents?: number | null;
    lastStatementAt?: string | null;
    parsedDocumentCount: number;
  };
};

const STATUS_COLORS: Record<WorkflowStatus, { bg: string; fg: string }> = {
  SUBMITTED: { bg: 'var(--badge-pending-bg)', fg: 'var(--badge-pending-fg)' },
  APPROVED: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  REJECTED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
  PENDING_DISBURSEMENT: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
};

const SLA_COLORS: Record<SlaStatus, { bg: string; fg: string }> = {
  WITHIN_SLA: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  BREACH_SOON: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
  BREACHED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
};

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatCurrency(cents?: number | null) {
  if (cents == null) return '—';
  return `R ${(cents / 100).toLocaleString('en-ZA')}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-ZA') : '—';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-ZA') : '—';
}

function formatTerm(termDays: number) {
  if (termDays % 30 === 0) return `${termDays / 30} months`;
  if (termDays % 7 === 0) return `${termDays / 7} weeks`;
  return `${termDays} days`;
}

function formatBps(bps?: number | null) {
  return bps == null ? '—' : `${(bps / 100).toFixed(2)}%`;
}

function formatRatio(value?: number | null) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function summarizePayload(payload: unknown) {
  if (payload == null) return 'No additional payload';
  if (typeof payload !== 'object') return String(payload);
  if (Array.isArray(payload)) return payload.map((item) => String(item)).join(', ');

  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) return 'No additional payload';

  return entries.map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
    if (value && typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
    return `${key}: ${String(value)}`;
  }).join(' · ');
}

function formatAge(ageHours: number) {
  if (ageHours >= 24) {
    const days = Math.floor(ageHours / 24);
    const hours = ageHours % 24;
    return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
  }

  return `${ageHours}h`;
}

function buildBankStatementNarrative(data: ApplicationDetail) {
  const signals: string[] = [];

  if (data.bankAnalysis.verifiedAccountCount > 0) {
    signals.push(`${data.bankAnalysis.verifiedAccountCount} verified bank account${data.bankAnalysis.verifiedAccountCount === 1 ? '' : 's'} linked`);
  } else if (data.bankAnalysis.linkedAccountCount > 0) {
    signals.push(`${data.bankAnalysis.linkedAccountCount} linked account${data.bankAnalysis.linkedAccountCount === 1 ? '' : 's'} pending verification`);
  } else {
    signals.push('No linked bank accounts available yet');
  }

  if (data.bankAnalysis.statementCount > 0) {
    signals.push(`${data.bankAnalysis.verifiedStatementCount}/${data.bankAnalysis.statementCount} statements verified`);
  } else {
    signals.push('No bank statements uploaded');
  }

  if (data.bankAnalysis.avgMonthlyCreditsCents != null) {
    signals.push(`average monthly credits ${formatCurrency(data.bankAnalysis.avgMonthlyCreditsCents)}`);
  }

  if (data.bankAnalysis.avgMonthlyDebitsCents != null) {
    signals.push(`average monthly debits ${formatCurrency(data.bankAnalysis.avgMonthlyDebitsCents)}`);
  }

  if (data.bankAnalysis.parsedDocumentCount > 0) {
    signals.push(`${data.bankAnalysis.parsedDocumentCount} parsed document${data.bankAnalysis.parsedDocumentCount === 1 ? '' : 's'} available for extraction`);
  }

  return signals;
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);
  const [busy, setBusy] = useState<'bureau' | 'assign' | 'note' | 'document' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewRationale, setReviewRationale] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [documentRequest, setDocumentRequest] = useState('Please upload your latest payslip and 3 months of bank statements.');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadApplication() {
      setLoading(true);
      setError(null);

      try {
        const headers = await buildOpsApiHeaders();
        const response = await fetch(`${API}/api/v1/applications/${id}`, {
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as (ApplicationDetail & { error?: string }) | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Unable to load application.');
        }

        if (controller.signal.aborted) return;
        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load application.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadApplication();

    return () => {
      controller.abort();
    };
  }, [id, refreshKey]);

  useEffect(() => {
    setAssignedTo(data?.workflow.assignee ?? '');
  }, [data?.id, data?.workflow.assignee]);

  async function act(action: 'approve' | 'reject') {
    if (!data) return;

    const overrideReason = action === 'approve'
      ? data.underwriting.recommendation && data.underwriting.recommendation !== 'APPROVE'
        ? reviewRationale.trim() || 'Manual approval overrides the latest AI recommendation.'
        : undefined
      : data.underwriting.recommendation && data.underwriting.recommendation !== 'DECLINE'
        ? reviewRationale.trim() || 'Manual decline overrides the latest AI recommendation.'
        : undefined;

    setActing(action);
    setError(null);
    setNotice(null);

    try {
      const headers = await buildOpsApiHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API}/api/v1/applications/${data.id}/${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rationale: reviewRationale.trim() || (action === 'approve' ? 'Approved from the enterprise review workspace.' : 'Declined from the enterprise review workspace.'),
          reason: action === 'reject' ? (reviewRationale.trim() || 'Application declined from the enterprise review workspace.') : undefined,
          reasonCodes: action === 'reject' ? ['OPS_WORKSPACE_DECISION'] : undefined,
          overrideReason,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Unable to ${action} application.`);
      }

      setNotice(action === 'approve' ? 'Application approved and logged.' : 'Application declined and logged.');
      setReviewRationale('');
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Unable to ${action} application.`);
    } finally {
      setActing(null);
    }
  }

  async function runBureauPull() {
    if (!data) return;

    setBusy('bureau');
    setError(null);
    setNotice(null);

    try {
      const headers = await buildOpsApiHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API}/api/v1/applications/${data.id}/bureau-pull`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to run bureau pull.');
      }

      setNotice('Bureau pull completed and attached to the application audit trail.');
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to run bureau pull.');
    } finally {
      setBusy(null);
    }
  }

  async function submitEvent(type: 'ASSIGNED' | 'NOTE_ADDED' | 'DOCUMENT_REQUESTED', payload: Record<string, unknown>, successMessage: string) {
    if (!data) return;

    const stateKey = type === 'ASSIGNED' ? 'assign' : type === 'NOTE_ADDED' ? 'note' : 'document';
    setBusy(stateKey);
    setError(null);
    setNotice(null);

    try {
      const headers = await buildOpsApiHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API}/api/v1/applications/${data.id}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type,
          payload,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? 'Unable to update application workflow.');
      }

      if (type === 'NOTE_ADDED') setNoteDraft('');
      if (type === 'DOCUMENT_REQUESTED') setDocumentRequest('');
      setNotice(successMessage);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update application workflow.');
    } finally {
      setBusy(null);
    }
  }

  const borrowerItems: [string, string][] = data ? (data.borrower.type === 'BUSINESS'
    ? [
        ['Legal name', data.borrower.business?.legalName ?? data.borrower.displayName],
        ['Trading name', data.borrower.business?.tradingName ?? '—'],
        ['Registration', data.borrower.business?.registrationNumber ?? '—'],
        ['Email', data.borrower.email],
        ['Phone', data.borrower.phone],
        ['Industry', data.borrower.business?.industry ?? '—'],
        ['Founded', formatDate(data.borrower.business?.founded)],
        ['Monthly turnover', formatCurrency(data.borrower.business?.monthlyTurnover)],
        ['Employees', data.borrower.business?.numberOfEmployees?.toString() ?? '—'],
        ['Risk rating', data.borrower.riskRating ?? '—'],
        ['Blacklist flag', data.borrower.blacklistFlag ? 'Yes' : 'No'],
      ]
    : [
        ['Name', data.borrower.individual?.fullName ?? data.borrower.displayName],
        ['Email', data.borrower.email],
        ['Phone', data.borrower.phone],
        ['ID number', data.borrower.individual?.idNumber ?? '—'],
        ['Date of birth', formatDate(data.borrower.individual?.dateOfBirth)],
        ['Employment', data.borrower.individual?.employmentStatus ?? '—'],
        ['Employer', data.borrower.individual?.employer ?? '—'],
        ['Occupation', data.borrower.individual?.occupation ?? '—'],
        ['Monthly income', formatCurrency(data.borrower.individual?.monthlyIncome)],
        ['Nationality', data.borrower.individual?.nationality ?? '—'],
        ['Risk rating', data.borrower.riskRating ?? '—'],
        ['Blacklist flag', data.borrower.blacklistFlag ? 'Yes' : 'No'],
      ]) : [];

  return (
    <OpsLayout title="Application Review">
      {loading && !data && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading application workspace…</p>}
      {error && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}
      {notice && <p className="text-sm" style={{ color: 'var(--badge-approved-fg)' }}>{notice}</p>}

      {data && (
        <div className="max-w-6xl flex flex-col gap-6">
          <div
            className="rounded-2xl p-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                Application · {data.referenceNumber}
              </div>
              <div className="text-3xl font-black">{formatCurrency(data.amountRequested)}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                {data.product.name} · {formatTerm(data.termDaysRequested)}
                {data.purpose ? ` · ${data.purpose}` : ''}
              </div>
              <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                Submitted {formatDateTime(data.submittedAt)} · Channel {formatStatus(data.channel)} · Owner {data.workflow.assignee ?? 'Unassigned'}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-2">
              <span className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: STATUS_COLORS[data.workflowStatus].bg, color: STATUS_COLORS[data.workflowStatus].fg }}>
                {formatStatus(data.workflowStatus)}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: SLA_COLORS[data.workflow.slaStatus].bg, color: SLA_COLORS[data.workflow.slaStatus].fg }}>
                {data.workflow.slaStatus === 'WITHIN_SLA' ? 'Within SLA' : data.workflow.slaStatus === 'BREACH_SOON' ? 'SLA watch' : 'SLA breached'}
              </span>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Age {formatAge(data.workflow.ageHours)} · Tier {formatStatus(data.workflow.approvalTier)}
              </div>
              {data.decidedAt && (
                <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Decided {formatDateTime(data.decidedAt)}
                </div>
              )}
            </div>
          </div>

          <Card title="Human Override & Decision Controls">
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted)' }}>
                  Human override reason
                </label>
                <textarea
                  value={reviewRationale}
                  onChange={(event) => setReviewRationale(event.target.value)}
                  placeholder="Capture why you are agreeing with or overriding the AI recommendation. This is written into the decision audit trail."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                />
                <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                  Use this field whenever a human reviewer changes the AI-recommended outcome or wants to add decision context for audit.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {data.canApprove && (
                  <button
                    onClick={() => act('approve')}
                    disabled={acting !== null}
                    className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none' }}
                  >
                    {acting === 'approve' ? 'Approving…' : 'Approve with audit log'}
                  </button>
                )}
                {data.canReject && (
                  <button
                    onClick={() => act('reject')}
                    disabled={acting !== null}
                    className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)', border: 'none' }}
                  >
                    {acting === 'reject' ? 'Declining…' : 'Decline with audit log'}
                  </button>
                )}
                <button
                  onClick={runBureauPull}
                  disabled={busy === 'bureau'}
                  className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}
                >
                  {busy === 'bureau' ? 'Pulling bureau…' : 'Run bureau pull'}
                </button>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="AI Decisioning">
              <Grid items={[
                ['Recommendation', data.underwriting.recommendation ?? 'Pending'],
                ['Risk score', data.underwriting.riskScore != null ? `${data.underwriting.riskScore}/1000` : '—'],
                ['Confidence', data.underwriting.confidencePct != null ? `${data.underwriting.confidencePct}%` : '—'],
                ['Risk band', data.underwriting.riskBand ?? '—'],
                ['PD score', data.underwriting.pdScore != null ? `${(data.underwriting.pdScore * 100).toFixed(1)}%` : '—'],
                ['LGD score', data.underwriting.lgdScore != null ? `${(data.underwriting.lgdScore * 100).toFixed(1)}%` : '—'],
                ['Expected loss', data.underwriting.expectedLoss != null ? data.underwriting.expectedLoss.toFixed(3) : '—'],
                ['Model version', data.underwriting.modelVersion ?? '—'],
                ['Recommended amount', formatCurrency(data.underwriting.recommendedOffer.amountCents)],
                ['Recommended term', formatTerm(data.underwriting.recommendedOffer.termDays)],
                ['Recommended APR', formatBps(data.underwriting.recommendedOffer.aprBps)],
                ['Instalment estimate', formatCurrency(data.underwriting.recommendedOffer.estimatedInstallmentCents)],
              ]} />

              {data.underwriting.topFactors.length > 0 && (
                <SectionList title="Top decision factors" items={data.underwriting.topFactors} />
              )}

              {data.underwriting.reasonCodes.length > 0 && (
                <SectionList title="Reason codes" items={data.underwriting.reasonCodes} />
              )}

              {data.underwriting.policyExceptions.length > 0 && (
                <SectionList title="Policy exceptions" items={data.underwriting.policyExceptions} />
              )}

              {data.latestDecision?.decisionMaker && (
                <div className="text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
                  Last human decision: {data.latestDecision.decisionMaker.fullName} · {formatStatus(data.latestDecision.decisionMaker.role)}
                </div>
              )}
            </Card>

            <Card title="NCA Affordability Assessment">
              <Grid items={[
                ['Assessment source', formatStatus(data.affordability.source)],
                ['Monthly income', formatCurrency(data.affordability.monthlyIncomeCents)],
                ['Monthly expenses', formatCurrency(data.affordability.monthlyExpensesCents)],
                ['Monthly obligations', formatCurrency(data.affordability.monthlyObligationsCents)],
                ['Requested instalment', formatCurrency(data.affordability.requestedInstallmentCents)],
                ['Disposable income', formatCurrency(data.affordability.disposableIncomeCents)],
                ['Headroom after commitments', formatCurrency(data.affordability.headroomCents)],
                ['Debt-to-income ratio', formatRatio(data.affordability.dtiPct)],
                ['NCA outcome', data.affordability.ncaStatus],
                ['Affordability result', data.affordability.canAfford == null ? 'Review' : data.affordability.canAfford ? 'Pass' : 'Fail'],
                ['Avg monthly credits', formatCurrency(data.affordability.avgMonthlyCreditsCents)],
                ['Avg monthly debits', formatCurrency(data.affordability.avgMonthlyDebitsCents)],
                ['Statements verified', `${data.affordability.bankStatementsVerified}/${data.affordability.bankStatementsTotal}`],
                ['Parsed documents', String(data.affordability.parsedDocumentCount)],
                ['Latest statement', formatDate(data.affordability.lastStatementAt)],
              ]} />

              <div className="text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
                This section is the internal NCA affordability view: debt-to-income, disposable income, headroom, and statement-backed affordability source.
              </div>
            </Card>

            <Card title="Bank Statement AI Analysis">
              <Grid items={[
                ['Linked accounts', String(data.bankAnalysis.linkedAccountCount)],
                ['Verified accounts', String(data.bankAnalysis.verifiedAccountCount)],
                ['Statement coverage', `${data.bankAnalysis.verifiedStatementCount}/${data.bankAnalysis.statementCount} verified`],
                ['Average monthly income signal', formatCurrency(data.bankAnalysis.avgMonthlyCreditsCents)],
                ['Average monthly expense signal', formatCurrency(data.bankAnalysis.avgMonthlyDebitsCents)],
                ['Latest statement', formatDate(data.bankAnalysis.lastStatementAt)],
                ['Parsed supporting documents', String(data.bankAnalysis.parsedDocumentCount)],
                ['AI extraction status', data.bankAnalysis.statementCount > 0 || data.bankAnalysis.parsedDocumentCount > 0 ? 'Structured inputs available' : 'Awaiting documents'],
              ]} />

              <SectionList title="Statement-driven signals" items={buildBankStatementNarrative(data)} />
            </Card>

            <Card title="Compliance & Bureau">
              <Grid items={[
                ['KYC pipeline', formatStatus(data.compliance.kycStatus)],
                ['AML risk', data.compliance.amlRisk],
                ['Bureau status', formatStatus(data.compliance.bureau.status)],
                ['Bureau provider', data.compliance.bureau.provider ?? '—'],
                ['Bureau score', data.compliance.bureau.bureauScore?.toString() ?? '—'],
                ['Defaults on file', data.compliance.bureau.defaultCount?.toString() ?? '—'],
                ['Judgements', data.compliance.bureau.judgementCount?.toString() ?? '—'],
                ['Recent enquiries', data.compliance.bureau.enquiryCount?.toString() ?? '—'],
                ['Total exposure', data.compliance.bureau.totalExposure != null ? `R ${data.compliance.bureau.totalExposure.toLocaleString('en-ZA')}` : '—'],
                ['Monthly obligations', data.compliance.bureau.monthlyObligations != null ? `R ${data.compliance.bureau.monthlyObligations.toLocaleString('en-ZA')}` : '—'],
                ['Last bureau pull', formatDateTime(data.compliance.bureau.lastPulledAt)],
                ['Failure reason', data.compliance.bureau.failureReason ?? '—'],
              ]} />

              {data.compliance.kycChecks.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>KYC checks</div>
                  {data.compliance.kycChecks.map((check) => (
                    <div key={check.id} className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                      <div className="font-semibold">{formatStatus(check.type)} · {formatStatus(check.status)}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                        {check.provider} · Created {formatDateTime(check.createdAt)} · Completed {formatDateTime(check.completedAt)}
                      </div>
                      {(check.outcome || check.failureReason) && (
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          {check.outcome ?? check.failureReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {data.compliance.amlAlerts.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>AML alerts</div>
                  {data.compliance.amlAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                      <div className="font-semibold">{alert.type} · {alert.severity}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                        {formatDateTime(alert.createdAt)} · SAR filed {alert.filedSar ? 'Yes' : 'No'}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                        {summarizePayload(alert.details)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.compliance.bureau.currentAccounts.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Tradelines</div>
                  {data.compliance.bureau.currentAccounts.map((account, index) => (
                    <div key={`${String(account.lender ?? 'account')}-${index}`} className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                      <div className="font-semibold">{String(account.lender ?? 'Credit account')} · {String(account.accountType ?? 'Unknown type')}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                        Outstanding R {Number(account.outstandingBalance ?? 0).toLocaleString('en-ZA')} · Monthly payment R {Number(account.monthlyPayment ?? 0).toLocaleString('en-ZA')} · Arrears {String(account.arrearsMonths ?? 0)} months
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Workflow & Collaboration">
              <div className="flex flex-col gap-4">
                <Grid items={[
                  ['Assignee', data.workflow.assignee ?? 'Unassigned'],
                  ['Assigned at', formatDateTime(data.workflow.assignedAt)],
                  ['Approval tier', formatStatus(data.workflow.approvalTier)],
                  ['SLA age', formatAge(data.workflow.ageHours)],
                  ['Latest note', data.workflow.latestNote ?? '—'],
                  ['Internal note count', String(data.workflow.noteCount)],
                ]} />

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted)' }}>
                    Assign application owner
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={assignedTo}
                      onChange={(event) => setAssignedTo(event.target.value)}
                      placeholder="Enter the reviewer or team name"
                      className="flex-1 rounded-xl px-4 py-3 text-sm"
                      style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                    />
                    <button
                      onClick={() => submitEvent('ASSIGNED', { assignee: assignedTo, queue: 'underwriting' }, 'Application owner updated.')}
                      disabled={busy === 'assign'}
                      className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
                    >
                      {busy === 'assign' ? 'Saving…' : 'Assign'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted)' }}>
                    Internal note
                  </label>
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Capture reviewer context, policy discussions, or escalation notes."
                    rows={3}
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={() => submitEvent('NOTE_ADDED', { note: noteDraft }, 'Internal note added.')}
                    disabled={busy === 'note'}
                    className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-surface)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}
                  >
                    {busy === 'note' ? 'Adding note…' : 'Add note'}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--color-muted)' }}>
                    Document request message
                  </label>
                  <textarea
                    value={documentRequest}
                    onChange={(event) => setDocumentRequest(event.target.value)}
                    placeholder="Request missing documents from the borrower and keep the request logged inside the platform."
                    rows={3}
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={() => submitEvent('DOCUMENT_REQUESTED', { message: documentRequest, channel: 'EMAIL' }, 'Document request logged and queued for borrower communication.')}
                    disabled={busy === 'document'}
                    className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--color-surface)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}
                  >
                    {busy === 'document' ? 'Requesting documents…' : 'Request documents'}
                  </button>
                </div>

                {data.notes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Recent notes</div>
                    {data.notes.map((note) => (
                      <div key={note.id} className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                        <div className="font-semibold">{note.actor}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{formatDateTime(note.createdAt)}</div>
                        <div className="text-sm mt-2">{note.note}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Borrower Information">
              <Grid items={borrowerItems} />
            </Card>

            <Card title="Product & Application Terms">
              <Grid items={[
                ['Product', data.product.name],
                ['Requested amount', formatCurrency(data.amountRequested)],
                ['Requested term', formatTerm(data.termDaysRequested)],
                ['Product amount band', `${formatCurrency(data.product.minAmount)} - ${formatCurrency(data.product.maxAmount)}`],
                ['Product term band', `${formatTerm(data.product.minTermDays)} - ${formatTerm(data.product.maxTermDays)}`],
                ['Default APR', formatBps(data.product.defaultAprBps)],
                ['Amortization', formatStatus(data.product.amortizationMethod ?? 'EQUAL_INSTALLMENT')],
                ['Purpose', data.purpose ?? '—'],
                ['Channel', formatStatus(data.channel)],
              ]} />
            </Card>

            {data.loan && (
              <Card title="Loan Record">
                <Grid items={[
                  ['Loan number', data.loan.loanNumber],
                  ['Loan status', formatStatus(data.loan.status)],
                  ['Principal', formatCurrency(data.loan.principal)],
                  ['APR', formatBps(data.loan.aprBps)],
                  ['Term', formatTerm(data.loan.termDays)],
                  ['Start date', formatDate(data.loan.startDate)],
                  ['Maturity date', formatDate(data.loan.maturityDate)],
                  ['Disbursed at', formatDateTime(data.loan.disbursedAt)],
                  ['Outstanding principal', formatCurrency(data.loan.outstandingPrincipal)],
                  ['Outstanding interest', formatCurrency(data.loan.outstandingInterest)],
                  ['Outstanding fees', formatCurrency(data.loan.outstandingFees)],
                ]} />
              </Card>
            )}

            <Card title="Borrower Communications">
              {data.communications.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No in-platform communications logged yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.communications.map((notification) => (
                    <div key={notification.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm font-semibold">{notification.subject ?? formatStatus(notification.type)}</div>
                        <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          {notification.channel} · {notification.status} · {formatDateTime(notification.sentAt ?? notification.createdAt)}
                        </div>
                      </div>
                      <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{notification.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Application Activity">
              <div className="flex flex-col gap-3">
                {data.events.map((event) => (
                  <div key={event.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-semibold">{formatStatus(event.type)}</div>
                      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {event.actor} · {formatDateTime(event.createdAt)}
                      </div>
                    </div>
                    <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{summarizePayload(event.payload)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Audit Trail">
              <div className="flex flex-col gap-3">
                {data.auditTrail.map((entry) => (
                  <div key={entry.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-semibold">{formatStatus(entry.action)}</div>
                      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {entry.actor} · {entry.actorType} · {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                    <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                      {summarizePayload(entry.after ?? entry.before)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <button
            onClick={() => router.push('/applications')}
            className="self-start text-sm font-medium"
            style={{ color: 'var(--color-muted)' }}
          >
            ← Back to applications
          </button>
        </div>
      )}
    </OpsLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Grid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      {items.map(([label, value]) => (
        <div key={label}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>{label}</div>
          <div className="font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>{title}</div>
      <ul className="list-disc list-inside flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}