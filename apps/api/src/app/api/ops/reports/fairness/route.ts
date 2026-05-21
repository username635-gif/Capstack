import { NextRequest, NextResponse } from 'next/server';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import { prisma } from '@capstack/db';
import type {
  FairnessReport,
  FairnessPeriod,
  FairnessProvinceRow,
  FairnessIncomeBandRow,
  FairnessScoreBandRow,
  FairnessAdviserRow,
  ScoreBand,
} from '@capstack/types';

const ALLOWED_ROLES = ['ADMIN', 'CREDIT_OFFICER', 'COMPLIANCE'];

const PERIOD_DAYS: Record<FairnessPeriod, number | null> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
  all: null,
};

const SCORE_BANDS: ScoreBand[] = ['A', 'B', 'C', 'D', 'E'];

const INCOME_BANDS = [
  { band: 'under_5k', label: 'Under R5k', maxCents: 5_000_00 },
  { band: '5k_15k', label: 'R5k–R15k', maxCents: 15_000_00 },
  { band: '15k_30k', label: 'R15k–R30k', maxCents: 30_000_00 },
  { band: 'over_30k', label: 'Over R30k', maxCents: Number.POSITIVE_INFINITY },
] as const;

const OVERRIDE_RATE_FLAG_THRESHOLD = 0.20;

function isPeriod(value: string): value is FairnessPeriod {
  return value === '30d' || value === '90d' || value === '12m' || value === 'all';
}

function getDateRange(period: FairnessPeriod): { from: Date; to: Date } {
  const to = new Date();
  const days = PERIOD_DAYS[period];
  if (days === null) return { from: new Date('2000-01-01'), to };
  return { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };
}

