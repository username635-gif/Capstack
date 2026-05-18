import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { computeEcl } from '@capstack/ledger';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import { buildCollectionsInsight, buildCollectionsSummary } from '@/lib/collections-review';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

type ReportType =
  | 'portfolio_summary'
  | 'ncr_monthly'
  | 'fica_ctr'
  | 'fica_sar'
  | 'nca_affordability'
  | 'ifrs9_ecl';

const VALID_TYPES: ReportType[] = [
  'portfolio_summary',
  'ncr_monthly',
  'fica_ctr',
  'fica_sar',
  'nca_affordability',
  'ifrs9_ecl',
];

const REPORT_ROLES = ['ADMIN', 'COMPLIANCE', 'FINANCE', 'READONLY'];

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, REPORT_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const reportType = (searchParams.get('type') ?? 'portfolio_summary') as ReportType;
  const periodFrom = searchParams.get('from') ?? _defaultFrom();
  const periodTo = searchParams.get('to') ?? new Date().toISOString().slice(0, 10);

  if (!VALID_TYPES.includes(reportType)) {
    return NextResponse.json({
      error: 'Missing or invalid ?type parameter',
      validTypes: VALID_TYPES,
      example: '/api/v1/reports?type=portfolio_summary&from=2026-05-01&to=2026-05-31',
    }, { status: 400 });
  }

  const from = new Date(periodFrom);
  const until = new Date(periodTo);

  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  switch (reportType) {
    case 'portfolio_summary': return _portfolioSummary(from, until);
    case 'ncr_monthly': return _ncrMonthly(from, until);
    case 'fica_ctr': return _ficaCtr(from, until);
    case 'fica_sar': return _ficaSar(from, until);
    case 'nca_affordability': return _ncaAffordability(from, until);
    case 'ifrs9_ecl': return _ifrs9Ecl(from, until);
    default:
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  }
}

