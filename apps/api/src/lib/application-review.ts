import {
  calculateAmortizationSchedule,
  computeAffordability,
  getAprByRiskBand,
} from '@capstack/pricing';

export const REVIEW_QUEUE_STATUSES = [
  'SUBMITTED',
  'KYC_IN_PROGRESS',
  'AWAITING_DATA',
  'UNDER_REVIEW',
  'AUTO_DECISIONED',
  'HUMAN_REVIEW',
] as const;

export type WorkflowStatus = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PENDING_DISBURSEMENT';
export type SlaStatus = 'WITHIN_SLA' | 'BREACH_SOON' | 'BREACHED';
export type AmlRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type BureauStatus = 'PULLED' | 'FAILED' | 'PENDING' | 'CONSENT_REQUIRED' | 'UNAVAILABLE';
export type ApprovalTier = 'AI_AUTO_ELIGIBLE' | 'ADVISOR_REVIEW' | 'MANAGER_SIGN_OFF';

export type ReviewEvent = {
  id?: string;
  type: string;
  actor?: string;
  createdAt: Date | string;
  payload?: unknown;
};

type SimpleDecision = {
  recommendation?: string | null;
  pdScore?: number | null;
  lgdScore?: number | null;
  expectedLoss?: number | null;
  riskBand?: string | null;
  approvedAmount?: number | null;
  approvedTermDays?: number | null;
  approvedAprBps?: number | null;
  reasonCodes?: string[] | null;
  policyExceptions?: string[] | null;
  modelVersion?: string | null;
  shapValues?: unknown;
};

type BuildAiSummaryInput = {
  amountRequestedCents: number;
  termDaysRequested: number;
  defaultAprBps?: number | null;
  amortizationMethod?: string | null;
  decision?: SimpleDecision | null;
};

type BuildAffordabilitySummaryInput = {
  monthlyIncomeCents?: number | null;
  monthlyExpensesCents?: number | null;
  monthlyObligationsCents?: number | null;
  amountRequestedCents: number;
  termDaysRequested: number;
  aprBps?: number | null;
  amortizationMethod?: string | null;
  source: 'BANK_TRANSACTIONS' | 'DECLARED_INCOME' | 'TURNOVER_FALLBACK' | 'UNAVAILABLE';
  avgMonthlyCreditsCents?: number | null;
  avgMonthlyDebitsCents?: number | null;
  bankStatementsTotal?: number;
  bankStatementsVerified?: number;
  parsedDocumentCount?: number;
  lastStatementAt?: string | null;
};

export function buildReferenceNumber(applicationId: string, externalRef?: string | null, loanNumber?: string | null) {
  return externalRef ?? loanNumber ?? `APP-${applicationId.slice(-8).toUpperCase()}`;
}

export function deriveWorkflowStatus(status: string, loanStatus?: string | null): Exclude<WorkflowStatus, 'ALL'> {
  if (loanStatus === 'PENDING_DISBURSEMENT') return 'PENDING_DISBURSEMENT';
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'REJECTED';
  return 'SUBMITTED';
}

export function getAgeHours(submittedAt: Date | string) {
  return Math.max(0, Math.floor((Date.now() - toDate(submittedAt).getTime()) / 3_600_000));
}

export function getSlaStatus(ageHours: number, workflowStatus: Exclude<WorkflowStatus, 'ALL'>): SlaStatus {
  if (workflowStatus !== 'SUBMITTED') return 'WITHIN_SLA';
  if (ageHours >= 72) return 'BREACHED';
  if (ageHours >= 24) return 'BREACH_SOON';
  return 'WITHIN_SLA';
}

export function summarizeKycStatus(statuses: string[]): string {
  if (statuses.some((status) => status === 'FAILED' || status === 'MANUAL_REVIEW')) return 'MANUAL_REVIEW';
  if (statuses.length > 0 && statuses.every((status) => status === 'PASSED')) return 'PASSED';
  if (statuses.some((status) => status === 'IN_PROGRESS' || status === 'PENDING')) return 'IN_PROGRESS';
  return statuses[0] ?? 'PENDING';
}