function provinceFromAddress(address: unknown): string {
  if (address && typeof address === 'object' && 'province' in address) {
    const value = (address as { province?: unknown }).province;
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return 'Unknown';
}

function bandForIncomeCents(monthlyIncomeCents: bigint | null | undefined): string {
  if (monthlyIncomeCents == null) return 'unknown';
  const cents = Number(monthlyIncomeCents);
  for (const b of INCOME_BANDS) {
    if (cents < b.maxCents) return b.band;
  }
  return INCOME_BANDS[INCOME_BANDS.length - 1].band;
}

function isDefaulted(loanStatus: string | undefined, delinquency: string | undefined): boolean {
  return loanStatus === 'DEFAULTED' || loanStatus === 'WRITTEN_OFF' || delinquency === 'NPL';
}

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, ALLOWED_ROLES);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const rawPeriod = searchParams.get('period') ?? '90d';
  const period: FairnessPeriod = isPeriod(rawPeriod) ? rawPeriod : '90d';
  const { from, to } = getDateRange(period);

  const applications = await prisma.application.findMany({
    where: { submittedAt: { gte: from, lte: to } },
    select: {
      id: true,
      status: true,
      borrower: {
        select: {
          id: true,
          individual: {
            select: { residentialAddress: true, monthlyIncome: true },
          },
          business: {
            select: { registeredAddress: true },
          },
        },
      },
      loan: {
        select: { status: true, delinquencyState: true },
      },
      decisions: {
        orderBy: { createdAt: 'desc' },
        select: {
          riskBand: true,
          pdScore: true,
          recommendation: true,
          decisionMakerId: true,
          decisionMaker: { select: { id: true, fullName: true } },
          createdAt: true,
        },
      },
    },
  });

  // ── Approval Rate by Province ───────────────────────────────────────────────
  const provinceTotals = new Map<string, { total: number; approved: number }>();
  for (const app of applications) {
    const province = provinceFromAddress(
      app.borrower?.individual?.residentialAddress ?? app.borrower?.business?.registeredAddress,
    );
    const bucket = provinceTotals.get(province) ?? { total: 0, approved: 0 };
    bucket.total++;
    if (app.status === 'APPROVED') bucket.approved++;
    provinceTotals.set(province, bucket);
  }
  const provinceRowsPre = Array.from(provinceTotals.entries()).map(([province, stats]) => ({
    province,
    totalApplications: stats.total,
    approved: stats.approved,
    approvalRate: stats.total ? stats.approved / stats.total : 0,
  }));
  const meanApproval =
    provinceRowsPre.reduce((sum, r) => sum + r.approvalRate, 0) / (provinceRowsPre.length || 1);
  const approvalRateByProvince: FairnessProvinceRow[] = provinceRowsPre.map((r) => ({
    ...r,
    deviationFromMean: r.approvalRate - meanApproval,
  }));

  // ── Approval & Default Rate by Income Band ──────────────────────────────────
  const bandTotals = new Map<string, { total: number; approved: number; defaults: number }>();
  for (const b of INCOME_BANDS) bandTotals.set(b.band, { total: 0, approved: 0, defaults: 0 });
  bandTotals.set('unknown', { total: 0, approved: 0, defaults: 0 });
  for (const app of applications) {
    const band = bandForIncomeCents(app.borrower?.individual?.monthlyIncome ?? null);
    const bucket = bandTotals.get(band)!;
    bucket.total++;
    if (app.status === 'APPROVED') bucket.approved++;
    if (isDefaulted(app.loan?.status, app.loan?.delinquencyState)) bucket.defaults++;
  }
  const labelByBand = new Map<string, string>([
    ...INCOME_BANDS.map((b) => [b.band, b.label] as [string, string]),
    ['unknown', 'Unknown'],
  ]);
  const approvalRateByIncomeBand: FairnessIncomeBandRow[] = Array.from(bandTotals.entries()).map(
    ([band, stats]) => ({
      band,
      label: labelByBand.get(band) ?? band,
      totalApplications: stats.total,
      approved: stats.approved,
      approvalRate: stats.total ? stats.approved / stats.total : 0,
      defaultRate: stats.total ? stats.defaults / stats.total : 0,
    }),
  );

  // ── AI Score Band Performance ───────────────────────────────────────────────
  const scoreTotals = new Map<
    ScoreBand,
    { count: number; approved: number; pdSum: number; pdCount: number; defaults: number }
  >();
  for (const band of SCORE_BANDS) {
    scoreTotals.set(band, { count: 0, approved: 0, pdSum: 0, pdCount: 0, defaults: 0 });
  }
  for (const app of applications) {
    const latest = app.decisions[0];
    if (!latest) continue;
    const band = latest.riskBand as ScoreBand;
    if (!SCORE_BANDS.includes(band)) continue;
    const bucket = scoreTotals.get(band)!;
    bucket.count++;
    if (app.status === 'APPROVED') bucket.approved++;
    if (typeof latest.pdScore === 'number') {
      bucket.pdSum += latest.pdScore;
      bucket.pdCount++;
    }
    if (isDefaulted(app.loan?.status, app.loan?.delinquencyState)) bucket.defaults++;
  }
  const scoreBandDistribution: FairnessScoreBandRow[] = SCORE_BANDS.map((band) => {
    const s = scoreTotals.get(band)!;
    return {
      band,
      count: s.count,
      approvalRate: s.count ? s.approved / s.count : 0,
      predictedDefaultRate: s.pdCount ? s.pdSum / s.pdCount : 0,
      actualDefaultRate: s.count ? s.defaults / s.count : 0,
    };
  });

  // ── Override Analysis by Adviser ────────────────────────────────────────────
  // Override = the final application status does not match the latest AI
  // recommendation. We attribute the override to the staff who made the
  // latest decision (CreditDecision.decisionMakerId).
  type AdviserBucket = {
    name: string;
    totalDecisions: number;
    overrideCount: number;
    overrideApproved: number;
    overrideDefaulted: number;
  };
  const adviserTotals = new Map<string, AdviserBucket>();
  for (const app of applications) {
    const latest = app.decisions[0];
    if (!latest?.decisionMakerId) continue;
    const adviserId = latest.decisionMakerId;
    const bucket = adviserTotals.get(adviserId) ?? {
      name: latest.decisionMaker?.fullName ?? adviserId,
      totalDecisions: 0,
      overrideCount: 0,
      overrideApproved: 0,
      overrideDefaulted: 0,
    };
    bucket.totalDecisions++;
    const recommended = latest.recommendation;
    const wasOverride =
      (recommended === 'APPROVE' && app.status !== 'APPROVED') ||
      (recommended === 'DECLINE' && app.status === 'APPROVED');
    if (wasOverride) {
      bucket.overrideCount++;
      if (app.status === 'APPROVED') bucket.overrideApproved++;
      if (isDefaulted(app.loan?.status, app.loan?.delinquencyState)) bucket.overrideDefaulted++;
    }
    adviserTotals.set(adviserId, bucket);
  }
  const overrideAnalysisByAdviser: FairnessAdviserRow[] = Array.from(adviserTotals.entries()).map(
    ([adviserId, b]) => {
      const overrideRate = b.totalDecisions ? b.overrideCount / b.totalDecisions : 0;
      return {
        adviserId,
        adviserName: b.name,
        totalDecisions: b.totalDecisions,
        overrideCount: b.overrideCount,
        overrideRate,
        overrideApprovalRate: b.overrideCount ? b.overrideApproved / b.overrideCount : 0,
        overrideDefaultRate: b.overrideCount ? b.overrideDefaulted / b.overrideCount : 0,
        flagged: overrideRate > OVERRIDE_RATE_FLAG_THRESHOLD,
      };
    },
  );

  const body: FairnessReport = {
    approvalRateByProvince,
    approvalRateByIncomeBand,
    scoreBandDistribution,
    overrideAnalysisByAdviser,
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