async function _portfolioSummary(from: Date, until: Date) {
  const [loanErr, loans] = await to(
    prisma.loan.findMany({
      where: {
        status: { in: ['ACTIVE', 'DEFAULTED', 'RESTRUCTURED', 'PENDING_DISBURSEMENT'] },
      },
      include: {
        product: { select: { name: true } },
        application: {
          include: {
            decisions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { pdScore: true },
            },
          },
        },
        collections: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    }),
  );
  const [decisionErr, decisions] = await to(
    prisma.creditDecision.findMany({
      where: { createdAt: { gte: from, lte: until } },
      select: { recommendation: true, pdScore: true, riskBand: true },
    }),
  );
  const [amlErr, amlAlerts] = await to(
    prisma.amlAlert.findMany({
      where: { createdAt: { gte: from, lte: until } },
      select: { severity: true, status: true },
    }),
  );
  const [eclErr, ecl] = await to(computeEcl());

  if (loanErr || decisionErr || amlErr || eclErr) {
    return NextResponse.json({
      error: loanErr?.message ?? decisionErr?.message ?? amlErr?.message ?? eclErr?.message ?? 'Failed to generate portfolio summary',
    }, { status: 500 });
  }

  const portfolioLoans = loans ?? [];
  const outstandingFor = (loan: { outstandingPrincipal: bigint; outstandingInterest: bigint; outstandingFees: bigint }) =>
    Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest) + Number(loan.outstandingFees);

  const totalOutstandingCents = portfolioLoans.reduce((sum, loan) => sum + outstandingFor(loan), 0);
  const loansInArrears = portfolioLoans.filter((loan) => loan.daysPastDue > 0);
  const arrearsOutstandingCents = loansInArrears.reduce((sum, loan) => sum + outstandingFor(loan), 0);
  const par30ExposureCents = portfolioLoans
    .filter((loan) => loan.daysPastDue >= 30)
    .reduce((sum, loan) => sum + outstandingFor(loan), 0);
  const par90ExposureCents = portfolioLoans
    .filter((loan) => loan.daysPastDue >= 90)
    .reduce((sum, loan) => sum + outstandingFor(loan), 0);

  const collections = buildCollectionsSummary(
    loansInArrears.map((loan) => buildCollectionsInsight({
      loanId: loan.id,
      daysPastDue: loan.daysPastDue,
      delinquencyState: loan.delinquencyState,
      outstandingPrincipalCents: Number(loan.outstandingPrincipal),
      outstandingInterestCents: Number(loan.outstandingInterest),
      outstandingFeesCents: Number(loan.outstandingFees),
      latestDecision: loan.application?.decisions[0] ?? null,
      events: loan.collections,
    })),
  );

  const riskBandCounts = (decisions ?? []).reduce<Record<string, number>>((accumulator, decision) => {
    accumulator[decision.riskBand] = (accumulator[decision.riskBand] ?? 0) + 1;
    return accumulator;
  }, {});

  const approvalCount = (decisions ?? []).filter((decision) => decision.recommendation === 'APPROVE').length;
  const avgPdPct = (decisions ?? []).length
    ? Math.round(((decisions ?? []).reduce((sum, decision) => sum + decision.pdScore, 0) / (decisions ?? []).length) * 1000) / 10
    : null;

  const productExposure = portfolioLoans.reduce<Record<string, { count: number; outstandingCents: number }>>((accumulator, loan) => {
    const key = loan.product?.name ?? 'Unknown';
    if (!accumulator[key]) {
      accumulator[key] = { count: 0, outstandingCents: 0 };
    }
    accumulator[key].count += 1;
    accumulator[key].outstandingCents += outstandingFor(loan);
    return accumulator;
  }, {});

  return NextResponse.json({
    reportType: 'Portfolio Summary',
    period: _formatPeriod(from, until),
    generatedAt: new Date().toISOString(),
    kpis: {
      activeLoans: portfolioLoans.length,
      loansInArrears: loansInArrears.length,
      totalOutstandingCents,
      arrearsOutstandingCents,
      par30Pct: _safePct(par30ExposureCents, totalOutstandingCents),
      par90Pct: _safePct(par90ExposureCents, totalOutstandingCents),
      nplCount: portfolioLoans.filter((loan) => loan.daysPastDue >= 90 || loan.delinquencyState === 'NPL').length,
      highRiskAmlAlerts: (amlAlerts ?? []).filter((alert) => alert.severity === 'HIGH').length,
      openAmlAlerts: (amlAlerts ?? []).filter((alert) => alert.status === 'OPEN').length,
      approvalRatePct: _safePct(approvalCount, (decisions ?? []).length),
      avgPdPct,
      totalEclCents: Number(ecl!.totalEcl),
    },
    collections,
    decisionSummary: {
      totalDecisions: (decisions ?? []).length,
      approvals: approvalCount,
      avgPdPct,
      riskBandCounts,
    },
    portfolioMix: [
      { bucket: 'Current', count: portfolioLoans.filter((loan) => loan.daysPastDue === 0).length, outstandingCents: portfolioLoans.filter((loan) => loan.daysPastDue === 0).reduce((sum, loan) => sum + outstandingFor(loan), 0) },
      { bucket: '1-29 DPD', count: portfolioLoans.filter((loan) => loan.daysPastDue >= 1 && loan.daysPastDue < 30).length, outstandingCents: portfolioLoans.filter((loan) => loan.daysPastDue >= 1 && loan.daysPastDue < 30).reduce((sum, loan) => sum + outstandingFor(loan), 0) },
      { bucket: '30-59 DPD', count: portfolioLoans.filter((loan) => loan.daysPastDue >= 30 && loan.daysPastDue < 60).length, outstandingCents: portfolioLoans.filter((loan) => loan.daysPastDue >= 30 && loan.daysPastDue < 60).reduce((sum, loan) => sum + outstandingFor(loan), 0) },
      { bucket: '60-89 DPD', count: portfolioLoans.filter((loan) => loan.daysPastDue >= 60 && loan.daysPastDue < 90).length, outstandingCents: portfolioLoans.filter((loan) => loan.daysPastDue >= 60 && loan.daysPastDue < 90).reduce((sum, loan) => sum + outstandingFor(loan), 0) },
      { bucket: '90+ DPD', count: portfolioLoans.filter((loan) => loan.daysPastDue >= 90).length, outstandingCents: portfolioLoans.filter((loan) => loan.daysPastDue >= 90).reduce((sum, loan) => sum + outstandingFor(loan), 0) },
    ],
    productExposure: Object.entries(productExposure).map(([product, data]) => ({
      product,
      count: data.count,
      outstandingCents: data.outstandingCents,
    })),
    filings: [
      {
        report: 'NCR Monthly Return',
        dueDate: _endOfNextMonth(until).toISOString().slice(0, 10),
        status: _deadlineStatus(_endOfNextMonth(until)),
      },
      {
        report: 'FICA CTR',
        dueDate: _addBusinessDays(until, 2).toISOString().slice(0, 10),
        status: _deadlineStatus(_addBusinessDays(until, 2)),
      },
      {
        report: 'FICA SAR',
        dueDate: _addBusinessDays(until, 3).toISOString().slice(0, 10),
        status: _deadlineStatus(_addBusinessDays(until, 3)),
      },
      {
        report: 'IFRS 9 ECL',
        dueDate: _quarterEndAfter(until).toISOString().slice(0, 10),
        status: _deadlineStatus(_quarterEndAfter(until)),
      },
    ],
  });
}

