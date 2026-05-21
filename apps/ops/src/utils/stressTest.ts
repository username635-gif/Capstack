import type { LoanItem } from '@/hooks/useLoans';

export const AFFORDABILITY_THRESHOLD = 0.35;

export type DpdBucket = '0' | '1-30' | '31-60' | '61-90' | '90+';

export const DPD_BUCKETS: DpdBucket[] = ['0', '1-30', '31-60', '61-90', '90+'];

export type StressTestInput = {
  loans: LoanItem[];
  rateBpsDelta: number;
  unemploymentIncrease: number;
  horizonMonths: number;
};

export type DpdDistributionRow = {
  bucket: DpdBucket;
  current: number;
  projected: number;
};

export type StressTestSummary = {
  activeLoanCount: number;
  totalOutstandingCents: number;
  affordabilityBreachCount: number;
  affordabilityBreachExposureCents: number;
  estimatedAdditionalDefaults: number;
  estimatedAdditionalDefaultPct: number;
  provisionIncreaseCents: number;
  dpdDistribution: DpdDistributionRow[];
  scenario: {
    rateBpsDelta: number;
    unemploymentIncrease: number;
    horizonMonths: number;
  };
};

function bucketFor(dpd: number): DpdBucket {
  if (dpd <= 0) return '0';
  if (dpd <= 30) return '1-30';
  if (dpd <= 60) return '31-60';
  if (dpd <= 90) return '61-90';
  return '90+';
}

function remainingMonths(loan: LoanItem): number {
  if (loan.maturityDate) {
    const ms = new Date(loan.maturityDate).getTime() - Date.now();
    const months = Math.ceil(ms / (1000 * 60 * 60 * 24 * 30.4375));
    if (Number.isFinite(months) && months > 0) return months;
  }
  if (loan.termDays && loan.termDays > 0) {
    return Math.max(1, Math.round(loan.termDays / 30));
  }
  return 1;
}

function newMonthlyInstalment(principalCents: number, annualRate: number, months: number): number {
  if (principalCents <= 0 || months <= 0) return 0;
  const monthly = annualRate / 12;
  if (monthly <= 0) {
    return principalCents / months;
  }
  const factor = Math.pow(1 + monthly, -months);
  const denom = 1 - factor;
  if (denom <= 0) return principalCents / months;
  return (principalCents * monthly) / denom;
}

export function runStressTest({
  loans,
  rateBpsDelta,
  unemploymentIncrease,
  horizonMonths,
}: StressTestInput): StressTestSummary {
  const currentBuckets: Record<DpdBucket, number> = { '0': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const projectedBuckets: Record<DpdBucket, number> = { '0': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

  let totalOutstandingCents = 0;
  let breachCount = 0;
  let breachExposureCents = 0;

  for (const loan of loans) {
    const outstanding = loan.outstandingTotal ?? 0;
    totalOutstandingCents += outstanding;

    const currentBucket = bucketFor(loan.daysPastDue);
    currentBuckets[currentBucket] += 1;
    projectedBuckets[currentBucket] += 1;

    const baseApr = loan.aprBps / 10000;
    const newApr = baseApr + rateBpsDelta / 10000;
    const months = remainingMonths(loan);
    const principal = loan.outstandingPrincipal ?? 0;
    const instalmentCents = newMonthlyInstalment(principal, newApr, months);

    const income = loan.borrower.monthlyIncome ?? 0;
    if (income <= 0) continue;

    const affordabilityRatio = instalmentCents / income;
    if (affordabilityRatio > AFFORDABILITY_THRESHOLD) {
      breachCount += 1;
      breachExposureCents += outstanding;

      if (currentBucket === '0') {
        const migrate = 0.4;
        projectedBuckets['0'] -= migrate;
        projectedBuckets['1-30'] += migrate;
      } else if (currentBucket === '1-30') {
        const migrate = 0.3;
        projectedBuckets['1-30'] -= migrate;
        projectedBuckets['31-60'] += migrate;
      }
    }
  }

  const adjustedBreachCount = breachCount * (1 + unemploymentIncrease * 1.5);
  const estimatedAdditionalDefaults = Math.round(adjustedBreachCount);
  const estimatedAdditionalDefaultPct =
    loans.length > 0 ? estimatedAdditionalDefaults / loans.length : 0;
  const provisionIncreaseCents = Math.round(breachExposureCents * 0.02);

  const horizonScale = horizonMonths / 12;
  const horizonAdjustedProjected = { ...currentBuckets };
  for (const bucket of DPD_BUCKETS) {
    const delta = projectedBuckets[bucket] - currentBuckets[bucket];
    horizonAdjustedProjected[bucket] = currentBuckets[bucket] + delta * horizonScale;
  }

  const dpdDistribution: DpdDistributionRow[] = DPD_BUCKETS.map((bucket) => ({
    bucket,
    current: Math.round(currentBuckets[bucket]),
    projected: Math.max(0, Math.round(horizonAdjustedProjected[bucket])),
  }));

  return {
    activeLoanCount: loans.length,
    totalOutstandingCents,
    affordabilityBreachCount: breachCount,
    affordabilityBreachExposureCents: breachExposureCents,
    estimatedAdditionalDefaults,
    estimatedAdditionalDefaultPct,
    provisionIncreaseCents,
    dpdDistribution,
    scenario: { rateBpsDelta, unemploymentIncrease, horizonMonths },
  };
}
