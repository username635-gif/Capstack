import { NextRequest, NextResponse } from 'next/server';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import { prisma } from '@capstack/db';

const ALLOWED_ROLES = ['ADMIN', 'CREDIT_OFFICER', 'COMPLIANCE'];

const PERIODS = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
  'all': null,
};

function getDateRange(period: string): { from: Date, to: Date } {
  const now = new Date();
  if (period === 'all' || !PERIODS[period]) {
    return { from: new Date('2000-01-01'), to: now };
  }
  const days = PERIODS[period] ?? 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to: now };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, ALLOWED_ROLES);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '90d';
  const { from, to } = getDateRange(period);

  // --- Approval Rate by Province ---
  const applications = await prisma.application.findMany({
    where: {
      submittedAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      status: true,
      borrower: {
        select: {
          id: true,
          province: true,
          incomeBand: true,
        },
      },
      aiOutput: true,
      loan: {
        select: {
          id: true,
          status: true,
          defaultedAt: true,
        },
      },
      decidedAt: true,
      decidedBy: true,
      override: true,
      overrideReason: true,
      overrideBy: true,
    },
  });

  // Province grouping
  const provinceStats: Record<string, { total: number, approved: number }> = {};
  for (const app of applications) {
    const province = app.borrower?.province || 'Unknown';
    if (!provinceStats[province]) provinceStats[province] = { total: 0, approved: 0 };
    provinceStats[province].total++;
    if (app.status === 'APPROVED') provinceStats[province].approved++;
  }
  const provinceArr = Object.entries(provinceStats).map(([province, stats]) => ({
    province,
    totalApplications: stats.total,
    approved: stats.approved,
    approvalRate: stats.total ? stats.approved / stats.total : 0,
  }));
  const meanApproval = provinceArr.reduce((sum, p) => sum + p.approvalRate, 0) / (provinceArr.length || 1);
  for (const p of provinceArr) {
    p.deviationFromMean = p.approvalRate - meanApproval;
  }

  // --- Approval Rate by Income Band ---
  const bands = [
    { band: 'under_5k', label: 'Under R5k', min: 0, max: 5000 },
    { band: '5k_15k', label: 'R5k–R15k', min: 5000, max: 15000 },
    { band: '15k_30k', label: 'R15k–R30k', min: 15000, max: 30000 },
    { band: 'over_30k', label: 'Over R30k', min: 30000, max: Infinity },
  ];
  const bandStats: Record<string, { label: string, total: number, approved: number, defaults: number }> = {};
  for (const b of bands) bandStats[b.band] = { label: b.label, total: 0, approved: 0, defaults: 0 };
  for (const app of applications) {
    const income = app.borrower?.incomeBand ?? null;
    let band = 'Unknown';
    if (typeof income === 'number') {
      if (income < 5000) band = 'under_5k';
      else if (income < 15000) band = '5k_15k';
      else if (income < 30000) band = '15k_30k';
      else band = 'over_30k';
    }
    if (!bandStats[band]) bandStats[band] = { label: band, total: 0, approved: 0, defaults: 0 };
    bandStats[band].total++;
    if (app.status === 'APPROVED') bandStats[band].approved++;
    if (app.loan?.defaultedAt) bandStats[band].defaults++;
  }
  const bandArr = Object.entries(bandStats).map(([band, stats]) => ({
    band,
    label: stats.label,
    totalApplications: stats.total,
    approved: stats.approved,
    approvalRate: stats.total ? stats.approved / stats.total : 0,
    defaultRate: stats.total ? stats.defaults / stats.total : 0,
  }));

  // --- Score Band Distribution ---
  const scoreBands = ['A', 'B', 'C', 'D', 'E'];
  const scoreStats: Record<string, { count: number, approved: number, predictedDefault: number, actualDefault: number }> = {};
  for (const band of scoreBands) scoreStats[band] = { count: 0, approved: 0, predictedDefault: 0, actualDefault: 0 };
  for (const app of applications) {
    const band = app.aiOutput?.scoreband || 'Unknown';
    if (!scoreStats[band]) scoreStats[band] = { count: 0, approved: 0, predictedDefault: 0, actualDefault: 0 };
    scoreStats[band].count++;
    if (app.status === 'APPROVED') scoreStats[band].approved++;
    if (typeof app.aiOutput?.predictedDefaultRate === 'number') scoreStats[band].predictedDefault += app.aiOutput.predictedDefaultRate;
    if (app.loan?.defaultedAt) scoreStats[band].actualDefault++;
  }
  const scoreArr = scoreBands.map(band => {
    const s = scoreStats[band];
    return {
      band: band as 'A' | 'B' | 'C' | 'D' | 'E',
      count: s.count,
      approvalRate: s.count ? s.approved / s.count : 0,
      predictedDefaultRate: s.count ? s.predictedDefault / s.count : 0,
      actualDefaultRate: s.count ? s.actualDefault / s.count : 0,
    };
  });

  // --- Override Analysis by Adviser ---
  const staff = await prisma.staff.findMany({ select: { id: true, name: true } });
  const adviserStats: Record<string, { adviserName: string, total: number, override: number, overrideApproved: number, overrideDefault: number }> = {};
  for (const s of staff) adviserStats[s.id] = { adviserName: s.name, total: 0, override: 0, overrideApproved: 0, overrideDefault: 0 };
  for (const app of applications) {
    const adviserId = app.overrideBy || app.decidedBy || 'Unknown';
    if (!adviserStats[adviserId]) adviserStats[adviserId] = { adviserName: adviserId, total: 0, override: 0, overrideApproved: 0, overrideDefault: 0 };
    adviserStats[adviserId].total++;
    if (app.override) {
      adviserStats[adviserId].override++;
      if (app.status === 'APPROVED') adviserStats[adviserId].overrideApproved++;
      if (app.loan?.defaultedAt) adviserStats[adviserId].overrideDefault++;
    }
  }
  const adviserArr = Object.entries(adviserStats).map(([adviserId, stats]) => ({
    adviserId,
    adviserName: stats.adviserName,
    totalDecisions: stats.total,
    overrideCount: stats.override,
    overrideRate: stats.total ? stats.override / stats.total : 0,
    overrideApprovalRate: stats.override ? stats.overrideApproved / stats.override : 0,
    overrideDefaultRate: stats.override ? stats.overrideDefault / stats.override : 0,
    flagged: stats.total ? (stats.override / stats.total) > 0.20 : false,
  }));

  return NextResponse.json({
    approvalRateByProvince: provinceArr,
    approvalRateByIncomeBand: bandArr,
    scoreBandDistribution: scoreArr,
    overrideAnalysisByAdviser: adviserArr,
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    generatedAt: new Date().toISOString(),
  });
}