async function _ncrMonthly(from: Date, until: Date) {
  const [err, loans] = await to(
    prisma.loan.findMany({
      where: { createdAt: { gte: from, lte: until } },
      include: { product: true },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const byProduct = (loans ?? []).reduce<Record<string, { count: number; totalValue: number; aprSum: number }>>((accumulator, loan) => {
    const key = loan.product?.name ?? 'Unknown';
    if (!accumulator[key]) accumulator[key] = { count: 0, totalValue: 0, aprSum: 0 };
    accumulator[key].count += 1;
    accumulator[key].totalValue += Number(loan.principal) / 100;
    accumulator[key].aprSum += loan.aprBps / 100;
    return accumulator;
  }, {});

  const productSummary = Object.entries(byProduct).map(([product, data]) => ({
    product,
    count: data.count,
    totalValueRand: data.totalValue,
    avgAprPct: data.count ? Math.round((data.aprSum / data.count) * 100) / 100 : 0,
  }));

  const [arrearsErr, arrears] = await to(prisma.loan.count({ where: { daysPastDue: { gt: 0 } } }));
  if (arrearsErr) return NextResponse.json({ error: arrearsErr.message }, { status: 500 });

  const filingDeadline = _endOfNextMonth(until);

  return NextResponse.json({
    reportType: 'NCR Monthly Return',
    period: _formatPeriod(from, until),
    totalOriginated: (loans ?? []).length,
    totalCancelled: 0,
    accountsInArrears: arrears ?? 0,
    byProduct: productSummary,
    generatedAt: new Date().toISOString(),
    filingDeadline: filingDeadline.toISOString().slice(0, 10),
    filingStatus: _deadlineStatus(filingDeadline),
  });
}

async function _ficaCtr(from: Date, until: Date) {
  const thresholdCents = 2_499_900;
  const [err, disbursements] = await to(
    prisma.disbursement.findMany({
      where: {
        createdAt: { gte: from, lte: until },
        amount: { gte: BigInt(thresholdCents) },
      },
      include: { loan: { include: { borrower: true } } },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const entries = (disbursements ?? []).map((disbursement) => ({
    transactionId: disbursement.id,
    date: disbursement.createdAt.toISOString().slice(0, 10),
    amountRand: Number(disbursement.amount) / 100,
    loanId: disbursement.loanId,
    borrowerId: disbursement.loan.borrowerId,
    rail: disbursement.rail,
    filedWithFic: false,
  }));

  const filingDeadline = _addBusinessDays(until, 2);

  return NextResponse.json({
    reportType: 'FICA Cash Threshold Report (CTR)',
    period: _formatPeriod(from, until),
    thresholdRand: thresholdCents / 100,
    totalEntries: entries.length,
    totalValueRand: entries.reduce((sum, entry) => sum + entry.amountRand, 0),
    entries,
    filingDeadline: filingDeadline.toISOString().slice(0, 10),
    filingStatus: _deadlineStatus(filingDeadline),
    generatedAt: new Date().toISOString(),
  });
}

async function _ficaSar(from: Date, until: Date) {
  const [err, alerts] = await to(
    prisma.amlAlert.findMany({
      where: { createdAt: { gte: from, lte: until } },
      orderBy: { createdAt: 'desc' },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const filingDeadline = _addBusinessDays(until, 3);

  return NextResponse.json({
    reportType: 'FICA Suspicious Activity Reports (SAR)',
    period: _formatPeriod(from, until),
    totalAlerts: (alerts ?? []).length,
    highRiskAlerts: (alerts ?? []).filter((alert) => alert.severity === 'HIGH').length,
    openAlerts: (alerts ?? []).filter((alert) => alert.status === 'OPEN').length,
    alerts: (alerts ?? []).map((alert) => ({
      alertId: alert.id,
      borrowerId: alert.borrowerId,
      alertType: alert.type,
      riskLevel: alert.severity,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
      filed: alert.filedSar,
    })),
    filingDeadline: filingDeadline.toISOString().slice(0, 10),
    filingStatus: _deadlineStatus(filingDeadline),
    generatedAt: new Date().toISOString(),
  });
}

async function _ncaAffordability(from: Date, until: Date) {
  const [err, decisions] = await to(
    prisma.creditDecision.findMany({
      where: { createdAt: { gte: from, lte: until } },
      include: {
        application: {
          include: {
            product: true,
            borrower: {
              include: {
                individual: true,
                business: true,
              },
            },
          },
        },
      },
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const all = decisions ?? [];
  const approved = all.filter((decision) => decision.recommendation === 'APPROVE');
  const declined = all.filter((decision) => decision.recommendation === 'DECLINE');
  const avgPdPct = all.length
    ? Math.round((all.reduce((sum, decision) => sum + decision.pdScore, 0) / all.length) * 1000) / 10
    : null;

  const declaredIncomeSamples = all
    .map((decision) => decision.application.borrower.individual?.monthlyIncome ?? decision.application.borrower.business?.monthlyTurnover ?? null)
    .filter((value): value is bigint => value !== null)
    .map((value) => Number(value) / 100);

  const declineReasons = declined
    .flatMap((decision) => decision.reasonCodes)
    .reduce<Record<string, number>>((accumulator, reason) => {
      accumulator[reason] = (accumulator[reason] ?? 0) + 1;
      return accumulator;
    }, {});

  const byProduct = all.reduce<Record<string, { count: number; approved: number; pdSum: number }>>((accumulator, decision) => {
    const key = decision.application.product.name;
    if (!accumulator[key]) {
      accumulator[key] = { count: 0, approved: 0, pdSum: 0 };
    }
    accumulator[key].count += 1;
    accumulator[key].approved += decision.recommendation === 'APPROVE' ? 1 : 0;
    accumulator[key].pdSum += decision.pdScore;
    return accumulator;
  }, {});

  return NextResponse.json({
    reportType: 'NCA Affordability Assessment Summary',
    period: _formatPeriod(from, until),
    totalDecisions: all.length,
    approved: approved.length,
    declined: declined.length,
    approvalRatePct: _safePct(approved.length, all.length),
    avgPdPct,
    avgDeclaredIncomeRand: declaredIncomeSamples.length
      ? Math.round((declaredIncomeSamples.reduce((sum, value) => sum + value, 0) / declaredIncomeSamples.length) * 100) / 100
      : null,
    declineReasons: Object.entries(declineReasons)
      .sort((left, right) => right[1] - left[1])
      .map(([reason, count]) => ({ reason, count })),
    byProduct: Object.entries(byProduct).map(([product, data]) => ({
      product,
      count: data.count,
      approvalRatePct: _safePct(data.approved, data.count),
      avgPdPct: data.count ? Math.round((data.pdSum / data.count) * 1000) / 10 : null,
    })),
    generatedAt: new Date().toISOString(),
    note: 'Affordability remains tied to declared income and underwriting PD until live bank-income normalization is wired across all products.',
  });
}

async function _ifrs9Ecl(from: Date, until: Date) {
  const [eclErr, ecl] = await to(computeEcl());
  const [loanErr, loans] = await to(
    prisma.loan.findMany({
      where: {
        createdAt: { lte: until },
        status: { in: ['ACTIVE', 'DEFAULTED', 'RESTRUCTURED', 'PENDING_DISBURSEMENT'] },
      },
      select: {
        daysPastDue: true,
      },
    }),
  );

  if (eclErr || loanErr) {
    return NextResponse.json({ error: eclErr?.message ?? loanErr?.message ?? 'Failed to generate IFRS 9 snapshot' }, { status: 500 });
  }

  const stageCounts = {
    stage1: (loans ?? []).filter((loan) => loan.daysPastDue === 0).length,
    stage2: (loans ?? []).filter((loan) => loan.daysPastDue > 0 && loan.daysPastDue < 90).length,
    stage3: (loans ?? []).filter((loan) => loan.daysPastDue >= 90).length,
  };

  return NextResponse.json({
    reportType: 'IFRS 9 Expected Credit Loss (ECL) Snapshot',
    period: _formatPeriod(from, until),
    generatedAt: new Date().toISOString(),
    ecl: {
      totalEcl: Number(ecl!.totalEcl),
      loanCount: ecl!.loanCount,
      stage1Ecl: Number(ecl!.stage1Ecl),
      stage2Ecl: Number(ecl!.stage2Ecl),
      stage3Ecl: Number(ecl!.stage3Ecl),
    },
    stageCounts,
    note: 'IFRS 9 ECL = PD × LGD × EAD. LGD remains fixed at 50% until recoveries are calibrated from production data.',
  });
}

function _defaultFrom(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function _formatPeriod(from: Date, until: Date) {
  return {
    from: from.toISOString().slice(0, 10),
    to: until.toISOString().slice(0, 10),
  };
}

function _safePct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null;
}

function _addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }
  return result;
}

function _endOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 2, 0);
}

function _quarterEndAfter(date: Date): Date {
  const quarterEndMonth = Math.floor(date.getMonth() / 3) * 3 + 3;
  return new Date(date.getFullYear(), quarterEndMonth, 0);
}

function _deadlineStatus(deadline: Date): 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' {
  const today = new Date();
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 7) return 'DUE_SOON';
  return 'ON_TRACK';
}