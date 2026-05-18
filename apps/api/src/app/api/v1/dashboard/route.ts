import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { authorizeOpsRequest } from '@/lib/ops-auth';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

const DASHBOARD_ROLES = ['ADMIN', 'UNDERWRITER', 'CREDIT_OFFICER', 'COLLECTIONS', 'COMPLIANCE', 'FINANCE', 'READONLY'];
const PORTFOLIO_STATUSES = ['ACTIVE', 'DEFAULTED', 'RESTRUCTURED', 'PENDING_DISBURSEMENT'] as const;
const DEFAULTED_STATUSES = new Set(['DEFAULTED', 'WRITTEN_OFF', 'CHARGED_OFF']);

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, DASHBOARD_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const now = new Date();
  const weeklyStart = startOfWeek(addWeeks(now, -5));
  const cohortStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [portfolioErr, portfolioLoans] = await to(
    prisma.loan.findMany({
      where: { status: { in: [...PORTFOLIO_STATUSES] } },
      select: {
        id: true,
        status: true,
        daysPastDue: true,
        principal: true,
        outstandingPrincipal: true,
        outstandingInterest: true,
        outstandingFees: true,
        startDate: true,
        disbursedAt: true,
        application: {
          select: {
            status: true,
            decisions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { recommendation: true, pdScore: true },
            },
          },
        },
      },
    }),
  );
  const [approvedErr, approvedApplications] = await to(
    prisma.application.findMany({
      where: {
        status: 'APPROVED',
        decidedAt: { gte: weeklyStart },
      },
      select: {
        id: true,
        decidedAt: true,
      },
    }),
  );
  const [disbursedErr, disbursedLoans] = await to(
    prisma.loan.findMany({
      where: {
        disbursedAt: { gte: weeklyStart },
      },
      select: {
        id: true,
        disbursedAt: true,
        principal: true,
      },
    }),
  );
  const [decisionErr, decisions] = await to(
    prisma.creditDecision.findMany({
      where: { createdAt: { gte: addMonths(now, -6) } },
      select: {
        recommendation: true,
        pdScore: true,
      },
    }),
  );

  if (portfolioErr || approvedErr || disbursedErr || decisionErr) {
    return NextResponse.json({
      error: portfolioErr?.message ?? approvedErr?.message ?? disbursedErr?.message ?? decisionErr?.message ?? 'Unable to load dashboard metrics.',
    }, { status: 500 });
  }

  const loans = portfolioLoans ?? [];
  const totalBookSizeCents = loans.reduce((sum, loan) => sum + outstandingFor(loan), 0);
  const par30ExposureCents = loans.filter((loan) => loan.daysPastDue >= 30).reduce((sum, loan) => sum + outstandingFor(loan), 0);
  const nplCount = loans.filter((loan) => loan.daysPastDue >= 90 || DEFAULTED_STATUSES.has(loan.status)).length;

  const aiApprovalRatePct = safePct(
    (decisions ?? []).filter((decision) => decision.recommendation === 'APPROVE').length,
    (decisions ?? []).length,
  );
  const avgPdPct = (decisions ?? []).length
    ? Math.round(((decisions ?? []).reduce((sum, decision) => sum + decision.pdScore, 0) / (decisions ?? []).length) * 1000) / 10
    : null;

  const alignedApprovedLoans = loans.filter((loan) => loan.application.decisions[0]?.recommendation === 'APPROVE');
  const overriddenApprovedLoans = loans.filter((loan) => {
    const recommendation = loan.application.decisions[0]?.recommendation;
    return recommendation != null && recommendation !== 'APPROVE';
  });

  const weeklyBuckets = buildWeeklyBuckets(weeklyStart, now);
  for (const application of approvedApplications ?? []) {
    if (application.decidedAt) {
      getWeeklyBucket(weeklyBuckets, application.decidedAt).approvedCount += 1;
    }
  }
  for (const loan of disbursedLoans ?? []) {
    if (loan.disbursedAt) {
      const bucket = getWeeklyBucket(weeklyBuckets, loan.disbursedAt);
      bucket.disbursedCount += 1;
      bucket.disbursedAmountCents += Number(loan.principal);
    }
  }

  const cohorts = buildMonthlyCohorts(cohortStart, now);
  for (const loan of loans.filter((item) => item.disbursedAt || item.startDate)) {
    const cohortDate = loan.disbursedAt ?? loan.startDate;
    if (cohortDate < cohortStart) continue;

    const key = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, '0')}`;
    const cohort = cohorts.find((item) => item.key === key);
    if (!cohort) continue;

    cohort.loanCount += 1;
    cohort.totalPrincipalCents += Number(loan.principal);
    if (loan.disbursedAt) {
      cohort.disbursedCount += 1;
    }
    if (loan.daysPastDue >= 30) {
      cohort.par30Count += 1;
    }
    if (loan.daysPastDue >= 90 || DEFAULTED_STATUSES.has(loan.status)) {
      cohort.nplCount += 1;
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    portfolio: {
      totalBookSizeCents,
      portfolioAtRiskPct: safePct(par30ExposureCents, totalBookSizeCents),
      nplRatePct: safePct(nplCount, loans.length),
      activeLoanCount: loans.length,
    },
    disbursementVelocity: weeklyBuckets.map((bucket) => ({
      week: bucket.label,
      approvedCount: bucket.approvedCount,
      disbursedCount: bucket.disbursedCount,
      disbursedAmountCents: bucket.disbursedAmountCents,
    })),
    aiPerformance: {
      approvalRatePct: aiApprovalRatePct,
      avgPdPct,
      aiAlignedDefaultRatePct: safePct(
        alignedApprovedLoans.filter((loan) => loan.daysPastDue >= 90 || DEFAULTED_STATUSES.has(loan.status)).length,
        alignedApprovedLoans.length,
      ),
      overrideDefaultRatePct: safePct(
        overriddenApprovedLoans.filter((loan) => loan.daysPastDue >= 90 || DEFAULTED_STATUSES.has(loan.status)).length,
        overriddenApprovedLoans.length,
      ),
      overrideApprovalRatePct: safePct(overriddenApprovedLoans.length, loans.length),
    },
    cohorts: cohorts.map((cohort) => ({
      label: cohort.label,
      loanCount: cohort.loanCount,
      disbursedCount: cohort.disbursedCount,
      totalPrincipalCents: cohort.totalPrincipalCents,
      par30Pct: safePct(cohort.par30Count, cohort.loanCount),
      nplPct: safePct(cohort.nplCount, cohort.loanCount),
    })),
  });
}

function outstandingFor(loan: { outstandingPrincipal: bigint; outstandingInterest: bigint; outstandingFees: bigint }) {
  return Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest) + Number(loan.outstandingFees);
}

function safePct(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null;
}

function addWeeks(date: Date, weeks: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + (weeks * 7));
  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + distance);
  return result;
}

function buildWeeklyBuckets(start: Date, end: Date) {
  const buckets: Array<{ start: Date; end: Date; label: string; approvedCount: number; disbursedCount: number; disbursedAmountCents: number }> = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = addWeeks(bucketStart, 1);
    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label: `${bucketStart.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}`,
      approvedCount: 0,
      disbursedCount: 0,
      disbursedAmountCents: 0,
    });
    cursor = bucketEnd;
  }
  return buckets;
}

function getWeeklyBucket<T extends { start: Date; end: Date }>(buckets: T[], date: Date) {
  return buckets.find((bucket) => date >= bucket.start && date < bucket.end) ?? buckets[buckets.length - 1];
}

function buildMonthlyCohorts(start: Date, end: Date) {
  const cohorts: Array<{ key: string; label: string; loanCount: number; disbursedCount: number; totalPrincipalCents: number; par30Count: number; nplCount: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    cohorts.push({
      key,
      label: cursor.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }),
      loanCount: 0,
      disbursedCount: 0,
      totalPrincipalCents: 0,
      par30Count: 0,
      nplCount: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return cohorts;
}