export function summarizeAmlRisk(alerts: Array<{ severity: string }>): AmlRisk {
  if (alerts.some((alert) => alert.severity === 'HIGH' || alert.severity === 'CRITICAL')) return 'HIGH';
  if (alerts.some((alert) => alert.severity === 'MED' || alert.severity === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

export function extractLatestAssignment(events: ReviewEvent[]) {
  const assignment = findLatestEvent(events, ['ASSIGNED']);
  const payload = asObject(assignment?.payload);
  const assignee = typeof payload?.assignee === 'string' && payload.assignee.trim()
    ? payload.assignee.trim()
    : null;

  return assignee ? {
    assignee,
    assignedAt: toDate(assignment!.createdAt).toISOString(),
    actor: assignment?.actor ?? null,
  } : null;
}

export function extractLatestFlag(events: ReviewEvent[]) {
  const flag = findLatestEvent(events, ['FLAGGED']);
  const payload = asObject(flag?.payload);
  const reason = typeof payload?.reason === 'string' && payload.reason.trim()
    ? payload.reason.trim()
    : typeof payload?.note === 'string' && payload.note.trim()
      ? payload.note.trim()
      : null;

  return flag ? {
    id: flag.id ?? `${toDate(flag.createdAt).getTime()}:${flag.actor ?? 'SYSTEM'}`,
    actor: flag.actor ?? 'SYSTEM',
    createdAt: toDate(flag.createdAt).toISOString(),
    reason,
  } : null;
}

export function extractNotes(events: ReviewEvent[]) {
  return events
    .filter((event) => event.type === 'NOTE_ADDED')
    .map((event) => {
      const payload = asObject(event.payload);
      return {
        id: event.id ?? `${toDate(event.createdAt).getTime()}:${event.actor ?? 'SYSTEM'}`,
        actor: event.actor ?? 'SYSTEM',
        createdAt: toDate(event.createdAt).toISOString(),
        note: typeof payload?.note === 'string' ? payload.note : 'Internal note added.',
      };
    });
}

export function buildBureauSummary(input: {
  eligible: boolean;
  hasConsent: boolean;
  events: ReviewEvent[];
}) {
  const completed = findLatestEvent(input.events, ['BUREAU_PULL_COMPLETED']);
  const failed = findLatestEvent(input.events, ['BUREAU_PULL_FAILED']);

  if (completed) {
    const payload = asObject(completed.payload);

    return {
      status: 'PULLED' as BureauStatus,
      lastPulledAt: toDate(completed.createdAt).toISOString(),
      provider: typeof payload?.provider === 'string' ? payload.provider : null,
      bureauScore: asNumber(payload?.bureauScore),
      defaultCount: asNumber(payload?.defaultCount),
      judgementCount: asNumber(payload?.judgementCount),
      enquiryCount: asNumber(payload?.enquiryCount),
      totalExposure: asNumber(payload?.totalExposure),
      monthlyObligations: asNumber(payload?.monthlyObligations),
      currentAccounts: Array.isArray(payload?.currentAccounts)
        ? payload.currentAccounts.filter((account): account is Record<string, unknown> => !!account && typeof account === 'object')
        : [],
      failureReason: null,
    };
  }

  if (failed) {
    const payload = asObject(failed.payload);

    return {
      status: 'FAILED' as BureauStatus,
      lastPulledAt: toDate(failed.createdAt).toISOString(),
      provider: typeof payload?.provider === 'string' ? payload.provider : null,
      bureauScore: null,
      defaultCount: null,
      judgementCount: null,
      enquiryCount: null,
      totalExposure: null,
      monthlyObligations: null,
      currentAccounts: [],
      failureReason: typeof payload?.error === 'string' ? payload.error : 'Bureau pull failed.',
    };
  }

  if (!input.eligible) {
    return {
      status: 'UNAVAILABLE' as BureauStatus,
      lastPulledAt: null,
      provider: null,
      bureauScore: null,
      defaultCount: null,
      judgementCount: null,
      enquiryCount: null,
      totalExposure: null,
      monthlyObligations: null,
      currentAccounts: [],
      failureReason: 'Bureau pull is only available for consented individual borrowers.',
    };
  }

  return {
    status: (input.hasConsent ? 'PENDING' : 'CONSENT_REQUIRED') as BureauStatus,
    lastPulledAt: null,
    provider: null,
    bureauScore: null,
    defaultCount: null,
    judgementCount: null,
    enquiryCount: null,
    totalExposure: null,
    monthlyObligations: null,
    currentAccounts: [],
    failureReason: input.hasConsent ? null : 'Borrower consent is required before a bureau enquiry.',
  };
}

export function buildAiSummary(input: BuildAiSummaryInput) {
  const riskBand = input.decision?.riskBand ?? null;
  const recommendation = input.decision?.recommendation ?? null;
  const aprBps = input.decision?.approvedAprBps
    ?? input.defaultAprBps
    ?? (riskBand ? getAprByRiskBand(riskBand) : 1800);
  const amountCents = input.decision?.approvedAmount ?? input.amountRequestedCents;
  const termDays = input.decision?.approvedTermDays ?? input.termDaysRequested;
  const periods = Math.max(1, Math.round(termDays / 30));
  const pdScore = input.decision?.pdScore ?? null;
  const estimatedInstallment = estimateInstallment(amountCents, aprBps, termDays, input.amortizationMethod, periods);

  const shapFactors = asObject(input.decision?.shapValues)
    ? Object.entries(asObject(input.decision?.shapValues) ?? {})
        .map(([key, value]) => ({ key, value: asNumber(value) }))
        .filter((entry): entry is { key: string; value: number } => entry.value !== null)
        .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
        .slice(0, 4)
        .map((entry) => `${entry.key.replace(/_/g, ' ')} (${entry.value >= 0 ? '+' : ''}${entry.value.toFixed(2)})`)
    : [];

  const topFactors = shapFactors.length > 0
    ? shapFactors
    : (input.decision?.reasonCodes ?? []).slice(0, 4);

  return {
    recommendation,
    modelVersion: input.decision?.modelVersion ?? null,
    riskBand,
    riskScore: pdScore == null ? null : Math.max(0, Math.min(1000, Math.round((1 - pdScore) * 1000))),
    confidencePct: pdScore == null || !recommendation
      ? null
      : Math.round((recommendation === 'APPROVE' ? 1 - pdScore : pdScore) * 100),
    pdScore,
    lgdScore: input.decision?.lgdScore ?? null,
    expectedLoss: input.decision?.expectedLoss ?? null,
    reasonCodes: input.decision?.reasonCodes ?? [],
    topFactors,
    policyExceptions: input.decision?.policyExceptions ?? [],
    recommendedOffer: {
      amountCents,
      termDays,
      aprBps,
      estimatedInstallmentCents: estimatedInstallment,
    },
  };
}

export function buildAffordabilitySummary(input: BuildAffordabilitySummaryInput) {
  if (!input.monthlyIncomeCents || input.monthlyIncomeCents <= 0) {
    return {
      source: 'UNAVAILABLE' as const,
      monthlyIncomeCents: null,
      monthlyExpensesCents: null,
      monthlyObligationsCents: null,
      requestedInstallmentCents: null,
      disposableIncomeCents: null,
      headroomCents: null,
      dtiPct: null,
      canAfford: null,
      ncaStatus: 'REVIEW' as const,
      avgMonthlyCreditsCents: input.avgMonthlyCreditsCents ?? null,
      avgMonthlyDebitsCents: input.avgMonthlyDebitsCents ?? null,
      bankStatementsTotal: input.bankStatementsTotal ?? 0,
      bankStatementsVerified: input.bankStatementsVerified ?? 0,
      parsedDocumentCount: input.parsedDocumentCount ?? 0,
      lastStatementAt: input.lastStatementAt ?? null,
    };
  }

  const aprBps = input.aprBps ?? 1800;
  const periods = Math.max(1, Math.round(input.termDaysRequested / 30));
  const requestedInstallmentCents = estimateInstallment(
    input.amountRequestedCents,
    aprBps,
    input.termDaysRequested,
    input.amortizationMethod,
    periods,
  );

  const monthlyExpensesCents = input.monthlyExpensesCents
    ?? input.avgMonthlyDebitsCents
    ?? Math.round(input.monthlyIncomeCents / 3);
  const monthlyObligationsCents = input.monthlyObligationsCents ?? 0;
  const totalCommitmentsCents = requestedInstallmentCents + monthlyObligationsCents;
  const affordability = computeAffordability(
    BigInt(input.monthlyIncomeCents),
    BigInt(monthlyExpensesCents),
    BigInt(totalCommitmentsCents),
  );
  const disposableIncomeCents = Number(affordability.disposable);

  return {
    source: input.source,
    monthlyIncomeCents: input.monthlyIncomeCents,
    monthlyExpensesCents,
    monthlyObligationsCents,
    requestedInstallmentCents,
    disposableIncomeCents,
    headroomCents: disposableIncomeCents - totalCommitmentsCents,
    dtiPct: affordability.dtiPct,
    canAfford: affordability.canAfford,
    ncaStatus: affordability.canAfford ? 'PASS' as const : 'FAIL' as const,
    avgMonthlyCreditsCents: input.avgMonthlyCreditsCents ?? null,
    avgMonthlyDebitsCents: input.avgMonthlyDebitsCents ?? null,
    bankStatementsTotal: input.bankStatementsTotal ?? 0,
    bankStatementsVerified: input.bankStatementsVerified ?? 0,
    parsedDocumentCount: input.parsedDocumentCount ?? 0,
    lastStatementAt: input.lastStatementAt ?? null,
  };
}

export function getApprovalTier(input: {
  amountRequestedCents: number;
  amlRisk: AmlRisk;
  kycStatus: string;
  riskBand?: string | null;
  canAfford?: boolean | null;
}): ApprovalTier {
  const needsManager = input.amountRequestedCents > 10_000_000
    || input.amlRisk === 'HIGH'
    || input.kycStatus === 'MANUAL_REVIEW'
    || input.riskBand === 'D'
    || input.riskBand === 'E'
    || input.canAfford === false;

  if (needsManager) return 'MANAGER_SIGN_OFF';
  if (input.amountRequestedCents <= 2_500_000) return 'AI_AUTO_ELIGIBLE';
  return 'ADVISOR_REVIEW';
}

function findLatestEvent(events: ReviewEvent[], types: string[]) {
  return events.find((event) => types.includes(event.type));
}

function estimateInstallment(
  amountCents: number,
  aprBps: number,
  termDays: number,
  amortizationMethod?: string | null,
  periods = Math.max(1, Math.round(termDays / 30)),
) {
  try {
    return calculateAmortizationSchedule({
      principalCents: amountCents,
      aprBps,
      termDays,
      periods,
      method: normalizeAmortizationMethod(amortizationMethod),
    }).payments[0]?.totalPayment.getCents() ?? Math.round(amountCents / periods);
  } catch {
    return Math.round(amountCents / periods);
  }
}

function normalizeAmortizationMethod(amortizationMethod?: string | null) {
  if (amortizationMethod === 'BULLET' || amortizationMethod === 'INTEREST_ONLY') {
    return amortizationMethod;
  }

  return 'EQUAL_INSTALLMENT';
}

function asObject(payload: unknown) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}